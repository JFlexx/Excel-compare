import {
  applyDecisionToSession,
  createAcceptLeftDecision,
  createAcceptRightDecision,
  createManualEditDecision,
  validateManualEdit,
} from '../../../services/merge-engine/src/index.js';

function findConflict(session, conflictId) {
  return (session.conflicts ?? []).find((conflict) => conflict.id === conflictId);
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
      placeholder: 'Escribe el valor final manual',
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
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

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

  return applyDecisionToSession(session, action.payload);
}
