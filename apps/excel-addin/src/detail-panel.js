import {
  applyDecisionToSession,
  createAcceptLeftDecision,
  createAcceptRightDecision,
  createManualEditDecision,
  validateManualEdit,
} from '../../../services/merge-engine/src/index.js';
import { syncDerivedHistoryArtifacts } from './history-panel.js';

function findConflict(session, conflictId) {
  return (session?.conflicts ?? []).find(
    (conflict) =>
      conflict.id === conflictId ||
      conflict.cellRef === conflictId ||
      (Array.isArray(conflict.cellRefs) && conflict.cellRefs.includes(conflictId)),
  );
}

function assertSessionConsistency(session, conflictId) {
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

  const conflict = problems.length === 0 ? findConflict(session, conflictId) : null;
  if (!conflict) {
    problems.push(`conflict ${conflictId} not found`);
  }

  if (problems.length > 0) {
    const error = new Error(`Invalid session state: ${problems.join(', ')}`);
    error.code = 'INVALID_SESSION_STATE';
    error.details = {
      sessionId: session?.sessionId,
      conflictId,
      sessionStatus: session?.status,
      invalidReason: problems.join(', '),
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
    ? { valid: true, expectedType: inferExpectedType(conflict), error: null }
    : validateManualEdit(conflict, draftValue);

  if (draftValue !== '' && validation.valid) {
    return {
      validation,
      preview: {
        value: validation.parsedValue,
        displayValue: validation.displayValue,
        type: validation.valueType,
        origin: 'manual_edit',
      },
    };
  }

  return {
    validation,
    preview: session?.resultPreview?.cells?.[getPrimaryCellRef(conflict)] ?? null,
  };
}

export function buildConflictDetailPanelModel(session, conflictId, draftValue = '') {
  const conflict = assertSessionConsistency(session, conflictId);
  const { validation, preview } = previewForCurrentConflict(session, conflict, draftValue);
  const block = buildBlockMetadata(conflict);

  return {
    conflictId: conflict.id,
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
        cellRefs: block.cellRefs,
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
          cell: conflict.location?.a1 ?? null,
          value: preview.displayValue,
          type: preview.type,
          origin: preview.origin,
        }
      : null,
    resolutionSummary: buildSummary(session.conflicts ?? []),
  };
}

export function createDecisionActionFromPanel(session, {
  conflictId,
  decisionType,
  rawValue,
  decidedBy,
  decidedAt = new Date().toISOString(),
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
  if (action?.type !== 'APPLY_MERGE_DECISION') {
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
