import { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';

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
const SUPPORTED_TYPES = new Set(["string", "number", "boolean", "formula"]);
'use strict';

import { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';
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

const SUPPORTED_TYPES = new Set(['string', 'number', 'boolean', 'formula']);

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

function normalizeCellRefs(...valueSets) {
  return [...new Set(valueSets.flat().filter(Boolean))];
}

function resolveWorksheetDiffIds(conflict, worksheetDiffIds = []) {
  const explicit = normalizeCellRefs(worksheetDiffIds);
  if (explicit.length > 0) {
    return explicit;
  }

  if (conflict?.worksheetDiffId) {
    return [conflict.worksheetDiffId];
  }

  return [];
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

function coerceManualEditValue(rawValue, expectedType) {
  if (expectedType === 'number') {
    const trimmed = String(rawValue).trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: 'Introduce un número válido para resolver este conflicto.',
      };
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      return {
        ok: false,
        error: 'Introduce un número válido para resolver este conflicto.',
      };
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
      return {
        ok: false,
        error: 'Usa un valor booleano válido: true/false, sí/no o 1/0.',
      };
    }

    return {
      ok: true,
      valueType: 'boolean',
      parsedValue: booleanMap.get(normalized),
      displayValue: booleanMap.get(normalized) ? 'TRUE' : 'FALSE',
    };
  }

  if (expectedType === 'formula') {
    const trimmed = String(rawValue).trim();
    if (!trimmed.startsWith('=')) {
      return {
        ok: false,
        error: "Las fórmulas manuales deben empezar por '='.",
      };
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
  const normalizedCellRefs = normalizeCellRefs(cellRefs, conflict?.cellRef ? [conflict.cellRef] : [], conflict?.cellRefs ?? []);
  const normalizedWorksheetDiffIds = resolveWorksheetDiffIds(conflict, worksheetDiffIds);
  const effectiveTargetType = targetType ?? (scopeType === 'block' ? 'block' : conflict?.scopeType ?? 'conflict');
  const effectiveTargetId =
    targetId ??
    (scopeType === 'block'
      ? `block:${normalizedWorksheetDiffIds[0] ?? normalizedCellRefs[0] ?? conflict?.id ?? 'unknown'}`
      : conflict?.id ?? normalizedCellRefs[0] ?? normalizedWorksheetDiffIds[0] ?? 'target:unknown');

  let manualEdit = null;
  if (normalizedDecisionType === 'manual_edit') {
    const validation = validateManualEdit(conflict, rawValue);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    manualEdit = {
  const targetId = conflict.cellRef ?? conflict.cellRefs?.[0] ?? conflict.id;
  const preview = {
    targetId,
    location: conflict.location,
    value: validation.parsedValue,
    displayValue: validation.displayValue,
    type: validation.valueType,
  };

  return {
    id: `decision:${targetId}:manual_edit`,
    nodeType: 'MergeDecision',
    targetType: 'cell',
    targetId,
    location: conflict.location,
    changeType: conflict.changeType,
    sourceA: conflict.sourceA,
    sourceB: conflict.sourceB,
    userDecision: 'manual_edit',
    finalState: 'merged',
    decidedBy,
    decidedAt,
    manualEdit: {
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
      decisionType: normalizedDecisionType,
      conflict,
      manualEdit,
      cellRefOverride: normalizedCellRefs[0],
    }),
    },
    preview,
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
    const normalizedDecision = {
      ...decision,
      decisionType: normalizeDecisionType(decision?.decisionType ?? decision?.userDecision),
      userDecision: normalizeDecisionType(decision?.decisionType ?? decision?.userDecision),
      finalState: decision?.finalState ?? decisionToFinalState(decision?.decisionType ?? decision?.userDecision),
      cellRefs: normalizeCellRefs(decision?.cellRefs ?? []),
      worksheetDiffIds: normalizeCellRefs(decision?.worksheetDiffIds ?? []),
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
    null
export function applyDecisionToSession(session, decision) {
  const targetId = decision.targetId;
  const updatedConflicts = updateCollection(
    session.conflicts ?? [],
    (conflict) => conflict.id === targetId || conflict.cellRef === targetId || conflict.cellRefs?.includes(targetId),
    (conflict) => ({
      ...conflict,
      userDecision: decision.userDecision,
      finalState: decision.finalState,
      resolution: {
        type: 'manual_edit',
        value: decision.manualEdit.value,
        displayValue: decision.manualEdit.displayValue,
        valueType: decision.manualEdit.type,
      },
    }),
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
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      valueType: decision.manualEdit.type,
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
  const updatedSheets = updateCollection(session.worksheetDiffs ?? [], () => true, (sheet) => ({
    ...sheet,
    cellDiffs: updateCollection(
      sheet.cellDiffs ?? [],
      (cellDiff) => cellDiff.id === targetId,
      (cellDiff) => ({
        ...cellDiff,
        userDecision: decision.userDecision,
        finalState: decision.finalState,
        finalValue: {
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          type: decision.manualEdit.type,
          origin: 'manual_edit',
        },
      }),
    ),
  }));

  const mergedCellPreviews = {
    ...(session.resultPreview?.cells ?? {}),
    [targetId]: {
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      type: decision.manualEdit.type,
      origin: 'manual_edit',
      location: decision.location,
    },
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

function updateWorksheetDiff(worksheetDiff, decision) {
  const updatedCellDiffs = (worksheetDiff.cellDiffs ?? []).map((cellDiff) => updateCellDiff(cellDiff, decision));
  const updatedConflicts = (worksheetDiff.conflicts ?? []).map((conflict) => updateConflict(conflict, decision));
  const resolvedCells = updatedCellDiffs.filter((cellDiff) => ['accepted_a', 'accepted_b', 'merged'].includes(cellDiff.finalState)).length;
  const pendingConflicts = updatedConflicts.filter((conflict) => conflict.finalState === 'unresolved').length;

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
    for (const cellRef of normalizeCellRefs(conflict.cellRef ? [conflict.cellRef] : [], conflict.cellRefs ?? [])) {
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
      cellRefs: normalizeCellRefs(conflict.cellRef ? [conflict.cellRef] : [], conflict.cellRefs ?? []),
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

  const conflicts = (session.conflicts ?? []).map((conflict) => updateConflict(conflict, getDecisionForConflict(conflict, coverage)));
  const worksheetDiffs = (session.worksheetDiffs ?? []).map((worksheetDiff) => {
    const worksheetDecision = getDecisionForWorksheetDiff(worksheetDiff, coverage);
    const updatedWorksheet = updateWorksheetDiff(worksheetDiff, worksheetDecision);

    return {
      ...updatedWorksheet,
      cellDiffs: updatedWorksheet.cellDiffs.map((cellDiff) => {
        const cellDecision = getDecisionForCellDiff(cellDiff, coverage) ?? worksheetDecision;
        return updateCellDiff(cellDiff, cellDecision);
      }),
      conflicts: updatedWorksheet.conflicts.map((conflict) => updateConflict(conflict, getDecisionForConflict(conflict, coverage) ?? worksheetDecision)),
    };
  });

  const summary = recalculateSummary(conflicts.length > 0 ? conflicts : worksheetDiffs.flatMap((worksheetDiff) => worksheetDiff.conflicts ?? []));

  return {
    ...session,
    mergeDecisions,
    conflicts,
    worksheetDiffs,
    summary,
    pendingConflicts: summary.pendingConflicts,
    resultPreview: recalculateResultPreview({
      conflicts: conflicts.length > 0 ? conflicts : worksheetDiffs.flatMap((worksheetDiff) => worksheetDiff.conflicts ?? []),
      worksheetDiffs,
      decisions: mergeDecisions,
    }),
    status: summary.unresolvedConflictCount > 0 ? 'NeedsReview' : 'Ready',
  };
}

export { apply_merge_decisions, buildXlsxPayload };
export { compare_workbooks, compare_worksheets, compare_cells } from './diff.js';
    ...session,
    mergeDecisions: [...(session.mergeDecisions ?? []), decision],
    conflicts: updatedConflicts,
    worksheetDiffs: updatedSheets,
    resultPreview: {
      ...(session.resultPreview ?? {}),
      cells: mergedCellPreviews,
      updatedAt: decision.decidedAt,
    },
    status: 'Ready',
  };
}

export { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';
export {
  apply_merge_decisions,
  buildXlsxPayload,
} from './apply-merge-decisions.js';
export {
  compare_workbooks,
  compare_worksheets,
  compare_cells,
} from './diff.js';
export {
  apply_merge_decisions,
  buildXlsxPayload,
};

export { apply_merge_decisions, buildXlsxPayload };
