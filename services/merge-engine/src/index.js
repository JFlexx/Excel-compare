import { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';

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

export function createManualEditDecision({ conflict, rawValue, decidedBy, decidedAt = new Date().toISOString() }) {
  const validation = validateManualEdit(conflict, rawValue);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

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
    },
    preview,
  };
}

function updateCollection(items, matcher, updater) {
  return items.map((item) => (matcher(item) ? updater(item) : item));
}

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

  return {
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
