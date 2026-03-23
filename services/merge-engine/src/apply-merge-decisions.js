/**
 * @typedef {Object} WorkbookCell
 * @property {*} [value]
 * @property {string|null} [displayValue]
 * @property {string|null} [formula]
 * @property {string|null} [type]
 * @property {boolean} [exists]
 * @property {Object<string, *>} [metadata]
 */

/**
 * @typedef {Object} WorkbookWorksheet
 * @property {string} name
 * @property {number} index
 * @property {string} [id]
 * @property {Object<string, WorkbookCell>} [cells]
 * @property {Object<string, *>} [metadata]
 */

/**
 * @typedef {Object} WorkbookDocument
 * @property {string} workbookId
 * @property {string} [label]
 * @property {WorkbookWorksheet[]} worksheets
 * @property {Object<string, *>} [metadata]
 */

const DECISION_TO_STATE = {
  take_a: 'accepted_a',
  take_b: 'accepted_b',
  take_left: 'accepted_a',
  take_right: 'accepted_b',
  accept_left: 'accepted_a',
  accept_right: 'accepted_b',
  manual_edit: 'merged',
  skip: 'pending',
  unresolved: 'unresolved',
};

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDecisionType(decision) {
  const rawType = decision?.decisionType ?? decision?.userDecision ?? 'unresolved';
  const aliases = {
    take_a: 'accept_left',
    take_left: 'accept_left',
    accepted_a: 'accept_left',
    take_b: 'accept_right',
    take_right: 'accept_right',
    accepted_b: 'accept_right',
  };
  return aliases[rawType] ?? rawType;
}

function normalizeCell(cell) {
  if (!cell) {
    return { value: null, displayValue: null, formula: null, type: null, exists: false };
  }

  return {
    value: Object.prototype.hasOwnProperty.call(cell, 'value') ? deepClone(cell.value) : null,
    displayValue: Object.prototype.hasOwnProperty.call(cell, 'displayValue') ? cell.displayValue : null,
    formula: Object.prototype.hasOwnProperty.call(cell, 'formula') ? cell.formula : null,
    type: Object.prototype.hasOwnProperty.call(cell, 'type') ? cell.type : inferCellType(cell),
    exists: Object.prototype.hasOwnProperty.call(cell, 'exists') ? Boolean(cell.exists) : true,
    metadata: deepClone(cell.metadata || {}),
  };
}

function inferCellType(cell) {
  if (cell == null) {
    return null;
  }

  if (cell.formula) {
    return 'formula';
  }

  if (typeof cell.value === 'number') {
    return 'number';
  }

  if (typeof cell.value === 'boolean') {
    return 'boolean';
  }

  return cell.value == null ? null : typeof cell.value;
}

function normalizeWorksheet(worksheet, fallbackIndex) {
  const safeWorksheet = worksheet || { name: `Sheet${fallbackIndex + 1}` };
  const cells = {};

  for (const [address, cell] of Object.entries(safeWorksheet.cells || {})) {
    cells[address] = normalizeCell(cell);
  }

  return {
    id: safeWorksheet.id || `ws:${safeWorksheet.name}:${safeWorksheet.index ?? fallbackIndex}`,
    name: safeWorksheet.name,
    index: safeWorksheet.index ?? fallbackIndex,
    cells,
    metadata: deepClone(safeWorksheet.metadata || {}),
  };
}

function normalizeWorkbook(workbook) {
  return {
    workbookId: workbook?.workbookId || 'workbook:unknown',
    label: workbook?.label || null,
    metadata: deepClone(workbook?.metadata || {}),
    worksheets: (workbook?.worksheets || []).map((worksheet, index) => normalizeWorksheet(worksheet, index)),
  };
}

function workbookToSheetMap(workbook) {
  const map = new Map();
  for (const worksheet of workbook.worksheets) {
    map.set(sheetKeyFromSheet(worksheet), worksheet);
    map.set(worksheet.id, worksheet);
    map.set(worksheet.name, worksheet);
  }
  return map;
}

function sheetKeyFromSheet(worksheet) {
  return `${worksheet.name}#${worksheet.index}`;
}

function sheetKeyFromLocation(location) {
  if (!location) {
    return null;
  }
  return `${location.worksheetName}#${location.sheetIndex}`;
}

