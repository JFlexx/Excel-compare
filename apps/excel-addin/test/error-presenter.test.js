import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportGuard,
  createUserErrorView,
} from '../src/error-presenter.js';

test('presenta un error entendible cuando el archivo queda fuera del piloto', () => {
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
  assert.equal(view.telemetry.technicalDetails.diagnostics.hasMacros, true);
});

test('bloquea la exportación cuando quedan conflictos críticos pendientes', () => {
  const guard = buildExportGuard({ sessionId: 'session-export', criticalConflictsPending: 2, totalPending: 5 });

  assert.equal(guard.title, 'La exportación está bloqueada');
  assert.equal(guard.canContinue, false);
  assert.equal(guard.actionLabel, 'Revisar conflictos críticos');
  assert.equal(guard.telemetry.supportContext.pendingConflictCount, 2);
});

test('bloquea la exportación cuando quedan pendientes no críticos', () => {
  const guard = buildExportGuard({ sessionId: 'session-export', criticalConflictsPending: 0, totalPending: 1 });

  assert.equal(guard.title, 'Debes resolver los pendientes antes de exportar');
  assert.equal(guard.canContinue, false);
  assert.equal(guard.actionLabel, 'Resolver pendientes');
  assert.equal(guard.telemetry.supportContext.pendingConflictCount, 1);
});

test('supervisa sesiones inválidas antes de permitir exportar', () => {
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

test('permite exportar cuando ya no quedan decisiones pendientes', () => {
  const guard = buildExportGuard({ sessionId: 'session-ready', criticalConflictsPending: 0, totalPending: 0 });

  assert.equal(guard.title, 'Listo para exportar');
  assert.equal(guard.canContinue, true);
  assert.equal(guard.telemetry, null);
});
