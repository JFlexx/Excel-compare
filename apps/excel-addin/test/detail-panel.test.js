import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConflictDetailPanelModel,
  reduceSessionState,
  saveManualEditFromPanel,
} from '../src/detail-panel.js';

function buildSession() {
  return {
    sessionId: 'session-1',
    status: 'ready',
    workbookDiff: {
      id: 'workbook:session-1',
      conflicts: [],
      worksheetDiffs,
    },
    conflicts: [
      {
        id: 'conflict:sheet1:B4',
        scopeType: 'cell',
        worksheetDiffId: 'wsd:sheet1:0',
        cellRef: 'cell:sheet1:0:B4',
        cellRefs: ['cell:sheet1:0:B4'],
        location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
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

function buildFormulaSession() {
  return {
    sessionId: 'session-2',
    status: 'ready',
    conflicts: [
      {
        id: 'conflict:sheet2:C8',
        cellRef: 'cell:sheet2:1:C8',
        cellRefs: ['cell:sheet2:1:C8'],
        location: { worksheetName: 'Forecast', sheetIndex: 1, row: 8, column: 3, a1: 'C8', rangeA1: 'C8' },
        changeType: 'conflict',
        sourceA: { value: '=SUM(C2:C7)', displayValue: '=SUM(C2:C7)', type: 'formula', exists: true },
        sourceB: { value: '=SUM(C2:C7)-C4', displayValue: '=SUM(C2:C7)-C4', type: 'formula', exists: true },
        userDecision: 'unresolved',
        finalState: 'unresolved',
      },
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
    ...overrides,
  };
}

test('detail panel exposes editable field and inline validation for value changes in pilot scope', () => {
  const invalidModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet1:B4', 'abc');
  assert.equal(invalidModel.editableField.label, 'Valor final');
  assert.equal(invalidModel.editableField.expectedType, 'number');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /número válido/i);
  assert.equal(invalidModel.actions.saveManualEdit.enabled, false);

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet1:B4', '1450');
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.preview.value, '1450');
  assert.equal(validModel.preview.origin, 'manual_edit');
});

test('detail panel validates simple formulas before saving manual edits', () => {
  const invalidModel = buildConflictDetailPanelModel(buildFormulaSession(), 'conflict:sheet2:C8', 'SUM(C2:C7)');
  assert.equal(invalidModel.editableField.expectedType, 'formula');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /empezar por '='|deben empezar por '='/i);

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet2:C8', '=SUM(C2:C7)-C5');
  assert.equal(validModel.editableField.isValid, true);
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.preview.value, '=SUM(C2:C7)-C5');
});

test('saving manual edit updates session preview state with manual_edit origin', () => {
  const session = buildSession();
  const action = saveManualEditFromPanel(session, {
    conflictId: 'conflict:sheet1:B4',
    rawValue: '1550',
    decidedBy: { userId: 'user:ana', displayName: 'Ana' },
    decidedAt: '2026-03-23T12:15:00Z',
  });

  const updated = reduceSessionState(session, action);

  assert.equal(updated.conflicts[0].userDecision, 'manual_edit');
  assert.equal(updated.conflicts[0].finalState, 'merged');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '1550');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].origin, 'manual_edit');
  assert.equal(updated.mergeDecisions[0].manualEdit.type, 'number');
  assert.equal(updated.summary.resolvedConflictCount, 1);
  assert.equal(updated.summary.unresolvedConflictCount, 0);
  assert.equal(updated.supportExport.rows[0].affectedLocation, 'Summary!B4');
});

test('block decisions cover every referenced cell and recalculate preview', () => {
  const session = buildSession();
  const action = createDecisionActionFromPanel(session, {
    conflictId: 'conflict:sheet1:B4',
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
    conflictId: 'conflict:sheet1:B4',
    decisionType: 'accept_left',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:21:00Z',
  });
  const afterFirst = reduceSessionState(session, firstAction);

  const secondAction = createDecisionActionFromPanel(afterFirst, {
    conflictId: 'conflict:sheet1:B4',
    decisionType: 'accept_right',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:22:00Z',
  });
  const updated = reduceSessionState(afterFirst, secondAction);

  assert.equal(updated.mergeDecisions.length, 2);
  assert.equal(updated.conflicts[0].userDecision, 'accept_right');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '1350');
  assert.equal(updated.status, 'ready');
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
    () => reduceSessionState(session, { type: 'APPLY_MERGE_DECISION', payload: { decisionType: 'manual_edit' } }),
    (error) => error.code === 'INVALID_SESSION_STATE' && /payload incomplete/i.test(error.message),
  );
  assert.equal(session.mergeDecisions.length, 0);
  assert.deepEqual(session.resultPreview.cells, {});
});
