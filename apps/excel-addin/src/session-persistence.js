import { createManualEditDecision } from './manual-edit.js';
import { buildOfficialFlowDescriptor, createSessionCheckpoint } from './compare-session.js';
import { buildVisibleMvpLimits } from '../../../services/merge-engine/src/mvp-config.js';

export const SESSION_STORAGE_KEY = 'excel-compare.merge-session';

const STORAGE_VERSION = 1;
const LEFT_DECISION = 'take_a';
const RIGHT_DECISION = 'take_b';

function buildHash(input) {
  const value = String(input);
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }

  return `chk_${(hash >>> 0).toString(16)}`;
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

function formatWorkbookMetadata(file) {
  return {
    side: file.side,
    fileName: file.fileName,
    updatedAt: file.updatedAt,
    size: file.size,
    sheets: [...(file.sheets ?? [])],
  };
}

export function buildWorkbookFingerprint(file) {
  const metadata = formatWorkbookMetadata(file);
  const checksum = buildHash(JSON.stringify(metadata));

  return {
    workbookId: `wb:${file.side}:${checksum}`,
    checksum,
    metadata,
  };
}

function createLocation(sheet, cellRef, sheetIndex) {
  const match = /^([A-Z]+)(\d+)$/i.exec(cellRef ?? '');
  const columnRef = match?.[1]?.toUpperCase() ?? null;
  const row = match ? Number(match[2]) : null;
  const column = columnRef ? columnRef.split('').reduce((total, current) => (total * 26) + (current.charCodeAt(0) - 64), 0) : null;

  return {
    worksheetName: sheet,
    sheetIndex,
    row,
    column,
    a1: match ? `${columnRef}${row}` : null,
    rangeA1: match ? `${columnRef}${row}` : null,
  };
}

function buildCellRef(sheet, sheetIndex, cell) {
  return `cell:${slugify(sheet)}:${sheetIndex}:${String(cell).toUpperCase()}`;
}

function mapResolutionToDecision(conflict) {
  if (conflict.userDecision && conflict.userDecision !== 'unresolved') {
    return conflict.userDecision;
  }
  if (conflict.resolution === 'left') {
    return LEFT_DECISION;
  }
  if (conflict.resolution === 'right') {
    return RIGHT_DECISION;
  }
  return 'unresolved';
}

function buildFinalStateFromDecision(decision) {
  switch (decision) {
    case LEFT_DECISION:
      return 'accepted_a';
    case RIGHT_DECISION:
      return 'accepted_b';
    case 'manual_edit':
      return 'merged';
    default:
      return 'unresolved';
  }
}

function normalizeRawValue(value) {
  const formula = typeof value === 'string' && value.startsWith('=') ? value : null;
  const type = formula ? 'formula' : typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
  return {
    value,
    displayValue: value == null ? '' : String(value),
    formula,
    type,
    exists: true,
  };
}

function buildConflictNode(conflict, files) {
  const sheetIndex = files[0]?.sheets?.indexOf(conflict.sheet) ?? 0;
  const location = createLocation(conflict.sheet, conflict.cell, sheetIndex);
  const cellRef = conflict.cellRef ?? buildCellRef(conflict.sheet, sheetIndex, conflict.cell);
  const userDecision = mapResolutionToDecision(conflict);
  const finalState = buildFinalStateFromDecision(userDecision);
  const sourceA = conflict.sourceA ?? normalizeRawValue(conflict.leftValue);
  const sourceB = conflict.sourceB ?? normalizeRawValue(conflict.rightValue);

  return {
    id: conflict.id,
    nodeType: 'Conflict',
    scopeType: 'cell',
    targetType: 'cell',
    targetId: cellRef,
    cellRef,
    cellRefs: [cellRef],
    worksheetDiffId: `wsd:${slugify(conflict.sheet)}:${sheetIndex}`,
    location,
    changeType: conflict.changeType ?? 'conflict',
    sourceA,
    sourceB,
    description: conflict.description,
    reason: conflict.reason ?? conflict.description,
    status: conflict.status,
    resolution: conflict.resolution,
    userDecision,
    finalState,
    history: [...(conflict.history ?? [])],
  };
}

