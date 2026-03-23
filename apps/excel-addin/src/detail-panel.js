import {
  applyDecisionToSession,
  createAcceptLeftDecision,
  createAcceptRightDecision,
  createManualEditDecision,
  validateManualEdit,
} from '../../../services/merge-engine/src/index.js';
import { syncDerivedHistoryArtifacts } from './history-panel.js';

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

function buildBlockMetadata(conflict) {
  const cellRefs = conflict.cellRefs ?? (conflict.cellRef ? [conflict.cellRef] : []);
  return {
    targetId: `block:${conflict.id}`,
    cellRefs,
    scopeType: 'block',
  };
}

function previewForCurrentConflict(session, conflict, draftValue) {
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
  const conflict = assertSessionConsistency(session, conflictId);
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

  if (!action.payload?.targetId) {
    const error = new Error('Invalid session state: action payload incomplete');
    error.code = 'INVALID_SESSION_STATE';
    throw error;
  }

  const conflictProbe = action.payload.targetType === 'block'
    ? action.payload.cellRefs?.[0] ?? action.payload.targetId
    : action.payload.targetId;
  assertSessionConsistency(session, conflictProbe);
  const updated = applyDecisionToSession(session, action.payload);
  return syncDerivedHistoryArtifacts({
    ...updated,
    status: updated.summary?.unresolvedConflictCount > 0 ? 'attention_required' : 'ready',
  });
}
