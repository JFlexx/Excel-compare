import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSessionFromWorkbookPayload, exportSessionToWorkbook } from './src/server-session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 80 * 1024 * 1024;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const defaultFiles = new Set(['/', '/index.html']);

function resolveRequestPath(urlPath) {
  const normalizedPath = defaultFiles.has(urlPath) ? '/index.html' : urlPath;
  const safeRelativePath = path.normalize(normalizedPath).replace(/^([.][.][/\\])+/, '');
  return path.join(rootDir, safeRelativePath);
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('El payload excede el límite permitido.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(raw);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, error) {
  const statusCode = error?.statusCode ?? 500;
  sendJson(response, statusCode, {
    error: error?.message ?? 'Unexpected server error',
  });
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  try {
    if (request.method === 'POST' && requestUrl.pathname === '/api/compare') {
      const body = await readJsonBody(request);
      const session = createSessionFromWorkbookPayload(body);
      sendJson(response, 200, { session });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/export') {
      const body = await readJsonBody(request);
      const artifacts = exportSessionToWorkbook(body.session);
      response.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${artifacts.fileName}"`,
        'X-Excel-Compare-FileName': encodeURIComponent(artifacts.fileName),
      });
      response.end(artifacts.binary);
      return;
    }

    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    const filePath = resolveRequestPath(requestUrl.pathname);
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Directory listing disabled');
      return;
    }

    const extension = path.extname(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: 'El payload JSON no es válido.' });
      return;
    }

    sendError(response, error);
  }
});

server.listen(port, () => {
  console.log(`Excel task pane disponible en http://localhost:${port}/index.html`);
});
