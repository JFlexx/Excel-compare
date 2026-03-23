import { OFFICIAL_MVP_FLOW_LABELS, apply_merge_decisions, buildXlsxPayload } from '../../../services/merge-engine/src/index.js';
import { buildExportGuard, createUserErrorView } from './error-presenter.js';

const RESOLVED_DECISIONS = new Set(['take_a', 'take_b', 'take_left', 'take_right', 'manual_edit']);
const CRITICAL_CHANGE_TYPES = new Set(['formula_changed', 'worksheet_missing', 'worksheet_added', 'structural_conflict']);

function sanitizeFileNameSegment(value, fallback = 'merge') {
  const normalized = String(value ?? fallback)
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

function mapDecisionByTarget(decisions = []) {
  const index = new Map();
  for (const decision of decisions) {
    if (decision?.targetId) {
      index.set(decision.targetId, decision);
    }
  }
  return index;
}

function collectDiffTargetIds(workbookDiff = {}) {
  const targets = new Set([workbookDiff.id].filter(Boolean));
  for (const worksheet of workbookDiff.worksheetDiffs ?? []) {
    if (worksheet.id) {
      targets.add(worksheet.id);
    }
    for (const cell of worksheet.cellDiffs ?? []) {
      if (cell.id) {
        targets.add(cell.id);
      }
    }
    for (const conflict of worksheet.conflicts ?? []) {
      if (conflict.id) {
        targets.add(conflict.id);
      }
    }
  }
  for (const conflict of workbookDiff.conflicts ?? []) {
    if (conflict.id) {
      targets.add(conflict.id);
    }
  }
  return targets;
}

function getConflictDecision(conflict, decisionsByTarget) {
  if (!conflict) {
    return null;
  }

  const direct = decisionsByTarget.get(conflict.id);
  if (direct) {
    return direct;
  }

  for (const cellRef of conflict.cellRefs ?? []) {
    const cellDecision = decisionsByTarget.get(cellRef);
    if (cellDecision) {
      return cellDecision;
    }
  }

  return null;
}

function isResolvedDecision(decision) {
  return RESOLVED_DECISIONS.has(decision?.userDecision);
}

function getAllConflicts(session) {
  return [
    ...(session.workbookDiff?.conflicts ?? []),
    ...((session.workbookDiff?.worksheetDiffs ?? []).flatMap((worksheet) => worksheet.conflicts ?? [])),
  ];
}

function getConflictViewState(conflict, decisionsByTarget) {
  const decision = getConflictDecision(conflict, decisionsByTarget);
  const resolved = isResolvedDecision(decision);
  return {
    decision,
    resolved,
    pending: !resolved,
    critical: CRITICAL_CHANGE_TYPES.has(conflict.changeType) || conflict.severity === 'critical',
  };
}

export function createSuggestedFileName(session) {
  const base = sanitizeFileNameSegment(session.sourceA?.label || session.sourceAWorkbook?.label || 'resultado');
  const stamp = (session.updatedAt || new Date().toISOString())
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '_');
  return `${base}__merge__${stamp}.xlsx`;
}

