const SUPPORTED_TYPES = new Set(['string', 'number', 'boolean', 'formula']);
const CANONICAL_DECISIONS = new Set(['accept_left', 'accept_right', 'manual_edit', 'skip', 'unresolved']);
const DECISION_STATE_MAP = {
  accept_left: 'accepted_a',
  accept_right: 'accepted_b',
  manual_edit: 'merged',
  skip: 'pending',
  unresolved: 'unresolved',
};

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function inferCellType(conflict) {
  const candidateTypes = [conflict?.sourceA?.type, conflict?.sourceB?.type].filter(Boolean);
  const preferred = candidateTypes.find((type) => SUPPORTED_TYPES.has(type));
  return preferred ?? 'string';
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

function normalizeRefs(...valueSets) {
  return [...new Set(valueSets.flat().filter(Boolean))];
}

function resolveWorksheetDiffIds(conflict, worksheetDiffIds = []) {
  const explicit = normalizeRefs(worksheetDiffIds);
  if (explicit.length > 0) {
    return explicit;
  }

  if (conflict?.worksheetDiffId) {
    return [conflict.worksheetDiffId];
  }

  return [];
}

function coerceManualEditValue(rawValue, expectedType) {
  if (expectedType === 'number') {
    const trimmed = String(rawValue).trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Introduce un número válido para resolver este conflicto.' };
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      return { ok: false, error: 'Introduce un número válido para resolver este conflicto.' };
    }

    return {
      ok: true,
      valueType: 'number',
      parsedValue: numericValue,
      displayValue: trimmed,
    };
  }

  if (expectedType === 'boolean') {
    const normalized = String(rawValue).trim().toLowerCase();
    const booleanMap = new Map([
      ['true', true],
      ['false', false],
      ['verdadero', true],
      ['falso', false],
      ['sí', true],
      ['si', true],
      ['no', false],
      ['1', true],
      ['0', false],
    ]);

    if (!booleanMap.has(normalized)) {
      return { ok: false, error: 'Usa un valor booleano válido: true/false, sí/no o 1/0.' };
    }

    const parsedValue = booleanMap.get(normalized);
    return {
      ok: true,
      valueType: 'boolean',
      parsedValue,
      displayValue: parsedValue ? 'TRUE' : 'FALSE',
    };
  }

  if (expectedType === 'formula') {
    const trimmed = String(rawValue).trim();
    if (!trimmed.startsWith('=')) {
      return { ok: false, error: "Las fórmulas manuales deben empezar por '='." };
    }

    return {
      ok: true,
      valueType: 'formula',
      parsedValue: trimmed,
      displayValue: trimmed,
    };
  }

  return {
    ok: true,
    valueType: 'string',
    parsedValue: String(rawValue),
    displayValue: String(rawValue),
  };
}

function buildPreviewForDecision({ decisionType, conflict, manualEdit, cellRefOverride }) {
  const location = deepClone(conflict?.location ?? null);
  const targetId = cellRefOverride ?? conflict?.cellRef ?? conflict?.cellRefs?.[0] ?? conflict?.id ?? null;

  if (decisionType === 'manual_edit' && manualEdit) {
    return {
      targetId,
      location,
      value: manualEdit.value,
      displayValue: manualEdit.displayValue,
      type: manualEdit.type,
      origin: 'manual_edit',
    };
  }

  const source = decisionType === 'accept_right' ? conflict?.sourceB : conflict?.sourceA;
  return {
    targetId,
    location,
    value: deepClone(source?.value ?? null),
    displayValue: source?.displayValue ?? (source?.value == null ? null : String(source.value)),
    type: source?.type ?? inferCellType(conflict),
    origin: decisionType === 'accept_right' ? 'right' : 'left',
  };
}

