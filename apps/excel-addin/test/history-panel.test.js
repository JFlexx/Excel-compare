import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHistoryEntry,
  buildSupportExport,
  syncDerivedHistoryArtifacts,
  upsertMergeDecision,
} from '../src/history-panel.js';

function buildSession() {
  return {
    sessionId: 'session-1',
    conflicts: [
      {
        id: 'conflict-1',
        sheet: 'Clientes',
        cell: 'D18',
        type: 'Valor distinto',
        location: { worksheetName: 'Clientes', a1: 'D18', rangeA1: 'D18' },
      },
    ],
    mergeDecisions: [],
  };
}

test('upsertMergeDecision merges history entries without duplicating the same event', () => {
  const session = buildSession();
  const entry = buildHistoryEntry({
    sessionId: session.sessionId,
    conflict: session.conflicts[0],
    decisionId: 'decision:conflict-1',
    targetId: 'conflict-1',
    decision: 'take_a',
    finalValue: { value: 'Activo', displayValue: 'Activo', type: 'string' },
    occurredAt: '2026-03-23T12:00:00Z',
    actor: { userId: 'user:ana', displayName: 'Ana', origin: 'office-addin' },
    actionType: 'selected_source',
    changeOrigin: 'manual',
  });

  const decisions = upsertMergeDecision([], {
    id: 'decision:conflict-1',
    targetId: 'conflict-1',
    decidedAt: '2026-03-23T12:00:00Z',
    history: [entry],
  });
  const merged = upsertMergeDecision(decisions, {
    id: 'decision:conflict-1',
    targetId: 'conflict-1',
    decidedAt: '2026-03-23T12:00:00Z',
    history: [entry],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].history.length, 1);
});

test('buildSupportExport flattens rows with conflict, decision, user and location', () => {
  const session = buildSession();
  session.mergeDecisions = [
    {
      id: 'decision:conflict-1',
      targetId: 'conflict-1',
      decidedAt: '2026-03-23T12:00:00Z',
      history: [
        buildHistoryEntry({
          sessionId: session.sessionId,
          conflict: session.conflicts[0],
          decisionId: 'decision:conflict-1',
          targetId: 'conflict-1',
          decision: 'take_b',
          finalValue: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string' },
          occurredAt: '2026-03-23T12:00:00Z',
          actor: { userId: 'user:ana', displayName: 'Ana', origin: 'office-addin' },
          actionType: 'selected_source',
          changeOrigin: 'manual',
        }),
      ],
    },
  ];

  const exported = buildSupportExport(session);

  assert.equal(exported.rows[0].conflict, 'Clientes · D18 · Valor distinto');
  assert.equal(exported.rows[0].decision, 'take_b');
  assert.equal(exported.rows[0].user, 'Ana');
  assert.equal(exported.rows[0].affectedLocation, 'Clientes!D18');
  assert.match(exported.jsonl, /Clientes/);
  assert.match(exported.csv, /decisionId/);
});

test('syncDerivedHistoryArtifacts exposes decisionTimeline and supportExport metadata', () => {
  const session = buildSession();
  session.mergeDecisions = [
    {
      id: 'decision:conflict-1',
      targetId: 'conflict-1',
      decidedAt: '2026-03-23T12:00:00Z',
      history: [
        buildHistoryEntry({
          sessionId: session.sessionId,
          conflict: session.conflicts[0],
          decisionId: 'decision:conflict-1',
          targetId: 'conflict-1',
          decision: 'take_b',
          finalValue: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string' },
          occurredAt: '2026-03-23T12:00:00Z',
          actor: { userId: 'system:auto', displayName: 'Regla', origin: 'automatic-rule' },
          actionType: 'auto_resolved',
          changeOrigin: 'automatic',
        }),
      ],
    },
  ];

  const synced = syncDerivedHistoryArtifacts(session);

  assert.equal(synced.decisionTimeline[0].isAutomatic, true);
  assert.equal(synced.technicalSummary.historyEntryCount, 1);
  assert.equal(synced.supportExport.automaticCount, 1);
});
