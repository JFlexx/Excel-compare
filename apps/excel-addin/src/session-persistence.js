import { createManualEditDecision } from './manual-edit.js';

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
    sheets: [...(file.sheets ?? [])]
  };
}

export function buildWorkbookFingerprint(file) {
  const metadata = formatWorkbookMetadata(file);
  const checksum = buildHash(JSON.stringify(metadata));

  return {
    workbookId: `wb:${file.side}:${checksum}`,
    checksum,
    metadata
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
    rangeA1: match ? `${columnRef}${row}` : null
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
      return 'pending';
  }
}

function buildConflictNode(conflict, files) {
  const sheetIndex = files[0]?.sheets?.indexOf(conflict.sheet) ?? 0;
  const location = createLocation(conflict.sheet, conflict.cell, sheetIndex);
  const cellRef = conflict.cellRef ?? buildCellRef(conflict.sheet, sheetIndex, conflict.cell);
  const userDecision = mapResolutionToDecision(conflict);
  const finalState = buildFinalStateFromDecision(userDecision);

  return {
    id: conflict.id,
    nodeType: 'Conflict',
    targetType: 'cell',
    targetId: cellRef,
    cellRef,
    location,
    changeType: 'conflict',
    sourceA: {
      value: conflict.leftValue,
      displayValue: String(conflict.leftValue),
      formula: typeof conflict.leftValue === 'string' && conflict.leftValue.startsWith('=') ? conflict.leftValue : null,
      type: typeof conflict.leftValue === 'string' && conflict.leftValue.startsWith('=') ? 'formula' : typeof conflict.leftValue === 'number' ? 'number' : 'string',
      exists: true
    },
    sourceB: {
      value: conflict.rightValue,
      displayValue: String(conflict.rightValue),
      formula: typeof conflict.rightValue === 'string' && conflict.rightValue.startsWith('=') ? conflict.rightValue : null,
      type: typeof conflict.rightValue === 'string' && conflict.rightValue.startsWith('=') ? 'formula' : typeof conflict.rightValue === 'number' ? 'number' : 'string',
      exists: true
    },
    description: conflict.description,
    status: conflict.status,
    resolution: conflict.resolution,
    userDecision,
    finalState,
    history: [...(conflict.history ?? [])]
  };
}

function buildWorksheetDiff(sheet, sheetIndex, conflicts) {
  const sheetKey = `${slugify(sheet)}:${sheetIndex}`;

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
      rangeA1: `${sheet}!A1:XFD1048576`
    },
    changeType: conflicts.some((conflict) => conflict.finalState === 'pending') ? 'conflict' : 'modified',
    sourceA: { name: sheet, exists: true },
    sourceB: { name: sheet, exists: true },
    userDecision: conflicts.every((conflict) => conflict.finalState !== 'pending') ? 'resolved' : 'unresolved',
    finalState: conflicts.every((conflict) => conflict.finalState !== 'pending') ? 'merged' : 'pending',
    cellDiffs: conflicts.map((conflict) => ({
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
      finalValue: conflict.resolution?.type === 'manual_edit'
        ? {
            value: conflict.resolution.value,
            displayValue: conflict.resolution.displayValue,
            type: conflict.resolution.valueType,
            origin: 'manual_edit'
          }
        : null
    })),
    conflicts
  };
}

function buildWorkbookDiff(session, worksheetDiffs, files, sourceA, sourceB) {
  return {
    id: `wbd:${sourceA.workbookId}:${sourceB.workbookId}`,
    nodeType: 'WorkbookDiff',
    sourceAWorkbookId: sourceA.workbookId,
    sourceBWorkbookId: sourceB.workbookId,
    location: {
      worksheetName: null,
      sheetIndex: null,
      row: null,
      column: null,
      a1: null,
      rangeA1: null
    },
    changeType: 'modified',
    sourceA: {
      label: files[0]?.fileName,
      path: `/local/${files[0]?.fileName}`,
      exists: true,
      checksum: sourceA.checksum,
      metadata: sourceA.metadata
    },
    sourceB: {
      label: files[1]?.fileName,
      path: `/local/${files[1]?.fileName}`,
      exists: true,
      checksum: sourceB.checksum,
      metadata: sourceB.metadata
    },
    userDecision: worksheetDiffs.every((worksheet) => worksheet.finalState !== 'pending') ? 'resolved' : 'unresolved',
    finalState: worksheetDiffs.every((worksheet) => worksheet.finalState !== 'pending') ? 'merged' : 'pending',
    worksheetDiffs,
    conflicts: worksheetDiffs.flatMap((worksheet) => worksheet.conflicts),
    summary: summarizeProgress(worksheetDiffs.flatMap((worksheet) => worksheet.conflicts))
  };
}