export function validateManualEdit(conflict, rawValue) {
  const expectedType = inferCellType(conflict);
  const validation = coerceManualEditValue(rawValue, expectedType);

  if (!validation.ok) {
    return {
      valid: false,
      expectedType,
      error: validation.error,
    };
  }

  return {
    valid: true,
    expectedType,
    parsedValue: validation.parsedValue,
    displayValue: validation.displayValue,
    valueType: validation.valueType,
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
  cellRefs,
  worksheetDiffIds,
  rawValue,
}) {
  const normalizedDecisionType = normalizeDecisionType(decisionType);
  const normalizedCellRefs = normalizeRefs(cellRefs, conflict?.cellRef ? [conflict.cellRef] : [], conflict?.cellRefs ?? []);
  const normalizedWorksheetDiffIds = resolveWorksheetDiffIds(conflict, worksheetDiffIds);
  const effectiveScopeType = scopeType ?? 'target';
  const effectiveTargetType = targetType ?? (effectiveScopeType === 'block' ? 'block' : conflict?.scopeType ?? 'conflict');
  const effectiveTargetId =
    targetId ??
    (effectiveScopeType === 'block'
      ? `block:${normalizedWorksheetDiffIds[0] ?? normalizedCellRefs[0] ?? conflict?.id ?? 'unknown'}`
      : conflict?.id ?? normalizedCellRefs[0] ?? normalizedWorksheetDiffIds[0] ?? 'target:unknown');

  let manualEdit = null;
  if (normalizedDecisionType === 'manual_edit') {
    const validation = validateManualEdit(conflict, rawValue);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    manualEdit = {
      rawValue: String(rawValue),
      value: validation.parsedValue,
      displayValue: validation.displayValue,
      type: validation.valueType,
    };
  }

  return {
    id: `decision:${effectiveTargetId}:${normalizedDecisionType}:${decidedAt}`,
    nodeType: 'MergeDecision',
    decisionType: normalizedDecisionType,
    userDecision: normalizedDecisionType,
    targetType: effectiveTargetType,
    scopeType: effectiveScopeType,
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
      decisionType: normalizedDecisionType,
      conflict,
      manualEdit,
      cellRefOverride: normalizedCellRefs[0],
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
  return createMergeDecision({ ...options, decisionType: 'manual_edit' });
}

function buildDecisionCoverage(decisions = []) {
  const coverage = {
    byConflictId: new Map(),
    byCellRef: new Map(),
    byWorksheetDiffId: new Map(),
  };

  for (const decision of decisions) {
    const normalizedDecisionType = normalizeDecisionType(decision?.decisionType ?? decision?.userDecision);
    const normalizedDecision = {
      ...decision,
      decisionType: normalizedDecisionType,
      userDecision: normalizedDecisionType,
      finalState: decision?.finalState ?? decisionToFinalState(normalizedDecisionType),
      cellRefs: normalizeRefs(decision?.cellRefs ?? []),
      worksheetDiffIds: normalizeRefs(decision?.worksheetDiffIds ?? []),
    };

    if (normalizedDecision.targetId?.startsWith('conflict:')) {
      coverage.byConflictId.set(normalizedDecision.targetId, normalizedDecision);
    }

    if (normalizedDecision.targetId?.startsWith('cell:')) {
      coverage.byCellRef.set(normalizedDecision.targetId, normalizedDecision);
    }

    if (normalizedDecision.targetId?.startsWith('wsd:')) {
      coverage.byWorksheetDiffId.set(normalizedDecision.targetId, normalizedDecision);
    }

    for (const cellRef of normalizedDecision.cellRefs) {
      coverage.byCellRef.set(cellRef, normalizedDecision);
    }

    for (const worksheetDiffId of normalizedDecision.worksheetDiffIds) {
      coverage.byWorksheetDiffId.set(worksheetDiffId, normalizedDecision);
    }
  }

  return coverage;
}

function getDecisionForConflict(conflict, coverage) {
  return (
    coverage.byConflictId.get(conflict.id) ||
    coverage.byCellRef.get(conflict.cellRef) ||
    (conflict.cellRefs ?? []).map((cellRef) => coverage.byCellRef.get(cellRef)).find(Boolean) ||
    coverage.byWorksheetDiffId.get(conflict.worksheetDiffId) ||
    null
  );
}

function getDecisionForCellDiff(cellDiff, coverage) {
  return coverage.byCellRef.get(cellDiff.id) || null;
}

function getDecisionForWorksheetDiff(worksheetDiff, coverage) {
  return coverage.byWorksheetDiffId.get(worksheetDiff.id) || null;
}

function buildResolutionFromDecision(decision, fallbackNode) {
  const normalizedDecisionType = normalizeDecisionType(decision?.decisionType ?? decision?.userDecision);

  if (normalizedDecisionType === 'manual_edit') {
    return {
      type: 'manual_edit',
      value: decision.manualEdit?.value,
      displayValue: decision.manualEdit?.displayValue,
      valueType: decision.manualEdit?.type,
      origin: 'manual_edit',
    };
  }

  const source = normalizedDecisionType === 'accept_right' ? fallbackNode?.sourceB : fallbackNode?.sourceA;
  return {
    type: normalizedDecisionType,
    value: deepClone(source?.value ?? null),
    displayValue: source?.displayValue ?? (source?.value == null ? null : String(source.value)),
    valueType: source?.type ?? inferCellType(fallbackNode),
    origin: normalizedDecisionType === 'accept_right' ? 'right' : 'left',
  };
}

function buildPreviewCellFromResolution(resolution, node, locationOverride) {
  return {
    value: deepClone(resolution.value ?? null),
    displayValue: resolution.displayValue ?? null,
    type: resolution.valueType ?? inferCellType(node),
    origin: resolution.origin,
    location: deepClone(locationOverride ?? node?.location ?? null),
  };
}

function updateConflict(conflict, decision) {
  if (!decision || !CANONICAL_DECISIONS.has(normalizeDecisionType(decision.userDecision))) {
    return {
      ...conflict,
      userDecision: 'unresolved',
      finalState: 'unresolved',
      resolution: null,
    };
  }

  const normalizedDecisionType = normalizeDecisionType(decision.userDecision);
  if (normalizedDecisionType === 'skip' || normalizedDecisionType === 'unresolved') {
    return {
      ...conflict,
      userDecision: normalizedDecisionType,
      finalState: 'unresolved',
      resolution: null,
    };
  }

  return {
    ...conflict,
    userDecision: normalizedDecisionType,
    finalState: decisionToFinalState(normalizedDecisionType),
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

  const normalizedDecisionType = normalizeDecisionType(decision.userDecision);
  if (normalizedDecisionType === 'skip' || normalizedDecisionType === 'unresolved') {
    return {
      ...cellDiff,
      userDecision: normalizedDecisionType,
      finalState: cellDiff.changeType === 'conflict' ? 'unresolved' : 'pending',
      finalValue: null,
    };
  }

  const resolution = buildResolutionFromDecision(decision, cellDiff);
  return {
    ...cellDiff,
    userDecision: normalizedDecisionType,
    finalState: decisionToFinalState(normalizedDecisionType),
    finalValue: {
      value: resolution.value,
      displayValue: resolution.displayValue,
      type: resolution.valueType,
      origin: resolution.origin,
    },
  };
}

function updateWorksheetDiff(worksheetDiff, decision, coverage) {
  const updatedCellDiffs = (worksheetDiff.cellDiffs ?? []).map((cellDiff) => {
    const cellDecision = getDecisionForCellDiff(cellDiff, coverage) ?? decision;
    return updateCellDiff(cellDiff, cellDecision);
  });
  const updatedConflicts = (worksheetDiff.conflicts ?? []).map((conflict) => updateConflict(conflict, getDecisionForConflict(conflict, coverage) ?? decision));
  const pendingConflicts = updatedConflicts.filter((conflict) => conflict.finalState === 'unresolved').length;
  const resolvedCells = updatedCellDiffs.filter((cellDiff) => ['accepted_a', 'accepted_b', 'merged'].includes(cellDiff.finalState)).length;

  return {
    ...worksheetDiff,
    userDecision: decision ? normalizeDecisionType(decision.userDecision) : 'unresolved',
    finalState: pendingConflicts > 0 ? 'unresolved' : resolvedCells > 0 ? 'merged' : worksheetDiff.finalState,
    cellDiffs: updatedCellDiffs,
    conflicts: updatedConflicts,
  };
}

function recalculateResultPreview({ conflicts, worksheetDiffs, decisions }) {
  const coverage = buildDecisionCoverage(decisions);
  const previewCells = {};

  for (const conflict of conflicts) {
    const decision = getDecisionForConflict(conflict, coverage);
    const normalizedDecisionType = normalizeDecisionType(decision?.userDecision);
    if (!decision || normalizedDecisionType === 'skip' || normalizedDecisionType === 'unresolved') {
      continue;
    }

    const resolution = buildResolutionFromDecision(decision, conflict);
    for (const cellRef of normalizeRefs(conflict.cellRef ? [conflict.cellRef] : [], conflict.cellRefs ?? [])) {
      previewCells[cellRef] = buildPreviewCellFromResolution(resolution, conflict);
    }
  }

  for (const worksheetDiff of worksheetDiffs) {
    const worksheetDecision = getDecisionForWorksheetDiff(worksheetDiff, coverage);
    const normalizedDecisionType = normalizeDecisionType(worksheetDecision?.userDecision);
    if (!worksheetDecision || normalizedDecisionType === 'skip' || normalizedDecisionType === 'unresolved') {
      continue;
    }

    for (const cellDiff of worksheetDiff.cellDiffs ?? []) {
      const resolution = buildResolutionFromDecision(worksheetDecision, cellDiff);
      previewCells[cellDiff.id] = buildPreviewCellFromResolution(resolution, cellDiff, cellDiff.location);
    }
  }

  return {
    cells: previewCells,
    updatedAt: decisions.at(-1)?.decidedAt ?? null,
  };
}

function recalculateSummary(conflicts) {
  const pendingConflicts = conflicts
    .filter((conflict) => conflict.finalState === 'unresolved')
    .map((conflict) => ({
      targetType: 'conflict',
      targetId: conflict.id,
      cellRefs: normalizeRefs(conflict.cellRef ? [conflict.cellRef] : [], conflict.cellRefs ?? []),
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

  const rootConflicts = (session.conflicts ?? []).map((conflict) => updateConflict(conflict, getDecisionForConflict(conflict, coverage)));
  const worksheetDiffs = (session.worksheetDiffs ?? []).map((worksheetDiff) => {
    const worksheetDecision = getDecisionForWorksheetDiff(worksheetDiff, coverage);
    return updateWorksheetDiff(worksheetDiff, worksheetDecision, coverage);
  });
  const effectiveConflicts = rootConflicts.length > 0 ? rootConflicts : worksheetDiffs.flatMap((worksheetDiff) => worksheetDiff.conflicts ?? []);
  const summary = recalculateSummary(effectiveConflicts);

  return {
    ...session,
    mergeDecisions,
    conflicts: rootConflicts,
    worksheetDiffs,
    summary,
    pendingConflicts: summary.pendingConflicts,
    resultPreview: recalculateResultPreview({
      conflicts: effectiveConflicts,
      worksheetDiffs,
      decisions: mergeDecisions,
    }),
    status: summary.unresolvedConflictCount > 0 ? 'NeedsReview' : 'Ready',
  };
}