function ensureWorksheet(resultWorkbook, location, sourceWorksheet) {
  const key = sourceWorksheet ? sheetKeyFromSheet(sourceWorksheet) : sheetKeyFromLocation(location);
  if (!key) {
    return null;
  }

  let worksheet = resultWorkbook.worksheets.find((item) => sheetKeyFromSheet(item) === key);
  if (!worksheet) {
    const fallback = sourceWorksheet || {
      id: `ws:${location?.worksheetName}:${location?.sheetIndex}`,
      name: location?.worksheetName || 'Sheet',
      index: location?.sheetIndex ?? resultWorkbook.worksheets.length,
      cells: {},
      metadata: {},
    };

    worksheet = normalizeWorksheet(fallback, fallback.index ?? resultWorkbook.worksheets.length);
    resultWorkbook.worksheets.push(worksheet);
  }

  return worksheet;
}

function removeWorksheet(resultWorkbook, location, sourceWorksheet) {
  const key = sourceWorksheet ? sheetKeyFromSheet(sourceWorksheet) : sheetKeyFromLocation(location);
  if (!key) {
    return false;
  }

  const before = resultWorkbook.worksheets.length;
  resultWorkbook.worksheets = resultWorkbook.worksheets.filter((worksheet) => sheetKeyFromSheet(worksheet) !== key);
  return resultWorkbook.worksheets.length !== before;
}

function extractSheet(workbook, worksheetDiff) {
  const map = workbookToSheetMap(workbook);
  return (
    map.get(worksheetDiff?.worksheetId) ||
    map.get(sheetKeyFromLocation(worksheetDiff?.location)) ||
    map.get(worksheetDiff?.location?.worksheetName) ||
    null
  );
}

function extractCellFromWorkbook(workbook, cellDiff) {
  const sheet = extractSheet(workbook, {
    worksheetId: cellDiff.worksheetId,
    location: cellDiff.location,
  });

  if (!sheet || !cellDiff?.location?.a1) {
    return null;
  }

  return sheet.cells[cellDiff.location.a1] || null;
}

function toCellFromSnapshot(snapshot) {
  return normalizeCell(snapshot);
}

function collectDecisionCoverage(decisions = []) {
  const coverage = {
    byTarget: new Map(),
    byCell: new Map(),
    byWorksheet: new Map(),
  };

  for (const decision of decisions) {
    const normalizedDecision = {
      ...decision,
      decisionType: normalizeDecisionType(decision),
      userDecision: normalizeDecisionType(decision),
      cellRefs: [...new Set((decision?.cellRefs || []).filter(Boolean))],
      worksheetDiffIds: [...new Set((decision?.worksheetDiffIds || []).filter(Boolean))],
    };

    if (normalizedDecision.targetId) {
      coverage.byTarget.set(normalizedDecision.targetId, normalizedDecision);
    }

    for (const cellRef of normalizedDecision.cellRefs) {
      coverage.byCell.set(cellRef, normalizedDecision);
    }

    for (const worksheetDiffId of normalizedDecision.worksheetDiffIds) {
      coverage.byWorksheet.set(worksheetDiffId, normalizedDecision);
    }
  }

  return coverage;
}

function collectConflicts(diff) {
  return [
    ...(diff?.conflicts || []),
    ...((diff?.worksheetDiffs || []).flatMap((worksheet) => worksheet.conflicts || [])),
  ];
}

function collectCellDiffs(diff) {
  return (diff?.worksheetDiffs || []).flatMap((worksheet) => worksheet.cellDiffs || []);
}

function collectWorksheetDiffs(diff) {
  return diff?.worksheetDiffs || [];
}

function findDecisionForConflict(conflict, coverage) {
  return (
    coverage.byTarget.get(conflict.id) ||
    (conflict.cellRefs || []).map((cellRef) => coverage.byCell.get(cellRef)).find(Boolean) ||
    null
  );
}

function isDecisionResolved(decision) {
  return Boolean(decision) && !['skip', 'unresolved'].includes(normalizeDecisionType(decision));
}

function decisionToState(decision) {
  if (decision?.finalState) {
    return decision.finalState;
  }
  return DECISION_TO_STATE[normalizeDecisionType(decision)] || 'pending';
}

function resolveTargetSnapshot(decision, leftValue, rightValue) {
  switch (normalizeDecisionType(decision)) {
    case 'take_a':
    case 'take_left':
    case 'accept_left':
      return { snapshot: leftValue, origin: 'left' };
    case 'take_b':
    case 'take_right':
    case 'accept_right':
      return { snapshot: rightValue, origin: 'right' };
    case 'manual_edit':
      return {
        snapshot: decision.manualValue || decision.manualCell || decision.manualWorksheet || decision.manualSnapshot || decision.manualEdit,
        origin: 'manual',
      };
    default:
      return { snapshot: leftValue, origin: 'left' };
  }
}

