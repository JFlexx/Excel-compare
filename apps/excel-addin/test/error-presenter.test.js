import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportGuard,
  createUserErrorView,
  recordAddinError,
} from '../src/error-presenter.js';

test('createUserErrorView turns engine errors into user-facing copy without raw technical text', () => {
  const view = createUserErrorView({
    code: 'UNINTERPRETABLE_FORMULAS',
    context: {
      operation: 'analyze-formulas',
      diagnostics: { parser: 'excel-formula-v2', token: '#REF!' },
      userHint: 'Stack trace in parser.ts',
    },
  });

  assert.equal(view.title, 'Hay fórmulas que necesitan revisión');
  assert.match(view.message, /no puede interpretar con seguridad/i);
  assert.ok(!/parser\.ts/i.test(view.message));
  assert.equal(view.telemetry.technicalDetails.diagnostics.parser, 'excel-formula-v2');
});

test('createUserErrorView exposes pilot-scope copy for unsupported features', () => {
  const view = createUserErrorView({
    code: 'UNSUPPORTED_PILOT_FEATURES',
    context: {
      operation: 'validate-pilot-scope',
      diagnostics: { hasMacros: true, hasPivotTables: true },
    },
  });

  assert.equal(view.title, 'Este archivo queda fuera del piloto');
  assert.match(view.message, /macros/i);
  assert.equal(view.actionLabel, 'Ver alcance del piloto');
  assert.equal(view.canContinue, false);
});

test('buildExportGuard blocks export while critical conflicts remain', () => {
  const guard = buildExportGuard({ criticalConflictsPending: 2, totalPending: 5 });

  assert.equal(guard.title, 'Todavía no puedes exportar');
  assert.equal(guard.canContinue, false);
  assert.equal(guard.actionLabel, 'Revisar conflictos críticos');
  assert.equal(guard.telemetry.supportContext.pendingConflictCount, 2);
});

test('buildExportGuard allows export when no critical conflicts remain', () => {
  const guard = buildExportGuard({ criticalConflictsPending: 0, totalPending: 1 });

  assert.equal(guard.title, 'Listo para exportar');
  assert.equal(guard.canContinue, true);
  assert.equal(guard.telemetry, null);
});

test('recordAddinError emits telemetry payload for support', () => {
  const events = [];
  const logger = { error: (payload) => events.push(payload) };
  const view = createUserErrorView({
    code: 'WORKBOOK_TOO_LARGE',
    context: {
      limits: { maxSheets: 20, maxUsedCells: 50000 },
      metrics: { sheetCount: 32, usedCells: 120000 },
      operation: 'validate-limits',
    },
  });

  const payload = recordAddinError(logger, view);
  assert.equal(events.length, 1);
  assert.equal(payload.telemetry.code, 'WORKBOOK_TOO_LARGE');
  assert.equal(payload.telemetry.supportContext.metrics.sheetCount, 32);
});
