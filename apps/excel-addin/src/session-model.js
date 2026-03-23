const SESSION_OBJECT_KEYS = ['session', 'mergeSession'];

export function extractSessionCandidate(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  for (const key of SESSION_OBJECT_KEYS) {
    if (payload[key] && typeof payload[key] === 'object') {
      return payload[key];
    }
  }

  if (Array.isArray(payload.examples) && payload.examples.length > 0) {
    const firstExample = payload.examples.find((entry) => entry?.workbookDiff || entry?.session);
    if (firstExample?.session) {
      return firstExample.session;
    }

    if (firstExample?.workbookDiff) {
      return {
        sessionId: payload.sessionId ?? firstExample.workbookDiff.id ?? 'session-from-example',
        sourceA: payload.sourceA ?? firstExample.workbookDiff.sourceA ?? null,
        sourceB: payload.sourceB ?? firstExample.workbookDiff.sourceB ?? null,
        workbookDiff: firstExample.workbookDiff,
        mergeDecisions: firstExample.mergeDecisions ?? [],
        resultPreview: firstExample.workbookDiff.resultPreview ?? payload.resultPreview ?? { cells: {} },
      };
    }
  }

  return payload;
}

export function normalizeSessionPayload(rawPayload, workbookInfo = null) {
  const session = extractSessionCandidate(rawPayload);
  if (!session || typeof session !== 'object') {
    throw new Error('No se encontró una merge session válida en el host.');
  }

  const workbookDiff = session.workbookDiff ?? session.diff ?? session;
  const conflicts = (session.conflicts ?? workbookDiff.conflicts ?? []).map((conflict) =>
    normalizeConflict(conflict),
  );

  if (conflicts.length === 0) {
    throw new Error('La merge session no contiene conflictos para mostrar en el panel.');
  }

  const normalized = {
    sessionId: session.sessionId ?? workbookDiff.id ?? 'session-without-id',
    createdAt: session.createdAt ?? null,
    sourceA: session.sourceA ?? workbookDiff.sourceA ?? null,
    sourceB: session.sourceB ?? workbookDiff.sourceB ?? null,
    workbookDiff,
    workbookInfo,
    conflicts,
    mergeDecisions: [...(session.mergeDecisions ?? [])],
    resultPreview: {
      ...(session.resultPreview ?? {}),
      cells: { ...(session.resultPreview?.cells ?? {}) },
    },
  };

  return normalized;
}

export function normalizeConflict(conflict) {
  const worksheetName = conflict.location?.worksheetName ?? conflict.worksheetName ?? conflict.sheet ?? 'Hoja';
  const address = normalizeAddress(conflict.location?.a1 ?? conflict.location?.rangeA1 ?? conflict.address ?? conflict.cell ?? '');
  const sourceA = conflict.sourceA ?? conflict.left ?? {};
  const sourceB = conflict.sourceB ?? conflict.right ?? {};
  const resolution = conflict.resolution ?? null;
  const isResolved = conflict.finalState === 'merged' || conflict.finalState === 'accepted_a' || conflict.finalState === 'accepted_b' || Boolean(resolution);

  return {
    ...conflict,
    id: conflict.id ?? `${worksheetName}:${address}`,
    sheet: worksheetName,
    cell: address,
    worksheetName,
    address,
    type: normalizeChangeType(conflict.changeType ?? conflict.type),
    leftValue: toDisplayValue(sourceA),
    rightValue: toDisplayValue(sourceB),
    leftFormula: sourceA?.formula ?? null,
    rightFormula: sourceB?.formula ?? null,
    leftSource: sourceA,
    rightSource: sourceB,
    description: conflict.reason ?? conflict.description ?? buildConflictDescription(conflict.changeType, worksheetName, address),
    status: isResolved ? 'resolved' : 'pending',
    resolution: resolution?.type ?? resolution?.side ?? conflict.userDecision ?? null,
  };
}

export function buildConflictIndex(conflicts) {
  const exact = new Map();
  const entries = conflicts.map((conflict) => {
    const worksheetKey = normalizeWorksheetName(conflict.worksheetName);
    const normalizedAddress = normalizeAddress(conflict.address);
    const range = parseAddressRange(normalizedAddress);
    const entry = {
      conflictId: conflict.id,
      worksheetName: conflict.worksheetName,
      address: normalizedAddress,
      normalizedRangeKey: `${worksheetKey}:${normalizedAddress}`,
      type: range.isSingleCell ? 'cell' : 'range',
      range,
    };

    exact.set(entry.normalizedRangeKey, conflict.id);
    return entry;
  });

  return { exact, entries };
}

export function findConflictByWorksheetAndAddress(index, worksheetName, address) {
  const normalizedAddress = normalizeAddress(address);
  const key = `${normalizeWorksheetName(worksheetName)}:${normalizedAddress}`;
  return index.exact.get(key) ?? null;
}

