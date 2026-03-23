import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDecisionToSession, createManualEditDecision, validateManualEdit } from '../src/index.js';

function buildConflict(overrides = {}) {
  return {
    id: 'conflict:sheet1:B4',
    cellRef: 'cell:sheet1:B4',
    location: { worksheetName: 'Summary', sheetIndex: 0, row: 4, column: 2, a1: 'B4', rangeA1: 'B4' },
    changeType: 'conflict',
    sourceA: { value: 1200, displayValue: '1200', type: 'number', exists: true },
    sourceB: { value: 1350, displayValue: '1350', type: 'number', exists: true },
    userDecision: 'unresolved',
    finalState: 'pending',
    ...overrides
  };
}

test('validateManualEdit enforces numeric parsing for number conflicts', () => {
  const invalid = validateManualEdit(buildConflict(), 'abc');
  assert.equal(invalid.valid, false);
  assert.match(invalid.error, /número válido/i);

  const valid = validateManualEdit(buildConflict(), '1400.50');
  assert.deepEqual(valid, {
    valid: true,
    expectedType: 'number',
    parsedValue: 1400.5,
    displayValue: '1400.50',
    valueType: 'number'
  });
});

test('createManualEditDecision persists a first-class manual_edit decision', () => {
  const decision = createManualEditDecision({
    conflict: buildConflict(),
    rawValue: '1450',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:00:00Z'
  });

  assert.equal(decision.userDecision, 'manual_edit');
  assert.equal(decision.finalState, 'merged');
  assert.equal(decision.manualEdit.value, 1450);
  assert.equal(decision.preview.displayValue, '1450');
});

test('applyDecisionToSession updates conflict resolution and result preview', () => {
  const session = {
    sessionId: 'session-1',
    status: 'Processing',
    conflicts: [buildConflict()],
    worksheetDiffs: [
      {
        id: 'wsd:summary:0',
        cellDiffs: [
          {
            id: 'cell:sheet1:B4',
            userDecision: 'unresolved',
            finalState: 'pending'
          }
        ]
      }
    ],
    mergeDecisions: [],
    resultPreview: { cells: {} }
  };

  const decision = createManualEditDecision({
    conflict: buildConflict(),
    rawValue: '1500',
    decidedBy: 'user:ana',
    decidedAt: '2026-03-23T12:05:00Z'
  });

  const updated = applyDecisionToSession(session, decision);
  assert.equal(updated.conflicts[0].userDecision, 'manual_edit');
  assert.equal(updated.conflicts[0].resolution.type, 'manual_edit');
  assert.equal(updated.worksheetDiffs[0].cellDiffs[0].finalValue.origin, 'manual_edit');
  assert.equal(updated.resultPreview.cells['cell:sheet1:B4'].displayValue, '1500');
  assert.equal(updated.status, 'Ready');
});
