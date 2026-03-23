const DEFAULT_WORKSHEET_RANGE = 'A1:XFD1048576';

/**
 * @typedef {'unchanged' | 'added' | 'removed' | 'modified' | 'conflict'} ChangeType
 */

/**
 * @typedef {{
 *   worksheetName: string | null,
 *   sheetIndex: number | null,
 *   row: number | null,
 *   column: number | null,
 *   a1: string | null,
 *   rangeA1: string | null,
 * }} DiffLocation
 */

/**
 * @typedef {{
 *   value?: unknown,
 *   displayValue?: string | null,
 *   formula?: string | null,
 *   type?: string | null,
 *   exists: boolean,
 * }} DiffSide
 */

/**
 * @typedef {{
 *   workbookId?: string,
 *   label?: string,
 *   path?: string,
 *   worksheets?: Array<NormalizedWorksheet>,
 * }} NormalizedWorkbook
 */

/**
 * @typedef {{
 *   worksheetId?: string,
 *   name?: string,
 *   sheetIndex?: number,
 *   cells?: Array<NormalizedCell>,
 * }} NormalizedWorksheet
 */

/**
 * @typedef {{
 *   address?: string,
 *   a1?: string,
 *   row?: number,
 *   column?: number,
 *   value?: unknown,
 *   displayValue?: string | null,
 *   formula?: string | null,
 *   type?: string | null,
 * }} NormalizedCell
 */

/**
 * @typedef {{
 *   conflictOnValueMismatch?: boolean,
 * }} CompareOptions
 */

/**
 * Primera versión del diff entre dos workbooks normalizados.
 *
 * @param {NormalizedWorkbook} sourceA
 * @param {NormalizedWorkbook} sourceB
 * @param {CompareOptions} [options]
 */
export function compare_workbooks(sourceA, sourceB, options = {}) {
  const workbookIdA = sourceA?.workbookId ?? 'workbook-a';
  const workbookIdB = sourceB?.workbookId ?? 'workbook-b';
  const worksheetPairs = pairWorksheets(sourceA?.worksheets ?? [], sourceB?.worksheets ?? []);
  const worksheetDiffs = worksheetPairs.map(({ worksheetA, worksheetB }) =>
    compare_worksheets(worksheetA, worksheetB, options),
  );

  const summary = buildWorkbookSummary(worksheetDiffs);

  return {
    id: `wbd:${workbookIdA}:${workbookIdB}`,
    nodeType: 'WorkbookDiff',
    sourceAWorkbookId: workbookIdA,
    sourceBWorkbookId: workbookIdB,
    location: createLocation(),
    changeType: summarizeChangeType(worksheetDiffs.map((worksheetDiff) => worksheetDiff.changeType)),
    sourceA: {
      workbookId: workbookIdA,
      label: sourceA?.label,
      path: sourceA?.path,
      exists: true,
    },
    sourceB: {
      workbookId: workbookIdB,
      label: sourceB?.label,
      path: sourceB?.path,
      exists: true,
    },
    userDecision: 'unresolved',
    finalState: summary.conflictCount > 0 ? 'unresolved' : 'pending',
    worksheetDiffs,
    conflicts: worksheetDiffs.flatMap((worksheetDiff) => worksheetDiff.conflicts),
    summary,
  };
}

/**
 * @param {NormalizedWorksheet | undefined} worksheetA
 * @param {NormalizedWorksheet | undefined} worksheetB
 * @param {CompareOptions} [options]
 */
export function compare_worksheets(worksheetA, worksheetB, options = {}) {
  const sheetIndex = worksheetA?.sheetIndex ?? worksheetB?.sheetIndex ?? 0;
  const worksheetName = worksheetA?.name ?? worksheetB?.name ?? `Sheet${sheetIndex + 1}`;
  const sheetKey = getWorksheetKey(worksheetA, worksheetB);
  const worksheetId = worksheetA?.worksheetId ?? worksheetB?.worksheetId ?? `ws:${sheetKey}`;

  if (!worksheetA || !worksheetB) {
    const changeType = worksheetA ? 'removed' : 'added';
    return {
      id: `wsd:${sheetKey}`,
      nodeType: 'WorksheetDiff',
      worksheetId,
      location: createLocation({
        worksheetName,
        sheetIndex,
        rangeA1: `${worksheetName}!${DEFAULT_WORKSHEET_RANGE}`,
      }),
      changeType,
      sourceA: buildWorksheetSide(worksheetA, worksheetName),
      sourceB: buildWorksheetSide(worksheetB, worksheetName),
      userDecision: 'unresolved',
      finalState: 'pending',
      cellDiffs: [],
      conflicts: [],
    };
  }

  const cellPairs = pairCells(worksheetA.cells ?? [], worksheetB.cells ?? []);
  const cellDiffs = cellPairs.map(({ cellA, cellB }) =>
    compare_cells(cellA, cellB, {
      ...options,
      worksheetName,
      sheetIndex,
      worksheetId,
      sheetKey,
    }),
  );
  const conflicts = cellDiffs
    .filter((cellDiff) => cellDiff.changeType === 'conflict')
    .map((cellDiff) => buildCellConflict(cellDiff));

  const effectiveCellDiffs = cellDiffs.map((cellDiff) => {
    if (cellDiff.changeType !== 'conflict') {
      return cellDiff;
    }

    return {
      ...cellDiff,
      conflictIds: [createConflictId(sheetKey, cellDiff.location.rangeA1 ?? cellDiff.location.a1 ?? 'unknown')],
    };
  });

  return {
    id: `wsd:${sheetKey}`,
    nodeType: 'WorksheetDiff',
    worksheetId,
    location: createLocation({
      worksheetName,
      sheetIndex,
      rangeA1: `${worksheetName}!${DEFAULT_WORKSHEET_RANGE}`,
    }),
    changeType: summarizeChangeType(effectiveCellDiffs.map((cellDiff) => cellDiff.changeType)),
    sourceA: buildWorksheetSide(worksheetA, worksheetName),
    sourceB: buildWorksheetSide(worksheetB, worksheetName),
    userDecision: 'unresolved',
    finalState: conflicts.length > 0 ? 'unresolved' : 'pending',
    cellDiffs: effectiveCellDiffs,
    conflicts,
  };
}

