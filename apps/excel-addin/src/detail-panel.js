import { buildHistoryEntry, syncDerivedHistoryArtifacts, upsertMergeDecision } from './history-panel.js';
import { createManualEditDecision, validateManualEdit } from './merge-engine-client.js';

function findConflict(session, conflictId) {
  return (session?.conflicts ?? []).find(
    (conflict) =>
      conflict.id === conflictId ||
      conflict.cellRef === conflictId ||
      (Array.isArray(conflict.cellRefs) && conflict.cellRefs.includes(conflictId)),
  );
}

function assertSessionConsistency(session, conflictId) {
  const problems = [];

  if (!session || typeof session !== 'object') {
    problems.push('session payload missing');
  }
  if (!Array.isArray(session?.conflicts)) {
    problems.push('conflicts collection missing');
  }
  if (!Array.isArray(session?.mergeDecisions)) {
    problems.push('mergeDecisions collection missing');
  }
  if (!session?.resultPreview || typeof session.resultPreview !== 'object') {
    problems.push('resultPreview missing');
  }

  const conflict = problems.length === 0 ? findConflict(session, conflictId) : null;
  if (!conflict) {
    problems.push(`conflict ${conflictId} not found`);
  }

  if (problems.length > 0) {
    const error = new Error(`Invalid session state: ${problems.join(', ')}`);
    error.code = 'INVALID_SESSION_STATE';
    error.details = {
      sessionId: session?.sessionId,
      conflictId,
      sessionStatus: session?.status,
      invalidReason: problems.join(', '),
    };
    throw error;
  }

  return conflict;
}

function inferExpectedType(conflict) {
  return conflict?.sourceA?.type ?? conflict?.sourceB?.type ?? 'string';
}

function getPrimaryCellRef(conflict) {
  return conflict?.cellRef ?? conflict?.cellRefs?.[0] ?? conflict?.id ?? null;
}

function buildBlockMetadata(conflict) {
  const cellRefs = [...new Set([...(conflict?.cellRefs ?? []), conflict?.cellRef].filter(Boolean))];
  return {
    targetId: `block:${conflict.id}`,
    cellRefs,
    scopeType: 'block',
  };
}

function buildPreviewValue(conflict, decision) {
  if (decision.userDecision === 'manual_edit') {
    return {
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      type: decision.manualEdit.type,
      origin: 'manual_edit',
      location: conflict.location,
    };
  }

  const source = decision.userDecision === 'take_right' ? conflict.sourceB : conflict.sourceA;
  return {
    value: source?.value ?? null,
    displayValue: source?.displayValue ?? (source?.value == null ? null : String(source.value)),
    type: source?.type ?? inferExpectedType(conflict),
    origin: decision.userDecision === 'take_right' ? 'right' : 'left',
    location: conflict.location,
  };
}

function previewForCurrentConflict(session, conflict, draftValue) {
  const validation = draftValue === ''
    ? { valid: true, expectedType: inferExpectedType(conflict), error: null }
    : validateManualEdit(conflict, draftValue);

  if (draftValue !== '' && validation.valid) {
    return {
      validation,
      preview: {
        value: validation.parsedValue,
        displayValue: validation.displayValue,
        type: validation.valueType,
        origin: 'manual_edit',
      },
    };
  }

  return {
    validation,
    preview: session?.resultPreview?.cells?.[getPrimaryCellRef(conflict)] ?? null,
  };
}

function uniqueWorksheetDiffIds(conflict, worksheetDiffIds = []) {
  return [...new Set([...(worksheetDiffIds ?? []), conflict?.worksheetDiffId].filter(Boolean))];
}

function createDecisionHistory({ session, conflict, decision, occurredAt, decidedBy }) {
  return [
    buildHistoryEntry({
      sessionId: session.sessionId,
      conflict,
      decisionId: decision.id,
      targetId: decision.targetId,
      decision: decision.userDecision,
      finalValue: decision.userDecision === 'manual_edit'
        ? {
            value: decision.manualEdit.value,
            displayValue: decision.manualEdit.displayValue,
            formula: decision.manualEdit.type === 'formula' ? decision.manualEdit.value : null,
            type: decision.manualEdit.type,
          }
        : buildPreviewValue(conflict, decision),
      occurredAt,
      actor: decidedBy,
      actionType: decision.userDecision === 'manual_edit' ? 'manual_edit_saved' : 'decision_applied',
      changeOrigin: 'manual',
    }),
  ];
}

