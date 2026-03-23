export type {
  CanonicalCell,
  CanonicalWorkbook,
  CanonicalWorksheet,
  SheetDimensions,
  WorkbookNormalizationOptions,
} from './types.js';

export {
  getWorksheetDimensions,
  iterateWorksheets,
  loadAndNormalizeWorkbook,
  loadWorkbook,
  normalizeExcelCellToCanonical,
  normalizeWorkbook,
  normalizeWorksheet,
  shouldIgnoreCell,
} from './xlsx-normalizer.js';
