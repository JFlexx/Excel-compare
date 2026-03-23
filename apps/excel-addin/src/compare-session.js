import {
  OFFICIAL_MVP_FLOW,
  OFFICIAL_MVP_FLOW_LABELS,
  buildVisibleMvpLimits,
  compare_workbooks,
  loadAndNormalizeWorkbook,
} from '../../../services/merge-engine/src/index.js';

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

  const sourceASelection = createWorkbookSelection('base', baseWorkbook.path, baseWorkbook);
  const sourceBSelection = createWorkbookSelection('compared', comparedWorkbook.path, comparedWorkbook);
  const canonicalA = loadAndNormalizeWorkbook(sourceASelection.path, normalizationOptions);
  const canonicalB = loadAndNormalizeWorkbook(sourceBSelection.path, normalizationOptions);

  return createSessionFromCanonicalWorkbooks({
    sourceASelection,
    sourceBSelection,
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
  const sourceAWorkbook = canonicalWorkbookToSessionWorkbook(canonicalA, sourceA);
  const sourceBWorkbook = canonicalWorkbookToSessionWorkbook(canonicalB, sourceB);
  const workbookDiff = compare_workbooks(comparableA, comparableB, compareOptions);
  const summary = buildSessionSummary(workbookDiff);
  const sessionId = createSessionId(createdAt, sourceA.label, sourceB.label);
  const checkpoint = createSessionCheckpoint({
    sessionId,
    type: 'checkpoint_persisted',
    step: 'persist_checkpoint',
    occurredAt: createdAt,
    payload: {
      workbookDiffId: workbookDiff.id,
      pendingConflictCount: summary.pendingConflictCount,
    },
  });

  return {
    sessionId,
    createdAt,
    updatedAt: createdAt,
    officialFlow: buildOfficialFlowDescriptor('persist_checkpoint'),
    sourceA,
    sourceB,
    sourceAWorkbook,
    sourceBWorkbook,
    workbookDiff,
    worksheetDiffs: workbookDiff.worksheetDiffs,
    conflicts: workbookDiff.conflicts,
    mergeDecisions: [],
    checkpoints: [checkpoint],
    summary,
    status: deriveSessionStatus(summary),
    resultPreview: {
      cells: {},
      updatedAt: null,
    },
    mvpLimits: buildVisibleMvpLimits(),
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
        formula: cell.formula ? `=${cell.formula.replace(/^=/, '')}` : null,
        type: normalizeComparableType(cell),
      })),
    })),
  };
}

export function canonicalWorkbookToSessionWorkbook(canonicalWorkbook, source) {
  return {
    workbookId: source.workbookId,
    label: source.label,
    metadata: {
      workbookName: canonicalWorkbook.workbookName,
      sheetOrder: canonicalWorkbook.sheetOrder ?? [],
    },
    worksheets: (canonicalWorkbook.worksheets ?? []).map((worksheet) => ({
      worksheetId: createWorksheetId(worksheet.name, worksheet.index),
      id: createWorksheetId(worksheet.name, worksheet.index),
      name: worksheet.name,
      sheetIndex: worksheet.index,
      index: worksheet.index,
      cells: Object.fromEntries((worksheet.cells ?? []).map((cell) => [cell.address, ({
        value: parseCanonicalCellValue(cell),
        displayValue: cell.visibleValue,
        formula: cell.formula ? `=${cell.formula.replace(/^=/, '')}` : null,
        type: normalizeComparableType(cell),
        exists: true,
      })])),
    })),
  };
}

export function buildOfficialFlowDescriptor(currentStep) {
  return {
    steps: OFFICIAL_MVP_FLOW.map((step, index) => ({
      step,
      label: OFFICIAL_MVP_FLOW_LABELS[step],
      order: index + 1,
      status: step === currentStep ? 'current' : OFFICIAL_MVP_FLOW.indexOf(step) < OFFICIAL_MVP_FLOW.indexOf(currentStep) ? 'completed' : 'pending',
    })),
    currentStep,
  };
}

export function createSessionCheckpoint({ sessionId, type, step, occurredAt, payload = {} }) {
  return {
    id: `checkpoint:${sessionId}:${type}:${occurredAt}`,
    type,
    sessionId,
    flowStep: step,
    occurredAt,
    ...payload,
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

  return 'ready_for_review';
}

function parseCanonicalCellValue(cell) {
  if (cell.formula) {
    return cell.visibleValue ?? `=${cell.formula.replace(/^=/, '')}`;
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
