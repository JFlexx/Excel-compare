import path from 'node:path';
import XLSX from 'xlsx';

const DEFAULT_OPTIONS = {
  ignoreIrrelevantEmptyCells: true,
};

export function loadWorkbook(filePath) {
  return XLSX.readFile(filePath, {
    cellDates: true,
    cellFormula: true,
    cellNF: false,
    cellStyles: false,
    cellText: true,
  });
}

export function iterateWorksheets(workbook) {
  return workbook.SheetNames.map((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    return normalizeWorksheet(sheetName, worksheet, index, DEFAULT_OPTIONS);
  });
}

export function normalizeWorkbook(workbook, workbookName = 'unknown.xlsx', options = {}) {
  const effectiveOptions = { ...DEFAULT_OPTIONS, ...options };
  const worksheets = workbook.SheetNames.map((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    return normalizeWorksheet(sheetName, worksheet, index, effectiveOptions);
  });

  return {
    workbookName,
    sheetOrder: workbook.SheetNames.slice(),
    worksheets,
  };
}

export function loadAndNormalizeWorkbook(filePath, options = {}) {
  const workbook = loadWorkbook(filePath);
  return normalizeWorkbook(workbook, path.basename(filePath), options);
}

export function normalizeWorksheet(sheetName, worksheet, index, options = DEFAULT_OPTIONS) {
  const cellEntries = Object.entries(worksheet)
    .filter(([address]) => !address.startsWith('!'))
    .sort(([left], [right]) => compareAddresses(left, right));

  const cells = cellEntries
    .map(([address, cell]) => normalizeExcelCellToCanonical(address, cell))
    .filter((cell) => !shouldIgnoreCell(cell, options));

  return {
    name: sheetName,
    index,
    order: index,
    dimensions: getWorksheetDimensions(worksheet),
    cells,
  };
}

export function normalizeExcelCellToCanonical(address, cell) {
  const decoded = XLSX.utils.decode_cell(address);
  const visibleValue = getVisibleValue(cell);

  return {
    address,
    row: decoded.r + 1,
    column: decoded.c + 1,
    visibleValue,
    formula: cell.f ?? null,
    valueType: inferValueType(cell),
  };
}

export function shouldIgnoreCell(cell, options = DEFAULT_OPTIONS) {
  if (!options.ignoreIrrelevantEmptyCells) {
    return false;
  }

  const hasVisibleValue = cell.visibleValue !== null && cell.visibleValue !== '';
  const hasFormula = cell.formula !== null && cell.formula !== '';

  return !hasVisibleValue && !hasFormula;
}

export function getWorksheetDimensions(worksheet) {
  const ref = worksheet['!ref'];
  if (!ref) {
    return {
      rangeA1: null,
      startRow: null,
      endRow: null,
      startColumn: null,
      endColumn: null,
    };
  }

  const decoded = XLSX.utils.decode_range(ref);
  return {
    rangeA1: ref,
    startRow: decoded.s.r + 1,
    endRow: decoded.e.r + 1,
    startColumn: decoded.s.c + 1,
    endColumn: decoded.e.c + 1,
  };
}

function getVisibleValue(cell) {
  if (typeof cell.w === 'string') {
    return cell.w;
  }

  if (cell.v === undefined || cell.v === null) {
    return null;
  }

  if (cell.t === 'd' && cell.v instanceof Date) {
    return cell.v.toISOString();
  }

  return String(cell.v);
}

function inferValueType(cell) {
  switch (cell.t) {
    case 's':
      return 'string';
    case 'n':
      return 'number';
    case 'b':
      return 'boolean';
    case 'd':
      return 'date';
    case 'e':
      return 'error';
    case 'z':
      return 'blank';
    default:
      return 'unknown';
  }
}

function compareAddresses(left, right) {
  const a = XLSX.utils.decode_cell(left);
  const b = XLSX.utils.decode_cell(right);

  if (a.r !== b.r) {
    return a.r - b.r;
  }

  return a.c - b.c;
}
