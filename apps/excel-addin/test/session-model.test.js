import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyConflictResolution,
  buildConflictIndex,
  findConflictByWorksheetAndAddress,
  findConflictsIntersectingRange,
  normalizeSessionPayload,
  pickBestConflictMatch,
} from '../src/session-model.js';

function buildSessionFixture() {
  return {
    sessionId: 'ms_demo_budget_001',
    sourceA: { workbookId: 'wb_a', label: 'budget.base.xlsx', path: '/files/budget.base.xlsx' },
    sourceB: { workbookId: 'wb_b', label: 'budget.review.xlsx', path: '/files/budget.review.xlsx' },
    workbookDiff: {
      id: 'wbd:wb_a:wb_b',
      conflicts: [
        {
          id: 'conflict:summary:C10',
          location: { worksheetName: 'Summary', a1: 'C10', rangeA1: 'C10' },
          changeType: 'formula_difference',
          sourceA: { formula: '=SUM(C2:C9)', displayValue: '=SUM(C2:C9)', type: 'formula', exists: true },
          sourceB: { formula: '=SUM(C2:C8)', displayValue: '=SUM(C2:C8)', type: 'formula', exists: true },
          finalState: 'unresolved',
        },
      ],
    },
    mergeDecisions: [],
    resultPreview: { cells: {} },
  };
}

test('normalizeSessionPayload extracts a usable merge session from a workbook diff payload', () => {
  const session = normalizeSessionPayload(buildSessionFixture(), {
    name: 'budget.review.xlsx',
    worksheetNames: ['Summary'],
    activeWorksheetName: 'Summary',
    selectionAddress: 'C10',
  });

  assert.equal(session.sessionId, 'ms_demo_budget_001');
  assert.equal(session.conflicts.length, 1);
  assert.equal(session.conflicts[0].worksheetName, 'Summary');
  assert.equal(session.conflicts[0].address, 'C10');
});

test('conflict index resolves exact addresses and range intersections', () => {
  const session = normalizeSessionPayload(buildSessionFixture(), null);
  const index = buildConflictIndex(session.conflicts);

  const exactId = findConflictByWorksheetAndAddress(index, 'Summary', 'C10');
  assert.equal(exactId, 'conflict:summary:C10');

  const matches = findConflictsIntersectingRange(index, 'Summary', 'C10:C12');
  assert.equal(matches.length, 1);
  assert.equal(pickBestConflictMatch(matches)?.conflictId, exactId);
});

test('applyConflictResolution updates session state and preview using the selected side', () => {
  const session = normalizeSessionPayload(buildSessionFixture(), null);
  const conflict = session.conflicts[0];
  const updated = applyConflictResolution(session, conflict.id, 'right');
  const resolved = updated.conflicts.find((entry) => entry.id === conflict.id);

  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.resolution, 'right');
  assert.equal(updated.mergeDecisions.at(-1).userDecision, 'take_b');
});
