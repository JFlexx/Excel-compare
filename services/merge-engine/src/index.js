'use strict';

const { apply_merge_decisions, buildXlsxPayload } = require('./apply-merge-decisions');

module.exports = {
  apply_merge_decisions,
  buildXlsxPayload,
};
export {
  compare_workbooks,
  compare_worksheets,
  compare_cells,
} from './diff.js';
