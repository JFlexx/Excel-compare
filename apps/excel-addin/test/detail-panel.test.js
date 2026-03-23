import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConflictDetailPanelModel,
  createDecisionActionFromPanel,
  reduceSessionState,
  saveManualEditFromPanel,
} from '../src/detail-panel.js';

function buildNumberSession() {
  return {
    sessionId: 'session-1',
    status: 'ready',
    conflicts: [
      {
        id: 'conflict:cell:sheet1:0:B4',
        scopeType: 'cell',
        cellRef: 'cell:sheet1:0:B4',
        cellRefs: ['cell:sheet1:0:B4', 'cell:sheet1:0:C4'],
        location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4:C4' },
        changeType: 'conflict',
        sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
        sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
        userDecision: 'unresolved',
        finalState: 'unresolved',
        reason: 'Mismatch',
      },
    ],
    worksheetDiffs: [
      {
        id: 'wsd:sheet1:0',
        location: { worksheetName: 'Summary', sheetIndex: 0, rangeA1: 'Summary!A1:XFD1048576' },
        cellDiffs: [
          {
            id: 'cell:sheet1:0:B4',
            location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
            changeType: 'conflict',
            sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
            sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
            userDecision: 'unresolved',
            finalState: 'unresolved',
          },
          {
            id: 'cell:sheet1:0:C4',
            location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 3, a1: 'C4', rangeA1: 'C4' },
            changeType: 'conflict',
            sourceA: { value: 200, displayValue: '200', type: 'number', exists: true },
            sourceB: { value: 300, displayValue: '300', type: 'number', exists: true },
            userDecision: 'unresolved',
            finalState: 'unresolved',
          },
        ],
        conflicts: [],
      },
        finalState: 'pending',
      },
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
  };
}

function buildFormulaSession() {
  return {
    sessionId: 'session-2',
    conflicts: [
      {
        id: 'conflict:sheet2:C8',
        cellRef: 'cell:sheet2:C8',
        location: { worksheetName: 'Forecast', sheetIndex: 1, row: 8, column: 3, a1: 'C8', rangeA1: 'C8' },
        changeType: 'conflict',
        sourceA: { value: '=SUM(C2:C7)', displayValue: '=SUM(C2:C7)', type: 'formula', exists: true },
        sourceB: { value: '=SUM(C2:C7)-C4', displayValue: '=SUM(C2:C7)-C4', type: 'formula', exists: true },
        userDecision: 'unresolved',
        finalState: 'pending'
      }
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
    summary: { totalConflicts: 1, resolvedConflictCount: 0, unresolvedConflictCount: 1, pendingConflicts: [] },
  };
}

test('detail panel exposes canonical actions and inline validation', () => {
  const invalidModel = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4', 'abc');
test('detail panel exposes editable field and inline validation for value changes in pilot scope', () => {
  const invalidModel = buildConflictDetailPanelModel(buildNumberSession(), 'conflict:sheet1:B4', 'abc');
  assert.equal(invalidModel.editableField.label, 'Valor final');
  assert.equal(invalidModel.editableField.placeholder, 'Escribe el valor final manual (solo valor o fórmula simple)');
  assert.equal(invalidModel.editableField.expectedType, 'number');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /número válido/i);
  assert.equal(invalidModel.actions.acceptLeft.decisionType, 'accept_left');
  assert.equal(invalidModel.actions.acceptRightBlock.scopeType, 'block');

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4', '1450');
  const validModel = buildConflictDetailPanelModel(buildNumberSession(), 'conflict:sheet1:B4', '1450');
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.actions.saveManualEdit.decisionType, 'manual_edit');
  assert.equal(validModel.preview.value, '1450');
  assert.equal(validModel.preview.origin, 'manual_edit');
});

test('saving manual edit updates the full session state and preview', () => {
  const session = buildSession();
test('detail panel validates simple formulas before saving manual edits', () => {
  const invalidModel = buildConflictDetailPanelModel(buildFormulaSession(), 'conflict:sheet2:C8', 'SUM(C2:C7)');
  assert.equal(invalidModel.editableField.expectedType, 'formula');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /deben empezar por '='|empezar por '='/i);

  const validModel = buildConflictDetailPanelModel(buildFormulaSession(), 'conflict:sheet2:C8', '=SUM(C2:C7)-C5');
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.preview.value, '=SUM(C2:C7)-C5');
});

test('saving manual edit updates session preview state with manual_edit origin', () => {
  const session = buildNumberSession();
  const action = saveManualEditFromPanel(session, {
    conflictId: 'conflict:cell:sheet1:0:B4',
    rawValue: '1550',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:15:00Z',
  });

  const updated = reduceSessionState(session, action);
  assert.equal(updated.conflicts[0].userDecision, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].origin, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '1550');
  assert.equal(updated.mergeDecisions[0].manualEdit.type, 'number');
  assert.equal(updated.summary.resolvedConflictCount, 1);
  assert.equal(updated.summary.unresolvedConflictCount, 0);
});

test('block decisions cover every referenced cell and recalculate preview', () => {
  const session = buildSession();
  const action = createDecisionActionFromPanel(session, {
    conflictId: 'conflict:cell:sheet1:0:B4',
    decisionType: 'accept_right',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:20:00Z',
    scopeType: 'block',
    targetId: 'block:summary-row-4',
    cellRefs: ['cell:sheet1:0:B4', 'cell:sheet1:0:C4'],
  });

  const updated = reduceSessionState(session, action);
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '1350');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:C4'].displayValue, '1350');
  assert.equal(updated.worksheetDiffs[0].cellDiffs[1].userDecision, 'accept_right');
});

test('repeated decisions keep history and the latest state wins', () => {
  const session = buildSession();
  const firstAction = createDecisionActionFromPanel(session, {
    conflictId: 'conflict:cell:sheet1:0:B4',
    decisionType: 'accept_left',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:21:00Z',
  });
  const afterFirst = reduceSessionState(session, firstAction);

  const secondAction = createDecisionActionFromPanel(afterFirst, {
    conflictId: 'conflict:cell:sheet1:0:B4',
    decisionType: 'accept_right',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:22:00Z',
  });
  const updated = reduceSessionState(afterFirst, secondAction);

  assert.equal(updated.mergeDecisions.length, 2);
  assert.equal(updated.conflicts[0].userDecision, 'accept_right');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '1350');
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
  assert.equal(updated.mergeDecisions[0].history[0].conflictId, 'conflict:sheet1:B4');
  assert.equal(updated.supportExport.rows[0].affectedLocation, 'Summary!B4');
});