function applyCellDecision(resultWorkbook, leftWorkbook, rightWorkbook, cellDiff, decision, appliedChanges) {
  const leftSheet = extractSheet(leftWorkbook, { worksheetId: cellDiff.worksheetId, location: cellDiff.location });
  const rightSheet = extractSheet(rightWorkbook, { worksheetId: cellDiff.worksheetId, location: cellDiff.location });
  const targetSheet = ensureWorksheet(resultWorkbook, cellDiff.location, leftSheet || rightSheet);
  const leftCell = extractCellFromWorkbook(leftWorkbook, cellDiff) || cellDiff.sourceA || null;
  const rightCell = extractCellFromWorkbook(rightWorkbook, cellDiff) || cellDiff.sourceB || null;
  const { snapshot, origin } = resolveTargetSnapshot(decision, leftCell, rightCell);

  if (!targetSheet || !cellDiff.location?.a1) {
    return;
  }

  const normalized = toCellFromSnapshot(snapshot);

  if (!normalized.exists) {
    delete targetSheet.cells[cellDiff.location.a1];
  } else {
    targetSheet.cells[cellDiff.location.a1] = normalized;
  }

  appliedChanges.push({
    targetType: 'cell',
    targetId: cellDiff.id,
    worksheetName: targetSheet.name,
    address: cellDiff.location.a1,
    origin,
    finalState: decisionToState(decision),
  });
}

function applyWorksheetDecision(resultWorkbook, leftWorkbook, rightWorkbook, worksheetDiff, decision, appliedChanges) {
  const leftSheet = extractSheet(leftWorkbook, worksheetDiff);
  const rightSheet = extractSheet(rightWorkbook, worksheetDiff);
  const { snapshot, origin } = resolveTargetSnapshot(decision, leftSheet, rightSheet);

  if (!snapshot || snapshot.cells == null) {
    if (['take_a', 'take_left', 'accept_left'].includes(normalizeDecisionType(decision))) {
      if (leftSheet) {
        ensureWorksheet(resultWorkbook, worksheetDiff.location, leftSheet);
      } else {
        removeWorksheet(resultWorkbook, worksheetDiff.location, rightSheet);
      }
    } else if (['take_b', 'take_right', 'accept_right'].includes(normalizeDecisionType(decision))) {
      if (rightSheet) {
        ensureWorksheet(resultWorkbook, worksheetDiff.location, rightSheet);
      } else {
        removeWorksheet(resultWorkbook, worksheetDiff.location, leftSheet);
      }
    }
  } else {
    removeWorksheet(resultWorkbook, worksheetDiff.location, leftSheet || rightSheet);
    resultWorkbook.worksheets.push(normalizeWorksheet(snapshot, snapshot.index ?? worksheetDiff.location?.sheetIndex ?? resultWorkbook.worksheets.length));
  }

  appliedChanges.push({
    targetType: 'worksheet',
    targetId: worksheetDiff.id,
    worksheetName: worksheetDiff.location?.worksheetName,
    origin,
    finalState: decisionToState(decision),
  });
}

function summarizePending(conflicts, coverage) {
  const pending = [];
  for (const conflict of conflicts) {
    const decision = findDecisionForConflict(conflict, coverage);
    if (!isDecisionResolved(decision)) {
      pending.push({
        targetType: 'conflict',
        targetId: conflict.id,
        reason: conflict.reason,
        location: deepClone(conflict.location || null),
      });
    }
  }
  return pending;
}

function sortWorksheets(resultWorkbook) {
  resultWorkbook.worksheets.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
}

function buildXlsxPayload(resultWorkbook) {
  return {
    format: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    workbookId: resultWorkbook.workbookId,
    worksheets: resultWorkbook.worksheets.map((worksheet) => ({
      name: worksheet.name,
      index: worksheet.index,
      metadata: deepClone(worksheet.metadata || {}),
      cells: Object.entries(worksheet.cells || {}).map(([address, cell]) => ({
        address,
        value: deepClone(cell.value),
        displayValue: cell.displayValue,
        formula: cell.formula,
        type: cell.type,
        metadata: deepClone(cell.metadata || {}),
      })),
    })),
  };
}