function createCheckpoint(type, session, payload = {}) {
  return {
    id: `checkpoint:${type}:${session.sessionId}:${payload.occurredAt ?? session.updatedAt ?? session.createdAt}`,
    type,
    sessionId: session.sessionId,
    occurredAt: payload.occurredAt ?? session.updatedAt ?? session.createdAt,
    progress: summarizeProgress(session.conflicts),
    ...payload
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

  const worksheetDiffs = [...grouped.values()]
    .sort((left, right) => left.sheetIndex - right.sheetIndex)
    .map((entry) => buildWorksheetDiff(entry.sheet, entry.sheetIndex, entry.conflicts));

  const workbookDiff = buildWorkbookDiff(session, worksheetDiffs, session.files, session.sourceA, session.sourceB);
  const progress = summarizeProgress(session.conflicts);

  return {
    ...session,
    worksheetDiffs,
    workbookDiff,
    progress,
    status: progress.pending === 0 ? 'ready_to_export' : 'in_progress'
  };
}

function updateConflictCollections(conflicts, targetIds, updater) {
  const targetSet = new Set(targetIds);
  return conflicts.map((conflict) => (targetSet.has(conflict.id) ? updater(conflict) : conflict));
}

function appendDecision(session, decision, checkpointType, checkpointPayload = {}) {
  const nextSession = syncDerivedState({
    ...session,
    mergeDecisions: [...(session.mergeDecisions ?? []), decision],
    updatedAt: decision.decidedAt,
    lastCheckpointAt: decision.decidedAt
  });

  return {
    ...nextSession,
    checkpoints: [
      ...(nextSession.checkpoints ?? []),
      createCheckpoint(checkpointType, nextSession, {
        decisionId: decision.id,
        conflictId: checkpointPayload.conflictId,
        worksheetName: checkpointPayload.worksheetName,
        occurredAt: decision.decidedAt,
        ...checkpointPayload
      })
    ]
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
          type: finalValue.type
        },
        occurredAt,
        sessionId: session.sessionId,
        actor
      }
    ]
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
        location: conflict.location
      }
    },
    updatedAt: occurredAt
  };
}

export function summarizeProgress(conflicts = []) {
  const total = conflicts.length;
  const resolved = conflicts.filter((conflict) => conflict.finalState !== 'pending').length;
  const pending = total - resolved;
  const percent = total === 0 ? 100 : Math.round((resolved / total) * 100);

  return {
    total,
    resolved,
    pending,
    percent
  };
}

export function buildInitialMergeSession(files, baseConflicts, now = new Date().toISOString()) {
  const sourceA = buildWorkbookFingerprint(files[0]);
  const sourceB = buildWorkbookFingerprint(files[1]);
  const sessionId = `ms_${now.replace(/[:.]/g, '-').replace(/Z$/, 'Z')}_${slugify(files[0]?.fileName ?? 'workbook')}`;
  const conflicts = baseConflicts.map((conflict) => buildConflictNode(conflict, files));

  const session = syncDerivedState({
    sessionId,
    createdAt: now,
    updatedAt: now,
    lastCheckpointAt: now,
    sourceA: {
      workbookId: sourceA.workbookId,
      label: files[0]?.fileName,
      path: `/local/${files[0]?.fileName}`,
      checksum: sourceA.checksum,
      metadata: sourceA.metadata
    },
    sourceB: {
      workbookId: sourceB.workbookId,
      label: files[1]?.fileName,
      path: `/local/${files[1]?.fileName}`,
      checksum: sourceB.checksum,
      metadata: sourceB.metadata
    },
    files,
    conflicts,
    mergeDecisions: [],
    checkpoints: [],
    resultPreview: {
      cells: {},
      updatedAt: now
    },
    sessionValidation: {
      status: 'resumable',
      checkedAt: now,
      expectedChecksums: {
        sourceA: sourceA.checksum,
        sourceB: sourceB.checksum
      }
    }
  });

  return {
    ...session,
    checkpoints: [createCheckpoint('session_initialized', session, { occurredAt: now })]
  };
}