function createSideDecision(session, conflict, { decisionType, decidedBy, decidedAt, scopeType, targetId, cellRefs, worksheetDiffIds }) {
  const userDecision = decisionType === 'accept_right' ? 'take_right' : 'take_left';
  const finalState = decisionType === 'accept_right' ? 'accepted_b' : 'accepted_a';
  const resolvedCellRefs = [...new Set([...(cellRefs ?? []), ...(conflict.cellRefs ?? []), conflict.cellRef].filter(Boolean))];
  const resolvedTargetId = targetId ?? (scopeType === 'block' ? `block:${conflict.id}` : conflict.id);

  const decision = {
    id: `decision:${resolvedTargetId}:${decisionType}`,
    nodeType: 'MergeDecision',
    targetType: scopeType === 'block' ? 'block' : 'conflict',
    targetId: resolvedTargetId,
    location: conflict.location,
    changeType: conflict.changeType,
    sourceA: conflict.sourceA,
    sourceB: conflict.sourceB,
    userDecision,
    finalState,
    decidedBy,
    decidedAt,
    scopeType: scopeType ?? 'single',
    cellRefs: resolvedCellRefs,
    worksheetDiffIds: uniqueWorksheetDiffIds(conflict, worksheetDiffIds),
  };

  return {
    ...decision,
    history: createDecisionHistory({ session, conflict, decision, occurredAt: decidedAt, decidedBy }),
  };
}

function matchesDecision(conflict, decision) {
  if (decision.targetType === 'block' || decision.scopeType === 'block') {
    return (decision.cellRefs ?? []).some((cellRef) => conflict.cellRef === cellRef || (conflict.cellRefs ?? []).includes(cellRef));
  }

  return (
    conflict.id === decision.targetId ||
    conflict.cellRef === decision.targetId ||
    (conflict.cellRefs ?? []).includes(decision.targetId)
  );
}

function updateConflictState(conflict, decision) {
  if (!matchesDecision(conflict, decision)) {
    return conflict;
  }

  const resolution = decision.userDecision === 'manual_edit'
    ? {
        type: 'manual_edit',
        value: decision.manualEdit.value,
        displayValue: decision.manualEdit.displayValue,
        valueType: decision.manualEdit.type,
      }
    : {
        type: decision.userDecision,
        side: decision.userDecision === 'take_right' ? 'right' : 'left',
      };

  return {
    ...conflict,
    status: 'resolved',
    userDecision: decision.userDecision,
    finalState: decision.finalState,
    resolution,
  };
}

function updateWorksheetDiffs(worksheetDiffs = [], decision) {
  return worksheetDiffs.map((worksheetDiff) => ({
    ...worksheetDiff,
    cellDiffs: (worksheetDiff.cellDiffs ?? []).map((cellDiff) => updateConflictState(cellDiff, decision)),
    conflicts: (worksheetDiff.conflicts ?? []).map((conflict) => updateConflictState(conflict, decision)),
  }));
}

function updateResultPreview(session, decision, updatedConflicts, occurredAt) {
  const nextCells = {
    ...(session.resultPreview?.cells ?? {}),
  };

  updatedConflicts.forEach((conflict) => {
    if (!matchesDecision(conflict, decision)) {
      return;
    }

    const key = getPrimaryCellRef(conflict);
    if (!key) {
      return;
    }

    nextCells[key] = buildPreviewValue(conflict, decision);
  });

  return {
    ...(session.resultPreview ?? {}),
    cells: nextCells,
    updatedAt: occurredAt,
  };
}

function buildSummary(conflicts = []) {
  const totalConflicts = conflicts.length;
  const resolvedConflictCount = conflicts.filter((conflict) => conflict.status === 'resolved' || conflict.finalState === 'merged' || conflict.finalState === 'accepted_a' || conflict.finalState === 'accepted_b').length;
  const unresolvedConflictCount = totalConflicts - resolvedConflictCount;

  return {
    totalConflicts,
    resolvedConflictCount,
    unresolvedConflictCount,
  };
}

