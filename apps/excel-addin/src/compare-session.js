import { compare_workbooks, loadAndNormalizeWorkbook } from '../../../services/merge-engine/src/index.js';

export const MVP_COMPARE_OPTIONS = Object.freeze({
  conflictOnValueMismatch: false,
});

export function createWorkbookSelection(side, filePath, overrides = {}) {
  const fileName = overrides.fileName ?? getFileName(filePath);
  const label = overrides.label ?? fileName;
  const role = overrides.role ?? (side === 'base' ? 'Libro base' : 'Libro comparado');
  const workbookId = overrides.workbookId ?? createWorkbookId(side, fileName);

  return {
    side,
    path: filePath,
    fileName,
    label,
    role,
    workbookId,
  };
}

export function compareSelectedWorkbookFiles({
  baseWorkbook,
  comparedWorkbook,
  normalizationOptions,
  compareOptions = MVP_COMPARE_OPTIONS,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!baseWorkbook?.path || !comparedWorkbook?.path) {
    throw new Error('Both baseWorkbook.path and comparedWorkbook.path are required.');
  }

  const selectionA = createWorkbookSelection('base', baseWorkbook.path, baseWorkbook);
  const selectionB = createWorkbookSelection('compared', comparedWorkbook.path, comparedWorkbook);

  const canonicalA = loadAndNormalizeWorkbook(selectionA.path, normalizationOptions);
  const canonicalB = loadAndNormalizeWorkbook(selectionB.path, normalizationOptions);

  return createSessionFromCanonicalWorkbooks({
    sourceASelection: selectionA,
    sourceBSelection: selectionB,
    canonicalA,
    canonicalB,
    compareOptions,
    createdAt,
  });
}

export function createSessionFromCanonicalWorkbooks({
  sourceASelection,
  sourceBSelection,
  canonicalA,
  canonicalB,
  compareOptions = MVP_COMPARE_OPTIONS,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!canonicalA || !canonicalB) {
    throw new Error('Both canonicalA and canonicalB are required.');
  }

  const sourceA = buildSourceDescriptor(sourceASelection, canonicalA);
  const sourceB = buildSourceDescriptor(sourceBSelection, canonicalB);
  const comparableA = canonicalWorkbookToComparableWorkbook(canonicalA, sourceA);
  const comparableB = canonicalWorkbookToComparableWorkbook(canonicalB, sourceB);
  const workbookDiff = compare_workbooks(comparableA, comparableB, compareOptions);
  const summary = buildSessionSummary(workbookDiff);
  const sessionId = createSessionId(createdAt, sourceA.label, sourceB.label);

  return {
    sessionId,
    createdAt,
    sourceA,
    sourceB,
    workbookDiffId: workbookDiff.id,
    changeType: workbookDiff.changeType,
    userDecision: workbookDiff.userDecision,
    finalState: workbookDiff.finalState,
    worksheetDiffs: workbookDiff.worksheetDiffs,
    conflicts: workbookDiff.conflicts,
    mergeDecisions: [],
    summary,
    status: deriveSessionStatus(summary),
    resultPreview: {
      cells: {},
      updatedAt: null,
    },
  };
}

export function buildSessionSummary(workbookDiff) {
  const worksheetDiffs = workbookDiff?.worksheetDiffs ?? [];
  const conflicts = workbookDiff?.conflicts ?? [];
  const affectedSheets = worksheetDiffs
    .filter((worksheetDiff) => worksheetDiff.changeType !== 'unchanged' || (worksheetDiff.conflicts?.length ?? 0) > 0)
    .sort((left, right) => (left.location?.sheetIndex ?? Number.MAX_SAFE_INTEGER) - (right.location?.sheetIndex ?? Number.MAX_SAFE_INTEGER))
    .map((worksheetDiff) => worksheetDiff.location?.worksheetName)
    .filter(Boolean);
  const uniqueAffectedSheets = [...new Set(affectedSheets)];
  const autoResolvedCount = worksheetDiffs.reduce((count, worksheetDiff) => {
    const cellAutoResolved = (worksheetDiff.cellDiffs ?? []).filter((cellDiff) => (
      cellDiff.changeType === 'added'
      || cellDiff.changeType === 'removed'
      || cellDiff.changeType === 'modified'
    )).length;
    const worksheetAutoResolved = worksheetDiff.changeType === 'added' || worksheetDiff.changeType === 'removed' ? 1 : 0;
    return count + cellAutoResolved + worksheetAutoResolved;
  }, 0);
  const pendingConflictCount = conflicts.filter((conflict) => conflict.finalState === 'unresolved').length;
  const changedWorksheetCount = worksheetDiffs.filter((worksheetDiff) => worksheetDiff.changeType !== 'unchanged').length;
  const changedCellCount = worksheetDiffs.reduce(
    (count, worksheetDiff) => count + (worksheetDiff.cellDiffs ?? []).filter((cellDiff) => cellDiff.changeType !== 'unchanged').length,
    0,
  );

  return {
    affectedSheets: uniqueAffectedSheets,
    affectedWorksheetCount: uniqueAffectedSheets.length,
    changedWorksheetCount,
    changedCellCount,
    pendingConflictCount,
    totalConflictCount: conflicts.length,
    autoResolvedCount,
    worksheets: workbookDiff?.summary?.worksheets ?? null,
    cells: workbookDiff?.summary?.cells ?? null,
    visibleSummaryLines: [
      `Hojas afectadas: ${uniqueAffectedSheets.length > 0 ? uniqueAffectedSheets.join(', ') : 'ninguna'}`,
      `Conflictos pendientes: ${pendingConflictCount}`,
      `Cambios auto-resueltos: ${autoResolvedCount}`,
    ],
  };
}

