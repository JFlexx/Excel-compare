import { createManualEditDecision, validateManualEdit } from '../../../services/merge-engine/src/manual-decisions.js';
import { syncDerivedHistoryArtifacts, upsertMergeDecision } from './history-panel.js';
import { createManualEditDecision, validateManualEdit } from './manual-edit.js';
import { createManualEditDecision, validateManualEdit } from './merge-engine-client.js';

function findConflict(session, conflictId) {
  return (session.conflicts ?? []).find(
    (conflict) => conflict.id === conflictId || conflict.cellRef === conflictId || conflict.cellRefs?.includes(conflictId),
  );
}

function assertSessionConsistency(session, conflictId) {
  const conflict = findConflict(session, conflictId);
  const problems = [];

  if (!session || typeof session !== 'object') {
    problems.push('session payload missing');
  }
  if (!Array.isArray(session?.conflicts)) {
    problems.push('conflicts collection missing');
  }
  if (!Array.isArray(session?.mergeDecisions)) {
    problems.push('mergeDecisions collection missing');
  }
  if (!session?.resultPreview || typeof session.resultPreview !== 'object') {
    problems.push('resultPreview missing');
  }
  if (!conflict) {
    problems.push(`conflict ${conflictId} not found`);
  }

  if (problems.length > 0) {
    const error = new Error(`Invalid session state: ${problems.join(', ')}`);
    error.code = 'INVALID_SESSION_STATE';
    error.details = {
      sessionId: session?.sessionId,
      invalidReason: problems.join(', '),
      conflictId,
      sessionStatus: session?.status,
    };
    throw error;
  }

  return conflict;
}

export function buildConflictDetailPanelModel(session, conflictId, draftValue = '') {
  const conflict = assertSessionConsistency(session, conflictId);

  const validation = draftValue === ''
    ? { valid: true, expectedType: conflict.sourceA?.type ?? conflict.sourceB?.type ?? 'string' }
    : validateManualEdit(conflict, draftValue);

  const preview = validation.valid && draftValue !== ''
    ? {
        displayValue: validation.displayValue,
        value: validation.parsedValue,
        type: validation.valueType,
        origin: 'manual_edit',
      }
    : session.resultPreview?.cells?.[conflict.cellRef ?? conflict.cellRefs?.[0]] ?? null;

  return {
    conflictId,
    title: `Conflicto en ${conflict.location?.worksheetName ?? 'Hoja'} ${conflict.location?.a1 ?? ''}`.trim(),
    editableField: {
      label: 'Valor final',
      value: draftValue,
      placeholder: 'Escribe el valor final manual',
      expectedType: validation.expectedType,
      validationMessage: validation.valid ? null : validation.error,
      isValid: validation.valid,
    },
    actions: {
      saveManualEdit: {
        type: 'SAVE_MANUAL_EDIT',
        enabled: draftValue !== '' && validation.valid,
        userDecision: 'manual_edit',
      },
    },
    preview: preview
      ? {
          title: 'Vista previa del resultado final',
          cell: conflict.location?.a1,
          value: preview.displayValue,
          type: preview.type,
          origin: preview.origin,
        }
      : null,
  };
}

export function saveManualEditFromPanel(session, { conflictId, rawValue, decidedBy, decidedAt }) {
  const conflict = assertSessionConsistency(session, conflictId);

  const decision = createManualEditDecision({
    conflict,
    rawValue,
    decidedBy,
    decidedAt,
    sessionId: session.sessionId
  });

  return {
    type: 'SAVE_MANUAL_EDIT',
    payload: decision,
  };
}

export function reduceSessionState(session, action) {
  if (action.type !== 'SAVE_MANUAL_EDIT') {
    return session;
  }

  if (!action.payload?.targetId || !action.payload?.manualEdit) {
    const error = new Error('Invalid session state: action payload incomplete');
    error.code = 'INVALID_SESSION_STATE';
    throw error;
  }

  assertSessionConsistency(session, action.payload.targetId);

  const decision = action.payload;
  const targetId = decision.targetId;
  const matchedConflicts = (session.conflicts ?? []).filter(
    (conflict) => conflict.id === targetId || conflict.cellRef === targetId || conflict.cellRefs?.includes(targetId),
  );

  if (matchedConflicts.length === 0) {
    const error = new Error(`Invalid session state: target ${targetId} is missing from conflicts`);
    error.code = 'INVALID_SESSION_STATE';
    throw error;
  }

  const nextSession = {
    ...session,
    status: 'attention_required',
    mergeDecisions: [...(session.mergeDecisions ?? []), decision],
    mergeDecisions: upsertMergeDecision(session.mergeDecisions ?? [], decision),
    conflicts: (session.conflicts ?? []).map((conflict) => {
      if (!(conflict.id === targetId || conflict.cellRef === targetId || conflict.cellRefs?.includes(targetId))) {
        return conflict;
      }

      return {
        ...conflict,
        userDecision: 'manual_edit',
        finalState: 'merged',
        resolution: {
          type: 'manual_edit',
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          valueType: decision.manualEdit.type,
        },
      };
    }),
    resultPreview: {
      ...(session.resultPreview ?? {}),
      cells: {
        ...(session.resultPreview?.cells ?? {}),
        [targetId]: {
          value: decision.manualEdit.value,
          displayValue: decision.manualEdit.displayValue,
          type: decision.manualEdit.type,
          origin: 'manual_edit',
          location: decision.location,
        },
      },
      updatedAt: decision.decidedAt,
    },
  };

  return syncDerivedHistoryArtifacts(nextSession);
}
