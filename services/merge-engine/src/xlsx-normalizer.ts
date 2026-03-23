import path from 'node:path';
import XLSX from 'xlsx';
import type {
  CanonicalCell,
  CanonicalWorkbook,
  CanonicalWorksheet,
  SheetDimensions,
  WorkbookNormalizationOptions,
} from './types.js';

const DEFAULT_OPTIONS: Required<WorkbookNormalizationOptions> = {
  ignoreIrrelevantEmptyCells: true,
};

export function loadWorkbook(filePath: string): XLSX.WorkBook {
  return XLSX.readFile(filePath, {
    cellDates: true,
    cellFormula: true,
    cellNF: false,
    cellStyles: false,
    cellText: true,
  });
}

export function iterateWorksheets(workbook: XLSX.WorkBook): CanonicalWorksheet[] {
  return workbook.SheetNames.map((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    return normalizeWorksheet(sheetName, worksheet, index, DEFAULT_OPTIONS);
  });
}

export function normalizeWorkbook(
  workbook: XLSX.WorkBook,
  workbookName = 'unknown.xlsx',
  options: WorkbookNormalizationOptions = {},
): CanonicalWorkbook {
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

export function loadAndNormalizeWorkbook(
  filePath: string,
  options: WorkbookNormalizationOptions = {},
): CanonicalWorkbook {
  const workbook = loadWorkbook(filePath);
  return normalizeWorkbook(workbook, path.basename(filePath), options);
}

export function normalizeWorksheet(
  sheetName: string,
  worksheet: XLSX.WorkSheet,
  index: number,
  options: Required<WorkbookNormalizationOptions>,
): CanonicalWorksheet {
  const cellEntries = Object.entries(worksheet)
    .filter(([address]) => !address.startsWith('!'))
    .sort(([left], [right]) => compareAddresses(left, right));

  const cells = cellEntries
    .map(([address, cell]) => normalizeExcelCellToCanonical(address, cell as XLSX.CellObject))
    .filter((cell) => !shouldIgnoreCell(cell, options));

  return {
    name: sheetName,
    index,
    order: index,
    dimensions: getWorksheetDimensions(worksheet),
    cells,
  };
}

export function normalizeExcelCellToCanonical(
  address: string,
  cell: XLSX.CellObject,
): CanonicalCell {
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

export function shouldIgnoreCell(
  cell: CanonicalCell,
  options: Required<WorkbookNormalizationOptions> = DEFAULT_OPTIONS,
): boolean {
  if (!options.ignoreIrrelevantEmptyCells) {
    return false;
  }

  const hasVisibleValue = cell.visibleValue !== null && cell.visibleValue !== '';
  const hasFormula = cell.formula !== null && cell.formula !== '';

  return !hasVisibleValue && !hasFormula;
}

export function getWorksheetDimensions(worksheet: XLSX.WorkSheet): SheetDimensions {
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

function getVisibleValue(cell: XLSX.CellObject): string | null {
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

function inferValueType(cell: XLSX.CellObject): CanonicalCell['valueType'] {
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

function compareAddresses(left: string, right: string): number {
  const a = XLSX.utils.decode_cell(left);
  const b = XLSX.utils.decode_cell(right);

  if (a.r !== b.r) {
    return a.r - b.r;
  }

  return a.c - b.c;
}