export function findConflictsIntersectingRange(index, worksheetName, address) {
  const worksheetKey = normalizeWorksheetName(worksheetName);
  const selectionRange = parseAddressRange(address);

  return index.entries.filter((entry) => {
    if (normalizeWorksheetName(entry.worksheetName) !== worksheetKey) {
      return false;
    }

    return rangesIntersect(entry.range, selectionRange);
  });
}

export function pickBestConflictMatch(matches) {
  if (!matches || matches.length === 0) {
    return null;
  }

  return [...matches].sort((left, right) => left.range.area - right.range.area)[0];
}

export function normalizeAddress(address) {
  if (!address) {
    return '';
  }

  const withoutSheet = String(address).includes('!') ? String(address).split('!').pop() : String(address);
  return withoutSheet.replace(/\$/g, '').toUpperCase();
}

export function parseAddressRange(address) {
  const normalized = normalizeAddress(address);
  const [startToken, endToken = startToken] = normalized.split(':');
  const start = parseCellToken(startToken);
  const end = parseCellToken(endToken);
  const top = Math.min(start.row, end.row);
  const bottom = Math.max(start.row, end.row);
  const left = Math.min(start.column, end.column);
  const right = Math.max(start.column, end.column);

  return {
    address: normalized,
    top,
    bottom,
    left,
    right,
    area: Math.max(1, (bottom - top + 1) * (right - left + 1)),
    isSingleCell: top === bottom && left === right,
  };
}

export function rangesIntersect(left, right) {
  return !(
    left.right < right.left ||
    right.right < left.left ||
    left.bottom < right.top ||
    right.bottom < left.top
  );
}

export function applyConflictResolution(session, conflictId, resolutionSide) {
  const decidedAt = new Date().toISOString();
  const conflicts = session.conflicts.map((conflict) => {
    if (conflict.id !== conflictId) {
      return conflict;
    }

    return {
      ...conflict,
      status: 'resolved',
      resolution: resolutionSide,
      userDecision: resolutionSide === 'left' ? 'take_a' : 'take_b',
      finalState: resolutionSide === 'left' ? 'accepted_a' : 'accepted_b',
    };
  });

  const updatedConflict = conflicts.find((conflict) => conflict.id === conflictId);
  const previewCellKey = updatedConflict?.cellRef ?? updatedConflict?.cellRefs?.[0] ?? conflictId;
  const chosenSource = resolutionSide === 'left' ? updatedConflict?.leftSource : updatedConflict?.rightSource;

  return {
    ...session,
    conflicts,
    mergeDecisions: [
      ...(session.mergeDecisions ?? []),
      {
        id: `decision:${conflictId}:${resolutionSide}`,
        nodeType: 'MergeDecision',
        targetType: 'conflict',
        targetId: conflictId,
        location: updatedConflict?.location ?? null,
        userDecision: resolutionSide === 'left' ? 'take_a' : 'take_b',
        finalState: updatedConflict?.finalState ?? 'merged',
        decidedAt,
      },
    ],
    resultPreview: {
      ...(session.resultPreview ?? {}),
      cells: {
        ...(session.resultPreview?.cells ?? {}),
        [previewCellKey]: {
          value: chosenSource?.value ?? null,
          displayValue: toDisplayValue(chosenSource),
          formula: chosenSource?.formula ?? null,
          type: chosenSource?.type ?? typeof chosenSource?.value,
          origin: resolutionSide === 'left' ? 'sourceA' : 'sourceB',
          location: updatedConflict?.location ?? null,
        },
      },
      updatedAt: decidedAt,
    },
  };
}

export function buildSessionSummary(session) {
  const pending = session.conflicts.filter((conflict) => conflict.status !== 'resolved').length;
  const resolved = session.conflicts.length - pending;

  return {
    pending,
    resolved,
    sheets: [...new Set(session.conflicts.map((conflict) => conflict.worksheetName))],
  };
}

function parseCellToken(token) {
  const match = /^([A-Z]+)(\d+)$/i.exec(token);
  if (!match) {
    return { row: 1, column: 1 };
  }

  return {
    column: columnLabelToNumber(match[1]),
    row: Number(match[2]),
  };
}

function columnLabelToNumber(label) {
  return label
    .toUpperCase()
    .split('')
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function normalizeWorksheetName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function normalizeChangeType(changeType) {
  if (!changeType) {
    return 'Conflicto detectado';
  }

  return String(changeType)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildConflictDescription(changeType, worksheetName, address) {
  const label = normalizeChangeType(changeType).toLowerCase();
  return `Se detectó un conflicto de ${label} en ${worksheetName} ${address}.`;
}

function toDisplayValue(side) {
  if (!side || side.exists === false) {
    return '∅';
  }

  if (side.displayValue != null && side.displayValue !== '') {
    return String(side.displayValue);
  }

  if (side.formula) {
    return String(side.formula);
  }

  if (side.value == null || side.value === '') {
    return '∅';
  }

  return String(side.value);
}
