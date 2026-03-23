import { validateManualEdit } from './manual-edit.js';

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDecisionType(value) {
  if (value === 'left' || value === 'take_a' || value === 'take_left' || value === 'accept_left') {
    return 'take_a';
  }
  if (value === 'right' || value === 'take_b' || value === 'take_right' || value === 'accept_right') {
    return 'take_b';
  }
  if (value === 'manual' || value === 'manual_edit') {
    return 'manual_edit';
  }
  return 'unresolved';
}

function deriveStatusFromDecision(decisionType) {
  switch (normalizeDecisionType(decisionType)) {
    case 'take_a':
    case 'take_b':
      return 'resolved';
    case 'manual_edit':
      return 'manual';
    default:
      return 'pending';
  }
}

function deriveFinalStateFromDecision(decisionType) {
  switch (normalizeDecisionType(decisionType)) {
    case 'take_a':
      return 'accepted_a';
    case 'take_b':
      return 'accepted_b';
    case 'manual_edit':
      return 'merged';
    default:
      return 'unresolved';
  }
}

function decisionToResolution(decisionType) {
  switch (normalizeDecisionType(decisionType)) {
    case 'take_a':
      return 'left';
    case 'take_b':
      return 'right';
    case 'manual_edit':
      return 'manual';
    default:
      return null;
  }
}

function conflictMatches(conflict, conflictId) {
  return conflict?.id === conflictId || conflict?.cellRef === conflictId || conflict?.cellRefs?.includes?.(conflictId);
}

function findConflict(session, conflictId) {
  return (session?.conflicts ?? []).find((conflict) => conflictMatches(conflict, conflictId)) ?? null;
}

function replaceDecision(mergeDecisions = [], nextDecision) {
  const consumedTargets = new Set([
    nextDecision.targetId,
    ...(nextDecision.cellRefs ?? []),
  ].filter(Boolean));

  return [
    ...mergeDecisions.filter((decision) => {
      const target = decision?.targetId;
      if (target && consumedTargets.has(target)) {
        return false;
      }
      return !(decision?.cellRefs ?? []).some((cellRef) => consumedTargets.has(cellRef));
    }),
    nextDecision,
  ];
}

function updateCollectionConflicts(conflicts = [], conflictId, updater) {
  return conflicts.map((conflict) => (conflictMatches(conflict, conflictId) ? updater(conflict) : conflict));
}

function updateWorkbookDiff(workbookDiff, conflictId, updater) {
  if (!workbookDiff || typeof workbookDiff !== 'object') {
    return workbookDiff;
  }

  const next = deepClone(workbookDiff);
  next.conflicts = updateCollectionConflicts(next.conflicts ?? [], conflictId, updater);
  next.worksheetDiffs = (next.worksheetDiffs ?? []).map((worksheetDiff) => ({
    ...worksheetDiff,
    conflicts: updateCollectionConflicts(worksheetDiff.conflicts ?? [], conflictId, updater),
  }));
  return next;
}

function updateResultPreview(session, conflict, preview, decidedAt) {
  const key = conflict?.cellRef ?? conflict?.cellRefs?.[0] ?? conflict?.id;
  if (!key) {
    return session.resultPreview ?? { cells: {}, updatedAt: decidedAt };
  }

  return {
    ...(session.resultPreview ?? {}),
    cells: {
      ...(session.resultPreview?.cells ?? {}),
      [key]: preview,
    },
    updatedAt: decidedAt,
  };
}

function createSideDecision(conflict, side, decidedBy, decidedAt) {
  const decisionType = side === 'left' ? 'take_a' : 'take_b';
  const targetId = conflict.id;
  return {
    id: `decision:${targetId}:${decisionType}:${decidedAt}`,
    nodeType: 'MergeDecision',
    targetType: 'conflict',
    targetId,
    cellRefs: conflict.cellRefs ?? (conflict.cellRef ? [conflict.cellRef] : []),
    location: deepClone(conflict.location ?? null),
    changeType: conflict.changeType ?? conflict.type ?? 'conflict',
    sourceA: deepClone(conflict.sourceA ?? conflict.leftSource ?? null),
    sourceB: deepClone(conflict.sourceB ?? conflict.rightSource ?? null),
    userDecision: decisionType,
    finalState: deriveFinalStateFromDecision(decisionType),
    decidedBy,
    decidedAt,
  };
}

function createManualDecision(conflict, rawValue, decidedBy, decidedAt) {
  const validation = validateManualEdit(conflict, rawValue);
  if (!validation.valid) {
    const error = new Error(validation.error);
    error.code = 'INVALID_MANUAL_EDIT';
    throw error;
  }

  return {
    id: `decision:${conflict.id}:manual_edit:${decidedAt}`,
    nodeType: 'MergeDecision',
    targetType: 'conflict',
    targetId: conflict.id,
    cellRefs: conflict.cellRefs ?? (conflict.cellRef ? [conflict.cellRef] : []),
    location: deepClone(conflict.location ?? null),
    changeType: conflict.changeType ?? conflict.type ?? 'conflict',
    sourceA: deepClone(conflict.sourceA ?? conflict.leftSource ?? null),
    sourceB: deepClone(conflict.sourceB ?? conflict.rightSource ?? null),
    userDecision: 'manual_edit',
    finalState: 'merged',
    decidedBy,
    decidedAt,
    manualEdit: {
      rawValue: String(rawValue),
      value: validation.parsedValue,
      displayValue: validation.displayValue,
      type: validation.valueType,
    },
  };
}

