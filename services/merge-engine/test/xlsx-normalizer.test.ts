import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as XLSX from 'xlsx';
import {
  loadAndNormalizeWorkbook,
  normalizeExcelCellToCanonical,
  shouldIgnoreCell,
} from '../src/index.js';

test('normalizeExcelCellToCanonical conserva dirección, valor visible y fórmula', () => {
  const cell = {
    t: 'n',
    v: 42,
    w: '42',
    f: 'SUM(A1:A2)',
  } as XLSX.CellObject;

  const normalized = normalizeExcelCellToCanonical('B3', cell);

  assert.deepEqual(normalized, {
    address: 'B3',
    row: 3,
    column: 2,
    visibleValue: '42',
    formula: 'SUM(A1:A2)',
    valueType: 'number',
  });
});

test('shouldIgnoreCell ignora celdas vacías irrelevantes en el MVP', () => {
  assert.equal(
    shouldIgnoreCell(
      {
        address: 'C8',
        row: 8,
        column: 3,
        visibleValue: null,
        formula: null,
        valueType: 'blank',
      },
      { ignoreIrrelevantEmptyCells: true },
    ),
    true,
  );
});

test('loadAndNormalizeWorkbook genera un workbook comparable con orden de hojas, dimensiones y celdas', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'xlsx-normalizer-'));
  const filePath = path.join(tempDir, 'budget.review.xlsx');

  try {
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['Concept', 'Amount'],
      ['Revenue', 1200],
      ['Margin', null],
    ]);
    summarySheet.B3 = { t: 'n', v: 1200, w: '1200', f: 'SUM(B2:B2)' };
    summarySheet['!ref'] = 'A1:B3';

    const notesSheet = XLSX.utils.aoa_to_sheet([['Status'], ['Ready']]);

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(workbook, notesSheet, 'Notes');
    XLSX.writeFile(workbook, filePath);

    const normalized = loadAndNormalizeWorkbook(filePath);

    assert.equal(normalized.workbookName, 'budget.review.xlsx');
    assert.deepEqual(normalized.sheetOrder, ['Summary', 'Notes']);
    assert.equal(normalized.worksheets[0]?.dimensions.rangeA1, 'A1:B3');
    assert.deepEqual(
      normalized.worksheets[0]?.cells.map((cell) => cell.address),
      ['A1', 'B1', 'A2', 'B2', 'A3', 'B3'],
    );
    assert.deepEqual(normalized.worksheets[0]?.cells.find((cell) => cell.address === 'B3'), {
      address: 'B3',
      row: 3,
      column: 2,
      visibleValue: '1200',
      formula: 'SUM(B2:B2)',
      valueType: 'number',
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
