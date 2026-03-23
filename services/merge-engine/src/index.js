import { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';
import { compare_workbooks, compare_worksheets, compare_cells } from './diff.js';
import {
  getWorksheetDimensions,
  iterateWorksheets,
  loadAndNormalizeWorkbook,
  loadWorkbook,
  normalizeExcelCellToCanonical,
  normalizeWorkbook,
  normalizeWorksheet,
  shouldIgnoreCell,
} from './xlsx-normalizer.js';

export {
  apply_merge_decisions,
  buildXlsxPayload,
  compare_cells,
  compare_workbooks,
  compare_worksheets,
  getWorksheetDimensions,
  iterateWorksheets,
  loadAndNormalizeWorkbook,
  loadWorkbook,
  normalizeExcelCellToCanonical,
  normalizeWorkbook,
  normalizeWorksheet,
  shouldIgnoreCell,
};
