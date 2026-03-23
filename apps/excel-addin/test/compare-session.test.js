import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compareSelectedWorkbookFiles } from '../src/compare-session.js';

const require = createRequire(import.meta.url);
const XLSX = require('../../../services/merge-engine/node_modules/xlsx');

test('compareSelectedWorkbookFiles normaliza ambos libros y construye la sesión inicial del add-in', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'excel-addin-compare-'));

  try {
    const baseWorkbook = XLSX.utils.book_new();
    const baseSummary = XLSX.utils.aoa_to_sheet([
      ['Concepto', 'Valor', 'Resultado'],
      ['Ventas', 1200, 1200],
      ['Margen', 300, 300],
    ]);
    baseSummary.C2 = { t: 'n', v: 1200, w: '1200', f: 'SUM(B2:B2)' };
    baseSummary.C3 = { t: 'n', v: 300, w: '300', f: 'SUM(B3:B3)' };
    baseSummary['!ref'] = 'A1:C3';
    XLSX.utils.book_append_sheet(baseWorkbook, baseSummary, 'Summary');

    const comparedWorkbook = XLSX.utils.book_new();
    const comparedSummary = XLSX.utils.aoa_to_sheet([
      ['Concepto', 'Valor', 'Resultado'],
      ['Ventas', 1500, 1500],
      ['Margen', 300, 200],
    ]);
    comparedSummary.C2 = { t: 'n', v: 1500, w: '1500', f: 'SUM(B2:B2)' };
    comparedSummary.C3 = { t: 'n', v: 200, w: '200', f: 'SUM(B3:B3)-100' };
    comparedSummary['!ref'] = 'A1:C3';
    XLSX.utils.book_append_sheet(comparedWorkbook, comparedSummary, 'Summary');
    XLSX.utils.book_append_sheet(comparedWorkbook, XLSX.utils.aoa_to_sheet([['Nueva hoja']]), 'Notes');

    const basePath = path.join(tempDir, 'budget.base.xlsx');
    const comparedPath = path.join(tempDir, 'budget.review.xlsx');
    XLSX.writeFile(baseWorkbook, basePath);
    XLSX.writeFile(comparedWorkbook, comparedPath);

    const session = compareSelectedWorkbookFiles({
      baseWorkbook: { path: basePath, label: 'budget.base.xlsx' },
      comparedWorkbook: { path: comparedPath, label: 'budget.review.xlsx' },
      createdAt: '2026-03-23T10:30:00.000Z',
    });

    assert.equal(session.sourceA.label, 'budget.base.xlsx');
    assert.equal(session.sourceB.label, 'budget.review.xlsx');
    assert.equal(session.sourceA.worksheetCount, 1);
    assert.equal(session.sourceB.worksheetCount, 2);
    assert.equal(session.mergeDecisions.length, 0);
    assert.equal(session.summary.pendingConflictCount, 1);
    assert.equal(session.summary.autoResolvedCount, 3);
    assert.deepEqual(session.summary.affectedSheets, ['Summary', 'Notes']);
    assert.equal(session.status, 'pending_review');
    assert.equal(session.conflicts.length, 1);
    assert.equal(session.worksheetDiffs.length, 2);
    assert.equal(session.conflicts[0].location.worksheetName, 'Summary');
    assert.equal(session.conflicts[0].location.a1, 'C3');
    assert.match(session.sessionId, /^ms_2026-03-23T10-30-00-000Z_budget_base_xlsx__budget_review_xlsx$/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
