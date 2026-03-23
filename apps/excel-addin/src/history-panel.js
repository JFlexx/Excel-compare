function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function normalizeActor(actor) {
  if (!actor) {
    return { userId: 'system:auto', displayName: 'Regla automática', origin: 'automatic-rule' };
  }

  if (typeof actor === 'string') {
    return { userId: actor, displayName: actor, origin: 'office-addin' };
  }

  return {
    userId: actor.userId ?? 'system:auto',
    displayName: actor.displayName ?? actor.userId ?? 'Regla automática',
    origin: actor.origin ?? 'office-addin'
  };
}

export function serializeFinalValue(finalValue) {
  if (finalValue == null) {
    return '—';
  }

  if (typeof finalValue !== 'object') {
    return String(finalValue);
  }

  if (finalValue.displayValue != null) {
    return String(finalValue.displayValue);
  }

  if (finalValue.formula != null) {
    return String(finalValue.formula);
  }

  if (Object.prototype.hasOwnProperty.call(finalValue, 'value')) {
    return String(finalValue.value);
  }

  return JSON.stringify(finalValue);
}

export function buildHistoryEntry({
  sessionId,
  conflict,
  decisionId,
  targetId,
  decision,
  finalValue,
  occurredAt = new Date().toISOString(),
  actor,
  actionType = 'decision_applied',
  changeOrigin = 'manual'
}) {
  const normalizedActor = normalizeActor(actor);
  const eventId = `${decisionId}:${occurredAt}:${decision}:${changeOrigin}`;

  return {
    id: eventId,
    actionType,
    conflictId: conflict.id,
    targetId,
    decision,
    finalValue,
    occurredAt,
    sessionId,
    actor: normalizedActor,
    changeOrigin,
    location: {
      worksheetName: conflict.location?.worksheetName ?? conflict.sheet ?? null,
      a1: conflict.location?.a1 ?? conflict.cell ?? null,
      rangeA1: conflict.location?.rangeA1 ?? conflict.cell ?? null,
    }
  };
}

export function mergeHistoryEntries(existingEntries = [], nextEntries = []) {
  const byId = new Map();

  [...existingEntries, ...nextEntries].forEach((entry) => {
    byId.set(entry.id, entry);
  });

  return [...byId.values()].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function upsertMergeDecision(decisions = [], nextDecision) {
  const existing = decisions.find(
    (decision) => decision.id === nextDecision.id || decision.targetId === nextDecision.targetId,
  );

  const mergedDecision = existing
    ? {
        ...existing,
        ...nextDecision,
        history: mergeHistoryEntries(existing.history ?? [], nextDecision.history ?? []),
      }
    : {
        ...nextDecision,
        history: mergeHistoryEntries([], nextDecision.history ?? []),
      };

  const filtered = decisions.filter(
    (decision) => !(decision.id === mergedDecision.id || decision.targetId === mergedDecision.targetId),
  );

  return [...filtered, mergedDecision].sort((left, right) => right.decidedAt.localeCompare(left.decidedAt));
}

export function buildDecisionTimeline(session) {
  const conflictIndex = new Map((session.conflicts ?? []).map((conflict) => [conflict.id, conflict]));

  return (session.mergeDecisions ?? [])
    .flatMap((decision) =>
      (decision.history ?? []).map((entry) => {
        const conflict = conflictIndex.get(entry.conflictId) ?? {};
        const worksheetName = entry.location?.worksheetName ?? conflict.sheet ?? conflict.location?.worksheetName ?? '—';
        const cell = entry.location?.a1 ?? conflict.cell ?? conflict.location?.a1 ?? '—';
        const conflictLabel = conflict.type
          ? `${worksheetName} · ${cell} · ${conflict.type}`
          : `${worksheetName} · ${cell}`;

        return {
          id: entry.id,
          decisionId: decision.id,
          targetId: decision.targetId,
          conflictId: entry.conflictId,
          conflictLabel,
          worksheetName,
          cell,
          decision: entry.decision,
          decisionLabel: decision.note ?? entry.decision,
          finalValue: entry.finalValue,
          finalValueText: serializeFinalValue(entry.finalValue),
          occurredAt: entry.occurredAt,
          actorName: entry.actor?.displayName ?? entry.actor?.userId ?? 'Regla automática',
          actorId: entry.actor?.userId ?? 'system:auto',
          actorOrigin: entry.actor?.origin ?? 'office-addin',
          changeOrigin: entry.changeOrigin ?? 'manual',
          actionType: entry.actionType,
          isAutomatic: (entry.changeOrigin ?? 'manual') === 'automatic'
        };
      }),
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function buildSupportExport(session) {
  const timeline = buildDecisionTimeline(session);
  const rows = timeline.map((item) => ({
    sessionId: session.sessionId,
    decisionId: item.decisionId,
    targetId: item.targetId,
    conflictId: item.conflictId,
    conflict: item.conflictLabel,
    decision: item.decision,
    finalValue: item.finalValueText,
    user: item.actorName,
    date: item.occurredAt,
    worksheetName: item.worksheetName,
    cell: item.cell,
    affectedLocation: `${item.worksheetName}!${item.cell}`,
    changeOrigin: item.changeOrigin,
    actionType: item.actionType
  }));

  const csvHeader = [
    'sessionId',
    'decisionId',
    'targetId',
    'conflictId',
    'conflict',
    'decision',
    'finalValue',
    'user',
    'date',
    'worksheetName',
    'cell',
    'affectedLocation',
    'changeOrigin',
    'actionType'
  ];

  const csv = [
    csvHeader.join(','),
    ...rows.map((row) => csvHeader.map((column) => escapeCsvValue(row[column])).join(','))
  ].join('\n');

  const jsonl = rows.map((row) => JSON.stringify(row)).join('\n');
  const affectedSheets = [...new Set(rows.map((row) => row.worksheetName))];
  const decisionsByTypeMap = new Map();
  let automaticCount = 0;
  let manualCount = 0;

  rows.forEach((row) => {
    decisionsByTypeMap.set(row.decision, (decisionsByTypeMap.get(row.decision) ?? 0) + 1);
    if (row.changeOrigin === 'automatic') {
      automaticCount += 1;
    } else {
      manualCount += 1;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    decisionTimeline: timeline,
    rows,
    csv,
    jsonl,
    technicalSummary: {
      sessionId: session.sessionId,
      generatedAt: new Date().toISOString(),
      decisionCount: (session.mergeDecisions ?? []).length,
      historyEntryCount: rows.length,
      conflicts: timeline.map((item) => ({
        decisionId: item.decisionId,
        conflictId: item.conflictId,
        lastDecision: item.decision,
        lastOccurredAt: item.occurredAt,
        lastActor: item.actorId,
        lastFinalValue: item.finalValueText
      }))
    },
    supportExport: {
      format: 'jsonl',
      generatedFrom: 'mergeDecisions[*].history',
      rowCount: rows.length,
      affectedSheets,
      manualCount,
      automaticCount,
      decisionsByType: [...decisionsByTypeMap.entries()].map(([decisionType, count]) => ({ decisionType, count }))
    }
  };
}

export function syncDerivedHistoryArtifacts(session) {
  const exportBundle = buildSupportExport(session);

  return {
    ...session,
    decisionTimeline: exportBundle.decisionTimeline,
    technicalSummary: exportBundle.technicalSummary,
    supportExport: {
      ...exportBundle.supportExport,
      csv: exportBundle.csv,
      jsonl: exportBundle.jsonl,
      rows: exportBundle.rows,
      generatedAt: exportBundle.generatedAt
    }
  };
}
