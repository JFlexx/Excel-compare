import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportGuard,
  createUserErrorView,
  recordAddinError,
} from '../src/error-presenter.js';

test('createUserErrorView turns unsupported formulas into requires-attention copy without raw technical text', () => {
  const view = createUserErrorView({
    code: 'UNINTERPRETABLE_FORMULAS',
    context: {
      sessionId: 'session-12345678',
      operation: 'analyze-formulas',
      diagnostics: { parser: 'excel-formula-v2', token: '#REF!' },
      userHint: 'Stack trace in parser.ts',
    },
  });

  assert.equal(view.title, 'Hay fórmulas que requieren atención');
  assert.equal(view.severityLabel, 'Requiere atención');
  assert.match(view.message, /fórmulas no soportadas o ambiguas/i);
  assert.equal(view.actionLabel, 'Revisar fórmulas');
  assert.ok(!/parser\.ts/i.test(view.message));
  assert.match(view.supportHint, /SUP-UNINTERPRETABLE_FORMULAS-12345678/);
  assert.equal(view.telemetry.technicalDetails.diagnostics.parser, 'excel-formula-v2');
});

test('createUserErrorView exposes visible operational limits for oversized workbooks', () => {
  const view = createUserErrorView({
    code: 'WORKBOOK_TOO_LARGE',
    context: {
      sessionId: 'session-oversize',
      limits: { maxSheets: 25, maxUsedCells: 200000, maxFileSizeMb: 25 },
      metrics: { sheetCount: 32, usedCells: 240000, fileSizeMb: 31 },
      operation: 'validate-limits',
    },
  });

  assert.equal(view.severityLabel, 'Bloqueado');
  assert.equal(view.actionLabel, 'Ver límites operativos');
  assert.equal(view.visibleOperationalLimits.standard.length, 4);
  assert.match(view.visibleOperationalLimits.scope[2], /fuera de alcance inicial/i);
  assert.equal(view.telemetry.supportContext.metrics.sheetCount, 32);
});

test('buildExportGuard blocks export while critical conflicts remain', () => {
  const guard = buildExportGuard({ sessionId: 'session-export', criticalConflictsPending: 2, totalPending: 5 });

  assert.equal(guard.title, 'La exportación está bloqueada');
  assert.equal(guard.canContinue, false);
  assert.equal(guard.actionLabel, 'Revisar conflictos críticos');
  assert.equal(guard.telemetry.supportContext.pendingConflictCount, 2);
});

test('buildExportGuard surfaces invalid sessions before export', () => {
  const guard = buildExportGuard({
    sessionId: 'session-bad-01',
    sessionInvalid: true,
    sessionStatus: 'invalid',
    invalidReason: 'preview missing after conflict resolution',
  });

  assert.equal(guard.title, 'La sesión requiere reiniciarse');
  assert.equal(guard.severityLabel, 'Bloqueado');
  assert.equal(guard.actionLabel, 'Reiniciar comparación');
  assert.match(guard.telemetry.supportContext.invalidReason, /preview missing/i);
});

test('buildExportGuard allows export when no critical conflicts remain', () => {
  const guard = buildExportGuard({ criticalConflictsPending: 0, totalPending: 1 });

  assert.equal(guard.title, 'Listo para exportar');
  assert.equal(guard.canContinue, true);
  assert.equal(guard.telemetry, null);
});

test('recordAddinError emits minimal telemetry payload for support', () => {
  const events = [];
  const logger = { error: (payload) => events.push(payload) };
  const view = createUserErrorView({
    code: 'WORKBOOK_TOO_LARGE',
    context: {
      sessionId: 'session-telemetry',
      limits: { maxSheets: 25, maxUsedCells: 200000 },
      metrics: { sheetCount: 32, usedCells: 120000 },
      operation: 'validate-limits',
    },
  });

  const payload = recordAddinError(logger, view);
  assert.equal(events.length, 1);
  assert.equal(payload.code, 'WORKBOOK_TOO_LARGE');
  assert.equal(payload.supportContext.metrics.sheetCount, 32);
  assert.match(payload.supportReference, /SUP-WORKBOOK_TOO_LARGE/);
  assert.ok(payload.presentedAt);
});
