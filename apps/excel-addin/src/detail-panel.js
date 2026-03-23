import {
  applyDecisionToSession,
  createAcceptLeftDecision,
  createAcceptRightDecision,
  createManualEditDecision,
  validateManualEdit,
} from '../../../services/merge-engine/src/index.js';
import { createManualEditDecision, validateManualEdit } from '../../../services/merge-engine/src/manual-decisions.js';
import { syncDerivedHistoryArtifacts, upsertMergeDecision } from './history-panel.js';
import { createManualEditDecision, validateManualEdit } from './manual-edit.js';
import { createManualEditDecision, validateManualEdit } from './merge-engine-client.js';

function findConflict(session, conflictId) {
  return (session.conflicts ?? []).find(
    (conflict) => conflict.id === conflictId || conflict.cellRef === conflictId || conflict.cellRefs?.includes(conflictId),
  );
}

function buildBlockMetadata(conflict) {
  const cellRefs = conflict.cellRefs ?? (conflict.cellRef ? [conflict.cellRef] : []);
  return {
    targetId: `block:${conflict.id}`,
    cellRefs,
    scopeType: 'block',
  };
}

function previewForCurrentConflict(session, conflict, draftValue) {
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

  return { validation, preview };
}

export function buildConflictDetailPanelModel(session, conflictId, draftValue = '') {
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const { validation, preview } = previewForCurrentConflict(session, conflict, draftValue);
  const block = buildBlockMetadata(conflict);

  return {
    conflictId,
    title: `Conflicto en ${conflict.location?.worksheetName ?? 'Hoja'} ${conflict.location?.a1 ?? ''}`.trim(),
    editableField: {
      label: 'Valor final',
      value: draftValue,
      placeholder: 'Escribe el valor final manual (solo valor o fórmula simple)',
      expectedType: validation.expectedType,
      validationMessage: validation.valid ? null : validation.error,
      isValid: validation.valid,
    },
    actions: {
      acceptLeft: {
        type: 'APPLY_MERGE_DECISION',
        enabled: true,
        decisionType: 'accept_left',
      },
      acceptRight: {
        type: 'APPLY_MERGE_DECISION',
        enabled: true,
        decisionType: 'accept_right',
      },
      saveManualEdit: {
        type: 'APPLY_MERGE_DECISION',
        enabled: draftValue !== '' && validation.valid,
        decisionType: 'manual_edit',
      },
      acceptLeftBlock: {
        type: 'APPLY_MERGE_DECISION',
        enabled: block.cellRefs.length > 0,
        decisionType: 'accept_left',
        scopeType: 'block',
        targetId: block.targetId,
      },
      acceptRightBlock: {
        type: 'APPLY_MERGE_DECISION',
        enabled: block.cellRefs.length > 0,
        decisionType: 'accept_right',
        scopeType: 'block',
        targetId: block.targetId,
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
    resolutionSummary: {
      pending: session.summary?.unresolvedConflictCount ?? (session.pendingConflicts?.length ?? 0),
      resolved: session.summary?.resolvedConflictCount ?? 0,
      total: session.summary?.totalConflicts ?? (session.conflicts?.length ?? 0),
    },
  };
}

export function createDecisionActionFromPanel(session, {
  conflictId,
  decisionType,
  rawValue,
  decidedBy,
  decidedAt,
  scopeType,
  targetId,
  cellRefs,
  worksheetDiffIds,
}) {
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }
  };
}

export function saveManualEditFromPanel(session, { conflictId, rawValue, decidedBy, decidedAt }) {
  const conflict = assertSessionConsistency(session, conflictId);

  const sharedOptions = {
    conflict,
    decidedBy,
    decidedAt,
    scopeType,
    targetId,
    cellRefs,
    worksheetDiffIds,
  };

  let decision;
  if (decisionType === 'accept_left') {
    decision = createAcceptLeftDecision(sharedOptions);
  } else if (decisionType === 'accept_right') {
    decision = createAcceptRightDecision(sharedOptions);
  } else if (decisionType === 'manual_edit') {
    decision = createManualEditDecision({ ...sharedOptions, rawValue });
  } else {
    throw new Error(`Unsupported decision type: ${decisionType}`);
  }

  return {
    type: 'APPLY_MERGE_DECISION',
    sessionId: session.sessionId
  });

  return {
    type: 'SAVE_MANUAL_EDIT',
    payload: decision,
  };
}

export function saveManualEditFromPanel(session, { conflictId, rawValue, decidedBy, decidedAt }) {
  return createDecisionActionFromPanel(session, {
    conflictId,
    decisionType: 'manual_edit',
    rawValue,
    decidedBy,
    decidedAt,
  });
}

export function reduceSessionState(session, action) {
  if (action.type !== 'APPLY_MERGE_DECISION') {
    return session;
  }

  return applyDecisionToSession(session, action.payload);
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