function buildWorksheetDiff(sheet, sheetIndex, conflicts, sourceAWorkbook, sourceBWorkbook) {
  const sheetKey = `${slugify(sheet)}:${sheetIndex}`;
  const cellDiffs = conflicts.map((conflict) => ({
    id: conflict.cellRef,
    nodeType: 'CellDiff',
    worksheetId: `ws:${sheetKey}`,
    location: conflict.location,
    changeType: conflict.changeType,
    sourceA: conflict.sourceA,
    sourceB: conflict.sourceB,
    userDecision: conflict.userDecision,
    finalState: conflict.finalState,
    conflictIds: [conflict.id],
    finalValue: conflict.userDecision === 'manual_edit'
      ? {
          value: conflict.resolution?.value,
          displayValue: conflict.resolution?.displayValue,
          type: conflict.resolution?.valueType,
          origin: 'manual_edit',
        }
      : null,
  }));

  return {
    id: `wsd:${sheetKey}`,
    nodeType: 'WorksheetDiff',
    worksheetId: `ws:${sheetKey}`,
    location: {
      worksheetName: sheet,
      sheetIndex,
      row: null,
      column: null,
      a1: null,
      rangeA1: `${sheet}!A1:XFD1048576`,
    },
    changeType: conflicts.some((conflict) => conflict.finalState === 'unresolved') ? 'conflict' : 'modified',
    sourceA: { name: sheet, exists: Boolean(sourceAWorkbook.worksheets[sheetIndex]) },
    sourceB: { name: sheet, exists: Boolean(sourceBWorkbook.worksheets[sheetIndex]) },
    userDecision: conflicts.every((conflict) => conflict.finalState !== 'unresolved') ? 'resolved' : 'unresolved',
    finalState: conflicts.every((conflict) => conflict.finalState !== 'unresolved') ? 'merged' : 'unresolved',
    cellDiffs,
    conflicts,
  };
}

function buildWorkbookFromFiles(source, file, conflicts) {
  const cellsBySheet = new Map();
  for (const conflict of conflicts) {
    const key = `${conflict.location.worksheetName}#${conflict.location.sheetIndex}`;
    const sheet = cellsBySheet.get(key) ?? {
      id: `ws:${slugify(conflict.location.worksheetName)}:${conflict.location.sheetIndex}`,
      name: conflict.location.worksheetName,
      index: conflict.location.sheetIndex,
      cells: {},
    };
    sheet.cells[conflict.location.a1] = source === 'sourceA' ? conflict.sourceA : conflict.sourceB;
    cellsBySheet.set(key, sheet);
  }

  return {
    workbookId: source.workbookId,
    label: file?.fileName,
    worksheets: [...cellsBySheet.values()].sort((left, right) => left.index - right.index),
  };
}

function buildWorkbookDiff(session, worksheetDiffs) {
  return {
    id: `wbd:${session.sourceA.workbookId}:${session.sourceB.workbookId}`,
    nodeType: 'WorkbookDiff',
    sourceAWorkbookId: session.sourceA.workbookId,
    sourceBWorkbookId: session.sourceB.workbookId,
    location: {
      worksheetName: null,
      sheetIndex: null,
      row: null,
      column: null,
      a1: null,
      rangeA1: null,
    },
    changeType: session.conflicts.some((conflict) => conflict.finalState === 'unresolved') ? 'conflict' : 'modified',
    sourceA: {
      workbookId: session.sourceA.workbookId,
      label: session.files[0]?.fileName,
      path: `/local/${session.files[0]?.fileName}`,
      exists: true,
      checksum: session.sourceA.checksum,
      metadata: session.sourceA.metadata,
    },
    sourceB: {
      workbookId: session.sourceB.workbookId,
      label: session.files[1]?.fileName,
      path: `/local/${session.files[1]?.fileName}`,
      exists: true,
      checksum: session.sourceB.checksum,
      metadata: session.sourceB.metadata,
    },
    userDecision: worksheetDiffs.every((worksheet) => worksheet.finalState !== 'unresolved') ? 'resolved' : 'unresolved',
    finalState: worksheetDiffs.every((worksheet) => worksheet.finalState !== 'unresolved') ? 'merged' : 'unresolved',
    worksheetDiffs,
    conflicts: worksheetDiffs.flatMap((worksheet) => worksheet.conflicts),
    summary: summarizeProgress(worksheetDiffs.flatMap((worksheet) => worksheet.conflicts)),
  };
}