/**
 * @param {NormalizedCell | undefined} cellA
 * @param {NormalizedCell | undefined} cellB
 * @param {CompareOptions & {worksheetName?: string, sheetIndex?: number, worksheetId?: string, sheetKey?: string}} [options]
 */
export function compare_cells(cellA, cellB, options = {}) {
  const normalizedA = normalizeCell(cellA);
  const normalizedB = normalizeCell(cellB);
  const row = normalizedA.row ?? normalizedB.row ?? null;
  const column = normalizedA.column ?? normalizedB.column ?? null;
  const a1 = normalizedA.a1 ?? normalizedB.a1 ?? null;
  const worksheetName = options.worksheetName ?? null;
  const sheetIndex = options.sheetIndex ?? null;
  const sheetKey = options.sheetKey ?? `${slugify(worksheetName ?? 'sheet')}:${sheetIndex ?? 0}`;
  const changeType = detectCellChangeType(normalizedA, normalizedB, options);

  return {
    id: `cell:${sheetKey}:${a1 ?? `${row}:${column}`}`,
    nodeType: 'CellDiff',
    worksheetId: options.worksheetId ?? `ws:${sheetKey}`,
    location: createLocation({
      worksheetName,
      sheetIndex,
      row,
      column,
      a1,
      rangeA1: a1,
    }),
    changeType,
    sourceA: buildCellSide(normalizedA),
    sourceB: buildCellSide(normalizedB),
    userDecision: 'unresolved',
    finalState: changeType === 'conflict' ? 'unresolved' : 'pending',
    conflictIds: [],
  };
}

function pairWorksheets(worksheetsA, worksheetsB) {
  const mapA = new Map(worksheetsA.map((worksheet) => [getWorksheetKey(worksheet), worksheet]));
  const mapB = new Map(worksheetsB.map((worksheet) => [getWorksheetKey(worksheet), worksheet]));
  const keys = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();

  return keys.map((key) => ({
    worksheetA: mapA.get(key),
    worksheetB: mapB.get(key),
  }));
}

function pairCells(cellsA, cellsB) {
  const mapA = new Map(cellsA.map((cell) => {
    const normalized = normalizeCell(cell);
    return [normalized.a1 ?? `${normalized.row}:${normalized.column}`, normalized];
  }));
  const mapB = new Map(cellsB.map((cell) => {
    const normalized = normalizeCell(cell);
    return [normalized.a1 ?? `${normalized.row}:${normalized.column}`, normalized];
  }));
  const keys = [...new Set([...mapA.keys(), ...mapB.keys()])].sort(compareAddresses);

  return keys.map((key) => ({
    cellA: mapA.get(key),
    cellB: mapB.get(key),
  }));
}

function detectCellChangeType(cellA, cellB, options) {
  if (!cellA.exists && cellB.exists) {
    return 'added';
  }

  if (cellA.exists && !cellB.exists) {
    return 'removed';
  }

  if (!cellA.exists && !cellB.exists) {
    return 'unchanged';
  }

  if (cellA.formula !== cellB.formula && (cellA.formula || cellB.formula)) {
    return 'conflict';
  }

  if (!sameComparableValue(cellA.value, cellB.value) || cellA.displayValue !== cellB.displayValue || cellA.type !== cellB.type) {
    return options.conflictOnValueMismatch ? 'conflict' : 'modified';
  }

  return 'unchanged';
}