export function recordConflictResolution(session, { conflictId, resolution, actor, occurredAt = new Date().toISOString() }) {
  const conflict = (session.conflicts ?? []).find((item) => item.id === conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const updatedConflicts = updateConflictCollections(session.conflicts, [conflictId], (item) => ({
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
        actor
      }
    ]
  }));

  const updatedSession = syncDerivedState({
    ...session,
    conflicts: updatedConflicts,
    resultPreview: updatePreview(session, conflict, resolution, occurredAt)
  });

  const decision = createResolutionDecision(updatedSession, updatedSession.conflicts.find((item) => item.id === conflictId), resolution, actor, occurredAt);
  return appendDecision(updatedSession, decision, 'conflict_resolved', { conflictId });
}

export function applyBlockResolution(session, { worksheetName, resolution, actor, occurredAt = new Date().toISOString() }) {
  const targetIds = (session.conflicts ?? [])
    .filter((conflict) => conflict.location?.worksheetName === worksheetName && conflict.finalState === 'pending')
    .map((conflict) => conflict.id);

  if (targetIds.length === 0) {
    return session;
  }

  let nextSession = session;
  for (const conflictId of targetIds) {
    nextSession = recordConflictResolution(nextSession, { conflictId, resolution, actor, occurredAt });
  }

  const checkpoint = createCheckpoint('block_applied', nextSession, {
    worksheetName,
    resolution,
    occurredAt,
    affectedConflictIds: targetIds
  });

  return {
    ...nextSession,
    checkpoints: [...(nextSession.checkpoints ?? []), checkpoint],
    lastCheckpointAt: occurredAt
  };
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
    decidedAt: occurredAt
  });

  const updatedConflicts = updateConflictCollections(session.conflicts, [conflictId], (item) => ({
    ...item,
    status: 'resolved',
    resolution: {
      type: 'manual_edit',
      value: decision.manualEdit.value,
      displayValue: decision.manualEdit.displayValue,
      valueType: decision.manualEdit.type
    },
    userDecision: 'manual_edit',
    finalState: 'merged',
    history: [
      ...(item.history ?? []),
      {
        actionType: 'manual_edit_saved',
        conflictId: item.id,
        decision: 'manual_edit',
        finalValue: {
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          formula: decision.manualEdit.type === 'formula' ? decision.manualEdit.value : null,
          type: decision.manualEdit.type
        },
        occurredAt,
        sessionId: session.sessionId,
        actor
      }
    ]
  }));

  const updatedSession = syncDerivedState({
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
          location: conflict.location
        }
      },
      updatedAt: occurredAt
    }
  });

  const decisionWithHistory = {
    ...decision,
    history: [
      {
        actionType: 'manual_edit_saved',
        conflictId,
        decision: 'manual_edit',
        finalValue: {
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          formula: decision.manualEdit.type === 'formula' ? decision.manualEdit.value : null,
          type: decision.manualEdit.type
        },
        occurredAt,
        sessionId: session.sessionId,
        actor
      }
    ]
  };

  return appendDecision(updatedSession, decisionWithHistory, 'manual_edit_saved', { conflictId });
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
    session
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
      reason: 'No se encontró ninguna sesión guardada.'
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
      storedChecksums: { sourceA: expectedA, sourceB: expectedB }
    };
  }

  return {
    status: 'resumable',
    checkedAt,
    reason: null,
    currentChecksums: { sourceA: currentA.checksum, sourceB: currentB.checksum },
    storedChecksums: { sourceA: expectedA, sourceB: expectedB }
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
    session
  };
}
