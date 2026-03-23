const SUPPORTED_TYPES = new Set(['string', 'number', 'boolean', 'formula']);

function inferCellType(conflict) {
  const candidateTypes = [conflict?.sourceA?.type, conflict?.sourceB?.type].filter(Boolean);
  const preferred = candidateTypes.find((type) => SUPPORTED_TYPES.has(type));
  return preferred ?? 'string';
}

function coerceManualEditValue(rawValue, expectedType) {
  if (expectedType === 'number') {
    const trimmed = String(rawValue).trim();
    if (trimmed.length === 0) {
      return { ok: false, error: 'Introduce un número válido para resolver este conflicto.' };
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      return { ok: false, error: 'Introduce un número válido para resolver este conflicto.' };
    }

    return {
      ok: true,
      valueType: 'number',
      parsedValue: numericValue,
      displayValue: trimmed,
    };
  }

  if (expectedType === 'boolean') {
    const normalized = String(rawValue).trim().toLowerCase();
    const booleanMap = new Map([
      ['true', true],
      ['false', false],
      ['verdadero', true],
      ['falso', false],
      ['sí', true],
      ['si', true],
      ['no', false],
      ['1', true],
      ['0', false],
    ]);

    if (!booleanMap.has(normalized)) {
      return { ok: false, error: 'Usa un valor booleano válido: true/false, sí/no o 1/0.' };
    }

    return {
      ok: true,
      valueType: 'boolean',
      parsedValue: booleanMap.get(normalized),
      displayValue: booleanMap.get(normalized) ? 'TRUE' : 'FALSE',
    };
  }

  if (expectedType === 'formula') {
    const trimmed = String(rawValue).trim();
    if (!trimmed.startsWith('=')) {
      return { ok: false, error: "Las fórmulas manuales deben empezar por '='." };
    }

    return {
      ok: true,
      valueType: 'formula',
      parsedValue: trimmed,
      displayValue: trimmed,
    };
  }

  return {
    ok: true,
    valueType: 'string',
    parsedValue: String(rawValue),
    displayValue: String(rawValue),
  };
}

export function validateManualEdit(conflict, rawValue) {
  const expectedType = inferCellType(conflict);
  const validation = coerceManualEditValue(rawValue, expectedType);

  if (!validation.ok) {
    return {
      valid: false,
      expectedType,
      error: validation.error,
    };
  }

  return {
    valid: true,
    expectedType,
    parsedValue: validation.parsedValue,
    displayValue: validation.displayValue,
    valueType: validation.valueType,
  };
}

export function createManualEditDecision({ conflict, rawValue, decidedBy, decidedAt = new Date().toISOString() }) {
  const validation = validateManualEdit(conflict, rawValue);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const targetId = conflict.cellRef ?? conflict.cellRefs?.[0] ?? conflict.id;

  return {
    id: `decision:${targetId}:manual_edit`,
    nodeType: 'MergeDecision',
    targetType: 'cell',
    targetId,
    location: conflict.location,
    changeType: conflict.changeType,
    sourceA: conflict.sourceA,
    sourceB: conflict.sourceB,
    userDecision: 'manual_edit',
    finalState: 'merged',
    decidedBy,
    decidedAt,
    manualEdit: {
      rawValue: String(rawValue),
      value: validation.parsedValue,
      displayValue: validation.displayValue,
      type: validation.valueType,
    },
    preview: {
      targetId,
      location: conflict.location,
      value: validation.parsedValue,
      displayValue: validation.displayValue,
      type: validation.valueType,
    },
  };
}
