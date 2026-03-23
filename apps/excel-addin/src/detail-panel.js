import { createManualEditDecision, validateManualEdit } from './manual-edit.js';

function findConflict(session, conflictId) {
  return (session.conflicts ?? []).find((conflict) => conflict.id === conflictId);
}

export function buildConflictDetailPanelModel(session, conflictId, draftValue = '') {
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const validation = draftValue === ''
    ? { valid: true, expectedType: conflict.sourceA?.type ?? conflict.sourceB?.type ?? 'string' }
    : validateManualEdit(conflict, draftValue);

  const preview = validation.valid && draftValue !== ''
    ? {
        displayValue: validation.displayValue,
        value: validation.parsedValue,
        type: validation.valueType,
        origin: 'manual_edit'
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
      isValid: validation.valid
    },
    actions: {
      saveManualEdit: {
        type: 'SAVE_MANUAL_EDIT',
        enabled: draftValue !== '' && validation.valid,
        userDecision: 'manual_edit'
      }
    },
    preview: preview
      ? {
          title: 'Vista previa del resultado final',
          cell: conflict.location?.a1,
          value: preview.displayValue,
          type: preview.type,
          origin: preview.origin
        }
      : null
  };
}

export function saveManualEditFromPanel(session, { conflictId, rawValue, decidedBy, decidedAt }) {
  const conflict = findConflict(session, conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const decision = createManualEditDecision({
    conflict,
    rawValue,
    decidedBy,
    decidedAt
  });

  return {
    type: 'SAVE_MANUAL_EDIT',
    payload: decision
  };
}

export function reduceSessionState(session, action) {
  if (action.type !== 'SAVE_MANUAL_EDIT') {
    return session;
  }

  const decision = action.payload;
  const targetId = decision.targetId;

  return {
    ...session,
    mergeDecisions: [...(session.mergeDecisions ?? []), decision],
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
          valueType: decision.manualEdit.type
        }
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
          location: decision.location
        }
      },
      updatedAt: decision.decidedAt
    }
  };
}