function apply_merge_decisions(leftWorkbookInput, rightWorkbookInput, diff, decisions, options = {}) {
  const leftWorkbook = normalizeWorkbook(leftWorkbookInput);
  const rightWorkbook = normalizeWorkbook(rightWorkbookInput);
  const resultWorkbook = normalizeWorkbook(leftWorkbook);
  const coverage = collectDecisionCoverage(decisions);
  const conflicts = collectConflicts(diff);
  const cellDiffs = collectCellDiffs(diff);
  const worksheetDiffs = collectWorksheetDiffs(diff);
  const appliedChanges = [];
  const appliedDecisionIds = [];
  const resolvedConflicts = [];

  for (const worksheetDiff of worksheetDiffs) {
    const decision = coverage.byTarget.get(worksheetDiff.id) || coverage.byWorksheet.get(worksheetDiff.id);
    if (isDecisionResolved(decision)) {
      applyWorksheetDecision(resultWorkbook, leftWorkbook, rightWorkbook, worksheetDiff, decision, appliedChanges);
      appliedDecisionIds.push(decision.id);
    }
  }

  for (const cellDiff of cellDiffs) {
    const decision = coverage.byTarget.get(cellDiff.id) || coverage.byCell.get(cellDiff.id);
    if (isDecisionResolved(decision)) {
      applyCellDecision(resultWorkbook, leftWorkbook, rightWorkbook, cellDiff, decision, appliedChanges);
      if (decision.id && !appliedDecisionIds.includes(decision.id)) {
        appliedDecisionIds.push(decision.id);
      }
    }
  }

  const appliedCellDecisionIds = new Set(appliedDecisionIds);

  for (const conflict of conflicts) {
    const decision = findDecisionForConflict(conflict, coverage);
    if (!isDecisionResolved(decision)) {
      continue;
    }

    for (const cellRef of conflict.cellRefs || []) {
      const cellDiff = cellDiffs.find((item) => item.id === cellRef);
      if (!cellDiff) {
        continue;
      }

      const explicitCellDecision = coverage.byTarget.get(cellDiff.id) || coverage.byCell.get(cellDiff.id);
      if (explicitCellDecision && explicitCellDecision.id !== decision.id) {
        continue;
      }

      applyCellDecision(resultWorkbook, leftWorkbook, rightWorkbook, cellDiff, decision, appliedChanges);
      if (decision.id) {
        appliedCellDecisionIds.add(decision.id);
      }
    }

    resolvedConflicts.push({
      conflictId: conflict.id,
      resolution: normalizeDecisionType(decision),
      finalState: decisionToState(decision),
    });
  }

  appliedDecisionIds.splice(0, appliedDecisionIds.length, ...appliedCellDecisionIds);

  sortWorksheets(resultWorkbook);

  const pendingConflicts = summarizePending(conflicts, coverage);
  const summary = {
    totalConflicts: conflicts.length,
    resolvedConflictCount: resolvedConflicts.length,
    unresolvedConflictCount: pendingConflicts.length,
    resolvedConflicts,
    pendingConflicts,
    appliedChangeCount: appliedChanges.length,
    appliedChanges,
  };

  const mergeResult = {
    id: options.mergeResultId || `merge-result:${diff?.id || 'unknown'}:${appliedDecisionIds.length}`,
    nodeType: 'MergeResult',
    workbookDiffId: diff?.id || null,
    location: {
      worksheetName: null,
      sheetIndex: null,
      row: null,
      column: null,
      a1: null,
      rangeA1: null,
    },
    changeType: pendingConflicts.length > 0 ? 'conflict' : (diff?.changeType || 'modified'),
    sourceA: {
      workbookId: leftWorkbook.workbookId,
      label: leftWorkbook.label,
      exists: true,
    },
    sourceB: {
      workbookId: rightWorkbook.workbookId,
      label: rightWorkbook.label,
      exists: true,
    },
    userDecision: pendingConflicts.length > 0 ? 'unresolved' : 'take_both',
    finalState: pendingConflicts.length > 0 ? 'unresolved' : 'merged',
    appliedDecisionIds,
    output: {
      workbookId: options.outputWorkbookId || `${leftWorkbook.workbookId}__merged__${rightWorkbook.workbookId}`,
      format: 'xlsx',
      resolvedConflictCount: summary.resolvedConflictCount,
      unresolvedConflictCount: summary.unresolvedConflictCount,
    },
    summary,
  };

  return {
    workbook: resultWorkbook,
    xlsxPayload: buildXlsxPayload(resultWorkbook),
    mergeResult,
    summary,
  };
}

export {
  apply_merge_decisions,
  buildXlsxPayload,
};
