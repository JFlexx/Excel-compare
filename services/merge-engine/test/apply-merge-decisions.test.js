'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { apply_merge_decisions } = require('../src');

function buildWorkbooks() {
  return {
    leftWorkbook: {
      workbookId: 'wb:left',
      label: 'left.xlsx',
      worksheets: [
        {
          id: 'ws:summary:0',
          name: 'Summary',
          index: 0,
          cells: {
            B4: { value: 1200, displayValue: '1200', type: 'number', exists: true },
            C10: { value: 500, displayValue: '500', formula: '=SUM(C4:C9)', type: 'formula', exists: true },
          },
        },
      ],
    },
    rightWorkbook: {
      workbookId: 'wb:right',
      label: 'right.xlsx',
      worksheets: [
        {
          id: 'ws:summary:0',
          name: 'Summary',
          index: 0,
          cells: {
            B4: { value: 1350, displayValue: '1350', type: 'number', exists: true },
            C10: { value: 520, displayValue: '520', formula: '=SUM(C4:C8)+C9', type: 'formula', exists: true },
          },
        },
      ],
    },
    diff: {
      id: 'wbd:left:right',
      nodeType: 'WorkbookDiff',
      changeType: 'modified',
      worksheetDiffs: [
        {
          id: 'wsd:summary:0',
          nodeType: 'WorksheetDiff',
          worksheetId: 'ws:summary:0',
          location: { worksheetName: 'Summary', sheetIndex: 0, rangeA1: 'Summary!A1:XFD1048576' },
          changeType: 'modified',
          cellDiffs: [
            {
              id: 'cell:summary:0:B4',
              nodeType: 'CellDiff',
              worksheetId: 'ws:summary:0',
              location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
              changeType: 'modified',
              sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
              sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
              conflictIds: [],
            },
            {
              id: 'cell:summary:0:C10',
              nodeType: 'CellDiff',
              worksheetId: 'ws:summary:0',
              location: { worksheetName: 'Summary', sheetIndex: 0, row: 10, column: 3, a1: 'C10', rangeA1: 'C10' },
              changeType: 'formula_changed',
              sourceA: { value: 500, displayValue: '500', formula: '=SUM(C4:C9)', type: 'formula', exists: true },
              sourceB: { value: 520, displayValue: '520', formula: '=SUM(C4:C8)+C9', type: 'formula', exists: true },
              conflictIds: ['conflict:cell:summary:0:C10'],
            },
          ],
          conflicts: [
            {
              id: 'conflict:cell:summary:0:C10',
              nodeType: 'Conflict',
              scopeType: 'cell',
              location: { worksheetName: 'Summary', sheetIndex: 0, row: 10, column: 3, a1: 'C10', rangeA1: 'C10' },
              changeType: 'conflict',
              reason: 'Formula changed on both sides.',
              cellRefs: ['cell:summary:0:C10'],
            },
          ],
        },
      ],
      conflicts: [],
    },
  };
}

test('accepts right-side changes for a modified cell', () => {
  const { leftWorkbook, rightWorkbook, diff } = buildWorkbooks();

  const result = apply_merge_decisions(leftWorkbook, rightWorkbook, diff, [
    {
      id: 'decision:cell:summary:0:B4',
      nodeType: 'MergeDecision',
      targetType: 'cell',
      targetId: 'cell:summary:0:B4',
      userDecision: 'take_b',
    },
  ]);

  const summarySheet = result.workbook.worksheets.find((worksheet) => worksheet.name === 'Summary');
  assert.equal(summarySheet.cells.B4.value, 1350);
  assert.equal(result.summary.appliedChangeCount, 1);
  assert.equal(result.summary.unresolvedConflictCount, 1);
});

test('supports manual edits when resolving a conflict', () => {
  const { leftWorkbook, rightWorkbook, diff } = buildWorkbooks();

  const result = apply_merge_decisions(leftWorkbook, rightWorkbook, diff, [
    {
      id: 'decision:conflict:cell:summary:0:C10',
      nodeType: 'MergeDecision',
      targetType: 'conflict',
      targetId: 'conflict:cell:summary:0:C10',
      userDecision: 'manual_edit',
      manualValue: {
        value: 510,
        displayValue: '510',
        formula: '=SUM(C4:C9)-10',
        type: 'formula',
        exists: true,
      },
    },
  ]);

  const summarySheet = result.workbook.worksheets.find((worksheet) => worksheet.name === 'Summary');
  assert.equal(summarySheet.cells.C10.value, 510);
  assert.equal(summarySheet.cells.C10.formula, '=SUM(C4:C9)-10');
  assert.equal(result.summary.resolvedConflictCount, 1);
  assert.equal(result.summary.unresolvedConflictCount, 0);
  assert.equal(result.mergeResult.finalState, 'merged');
});

test('keeps pending conflicts in the summary when no decision exists', () => {
  const { leftWorkbook, rightWorkbook, diff } = buildWorkbooks();

  const result = apply_merge_decisions(leftWorkbook, rightWorkbook, diff, []);

  assert.equal(result.summary.resolvedConflictCount, 0);
  assert.equal(result.summary.unresolvedConflictCount, 1);
  assert.equal(result.summary.pendingConflicts[0].targetId, 'conflict:cell:summary:0:C10');
  assert.equal(result.mergeResult.finalState, 'unresolved');
});


test('accepts left-side changes and produces an exportable xlsx payload', () => {
  const { leftWorkbook, rightWorkbook, diff } = buildWorkbooks();

  const result = apply_merge_decisions(leftWorkbook, rightWorkbook, diff, [
    {
      id: 'decision:cell:summary:0:B4:left',
      nodeType: 'MergeDecision',
      targetType: 'cell',
      targetId: 'cell:summary:0:B4',
      userDecision: 'take_a',
    },
    {
      id: 'decision:conflict:cell:summary:0:C10:right',
      nodeType: 'MergeDecision',
      targetType: 'conflict',
      targetId: 'conflict:cell:summary:0:C10',
      userDecision: 'take_b',
    },
  ]);

  const summarySheet = result.workbook.worksheets.find((worksheet) => worksheet.name === 'Summary');
  const payloadSheet = result.xlsxPayload.worksheets.find((worksheet) => worksheet.name === 'Summary');
  const payloadB4 = payloadSheet.cells.find((cell) => cell.address === 'B4');

  assert.equal(summarySheet.cells.B4.value, 1200);
  assert.equal(summarySheet.cells.C10.formula, '=SUM(C4:C8)+C9');
  assert.equal(payloadB4.value, 1200);
  assert.equal(result.mergeResult.output.format, 'xlsx');
  assert.equal(result.summary.unresolvedConflictCount, 0);
});