export function validateSessionConsistency(session = {}) {
  const issues = [];
  const workbookDiff = session.workbookDiff;
  const decisions = session.mergeDecisions ?? [];
  const decisionTargets = collectDiffTargetIds(workbookDiff);

  if (!session.sessionId) {
    issues.push('La sesión no tiene identificador.');
  }
  if (!session.sourceAWorkbook || !session.sourceBWorkbook) {
    issues.push('Faltan los libros normalizados requeridos para construir el resultado final.');
  }
  if (!workbookDiff?.id) {
    issues.push('No existe un workbookDiff válido para esta sesión.');
  }
  if (workbookDiff?.sourceA?.workbookId && session.sourceAWorkbook?.workbookId && workbookDiff.sourceA.workbookId !== session.sourceAWorkbook.workbookId) {
    issues.push('El workbookDiff no coincide con el workbook base cargado en la sesión.');
  }
  if (workbookDiff?.sourceB?.workbookId && session.sourceBWorkbook?.workbookId && workbookDiff.sourceB.workbookId !== session.sourceBWorkbook.workbookId) {
    issues.push('El workbookDiff no coincide con el workbook comparado cargado en la sesión.');
  }

  for (const decision of decisions) {
    if (!decision.targetId || !decisionTargets.has(decision.targetId)) {
      issues.push(`La decisión ${decision.id ?? '(sin id)'} no pertenece al workbookDiff actual.`);
      continue;
    }

    if (decision.userDecision === 'manual_edit' && (decision.manualEdit?.value == null || decision.manualEdit?.displayValue == null)) {
      issues.push(`La decisión manual ${decision.id ?? decision.targetId} no tiene un valor final completo.`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function summarizeReview(session = {}) {
  const decisionsByTarget = mapDecisionByTarget(session.mergeDecisions);
  const conflicts = getAllConflicts(session);
  const resolvedConflicts = [];
  const pendingConflicts = [];
  const affectedSheets = new Set();
  const decisionsByTypeMap = new Map();

  for (const conflict of conflicts) {
    const state = getConflictViewState(conflict, decisionsByTarget);
    const worksheetName = conflict.location?.worksheetName ?? 'Hoja sin nombre';
    affectedSheets.add(worksheetName);

    if (state.pending) {
      pendingConflicts.push({
        id: conflict.id,
        sheet: worksheetName,
        cell: conflict.location?.a1 ?? '—',
        reason: conflict.reason,
        critical: state.critical,
      });
      continue;
    }

    decisionsByTypeMap.set(
      state.decision.userDecision,
      (decisionsByTypeMap.get(state.decision.userDecision) ?? 0) + 1,
    );

    resolvedConflicts.push({
      id: conflict.id,
      sheet: worksheetName,
      cell: conflict.location?.a1 ?? '—',
      decisionType: state.decision.userDecision,
      label: state.decision.userDecision === 'take_a' || state.decision.userDecision === 'take_left'
        ? 'Aceptar izquierda'
        : state.decision.userDecision === 'take_b' || state.decision.userDecision === 'take_right'
          ? 'Aceptar derecha'
          : 'Edición manual',
    });
  }

  const decisionsByType = [...decisionsByTypeMap.entries()].map(([decisionType, count]) => ({ decisionType, count }));
  const totalPending = pendingConflicts.length;
  const criticalConflictsPending = pendingConflicts.filter((item) => item.critical).length;
  const exportGuard = buildExportGuard({ totalPending, criticalConflictsPending });

  return {
    resolvedConflicts,
    pendingConflicts,
    affectedSheets: [...affectedSheets],
    decisionsByType,
    totalPending,
    criticalConflictsPending,
    exportGuard,
  };
}

export function buildFinalReviewModel(session = {}) {
  const consistency = validateSessionConsistency(session);
  const summary = summarizeReview(session);
  const suggestedFileName = session.exportFileName || createSuggestedFileName(session);

  const validationFlow = (session.officialFlow?.steps ?? []).map((step) => ({
    ...step,
    label: step.label ?? OFFICIAL_MVP_FLOW_LABELS[step.step] ?? step.step,
  }));

  return {
    consistency,
    validationFlow,
    suggestedFileName,
    resolvedConflictCount: summary.resolvedConflicts.length,
    pendingCount: summary.totalPending,
    criticalPendingCount: summary.criticalConflictsPending,
    resolvedConflicts: summary.resolvedConflicts,
    pendingConflicts: summary.pendingConflicts,
    affectedSheets: summary.affectedSheets,
    decisionsByType: summary.decisionsByType,
    exportGuard: consistency.valid
      ? summary.exportGuard
      : createUserErrorView({
          code: 'EXPORT_VALIDATION_FAILED',
          context: {
            sessionId: session.sessionId,
            operation: 'export-result',
            diagnostics: { issues: consistency.issues },
          },
        }),
  };
}

function applyCellToWorksheet(worksheet, cell) {
  const cellAddress = cell.address;
  const cellType = cell.type === 'formula' ? 'n' : cell.type === 'number' ? 'n' : cell.type === 'boolean' ? 'b' : 's';
  const nextCell = {
    t: cellType,
    v: cell.type === 'formula' ? cell.value : cell.value ?? cell.displayValue ?? '',
  };

  if (cell.displayValue != null) {
    nextCell.w = cell.displayValue;
  }
  if (cell.formula) {
    nextCell.f = String(cell.formula).replace(/^=/, '');
  }

  worksheet[cellAddress] = nextCell;
}

function computeSheetRef(addresses = [], xlsxLib) {
  if (!addresses.length) {
    return 'A1:A1';
  }

  const decoded = addresses.map((address) => xlsxLib.utils.decode_cell(address));
  const range = decoded.reduce(
    (acc, cell) => ({
      s: {
        r: Math.min(acc.s.r, cell.r),
        c: Math.min(acc.s.c, cell.c),
      },
      e: {
        r: Math.max(acc.e.r, cell.r),
        c: Math.max(acc.e.c, cell.c),
      },
    }),
    { s: { r: decoded[0].r, c: decoded[0].c }, e: { r: decoded[0].r, c: decoded[0].c } },
  );

  return xlsxLib.utils.encode_range(range);
}

export function createWorkbookBinaryFromPayload(xlsxPayload, xlsxLib) {
  if (!xlsxLib?.utils?.book_new || typeof xlsxLib.write !== 'function') {
    throw new Error('La librería XLSX no está disponible para construir el archivo final.');
  }

  const workbook = xlsxLib.utils.book_new();

  for (const worksheetPayload of xlsxPayload.worksheets ?? []) {
    const worksheet = {};
    const addresses = [];

    for (const cell of worksheetPayload.cells ?? []) {
      addresses.push(cell.address);
      applyCellToWorksheet(worksheet, cell);
    }

    worksheet['!ref'] = computeSheetRef(addresses, xlsxLib);
    xlsxLib.utils.book_append_sheet(workbook, worksheet, worksheetPayload.name);
  }

  return xlsxLib.write(workbook, { bookType: 'xlsx', type: 'array' });
}

export function generateFinalWorkbookArtifacts(session, dependencies = {}) {
  const consistency = validateSessionConsistency(session);
  if (!consistency.valid) {
    const error = new Error(consistency.issues.join(' | '));
    error.code = 'EXPORT_VALIDATION_FAILED';
    throw error;
  }

  const mergeOutcome = apply_merge_decisions(
    session.sourceAWorkbook,
    session.sourceBWorkbook,
    session.workbookDiff,
    session.mergeDecisions ?? [],
    {
      mergeResultId: `merge-result:${session.sessionId}:final`,
      outputWorkbookId: `${session.sourceAWorkbook.workbookId}__merged__${session.sourceBWorkbook.workbookId}`,
    },
  );

  const xlsxPayload = buildXlsxPayload(mergeOutcome.workbook);
  const binary = createWorkbookBinaryFromPayload(xlsxPayload, dependencies.xlsxLib ?? globalThis.XLSX);
  const review = summarizeReview(session);

  return {
    mergeOutcome,
    xlsxPayload,
    binary,
    fileName: session.exportFileName || createSuggestedFileName(session),
    exportArtifact: mergeOutcome.exportArtifact ?? {
      type: 'xlsx-payload',
      workbookId: mergeOutcome.workbook.workbookId,
      worksheetCount: xlsxPayload.worksheets.length,
      worksheets: xlsxPayload.worksheets.map((worksheet) => worksheet.name),
    },
    exportSummary: {
      affectedSheets: review.affectedSheets,
      resolvedConflictCount: review.resolvedConflicts.length,
      decisionsByType: review.decisionsByType,
      pendingConflicts: review.pendingConflicts,
      finalValidationStep: 'validate_final_state',
      finalExportStep: 'export_result_workbook',
    },
  };
}

export function triggerWorkbookDownload(binary, fileName, dependencies = {}) {
  const blobCtor = dependencies.Blob ?? globalThis.Blob;
  const urlApi = dependencies.URL ?? globalThis.URL;
  const documentRef = dependencies.document ?? globalThis.document;

  if (!blobCtor || !urlApi?.createObjectURL || !documentRef?.createElement) {
    throw new Error('La descarga no está disponible en este entorno.');
  }

  const blob = new blobCtor([binary], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  documentRef.body.append(anchor);
  anchor.click();
  anchor.remove();
  urlApi.revokeObjectURL(url);
}
