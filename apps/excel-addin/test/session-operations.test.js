import test from 'node:test';
import assert from 'node:assert/strict';

import { applyManualDecisionToSession, applySideDecisionToSession, buildReviewSummary } from '../src/session-operations.js';

function buildSession() {
  return {
    sessionId: 'session-1',
    sourceA: { label: 'Left.xlsx', workbookId: 'wb-left' },
    sourceB: { label: 'Right.xlsx', workbookId: 'wb-right' },
    sourceAWorkbook: { workbookId: 'wb-left', worksheets: [] },
    sourceBWorkbook: { workbookId: 'wb-right', worksheets: [] },
    workbookDiff: {
      id: 'wbd:1',
      conflicts: [
        {
          id: 'conf-1',
          worksheetName: 'Summary',
          address: 'C3',
          location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'C3' },
          sourceA: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
          sourceB: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
          cellRefs: ['cell:Summary:0:C3'],
          changeType: 'conflict',
        },
      ],
      worksheetDiffs: [
        {
          id: 'wsd:Summary:0',
          conflicts: [
            {
              id: 'conf-1',
              worksheetName: 'Summary',
              address: 'C3',
              location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'C3' },
              sourceA: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
              sourceB: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
              cellRefs: ['cell:Summary:0:C3'],
              changeType: 'conflict',
            },
          ],
        },
      ],
    },
    conflicts: [
      {
        id: 'conf-1',
        sheet: 'Summary',
        cell: 'C3',
        worksheetName: 'Summary',
        address: 'C3',
        leftValue: 'Activo',
        rightValue: 'Inactivo',
        leftSource: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
        rightSource: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
        sourceA: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
        sourceB: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
        location: { worksheetName: 'Summary', sheetIndex: 0, a1: 'C3' },
        cellRefs: ['cell:Summary:0:C3'],
        changeType: 'conflict',
        status: 'pending',
      },
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} },
  };
}

test('applySideDecisionToSession marks the conflict as resolved and stores a decision', () => {
  const updated = applySideDecisionToSession(buildSession(), 'conf-1', 'right', {
    decidedAt: '2026-03-23T00:00:00.000Z',
    decidedBy: 'tester',
  });

  assert.equal(updated.conflicts[0].status, 'resolved');
  assert.equal(updated.conflicts[0].resolution, 'right');
  assert.equal(updated.mergeDecisions[0].userDecision, 'take_b');
  assert.equal(updated.resultPreview.cells['cell:Summary:0:C3'].displayValue, 'Inactivo');
  assert.equal(updated.summary.pending, 0);
});

test('applyManualDecisionToSession stores manual edits and marks the conflict as manual', () => {
  const updated = applyManualDecisionToSession(buildSession(), 'conf-1', 'Revisado', {
    decidedAt: '2026-03-23T00:00:00.000Z',
    decidedBy: 'tester',
  });

  assert.equal(updated.conflicts[0].status, 'manual');
  assert.equal(updated.conflicts[0].manualValue, 'Revisado');
  assert.equal(updated.mergeDecisions[0].userDecision, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:Summary:0:C3'].origin, 'manual_edit');
});

test('buildReviewSummary counts affected sheets, pending and resolved conflicts', () => {
  const session = buildSession();
  session.conflicts.push({
    ...session.conflicts[0],
    id: 'conf-2',
    sheet: 'Forecast',
    worksheetName: 'Forecast',
    status: 'resolved',
  });

  const review = buildReviewSummary(session);
  assert.equal(review.pending, 1);
  assert.equal(review.resolved, 1);
  assert.deepEqual(review.affectedSheets.sort(), ['Forecast', 'Summary']);
});