export function buildConflictDetailPanelModel(session, conflictId, draftValue = '') {
  const conflict = assertSessionConsistency(session, conflictId);
  const { validation, preview } = previewForCurrentConflict(session, conflict, draftValue);
  const block = buildBlockMetadata(conflict);

  return {
    conflictId: conflict.id,
    title: `Conflicto en ${conflict.location?.worksheetName ?? 'Hoja'} ${conflict.location?.a1 ?? ''}`.trim(),
    editableField: {
      label: 'Valor final',
      value: draftValue,
      placeholder: 'Escribe el valor final manual (solo valor o fórmula simple)',
      expectedType: validation.expectedType,
      validationMessage: validation.valid ? null : validation.error,
      isValid: validation.valid,
    },
    actions: {
      acceptLeft: {
        type: 'APPLY_MERGE_DECISION',
        enabled: true,
        decisionType: 'accept_left',
      },
      acceptRight: {
        type: 'APPLY_MERGE_DECISION',
        enabled: true,
        decisionType: 'accept_right',
      },
      saveManualEdit: {
        type: 'APPLY_MERGE_DECISION',
        enabled: draftValue !== '' && validation.valid,
        decisionType: 'manual_edit',
      },
      acceptLeftBlock: {
        type: 'APPLY_MERGE_DECISION',
        enabled: block.cellRefs.length > 0,
        decisionType: 'accept_left',
        scopeType: 'block',
        targetId: block.targetId,
        cellRefs: block.cellRefs,
      },
      acceptRightBlock: {
        type: 'APPLY_MERGE_DECISION',
        enabled: block.cellRefs.length > 0,
        decisionType: 'accept_right',
        scopeType: 'block',
        targetId: block.targetId,
        cellRefs: block.cellRefs,
      },
    },
    preview: preview
      ? {
          title: 'Vista previa del resultado final',
          cell: conflict.location?.a1 ?? null,
          value: preview.displayValue,
          type: preview.type,
          origin: preview.origin,
        }
      : null,
    resolutionSummary: buildSummary(session.conflicts ?? []),
  };
}

export function createDecisionActionFromPanel(session, {
  conflictId,
  decisionType,
  rawValue,
  decidedBy,
  decidedAt = new Date().toISOString(),
  scopeType,
  targetId,
  cellRefs,
  worksheetDiffIds,
}) {
  const conflict = assertSessionConsistency(session, conflictId);

  let payload;
  if (decisionType === 'manual_edit') {
    payload = createManualEditDecision({
      conflict,
      rawValue,
      decidedBy,
      decidedAt,
    });
    payload = {
      ...payload,
      history: createDecisionHistory({ session, conflict, decision: payload, occurredAt: decidedAt, decidedBy }),
    };
  } else if (decisionType === 'accept_left' || decisionType === 'accept_right') {
    payload = createSideDecision(session, conflict, {
      decisionType,
      decidedBy,
      decidedAt,
      scopeType,
      targetId,
      cellRefs,
      worksheetDiffIds,
    });
  } else {
    throw new Error(`Unsupported decision type: ${decisionType}`);
  }

  return {
    type: 'APPLY_MERGE_DECISION',
    sessionId: session.sessionId,
    payload,
  };
}

export function saveManualEditFromPanel(session, { conflictId, rawValue, decidedBy, decidedAt }) {
  return createDecisionActionFromPanel(session, {
    conflictId,
    decisionType: 'manual_edit',
    rawValue,
    decidedBy,
    decidedAt,
  });
}

export function reduceSessionState(session, action) {
  if (action?.type !== 'APPLY_MERGE_DECISION') {
    return session;
  }

  const decision = action.payload;
  if (!decision?.targetId || !decision?.userDecision) {
    const error = new Error('Invalid session state: action payload incomplete');
    error.code = 'INVALID_SESSION_STATE';
    throw error;
  }
  if (decision.userDecision === 'manual_edit' && !decision.manualEdit) {
    const error = new Error('Invalid session state: action payload incomplete');
    error.code = 'INVALID_SESSION_STATE';
    throw error;
  }

  const updatedConflicts = (session.conflicts ?? []).map((conflict) => updateConflictState(conflict, decision));
  if (!updatedConflicts.some((conflict) => matchesDecision(conflict, decision))) {
    const error = new Error(`Invalid session state: target ${decision.targetId} is missing from conflicts`);
    error.code = 'INVALID_SESSION_STATE';
    throw error;
  }

  const nextSession = {
    ...session,
    status: 'attention_required',
    conflicts: updatedConflicts,
    mergeDecisions: upsertMergeDecision(session.mergeDecisions ?? [], decision),
    resultPreview: updateResultPreview(session, decision, updatedConflicts, decision.decidedAt),
    worksheetDiffs: updateWorksheetDiffs(session.worksheetDiffs ?? [], decision),
    workbookDiff: session.workbookDiff
      ? {
          ...session.workbookDiff,
          conflicts: (session.workbookDiff.conflicts ?? []).map((conflict) => updateConflictState(conflict, decision)),
          worksheetDiffs: updateWorksheetDiffs(session.workbookDiff.worksheetDiffs ?? [], decision),
        }
      : session.workbookDiff,
    summary: buildSummary(updatedConflicts),
    updatedAt: decision.decidedAt,
  };

  return syncDerivedHistoryArtifacts(nextSession);
}
