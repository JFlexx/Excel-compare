import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyBlockResolution,
  buildInitialMergeSession,
  buildResumeDescriptor,
  recordConflictResolution,
  saveManualEditCheckpoint,
  validatePersistedSession,
} from '../src/session-persistence.js';

const files = [
  {
    side: 'left',
    label: 'Libro izquierdo',
    role: 'Referencia original',
    fileName: 'Ventas_Q1_Base.xlsx',
    updatedAt: '18 mar 2026 · 09:14',
    sheets: ['Resumen', 'Clientes', 'Forecast'],
    size: '1,8 MB',
  },
  {
    side: 'right',
    label: 'Libro derecho',
    role: 'Versión con cambios detectados',
    fileName: 'Ventas_Q1_Actualizado.xlsx',
    updatedAt: '21 mar 2026 · 16:42',
    sheets: ['Resumen', 'Clientes', 'Forecast'],
    size: '1,9 MB',
  },
];

const conflicts = [
  {
    id: 'conf-1',
    sheet: 'Clientes',
    cell: 'D18',
    type: 'Valor distinto',
    leftValue: 'Activo',
    rightValue: 'Inactivo',
    status: 'pending',
    resolution: null,
    description: 'Cambio en el estado operativo del cliente 1042.',
  },
  {
    id: 'conf-2',
    sheet: 'Clientes',
    cell: 'F22',
    type: 'Monto actualizado',
    leftValue: 12500,
    rightValue: 13250,
    status: 'pending',
    resolution: null,
    description: 'Ajuste del importe comprometido para el mes actual.',
  },
  {
    id: 'conf-3',
    sheet: 'Forecast',
    cell: 'B7',
    type: 'Fórmula modificada',
    leftValue: '=SUM(B2:B6)',
    rightValue: '=SUM(B2:B6)-B4',
    status: 'pending',
    resolution: null,
    description: 'La fórmula excluye una línea intermedia en la proyección.',
  },
];

function actor() {
  return { userId: 'user:ana', displayName: 'Ana', origin: 'office-addin' };
}

test('buildInitialMergeSession stores mergeSession with workbook checksums ready for resume validation', () => {
  const session = buildInitialMergeSession(files, conflicts, '2026-03-23T10:30:00Z');

  assert.match(session.sessionId, /^ms_/);
  assert.equal(session.workbookDiff.nodeType, 'WorkbookDiff');
  assert.equal(session.worksheetDiffs.length, 2);
  assert.equal(session.checkpoints[0].type, 'session_initialized');
  assert.ok(session.sourceA.checksum);
  assert.ok(session.sourceB.checksum);

  const validation = validatePersistedSession({ version: 1, savedAt: session.updatedAt, session }, files, '2026-03-23T10:31:00Z');
  assert.equal(validation.status, 'resumable');
});

test('recordConflictResolution appends merge decision, history and checkpoint', () => {
  const session = buildInitialMergeSession(files, conflicts, '2026-03-23T10:30:00Z');
  const updated = recordConflictResolution(session, {
    conflictId: 'conf-1',
    resolution: 'right',
    actor: actor(),
    occurredAt: '2026-03-23T10:35:00Z',
  });

  assert.equal(updated.conflicts[0].userDecision, 'take_b');
  assert.equal(updated.conflicts[0].finalState, 'accepted_b');
  assert.equal(updated.mergeDecisions.at(-1).history[0].decision, 'take_b');
  assert.equal(updated.resultPreview.cells[updated.conflicts[0].cellRef].origin, 'source_b');
  assert.equal(updated.checkpoints.at(-1).type, 'conflict_resolved');
});

test('applyBlockResolution resolves all pending conflicts in a sheet and records block checkpoint', () => {
  const session = buildInitialMergeSession(files, conflicts, '2026-03-23T10:30:00Z');
  const updated = applyBlockResolution(session, {
    worksheetName: 'Clientes',
    resolution: 'left',
    actor: actor(),
    occurredAt: '2026-03-23T10:40:00Z',
  });

  const customerConflicts = updated.conflicts.filter((conflict) => conflict.location.worksheetName === 'Clientes');
  assert.ok(customerConflicts.every((conflict) => conflict.userDecision === 'take_a'));
  assert.equal(updated.checkpoints.at(-1).type, 'block_applied');
  assert.deepEqual(updated.checkpoints.at(-1).affectedConflictIds, ['conf-1', 'conf-2']);
});

test('saveManualEditCheckpoint stores manual edit and resume descriptor exposes progress', () => {
  const session = buildInitialMergeSession(files, conflicts, '2026-03-23T10:30:00Z');
  const updated = saveManualEditCheckpoint(session, {
    conflictId: 'conf-2',
    rawValue: '1550',
    actor: actor(),
    occurredAt: '2026-03-23T10:45:00Z',
  });

  assert.equal(updated.conflicts.find((conflict) => conflict.id === 'conf-2').userDecision, 'manual_edit');
  assert.equal(updated.mergeDecisions.at(-1).manualEdit.displayValue, '1550');
  assert.equal(updated.checkpoints.at(-1).type, 'manual_edit_saved');

  const descriptor = buildResumeDescriptor({ version: 1, savedAt: updated.updatedAt, session: updated }, files, '2026-03-23T10:46:00Z');
  assert.equal(descriptor.status, 'resumable');
  assert.equal(descriptor.progress.resolved, 1);
});

test('validatePersistedSession rejects mismatched workbook metadata', () => {
  const session = buildInitialMergeSession(files, conflicts, '2026-03-23T10:30:00Z');
  const modifiedFiles = [{ ...files[0], size: '9,9 MB' }, files[1]];
  const validation = validatePersistedSession({ version: 1, savedAt: session.updatedAt, session }, modifiedFiles, '2026-03-23T10:50:00Z');

  assert.equal(validation.status, 'invalid');
  assert.match(validation.reason, /no coinciden/i);
});