function buildPreviewFromDecision(conflict, decision) {
  if (decision.userDecision === 'manual_edit') {
    return {
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      type: decision.manualEdit.type,
      origin: 'manual_edit',
      location: deepClone(conflict.location ?? null),
    };
  }

  const source = decision.userDecision === 'take_b'
    ? (conflict.rightSource ?? conflict.sourceB)
    : (conflict.leftSource ?? conflict.sourceA);

  return {
    value: deepClone(source?.value ?? null),
    displayValue: source?.displayValue ?? (source?.value == null ? null : String(source.value)),
    formula: source?.formula ?? null,
    type: source?.type ?? null,
    origin: decision.userDecision === 'take_b' ? 'sourceB' : 'sourceA',
    location: deepClone(conflict.location ?? null),
  };
}

function applyConflictPatch(conflict, decision) {
  const decisionType = normalizeDecisionType(decision.userDecision);
  const next = {
    ...conflict,
    userDecision: decisionType,
    finalState: deriveFinalStateFromDecision(decisionType),
    status: deriveStatusFromDecision(decisionType),
    resolution: decisionToResolution(decisionType),
    manualValue: decision.userDecision === 'manual_edit' ? decision.manualEdit.displayValue : '',
  };

  if (decision.userDecision === 'manual_edit') {
    next.resolution = {
      type: 'manual_edit',
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      valueType: decision.manualEdit.type,
      origin: 'manual_edit',
    };
  }

  return next;
}

export function buildReviewSummary(session) {
  const conflicts = session?.conflicts ?? [];
  const pendingConflicts = conflicts.filter((conflict) => conflict.status === 'pending');
  const resolvedConflicts = conflicts.filter((conflict) => conflict.status !== 'pending');
  const manualConflicts = conflicts.filter((conflict) => conflict.status === 'manual');
  const criticalPending = pendingConflicts.filter((conflict) => (
    conflict.severity === 'critical'
    || ['formula_changed', 'worksheet_missing', 'worksheet_added', 'structural_conflict'].includes(conflict.changeType)
  ));

  return {
    total: conflicts.length,
    pending: pendingConflicts.length,
    resolved: resolvedConflicts.length,
    manual: manualConflicts.length,
    criticalPending: criticalPending.length,
    affectedSheets: [...new Set(conflicts.map((conflict) => conflict.worksheetName ?? conflict.sheet).filter(Boolean))],
    pendingConflicts,
    canExport: conflicts.length > 0 && pendingConflicts.length === 0,
  };
}

export function applySideDecisionToSession(session, conflictId, side, options = {}) {
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const decidedAt = options.decidedAt ?? new Date().toISOString();
  const decidedBy = options.decidedBy ?? 'task-pane';
  const decision = createSideDecision(conflict, side, decidedBy, decidedAt);
  const preview = buildPreviewFromDecision(conflict, decision);

  const nextSession = {
    ...session,
    updatedAt: decidedAt,
    conflicts: updateCollectionConflicts(session.conflicts ?? [], conflictId, (item) => applyConflictPatch(item, decision)),
    workbookDiff: updateWorkbookDiff(session.workbookDiff, conflictId, (item) => applyConflictPatch(item, decision)),
    mergeDecisions: replaceDecision(session.mergeDecisions ?? [], decision),
  };

  nextSession.resultPreview = updateResultPreview(nextSession, conflict, preview, decidedAt);
  nextSession.summary = buildReviewSummary(nextSession);
  nextSession.status = nextSession.summary.pending > 0 ? 'pending_review' : 'ready_for_export';
  return nextSession;
}

export function applyManualDecisionToSession(session, conflictId, rawValue, options = {}) {
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const decidedAt = options.decidedAt ?? new Date().toISOString();
  const decidedBy = options.decidedBy ?? 'task-pane';
  const decision = createManualDecision(conflict, rawValue, decidedBy, decidedAt);
  const preview = buildPreviewFromDecision(conflict, decision);

  const nextSession = {
    ...session,
    updatedAt: decidedAt,
    conflicts: updateCollectionConflicts(session.conflicts ?? [], conflictId, (item) => applyConflictPatch(item, decision)),
    workbookDiff: updateWorkbookDiff(session.workbookDiff, conflictId, (item) => applyConflictPatch(item, decision)),
    mergeDecisions: replaceDecision(session.mergeDecisions ?? [], decision),
  };

  nextSession.resultPreview = updateResultPreview(nextSession, conflict, preview, decidedAt);
  nextSession.summary = buildReviewSummary(nextSession);
  nextSession.status = nextSession.summary.pending > 0 ? 'pending_review' : 'ready_for_export';
  return nextSession;
}