export function canonicalWorkbookToComparableWorkbook(canonicalWorkbook, source) {
  return {
    workbookId: source.workbookId,
    label: source.label,
    path: source.path,
    worksheets: (canonicalWorkbook.worksheets ?? []).map((worksheet) => ({
      worksheetId: createWorksheetId(worksheet.name, worksheet.index),
      name: worksheet.name,
      sheetIndex: worksheet.index,
      cells: (worksheet.cells ?? []).map((cell) => ({
        address: cell.address,
        a1: cell.address,
        row: cell.row,
        column: cell.column,
        value: parseCanonicalCellValue(cell),
        displayValue: cell.visibleValue,
        formula: cell.formula,
        type: normalizeComparableType(cell),
      })),
    })),
  };
}

function buildSourceDescriptor(selection = {}, canonicalWorkbook) {
  const worksheetCount = canonicalWorkbook.worksheets?.length ?? 0;
  const cellCount = (canonicalWorkbook.worksheets ?? []).reduce(
    (total, worksheet) => total + (worksheet.cells?.length ?? 0),
    0,
  );

  return {
    workbookId: selection.workbookId ?? createWorkbookId(selection.side ?? 'source', canonicalWorkbook.workbookName),
    label: selection.label ?? canonicalWorkbook.workbookName,
    path: selection.path ?? canonicalWorkbook.workbookName,
    workbookName: canonicalWorkbook.workbookName,
    sheetOrder: canonicalWorkbook.sheetOrder ?? [],
    worksheetCount,
    cellCount,
    exists: true,
  };
}

function deriveSessionStatus(summary) {
  if (summary.pendingConflictCount > 0) {
    return 'pending_review';
  }

  if (summary.changedWorksheetCount === 0 && summary.changedCellCount === 0) {
    return 'no_changes';
  }

  return 'ready';
}

function parseCanonicalCellValue(cell) {
  if (cell.formula) {
    return cell.visibleValue ?? cell.formula;
  }

  if (cell.visibleValue === null || cell.visibleValue === undefined) {
    return null;
  }

  if (cell.valueType === 'number') {
    const numericValue = Number(cell.visibleValue);
    return Number.isFinite(numericValue) ? numericValue : cell.visibleValue;
  }

  if (cell.valueType === 'boolean') {
    const normalized = String(cell.visibleValue).trim().toLowerCase();
    if (['true', 'verdadero', 'sí', 'si', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'falso', 'no', '0'].includes(normalized)) {
      return false;
    }
  }

  return cell.visibleValue;
}

function normalizeComparableType(cell) {
  if (cell.formula) {
    return 'formula';
  }

  if (cell.valueType === 'unknown') {
    return 'string';
  }

  return cell.valueType;
}

function createWorkbookId(side, label) {
  return `wb_${side}_${slugify(label)}`;
}

function createWorksheetId(name, index) {
  return `ws:${slugify(name)}:${index}`;
}

function createSessionId(createdAt, labelA, labelB) {
  const timeToken = createdAt.replace(/[.:]/g, '-');
  return `ms_${timeToken}_${slugify(labelA)}__${slugify(labelB)}`;
}

function getFileName(filePath) {
  return String(filePath).split(/[/\\]/).filter(Boolean).pop() ?? String(filePath);
}

function slugify(value) {
  return String(value ?? 'unknown')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/[\s.-]+/g, '_')
    .toLowerCase();
}
