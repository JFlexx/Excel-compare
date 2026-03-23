import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDecisionToSession,
  createAcceptLeftDecision,
  createAcceptRightDecision,
  createManualEditDecision,
} from '../src/index.js';
import { apply_merge_decisions } from '../src/apply-merge-decisions.js';

function buildSession() {
  return {
    conflicts: [
      {
        id: 'conflict:cell:sheet1:0:B4',
        cellRefs: ['cell:sheet1:0:B4', 'cell:sheet1:0:C4'],
        cellRef: 'cell:sheet1:0:B4',
        location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'B4', rangeA1: 'B4:C4' },
        sourceA: { value: 10, displayValue: '10', type: 'number', exists: true },
        sourceB: { value: 20, displayValue: '20', type: 'number', exists: true },
        finalState: 'unresolved',
      },
    ],
    worksheetDiffs: [
      {
        id: 'wsd:sheet1:0',
        location: { worksheetName: 'Summary', sheetIndex: 0 },
        cellDiffs: [
          {
            id: 'cell:sheet1:0:B4',
            location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'B4' },
            changeType: 'conflict',
            sourceA: { value: 10, displayValue: '10', type: 'number', exists: true },
            sourceB: { value: 20, displayValue: '20', type: 'number', exists: true },
            finalState: 'unresolved',
          },
          {
            id: 'cell:sheet1:0:C4',
            location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'C4' },
            changeType: 'conflict',
            sourceA: { value: 30, displayValue: '30', type: 'number', exists: true },
            sourceB: { value: 40, displayValue: '40', type: 'number', exists: true },
            finalState: 'unresolved',
          },
        ],
        conflicts: [],
      },
    ],
    mergeDecisions: [],
  };
}

test('latest decision wins when the same target is decided twice', () => {
  const base = buildSession();
  const acceptLeft = createAcceptLeftDecision({
    conflict: base.conflicts[0],
    decidedBy: 'user:test',
    decidedAt: '2026-03-23T10:00:00Z',
  });
  const afterLeft = applyDecisionToSession(base, acceptLeft);

  const acceptRight = createAcceptRightDecision({
    conflict: afterLeft.conflicts[0],
    decidedBy: 'user:test',
    decidedAt: '2026-03-23T10:05:00Z',
  });
  const afterRight = applyDecisionToSession(afterLeft, acceptRight);

  assert.equal(afterRight.mergeDecisions.length, 2);
  assert.equal(afterRight.conflicts[0].userDecision, 'accept_right');
  assert.equal(afterRight.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '20');
});

test('block decisions apply to every covered cell ref', () => {
  const base = buildSession();
  const blockDecision = createAcceptRightDecision({
    conflict: base.conflicts[0],
    decidedBy: 'user:test',
    decidedAt: '2026-03-23T10:10:00Z',
    scopeType: 'block',
    targetId: 'block:summary-row-4',
    cellRefs: ['cell:sheet1:0:B4', 'cell:sheet1:0:C4'],
  });

  const updated = applyDecisionToSession(base, blockDecision);
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '20');
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:C4'].displayValue, '20');
  assert.equal(updated.worksheetDiffs[0].cellDiffs[1].userDecision, 'accept_right');
});

test('apply_merge_decisions resolves conflict coverage from canonical block decisions', () => {
  const leftWorkbook = {
    workbookId: 'left',
    worksheets: [{ name: 'Summary', index: 0, id: 'ws:summary:0', cells: { B4: { value: 10, displayValue: '10', type: 'number', exists: true }, C4: { value: 30, displayValue: '30', type: 'number', exists: true } } }],
  };
  const rightWorkbook = {
    workbookId: 'right',
    worksheets: [{ name: 'Summary', index: 0, id: 'ws:summary:0', cells: { B4: { value: 20, displayValue: '20', type: 'number', exists: true }, C4: { value: 40, displayValue: '40', type: 'number', exists: true } } }],
  };
  const diff = {
    id: 'diff:1',
    changeType: 'conflict',
    conflicts: [
      {
        id: 'conflict:cell:sheet1:0:B4',
        cellRefs: ['cell:sheet1:0:B4', 'cell:sheet1:0:C4'],
        location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'B4', rangeA1: 'B4:C4' },
      },
    ],
    worksheetDiffs: [
      {
        id: 'wsd:sheet1:0',
        worksheetId: 'ws:summary:0',
        location: { worksheetName: 'Summary', sheetIndex: 0 },
        cellDiffs: [
          {
            id: 'cell:sheet1:0:B4',
            worksheetId: 'ws:summary:0',
            location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'B4' },
            sourceA: { value: 10, displayValue: '10', type: 'number', exists: true },
            sourceB: { value: 20, displayValue: '20', type: 'number', exists: true },
          },
          {
            id: 'cell:sheet1:0:C4',
            worksheetId: 'ws:summary:0',
            location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'C4' },
            sourceA: { value: 30, displayValue: '30', type: 'number', exists: true },
            sourceB: { value: 40, displayValue: '40', type: 'number', exists: true },
          },
        ],
        conflicts: [],
      },
    ],
  };
  const decisions = [
    {
      id: 'decision:block:1',
      targetId: 'block:summary-row-4',
      decisionType: 'accept_right',
      userDecision: 'accept_right',
      cellRefs: ['cell:sheet1:0:B4', 'cell:sheet1:0:C4'],
    },
  ];

  const result = apply_merge_decisions(leftWorkbook, rightWorkbook, diff, decisions);
  const summarySheet = result.workbook.worksheets[0];
  assert.equal(summarySheet.cells.B4.displayValue, '20');
  assert.equal(summarySheet.cells.C4.displayValue, '40');
  assert.equal(result.summary.resolvedConflictCount, 1);
});

test('manual edit decisions preserve canonical payload and summary', () => {
  const base = buildSession();
  const decision = createManualEditDecision({
    conflict: base.conflicts[0],
    rawValue: '25',
    decidedBy: 'user:test',
    decidedAt: '2026-03-23T10:20:00Z',
  });
  const updated = applyDecisionToSession(base, decision);

  assert.equal(decision.decisionType, 'manual_edit');
  assert.equal(updated.summary.unresolvedConflictCount, 0);
  assert.equal(updated.resultPreview.cells['cell:sheet1:0:B4'].displayValue, '25');
});
