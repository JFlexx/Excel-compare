import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConflictDetailPanelModel, reduceSessionState, saveManualEditFromPanel } from '../src/detail-panel.js';

function buildSession() {
  return {
    sessionId: 'session-1',
    status: 'ready',
    conflicts: [
      {
        id: 'conflict:sheet1:B4',
        cellRef: 'cell:sheet1:B4',
        location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
        changeType: 'conflict',
        sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
        sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
        userDecision: 'unresolved',
        finalState: 'pending',
      },
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
  };
}

test('detail panel exposes editable field and inline validation', () => {
  const invalidModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet1:B4', 'abc');
  assert.equal(invalidModel.editableField.label, 'Valor final');
  assert.equal(invalidModel.editableField.expectedType, 'number');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /número válido/i);

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet1:B4', '1450');
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.actions.saveManualEdit.userDecision, 'manual_edit');
  assert.equal(validModel.preview.value, '1450');
  assert.equal(validModel.preview.origin, 'manual_edit');
});

test('saving manual edit updates session preview state with manual_edit origin', () => {
  const session = buildSession();
  const action = saveManualEditFromPanel(session, {
    conflictId: 'conflict:sheet1:B4',
    rawValue: '1550',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:15:00Z',
  });

  const updated = reduceSessionState(session, action);
  assert.equal(updated.conflicts[0].userDecision, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:B4'].origin, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:B4'].displayValue, '1550');
  assert.equal(updated.mergeDecisions[0].manualEdit.type, 'number');
  assert.equal(updated.status, 'attention_required');
});

test('invalid session state is rejected before mutating the session', () => {
  const brokenSession = {
    sessionId: 'session-bad',
    status: 'ready',
    conflicts: [],
    mergeDecisions: [],
  };

  assert.throws(
    () => buildConflictDetailPanelModel(brokenSession, 'conflict:sheet1:B4', '100'),
    (error) => error.code === 'INVALID_SESSION_STATE' && /resultPreview missing/i.test(error.message),
  );
  assert.deepEqual(brokenSession, {
    sessionId: 'session-bad',
    status: 'ready',
    conflicts: [],
    mergeDecisions: [],
  });
});

test('reduceSessionState rejects malformed actions instead of leaving a silent corruption', () => {
  const session = buildSession();

  assert.throws(
    () => reduceSessionState(session, { type: 'SAVE_MANUAL_EDIT', payload: { targetId: 'cell:sheet1:B4' } }),
    (error) => error.code === 'INVALID_SESSION_STATE' && /payload incomplete/i.test(error.message),
  );
  assert.equal(session.mergeDecisions.length, 0);
  assert.deepEqual(session.resultPreview.cells, {});
});