function syncDerivedState(session) {
  const grouped = new Map();
  for (const conflict of session.conflicts ?? []) {
    const key = `${conflict.location?.worksheetName ?? 'sheet'}::${conflict.location?.sheetIndex ?? 0}`;
    const current = grouped.get(key) ?? { sheet: conflict.location?.worksheetName ?? 'Sheet', sheetIndex: conflict.location?.sheetIndex ?? 0, conflicts: [] };
    current.conflicts.push(conflict);
    grouped.set(key, current);
  }

  const sourceAWorkbook = session.sourceAWorkbook ?? buildWorkbookFromFiles(session.sourceA, session.files[0], session.conflicts ?? []);
  const sourceBWorkbook = session.sourceBWorkbook ?? buildWorkbookFromFiles(session.sourceB, session.files[1], session.conflicts ?? []);
  const worksheetDiffs = [...grouped.values()]
    .sort((left, right) => left.sheetIndex - right.sheetIndex)
    .map((entry) => buildWorksheetDiff(entry.sheet, entry.sheetIndex, entry.conflicts, sourceAWorkbook, sourceBWorkbook));
  const workbookDiff = buildWorkbookDiff({ ...session, sourceAWorkbook, sourceBWorkbook }, worksheetDiffs);
  const progress = summarizeProgress(session.conflicts);

  return {
    ...session,
    sourceAWorkbook,
    sourceBWorkbook,
    worksheetDiffs,
    conflicts: workbookDiff.conflicts,
    workbookDiff,
    progress,
    summary: {
      ...(session.summary ?? {}),
      pendingConflictCount: progress.pending,
      totalConflictCount: progress.total,
    },
    officialFlow: buildOfficialFlowDescriptor(progress.pending === 0 ? 'validate_final_state' : 'resolve_conflicts'),
    status: progress.pending === 0 ? 'ready_to_export' : 'in_progress',
  };
}

function appendCheckpoint(session, type, occurredAt, payload = {}) {
  return {
    ...session,
    updatedAt: occurredAt,
    lastCheckpointAt: occurredAt,
    checkpoints: [
      ...(session.checkpoints ?? []),
      createSessionCheckpoint({
        sessionId: session.sessionId,
        type,
        step: payload.flowStep ?? (session.progress?.pending === 0 ? 'validate_final_state' : 'resolve_conflicts'),
        occurredAt,
        payload: {
          progress: summarizeProgress(session.conflicts),
          ...payload,
        },
      }),
    ],
  };
}

function createResolutionDecision(session, conflict, resolution, actor, occurredAt) {
  const userDecision = resolution === 'left' ? LEFT_DECISION : RIGHT_DECISION;
  const finalValue = resolution === 'left' ? conflict.sourceA : conflict.sourceB;

  return {
    id: `decision:${conflict.id}:${occurredAt}`,
    nodeType: 'MergeDecision',
    targetType: 'conflict',
    targetId: conflict.id,
    cellRefs: conflict.cellRefs ?? [conflict.cellRef],
    worksheetDiffIds: [conflict.worksheetDiffId],
    location: conflict.location,
    changeType: conflict.changeType,
    sourceA: conflict.sourceA,
    sourceB: conflict.sourceB,
    userDecision,
    finalState: buildFinalStateFromDecision(userDecision),
    decidedBy: actor.userId,
    decidedAt: occurredAt,
    history: [
      {
        actionType: 'selected_source',
        conflictId: conflict.id,
        decision: userDecision,
        finalValue: {
          value: finalValue.value,
          displayValue: finalValue.displayValue,
          formula: finalValue.formula ?? null,
          type: finalValue.type,
        },
        occurredAt,
        sessionId: session.sessionId,
        actor,
      },
    ],
  };
}

function updatePreview(session, conflict, resolution, occurredAt) {
  const value = resolution === 'left' ? conflict.sourceA : conflict.sourceB;

  return {
    ...(session.resultPreview ?? {}),
    cells: {
      ...(session.resultPreview?.cells ?? {}),
      [conflict.cellRef]: {
        value: value.value,
        displayValue: value.displayValue,
        type: value.type,
        origin: resolution === 'left' ? 'source_a' : 'source_b',
        location: conflict.location,
      },
    },
    updatedAt: occurredAt,
  };
}