function buildCellConflict(cellDiff) {
  const sheetKey = cellDiff.id.split(':').slice(1, 3).join(':');
  const rangeA1 = cellDiff.location.rangeA1 ?? cellDiff.location.a1 ?? 'unknown';
  const conflictId = createConflictId(sheetKey, rangeA1);

  return {
    id: conflictId,
    nodeType: 'Conflict',
    scopeType: 'cell',
    location: cellDiff.location,
    changeType: 'conflict',
    sourceA: cellDiff.sourceA,
    sourceB: cellDiff.sourceB,
    reason: inferConflictReason(cellDiff),
    cellRefs: [cellDiff.id],
    userDecision: 'unresolved',
    finalState: 'unresolved',
  };
}

function inferConflictReason(cellDiff) {
  if (cellDiff.sourceA.formula !== cellDiff.sourceB.formula) {
    return 'Both cells define different formulas and require manual validation.';
  }

  return 'Both cells differ and current product rules require manual validation.';
}

function createConflictId(sheetKey, rangeA1) {
  return `conflict:cell:${sheetKey}:${rangeA1}`;
}

function buildWorkbookSummary(worksheetDiffs) {
  const worksheets = createChangeCounter();
  const cells = createChangeCounter();
  let conflictCount = 0;

  for (const worksheetDiff of worksheetDiffs) {
    worksheets[worksheetDiff.changeType] += 1;
    conflictCount += worksheetDiff.conflicts.length;

    for (const cellDiff of worksheetDiff.cellDiffs) {
      cells[cellDiff.changeType] += 1;
    }
  }

  return {
    worksheets,
    cells,
    conflictCount,
  };
}

function createChangeCounter() {
  return {
    unchanged: 0,
    added: 0,
    removed: 0,
    modified: 0,
    conflict: 0,
  };
}

function summarizeChangeType(changeTypes) {
  if (changeTypes.includes('conflict')) {
    return 'conflict';
  }

  if (changeTypes.includes('modified') || changeTypes.includes('added') || changeTypes.includes('removed')) {
    return 'modified';
  }

  return 'unchanged';
}

function buildWorksheetSide(worksheet, fallbackName) {
  return {
    worksheetId: worksheet?.worksheetId,
    name: worksheet?.name ?? fallbackName,
    exists: Boolean(worksheet),
  };
}

function buildCellSide(cell) {
  return {
    value: cell.value,
    displayValue: cell.displayValue ?? null,
    formula: cell.formula ?? null,
    type: cell.type ?? inferCellType(cell),
    exists: cell.exists,
  };
}

function normalizeCell(cell) {
  if (!cell) {
    return {
      exists: false,
      row: null,
      column: null,
      a1: null,
      value: undefined,
      displayValue: null,
      formula: null,
      type: null,
    };
  }

  const row = cell.row ?? parseA1(cell.address ?? cell.a1).row;
  const column = cell.column ?? parseA1(cell.address ?? cell.a1).column;
  const a1 = cell.address ?? cell.a1 ?? toA1(row, column);

  return {
    exists: true,
    row,
    column,
    a1,
    value: cell.value,
    displayValue: cell.displayValue ?? valueToDisplay(cell.value),
    formula: cell.formula ?? null,
    type: cell.type ?? null,
  };
}

function createLocation(overrides = {}) {
  return {
    worksheetName: null,
    sheetIndex: null,
    row: null,
    column: null,
    a1: null,
    rangeA1: null,
    ...overrides,
  };
}

function getWorksheetKey(worksheetA, worksheetB = worksheetA) {
  const worksheet = worksheetA ?? worksheetB;
  const name = worksheet?.name ?? 'sheet';
  const sheetIndex = worksheet?.sheetIndex ?? worksheetB?.sheetIndex ?? 0;
  return `${slugify(name)}:${sheetIndex}`;
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function inferCellType(cell) {
  if (!cell.exists) {
    return null;
  }

  if (cell.formula) {
    return 'formula';
  }

  if (cell.value === null || cell.value === undefined) {
    return 'blank';
  }

  return typeof cell.value;
}

function valueToDisplay(value) {
  return value === null || value === undefined ? null : String(value);
}

function sameComparableValue(left, right) {
  return Object.is(left, right);
}

function compareAddresses(left, right) {
  const parsedLeft = parseA1(left);
  const parsedRight = parseA1(right);

  if (parsedLeft.row !== parsedRight.row) {
    return parsedLeft.row - parsedRight.row;
  }

  return parsedLeft.column - parsedRight.column;
}

function parseA1(a1) {
  if (!a1) {
    return { row: null, column: null };
  }

  const match = /^([A-Z]+)(\d+)$/i.exec(a1);
  if (!match) {
    return { row: null, column: null };
  }

  const [, columnLabel, rowLabel] = match;
  let column = 0;
  for (const character of columnLabel.toUpperCase()) {
    column = (column * 26) + (character.charCodeAt(0) - 64);
  }

  return {
    row: Number(rowLabel),
    column,
  };
}

function toA1(row, column) {
  if (!row || !column) {
    return null;
  }

  let remaining = column;
  let label = '';
  while (remaining > 0) {
    const modulo = (remaining - 1) % 26;
    label = String.fromCharCode(65 + modulo) + label;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return `${label}${row}`;
}
