import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const defaultFiles = new Set(['/','/index.html']);

function resolveRequestPath(urlPath) {
  const normalizedPath = defaultFiles.has(urlPath) ? '/index.html' : urlPath;
  const safeRelativePath = path.normalize(normalizedPath).replace(/^([.][.][/\\])+/, '');
  return path.join(rootDir, safeRelativePath);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
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
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Excel task pane disponible en http://localhost:${port}/index.html`);
});
