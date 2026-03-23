import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConflictDetailPanelModel, reduceSessionState, saveManualEditFromPanel } from '../src/detail-panel.js';

function buildNumberSession() {
  return {
    sessionId: 'session-1',
    conflicts: [
      {
        id: 'conflict:sheet1:B4',
        cellRef: 'cell:sheet1:B4',
        location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
        changeType: 'conflict',
        sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
        sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
        userDecision: 'unresolved',
        finalState: 'pending'
      }
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} }
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
    resultPreview: { cells: {} }
  };
}

test('detail panel exposes editable field and inline validation for value changes in pilot scope', () => {
  const invalidModel = buildConflictDetailPanelModel(buildNumberSession(), 'conflict:sheet1:B4', 'abc');
  assert.equal(invalidModel.editableField.label, 'Valor final');
  assert.equal(invalidModel.editableField.placeholder, 'Escribe el valor final manual (solo valor o fórmula simple)');
  assert.equal(invalidModel.editableField.expectedType, 'number');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /número válido/i);

  const validModel = buildConflictDetailPanelModel(buildNumberSession(), 'conflict:sheet1:B4', '1450');
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.actions.saveManualEdit.userDecision, 'manual_edit');
  assert.equal(validModel.preview.value, '1450');
  assert.equal(validModel.preview.origin, 'manual_edit');
});

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
    conflictId: 'conflict:sheet1:B4',
    rawValue: '1550',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:15:00Z'
  });

  const updated = reduceSessionState(session, action);
  assert.equal(updated.conflicts[0].userDecision, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:B4'].origin, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:B4'].displayValue, '1550');
  assert.equal(updated.mergeDecisions[0].manualEdit.type, 'number');
});