export function summarizeProgress(conflicts = []) {
  const total = conflicts.length;
  const resolved = conflicts.filter((conflict) => conflict.finalState !== 'unresolved').length;
  const pending = total - resolved;
  const percent = total === 0 ? 100 : Math.round((resolved / total) * 100);

  return {
    total,
    resolved,
    pending,
    percent,
  };
}

export function buildInitialMergeSession(files, baseConflicts, now = new Date().toISOString()) {
  const sourceA = buildWorkbookFingerprint(files[0]);
  const sourceB = buildWorkbookFingerprint(files[1]);
  const sessionId = `ms_${now.replace(/[:.]/g, '-').replace(/Z$/, 'Z')}_${slugify(files[0]?.fileName ?? 'workbook')}`;
  const conflicts = baseConflicts.map((conflict) => buildConflictNode(conflict, files));

  const initial = syncDerivedState({
    sessionId,
    createdAt: now,
    updatedAt: now,
    lastCheckpointAt: now,
    sourceA: {
      workbookId: sourceA.workbookId,
      label: files[0]?.fileName,
      path: `/local/${files[0]?.fileName}`,
      checksum: sourceA.checksum,
      metadata: sourceA.metadata,
    },
    sourceB: {
      workbookId: sourceB.workbookId,
      label: files[1]?.fileName,
      path: `/local/${files[1]?.fileName}`,
      checksum: sourceB.checksum,
      metadata: sourceB.metadata,
    },
    files,
    conflicts,
    mergeDecisions: [],
    checkpoints: [],
    resultPreview: {
      cells: {},
      updatedAt: now,
    },
    sessionValidation: {
      status: 'resumable',
      checkedAt: now,
      expectedChecksums: {
        sourceA: sourceA.checksum,
        sourceB: sourceB.checksum,
      },
    },
    mvpLimits: buildVisibleMvpLimits(),
  });

  return appendCheckpoint(initial, 'session_initialized', now, {
    flowStep: 'persist_checkpoint',
    expectedChecksums: initial.sessionValidation.expectedChecksums,
  });
}

