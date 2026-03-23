const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildError,
  inferErrorCode,
  logEngineError,
  normalizeEngineError,
} = require('../src/error-catalog');

test('buildError returns user-safe messaging and technical details for corrupt files', () => {
  const cause = new Error('ZipException: CRC mismatch in xl/workbook.xml');
  const error = buildError(
    'CORRUPT_FILE',
    {
      sessionId: 'ms_001',
      fileName: 'ventas.xlsx',
      operation: 'parse-upload',
    },
    cause,
  );

  assert.equal(error.userTitle, 'No pudimos abrir el archivo');
  assert.match(error.userMessage, /dañado/i);
  assert.equal(error.supportContext.fileName, 'ventas.xlsx');
  assert.match(error.technicalDetails.rawMessage, /CRC mismatch/);
});

test('inferErrorCode maps representative failure reasons to requested categories', () => {
  assert.equal(inferErrorCode({ message: 'unsupported xlsb workbook' }), 'UNSUPPORTED_FORMAT');
  assert.equal(inferErrorCode({ message: 'worksheet payload unreadable after parse' }), 'UNREADABLE_SHEET');
  assert.equal(inferErrorCode({ message: 'formula parser failed on #REF!' }), 'UNINTERPRETABLE_FORMULAS');
  assert.equal(inferErrorCode({ message: 'max cells limit exceeded, workbook too large' }), 'WORKBOOK_TOO_LARGE');
  assert.equal(inferErrorCode({ message: 'export blocked by critical conflicts' }), 'CRITICAL_CONFLICTS_PENDING_EXPORT');
});

test('normalizeEngineError preserves internal diagnostics for support', () => {
  const normalized = normalizeEngineError({
    message: 'worksheet payload unreadable after parse',
    context: {
      sessionId: 'ms_002',
      worksheetName: 'Resumen',
      diagnostics: { parserVersion: '1.0.0', offset: 128 },
      operation: 'analyze-sheet',
    },
  });

  assert.equal(normalized.code, 'UNREADABLE_SHEET');
  assert.equal(normalized.supportContext.worksheetName, 'Resumen');
  assert.deepEqual(normalized.technicalDetails.diagnostics, { parserVersion: '1.0.0', offset: 128 });
});

test('logEngineError emits structured payload', () => {
  const events = [];
  const logger = { error: (payload) => events.push(payload) };
  const engineError = normalizeEngineError({
    code: 'CRITICAL_CONFLICTS_PENDING_EXPORT',
    context: { pendingConflictCount: 3, operation: 'export-result' },
  });

  const payload = logEngineError(logger, engineError);
  assert.equal(events.length, 1);
  assert.equal(payload.code, 'CRITICAL_CONFLICTS_PENDING_EXPORT');
  assert.equal(payload.supportContext.pendingConflictCount, 3);
});
