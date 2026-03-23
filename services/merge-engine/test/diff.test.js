import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compare_workbooks,
  compare_worksheets,
  compare_cells,
} from '../src/index.js';

test('compare_cells classifies unchanged, added, removed and modified cells', () => {
  assert.equal(compare_cells({ address: 'A1', value: 'same' }, { address: 'A1', value: 'same' }).changeType, 'unchanged');
  assert.equal(compare_cells(undefined, { address: 'A1', value: 'new' }).changeType, 'added');
  assert.equal(compare_cells({ address: 'A1', value: 'old' }, undefined).changeType, 'removed');
  assert.equal(compare_cells({ address: 'A1', value: 'left' }, { address: 'A1', value: 'right' }).changeType, 'modified');
});

test('compare_cells marks formula mismatches as conflict', () => {
  const diff = compare_cells(
    { address: 'C10', value: 10, formula: '=SUM(A1:A2)' },
    { address: 'C10', value: 12, formula: '=SUM(A1:A3)' },
    { worksheetName: 'Summary', sheetIndex: 0, sheetKey: 'summary:0' },
  );

  assert.equal(diff.changeType, 'conflict');
  assert.equal(diff.finalState, 'unresolved');
});

test('compare_worksheets compares all normalized cells in the union of both sides', () => {
  const worksheetDiff = compare_worksheets(
    {
      name: 'Summary',
      sheetIndex: 0,
      cells: [
        { address: 'A1', value: 'same' },
        { address: 'B2', value: 10 },
        { address: 'C3', value: 'only-a' },
      ],
    },
    {
      name: 'Summary',
      sheetIndex: 0,
      cells: [
        { address: 'A1', value: 'same' },
        { address: 'B2', value: 20 },
        { address: 'D4', value: 'only-b' },
      ],
    },
  );

  assert.equal(worksheetDiff.changeType, 'modified');
  assert.deepEqual(
    worksheetDiff.cellDiffs.map((cellDiff) => [cellDiff.location.a1, cellDiff.changeType]),
    [
      ['A1', 'unchanged'],
      ['B2', 'modified'],
      ['C3', 'removed'],
      ['D4', 'added'],
    ],
  );
});

test('compare_workbooks returns worksheet nodes and aggregate summary', () => {
  const workbookDiff = compare_workbooks(
    {
      workbookId: 'wb-left',
      worksheets: [
        {
          name: 'Summary',
          sheetIndex: 0,
          cells: [
            { address: 'A1', value: 'same' },
            { address: 'B2', value: 1 },
          ],
        },
        {
          name: 'Archive',
          sheetIndex: 1,
          cells: [],
        },
      ],
    },
    {
      workbookId: 'wb-right',
      worksheets: [
        {
          name: 'Summary',
          sheetIndex: 0,
          cells: [
            { address: 'A1', value: 'same' },
            { address: 'B2', value: 2 },
            { address: 'C3', value: 'new' },
          ],
        },
        {
          name: 'Forecast',
          sheetIndex: 2,
          cells: [],
        },
      ],
    },
  );

  assert.equal(workbookDiff.nodeType, 'WorkbookDiff');
  assert.equal(workbookDiff.changeType, 'modified');
  assert.equal(workbookDiff.worksheetDiffs.length, 3);
  assert.deepEqual(workbookDiff.summary.worksheets, {
    unchanged: 0,
    added: 1,
    removed: 1,
    modified: 1,
    conflict: 0,
  });
  assert.deepEqual(workbookDiff.summary.cells, {
    unchanged: 1,
    added: 1,
    removed: 0,
    modified: 1,
    conflict: 0,
  });
});

test('compare_workbooks can escalate value mismatches to conflict with product rules', () => {
  const workbookDiff = compare_workbooks(
    {
      workbookId: 'wb-left',
      worksheets: [
        {
          name: 'Summary',
          sheetIndex: 0,
          cells: [{ address: 'B4', value: 100 }],
        },
      ],
    },
    {
      workbookId: 'wb-right',
      worksheets: [
        {
          name: 'Summary',
          sheetIndex: 0,
          cells: [{ address: 'B4', value: 120 }],
        },
      ],
    },
    { conflictOnValueMismatch: true },
  );

  assert.equal(workbookDiff.changeType, 'conflict');
  assert.equal(workbookDiff.summary.conflictCount, 1);
  assert.equal(workbookDiff.worksheetDiffs[0].cellDiffs[0].changeType, 'conflict');
  assert.equal(workbookDiff.worksheetDiffs[0].conflicts[0].cellRefs[0], 'cell:summary:0:B4');
});