export function recordConflictResolution(session, { conflictId, resolution, actor, occurredAt = new Date().toISOString() }) {
  const conflict = (session.conflicts ?? []).find((item) => item.id === conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const updatedConflicts = (session.conflicts ?? []).map((item) => (item.id !== conflictId ? item : {
    ...item,
    status: 'resolved',
    resolution,
    userDecision: resolution === 'left' ? LEFT_DECISION : RIGHT_DECISION,
    finalState: resolution === 'left' ? 'accepted_a' : 'accepted_b',
    history: [
      ...(item.history ?? []),
      {
        actionType: 'selected_source',
        conflictId: item.id,
        decision: resolution === 'left' ? LEFT_DECISION : RIGHT_DECISION,
        finalValue: resolution === 'left' ? item.sourceA : item.sourceB,
        occurredAt,
        sessionId: session.sessionId,
        actor,
      },
    ],
  }));

  const synced = syncDerivedState({
    ...session,
    conflicts: updatedConflicts,
    resultPreview: updatePreview(session, conflict, resolution, occurredAt),
  });
  const decision = createResolutionDecision(synced, synced.conflicts.find((item) => item.id === conflictId), resolution, actor, occurredAt);

  return appendCheckpoint({
    ...synced,
    mergeDecisions: [...(synced.mergeDecisions ?? []), decision],
  }, 'conflict_resolved', occurredAt, { conflictId, worksheetName: conflict.location?.worksheetName });
}

export function applyBlockResolution(session, { worksheetName, resolution, actor, occurredAt = new Date().toISOString() }) {
  const targetIds = (session.conflicts ?? [])
    .filter((conflict) => conflict.location?.worksheetName === worksheetName && conflict.finalState === 'unresolved')
    .map((conflict) => conflict.id);

  if (targetIds.length === 0) {
    return session;
  }

  let nextSession = session;
  for (const conflictId of targetIds) {
    nextSession = recordConflictResolution(nextSession, { conflictId, resolution, actor, occurredAt });
  }

  return appendCheckpoint(nextSession, 'block_applied', occurredAt, {
    worksheetName,
    resolution,
    affectedConflictIds: targetIds,
  });
}

export function saveManualEditCheckpoint(session, { conflictId, rawValue, actor, occurredAt = new Date().toISOString() }) {
  const conflict = (session.conflicts ?? []).find((item) => item.id === conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const decision = createManualEditDecision({
    conflict,
    rawValue,
    decidedBy: actor.userId,
    decidedAt: occurredAt,
    sessionId: session.sessionId,
  });

  const updatedConflicts = (session.conflicts ?? []).map((item) => (item.id !== conflictId ? item : {
    ...item,
    status: 'resolved',
    resolution: {
      type: 'manual_edit',
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      valueType: decision.manualEdit.type,
    },
    userDecision: 'manual_edit',
    finalState: 'merged',
    history: [
      ...(item.history ?? []),
      {
        actionType: 'manual_edit_saved',
        conflictId,
        decision: 'manual_edit',
        finalValue: {
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          formula: decision.manualEdit.type === 'formula' ? decision.manualEdit.value : null,
          type: decision.manualEdit.type,
        },
        occurredAt,
        sessionId: session.sessionId,
        actor,
      },
    ],
  }));

  const synced = syncDerivedState({
    ...session,
    conflicts: updatedConflicts,
    resultPreview: {
      ...(session.resultPreview ?? {}),
      cells: {
        ...(session.resultPreview?.cells ?? {}),
        [conflict.cellRef]: {
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          type: decision.manualEdit.type,
          origin: 'manual_edit',
          location: conflict.location,
        },
      },
      updatedAt: occurredAt,
    },
    mergeDecisions: [...(session.mergeDecisions ?? []), decision],
  });

  return appendCheckpoint(synced, 'manual_edit_saved', occurredAt, { conflictId });
}

function safeStorage() {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage;
}

export function persistSession(session) {
  const storage = safeStorage();
  if (!storage) {
    return false;
  }

  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    version: STORAGE_VERSION,
    savedAt: session.updatedAt,
    session,
  }));
  return true;
}

export function loadPersistedSession() {
  const storage = safeStorage();
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue);
}

export function clearPersistedSession() {
  const storage = safeStorage();
  if (!storage) {
    return false;
  }

  storage.removeItem(SESSION_STORAGE_KEY);
  return true;
}

export function validatePersistedSession(persistedEnvelope, files, checkedAt = new Date().toISOString()) {
  if (!persistedEnvelope?.session) {
    return {
      status: 'missing',
      checkedAt,
      reason: 'No se encontró ninguna sesión guardada.',
    };
  }

  const currentA = buildWorkbookFingerprint(files[0]);
  const currentB = buildWorkbookFingerprint(files[1]);
  const expectedA = persistedEnvelope.session?.sourceA?.checksum;
  const expectedB = persistedEnvelope.session?.sourceB?.checksum;

  if (expectedA !== currentA.checksum || expectedB !== currentB.checksum) {
    return {
      status: 'invalid',
      checkedAt,
      reason: 'Los metadatos del workbook no coinciden con la sesión guardada.',
      currentChecksums: { sourceA: currentA.checksum, sourceB: currentB.checksum },
      storedChecksums: { sourceA: expectedA, sourceB: expectedB },
    };
  }

  return {
    status: 'resumable',
    checkedAt,
    reason: null,
    currentChecksums: { sourceA: currentA.checksum, sourceB: currentB.checksum },
    storedChecksums: { sourceA: expectedA, sourceB: expectedB },
  };
}

export function buildResumeDescriptor(persistedEnvelope, files, checkedAt = new Date().toISOString()) {
  const validation = validatePersistedSession(persistedEnvelope, files, checkedAt);
  const session = persistedEnvelope?.session ?? null;
  const progress = summarizeProgress(session?.conflicts ?? []);

  return {
    status: validation.status,
    reason: validation.reason,
    checkedAt,
    lastUpdatedAt: session?.updatedAt ?? persistedEnvelope?.savedAt ?? null,
    progress,
    canResume: validation.status === 'resumable',
    session,
  };
}
