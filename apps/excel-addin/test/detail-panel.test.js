import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConflictDetailPanelModel,
  createDecisionActionFromPanel,
  reduceSessionState,
  saveManualEditFromPanel,
} from '../src/detail-panel.js';

function buildSession() {
  return {
    sessionId: 'session-1',
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
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
    summary: { totalConflicts: 1, resolvedConflictCount: 0, unresolvedConflictCount: 1, pendingConflicts: [] },
  };
}

test('detail panel exposes canonical actions and inline validation', () => {
  const invalidModel = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4', 'abc');
  assert.equal(invalidModel.editableField.label, 'Valor final');
  assert.equal(invalidModel.editableField.expectedType, 'number');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /número válido/i);
  assert.equal(invalidModel.actions.acceptLeft.decisionType, 'accept_left');
  assert.equal(invalidModel.actions.acceptRightBlock.scopeType, 'block');

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4', '1450');
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.actions.saveManualEdit.decisionType, 'manual_edit');
  assert.equal(validModel.preview.value, '1450');
  assert.equal(validModel.preview.origin, 'manual_edit');
});

test('saving manual edit updates the full session state and preview', () => {
  const session = buildSession();
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
});
