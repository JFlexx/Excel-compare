import { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';
import { createManualEditDecision as createManualEditDecisionBase, validateManualEdit } from './manual-decisions.js';

export { compare_workbooks, compare_worksheets, compare_cells } from './diff.js';
export {
  getWorksheetDimensions,
  iterateWorksheets,
  loadAndNormalizeWorkbook,
  loadWorkbook,
  normalizeExcelCellToCanonical,
  normalizeWorkbook,
  normalizeWorksheet,
  shouldIgnoreCell,
} from './xlsx-normalizer.js';
export {
  OFFICIAL_MVP_FLOW,
  OFFICIAL_MVP_FLOW_LABELS,
  PILOT_SUPPORTED_SCOPE,
  PILOT_OUT_OF_SCOPE,
  OPERATIONAL_LIMITS,
  buildVisibleMvpLimits,
} from './mvp-config.js';
export {
  ERROR_DEFINITIONS,
  buildError,
  inferErrorCode,
  logEngineError,
  normalizeEngineError,
  sanitizeForUser,
} from './error-catalog.js';

const CANONICAL_DECISIONS = new Set(['accept_left', 'accept_right', 'manual_edit', 'skip', 'unresolved']);
const DECISION_STATE_MAP = Object.freeze({
  accept_left: 'accepted_a',
  accept_right: 'accepted_b',
  manual_edit: 'merged',
  skip: 'pending',
  unresolved: 'unresolved',
});

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDecisionType(decisionType) {
  const aliases = {
    take_a: 'accept_left',
    take_left: 'accept_left',
    accepted_a: 'accept_left',
    left: 'accept_left',
    take_b: 'accept_right',
    take_right: 'accept_right',
    accepted_b: 'accept_right',
    right: 'accept_right',
  };

  const normalized = aliases[decisionType] ?? decisionType;
  return CANONICAL_DECISIONS.has(normalized) ? normalized : 'unresolved';
}

function decisionToFinalState(decisionType) {
  return DECISION_STATE_MAP[normalizeDecisionType(decisionType)] ?? 'pending';
}

function normalizeRefs(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function resolveCellRefs(conflict, explicit = []) {
  return normalizeRefs([...explicit, conflict?.cellRef, ...(conflict?.cellRefs ?? [])]);
}

function resolveWorksheetDiffIds(conflict, explicit = []) {
  return normalizeRefs([...explicit, conflict?.worksheetDiffId]);
}

function buildPreviewForDecision({ conflict, decisionType, manualEdit, cellRefs }) {
  const targetId = cellRefs[0] ?? conflict?.cellRef ?? conflict?.cellRefs?.[0] ?? conflict?.id ?? null;

  if (decisionType === 'manual_edit' && manualEdit) {
    return {
      targetId,
      location: deepClone(conflict?.location ?? null),
      value: manualEdit.value,
      displayValue: manualEdit.displayValue,
      type: manualEdit.type,
      origin: 'manual_edit',
    };
  }

  const source = decisionType === 'accept_right' ? conflict?.sourceB : conflict?.sourceA;
  return {
    targetId,
    location: deepClone(conflict?.location ?? null),
    value: deepClone(source?.value ?? null),
    displayValue: source?.displayValue ?? (source?.value == null ? null : String(source.value)),
    type: source?.type ?? null,
    origin: decisionType === 'accept_right' ? 'right' : 'left',
  };
}

export function createMergeDecision({
  conflict,
  decisionType,
  decidedBy,
  decidedAt = new Date().toISOString(),
  targetId,
  targetType,
  scopeType,
  cellRefs = [],
  worksheetDiffIds = [],
  rawValue,
}) {
  const normalizedDecisionType = normalizeDecisionType(decisionType);
  const normalizedCellRefs = resolveCellRefs(conflict, cellRefs);
  const normalizedWorksheetDiffIds = resolveWorksheetDiffIds(conflict, worksheetDiffIds);
  const effectiveTargetType = targetType ?? (scopeType === 'block' ? 'block' : conflict?.scopeType ?? 'conflict');
  const effectiveTargetId =
    targetId
    ?? (effectiveTargetType === 'block'
      ? `block:${normalizedWorksheetDiffIds[0] ?? normalizedCellRefs[0] ?? conflict?.id ?? 'unknown'}`
      : conflict?.id ?? normalizedCellRefs[0] ?? normalizedWorksheetDiffIds[0] ?? 'target:unknown');

  let manualEdit = null;
  if (normalizedDecisionType === 'manual_edit') {
    const decision = createManualEditDecisionBase({
      conflict,
      rawValue,
      decidedBy,
      decidedAt,
    });
    manualEdit = decision.manualEdit;
  }

  return {
    id: `decision:${effectiveTargetId}:${normalizedDecisionType}:${decidedAt}`,
    nodeType: 'MergeDecision',
    decisionType: normalizedDecisionType,
    userDecision: normalizedDecisionType,
    targetType: effectiveTargetType,
    scopeType: scopeType ?? (effectiveTargetType === 'block' ? 'block' : 'target'),
    targetId: effectiveTargetId,
    cellRefs: normalizedCellRefs,
    worksheetDiffIds: normalizedWorksheetDiffIds,
    location: deepClone(conflict?.location ?? null),
    changeType: conflict?.changeType ?? 'conflict',
    sourceA: deepClone(conflict?.sourceA ?? null),
    sourceB: deepClone(conflict?.sourceB ?? null),
    decidedBy,
    decidedAt,
    finalState: decisionToFinalState(normalizedDecisionType),
    manualEdit,
    preview: buildPreviewForDecision({
      conflict,
      decisionType: normalizedDecisionType,
      manualEdit,
      cellRefs: normalizedCellRefs,
    }),
  };
}

export function createAcceptLeftDecision(options) {
  return createMergeDecision({ ...options, decisionType: 'accept_left' });
}

export function createAcceptRightDecision(options) {
  return createMergeDecision({ ...options, decisionType: 'accept_right' });
}

export function createManualEditDecision(options) {
  const base = createManualEditDecisionBase(options);
  return {
    ...base,
    decisionType: 'manual_edit',
    userDecision: 'manual_edit',
    cellRefs: resolveCellRefs(options.conflict, options.cellRefs ?? [base.targetId]),
    worksheetDiffIds: resolveWorksheetDiffIds(options.conflict, options.worksheetDiffIds),
    scopeType: options.scopeType ?? 'target',
  };
}

function buildDecisionCoverage(decisions = []) {
  const coverage = {
    byConflictId: new Map(),
    byCellRef: new Map(),
    byWorksheetDiffId: new Map(),
  };

  for (const decision of decisions) {
    const normalized = {
      ...decision,
      userDecision: normalizeDecisionType(decision?.decisionType ?? decision?.userDecision),
      finalState: decision?.finalState ?? decisionToFinalState(decision?.decisionType ?? decision?.userDecision),
      cellRefs: normalizeRefs(decision?.cellRefs ?? []),
      worksheetDiffIds: normalizeRefs(decision?.worksheetDiffIds ?? []),
    };

    if (normalized.targetId?.startsWith('conflict:') || normalized.targetType === 'conflict') {
      coverage.byConflictId.set(normalized.targetId, normalized);
    }
    if (normalized.targetId?.startsWith('cell:') || normalized.targetType === 'cell') {
      coverage.byCellRef.set(normalized.targetId, normalized);
    }
    if (normalized.targetId?.startsWith('wsd:') || normalized.targetType === 'worksheet') {
      coverage.byWorksheetDiffId.set(normalized.targetId, normalized);
    }

    for (const cellRef of normalized.cellRefs) {
      coverage.byCellRef.set(cellRef, normalized);
    }
    for (const worksheetDiffId of normalized.worksheetDiffIds) {
      coverage.byWorksheetDiffId.set(worksheetDiffId, normalized);
    }
  }

  return coverage;
}

function buildResolutionFromDecision(decision, fallbackNode) {
  const decisionType = normalizeDecisionType(decision?.userDecision ?? decision?.decisionType);
  if (decisionType === 'manual_edit') {
    return {
      type: 'manual_edit',
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      valueType: decision.manualEdit.type,
      origin: 'manual_edit',
    };
  }

  const source = decisionType === 'accept_right' ? fallbackNode?.sourceB : fallbackNode?.sourceA;
  return {
    type: decisionType,
    value: deepClone(source?.value ?? null),
    displayValue: source?.displayValue ?? (source?.value == null ? null : String(source.value)),
    valueType: source?.type ?? null,
    origin: decisionType === 'accept_right' ? 'right' : 'left',
  };
}

function updateConflict(conflict, decision) {
  if (!decision) {
    return {
      ...conflict,
      userDecision: 'unresolved',
      finalState: 'unresolved',
      resolution: null,
    };
  }

  const decisionType = normalizeDecisionType(decision.userDecision);
  if (decisionType === 'skip' || decisionType === 'unresolved') {
    return {
      ...conflict,
      userDecision: decisionType,
      finalState: 'unresolved',
      resolution: null,
    };
  }

  return {
    ...conflict,
    userDecision: decisionType,
    finalState: decisionToFinalState(decisionType),
    resolution: buildResolutionFromDecision(decision, conflict),
  };
}

function updateCellDiff(cellDiff, decision) {
  if (!decision) {
    return {
      ...cellDiff,
      userDecision: 'unresolved',
      finalState: cellDiff.changeType === 'conflict' ? 'unresolved' : 'pending',
      finalValue: null,
    };
  }

  const decisionType = normalizeDecisionType(decision.userDecision);
  if (decisionType === 'skip' || decisionType === 'unresolved') {
    return {
      ...cellDiff,
      userDecision: decisionType,
      finalState: cellDiff.changeType === 'conflict' ? 'unresolved' : 'pending',
      finalValue: null,
    };
  }

  const resolution = buildResolutionFromDecision(decision, cellDiff);
  return {
    ...cellDiff,
    userDecision: decisionType,
    finalState: decisionToFinalState(decisionType),
    finalValue: {
      value: resolution.value,
      displayValue: resolution.displayValue,
      type: resolution.valueType,
      origin: resolution.origin,
    },
  };
}

function recalculateResultPreview(conflicts, decisions) {
  const coverage = buildDecisionCoverage(decisions);
  const cells = {};

  for (const conflict of conflicts) {
    const decision =
      coverage.byConflictId.get(conflict.id)
      || coverage.byCellRef.get(conflict.cellRef)
      || (conflict.cellRefs ?? []).map((cellRef) => coverage.byCellRef.get(cellRef)).find(Boolean)
      || null;

    if (!decision) {
      continue;
    }

    const decisionType = normalizeDecisionType(decision.userDecision);
    if (decisionType === 'skip' || decisionType === 'unresolved') {
      continue;
    }

    const resolution = buildResolutionFromDecision(decision, conflict);
    for (const cellRef of resolveCellRefs(conflict)) {
      cells[cellRef] = {
        value: resolution.value,
        displayValue: resolution.displayValue,
        type: resolution.valueType,
        origin: resolution.origin,
        location: deepClone(conflict.location ?? null),
      };
    }
  }

  return {
    cells,
    updatedAt: decisions.at(-1)?.decidedAt ?? null,
  };
}

function recalculateSummary(conflicts) {
  const pendingConflicts = conflicts
    .filter((conflict) => conflict.finalState === 'unresolved')
    .map((conflict) => ({
      targetType: 'conflict',
      targetId: conflict.id,
      cellRefs: resolveCellRefs(conflict),
      reason: conflict.reason ?? null,
      location: deepClone(conflict.location ?? null),
    }));

  return {
    totalConflicts: conflicts.length,
    resolvedConflictCount: conflicts.length - pendingConflicts.length,
    unresolvedConflictCount: pendingConflicts.length,
    pendingConflicts,
  };
}

export function applyDecisionToSession(session, decision) {
  const mergeDecisions = [...(session.mergeDecisions ?? []), decision];
  const coverage = buildDecisionCoverage(mergeDecisions);
  const topLevelConflicts = (session.conflicts ?? []).map((conflict) => {
    const conflictDecision =
      coverage.byConflictId.get(conflict.id)
      || coverage.byCellRef.get(conflict.cellRef)
      || (conflict.cellRefs ?? []).map((cellRef) => coverage.byCellRef.get(cellRef)).find(Boolean)
      || null;
    return updateConflict(conflict, conflictDecision);
  });

  const worksheetDiffs = (session.worksheetDiffs ?? []).map((worksheetDiff) => {
    const worksheetDecision = coverage.byWorksheetDiffId.get(worksheetDiff.id) || null;
    const worksheetConflicts = (worksheetDiff.conflicts ?? []).map((conflict) => {
      const conflictDecision =
        coverage.byConflictId.get(conflict.id)
        || coverage.byCellRef.get(conflict.cellRef)
        || (conflict.cellRefs ?? []).map((cellRef) => coverage.byCellRef.get(cellRef)).find(Boolean)
        || worksheetDecision;
      return updateConflict(conflict, conflictDecision);
    });

    return {
      ...worksheetDiff,
      cellDiffs: (worksheetDiff.cellDiffs ?? []).map((cellDiff) => {
        const matchingConflict = topLevelConflicts.find((conflict) => (conflict.cellRefs ?? [conflict.cellRef]).includes(cellDiff.id));
        const cellDecision = coverage.byCellRef.get(cellDiff.id) || (matchingConflict ? coverage.byConflictId.get(matchingConflict.id) : null) || worksheetDecision;
        return updateCellDiff(cellDiff, cellDecision);
      }),
      conflicts: worksheetConflicts,
    };
  });

  const conflicts = topLevelConflicts.length > 0 ? topLevelConflicts : worksheetDiffs.flatMap((worksheetDiff) => worksheetDiff.conflicts ?? []);
  const summary = recalculateSummary(conflicts);

  return {
    ...session,
    mergeDecisions,
    worksheetDiffs,
    conflicts,
    workbookDiff: session.workbookDiff
      ? {
          ...session.workbookDiff,
          worksheetDiffs,
          conflicts,
          userDecision: summary.unresolvedConflictCount > 0 ? 'unresolved' : 'take_both',
          finalState: summary.unresolvedConflictCount > 0 ? 'unresolved' : 'merged',
          summary: {
            ...(session.workbookDiff.summary ?? {}),
            conflictCount: summary.totalConflicts,
          },
        }
      : session.workbookDiff,
    summary: {
      ...(session.summary ?? {}),
      resolvedConflictCount: summary.resolvedConflictCount,
      unresolvedConflictCount: summary.unresolvedConflictCount,
      pendingConflictCount: summary.unresolvedConflictCount,
      totalConflictCount: summary.totalConflicts,
      totalConflicts: summary.totalConflicts,
    },
    resultPreview: recalculateResultPreview(conflicts, mergeDecisions),
    status: summary.unresolvedConflictCount > 0 ? 'NeedsReview' : 'Ready',
  };
}

export {
  apply_merge_decisions,
  buildXlsxPayload,
  validateManualEdit,
};
