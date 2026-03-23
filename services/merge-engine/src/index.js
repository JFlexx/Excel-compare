export { compare_workbooks, compare_worksheets, compare_cells } from './diff.js';
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
export {
  validateManualEdit,
  createManualEditDecision,
  createAcceptLeftDecision,
  createAcceptRightDecision,
  createMergeDecision,
  applyDecisionToSession,
} from './merge-decisions.js';
export { apply_merge_decisions, buildXlsxPayload } from './apply-merge-decisions.js';
