import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConflictDetailPanelModel,
  reduceSessionState,
  saveManualEditFromPanel,
} from '../src/detail-panel.js';

function buildSession(overrides = {}) {
  const worksheetDiffs = [
    {
      id: 'wsd:sheet1:0',
      location: { worksheetName: 'Summary', sheetIndex: 0, rangeA1: 'Summary!A1:XFD1048576' },
      cellDiffs: [
        {
          id: 'cell:sheet1:0:B4',
          cellRef: 'cell:sheet1:0:B4',
          location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
          changeType: 'conflict',
          sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
          sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
          userDecision: 'unresolved',
          finalState: 'unresolved',
        },
      ],
      conflicts: [],
    },
  ];

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
        id: 'conflict:cell:sheet1:0:B4',
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
      {
        id: 'conflict:sheet2:C8',
        scopeType: 'cell',
        worksheetDiffId: 'wsd:sheet2:1',
        cellRef: 'cell:sheet2:1:C8',
        cellRefs: ['cell:sheet2:1:C8'],
        location: { worksheetName: 'Forecast', sheetIndex: 1, row: 8, column: 3, a1: 'C8', rangeA1: 'C8' },
        changeType: 'conflict',
        sourceA: { value: '=SUM(C2:C7)', displayValue: '=SUM(C2:C7)', type: 'formula', exists: true },
        sourceB: { value: '=SUM(C2:C7)-C4', displayValue: '=SUM(C2:C7)-C4', type: 'formula', exists: true },
        userDecision: 'unresolved',
        finalState: 'unresolved',
        reason: 'Formula mismatch',
      },
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
    ...overrides,
  };
}

test('renderiza el detalle del conflicto con acciones y metadatos del bloque', () => {
  const model = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4');

  assert.equal(model.title, 'Conflicto en Summary B4');
  assert.equal(model.editableField.label, 'Valor final');
  assert.equal(model.editableField.expectedType, 'number');
  assert.equal(model.actions.acceptLeft.decisionType, 'accept_left');
  assert.equal(model.actions.acceptRightBlock.scopeType, 'block');
  assert.deepEqual(model.actions.acceptRightBlock.cellRefs, ['cell:sheet1:0:B4']);
  assert.equal(model.resolutionSummary.totalConflicts, 2);
});

test('valida la edición manual de números antes de habilitar el guardado', () => {
  const invalidModel = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4', 'abc');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /número válido/i);
  assert.equal(invalidModel.actions.saveManualEdit.enabled, false);

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:cell:sheet1:0:B4', '1450');
  assert.equal(validModel.editableField.isValid, true);
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.preview.value, '1450');
  assert.equal(validModel.preview.origin, 'manual_edit');
});

test('valida la edición manual de fórmulas usando el formato conectado en la UI', () => {
  const invalidModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet2:C8', 'SUM(C2:C7)');
  assert.equal(invalidModel.editableField.expectedType, 'formula');
  assert.equal(invalidModel.editableField.isValid, false);
  assert.match(invalidModel.editableField.validationMessage, /empezar por '='|empezar por '='/i);

  const validModel = buildConflictDetailPanelModel(buildSession(), 'conflict:sheet2:C8', '=SUM(C2:C7)-C5');
  assert.equal(validModel.editableField.isValid, true);
  assert.equal(validModel.actions.saveManualEdit.enabled, true);
  assert.equal(validModel.preview.value, '=SUM(C2:C7)-C5');
});

test('guarda una decisión manual y sincroniza preview, resumen e historial derivado', () => {
  const session = buildSession();
  const action = saveManualEditFromPanel(session, {
    conflictId: 'conflict:cell:sheet1:0:B4',
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
  assert.equal(updated.summary.unresolvedConflictCount, 1);
  assert.equal(updated.supportExport.rows[0].affectedLocation, 'Summary!B4');
});
