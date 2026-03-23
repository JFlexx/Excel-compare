import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFinalReviewModel,
  createWorkbookBinaryFromPayload,
  generateFinalWorkbookArtifacts,
  validateSessionConsistency,
} from '../src/final-review.js';

function buildSession() {
  const sourceAWorkbook = {
    workbookId: 'wb-left',
    label: 'Ventas_Q1_Base.xlsx',
    worksheets: [
      {
        id: 'ws:Clientes:0',
        name: 'Clientes',
        index: 0,
        cells: {
          D18: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
          F22: { value: 12500, displayValue: '12500', type: 'number', exists: true },
        },
      },
      {
        id: 'ws:Forecast:1',
        name: 'Forecast',
        index: 1,
        cells: {
          B7: { value: '=SUM(B2:B6)', displayValue: '=SUM(B2:B6)', formula: '=SUM(B2:B6)', type: 'formula', exists: true },
        },
      },
    ],
  };

  const sourceBWorkbook = {
    workbookId: 'wb-right',
    label: 'Ventas_Q1_Actualizado.xlsx',
    worksheets: [
      {
        id: 'ws:Clientes:0',
        name: 'Clientes',
        index: 0,
        cells: {
          D18: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
          F22: { value: 13250, displayValue: '13250', type: 'number', exists: true },
        },
      },
      {
        id: 'ws:Forecast:1',
        name: 'Forecast',
        index: 1,
        cells: {
          B7: { value: '=SUM(B2:B6)-B4', displayValue: '=SUM(B2:B6)-B4', formula: '=SUM(B2:B6)-B4', type: 'formula', exists: true },
        },
      },
    ],
  };

  const workbookDiff = {
    id: 'wbd:wb-left:wb-right',
    sourceA: { workbookId: 'wb-left', exists: true },
    sourceB: { workbookId: 'wb-right', exists: true },
    worksheetDiffs: [
      {
        id: 'wsd:Clientes:0',
        worksheetId: 'ws:Clientes:0',
        location: { worksheetName: 'Clientes', sheetIndex: 0 },
        cellDiffs: [
          {
            id: 'cell:Clientes:0:D18',
            worksheetId: 'ws:Clientes:0',
            location: { worksheetName: 'Clientes', sheetIndex: 0, a1: 'D18' },
            sourceA: { value: 'Activo', displayValue: 'Activo', type: 'string', exists: true },
            sourceB: { value: 'Inactivo', displayValue: 'Inactivo', type: 'string', exists: true },
          },
          {
            id: 'cell:Clientes:0:F22',
            worksheetId: 'ws:Clientes:0',
            location: { worksheetName: 'Clientes', sheetIndex: 0, a1: 'F22' },
            sourceA: { value: 12500, displayValue: '12500', type: 'number', exists: true },
            sourceB: { value: 13250, displayValue: '13250', type: 'number', exists: true },
          },
        ],
        conflicts: [
          {
            id: 'conf-1',
            changeType: 'conflict',
            location: { worksheetName: 'Clientes', sheetIndex: 0, a1: 'D18' },
            reason: 'Estado operativo distinto.',
            cellRefs: ['cell:Clientes:0:D18'],
          },
          {
            id: 'conf-2',
            changeType: 'conflict',
            location: { worksheetName: 'Clientes', sheetIndex: 0, a1: 'F22' },
            reason: 'Importe distinto.',
            cellRefs: ['cell:Clientes:0:F22'],
          },
        ],
      },
      {
        id: 'wsd:Forecast:1',
        worksheetId: 'ws:Forecast:1',
        location: { worksheetName: 'Forecast', sheetIndex: 1 },
        cellDiffs: [
          {
            id: 'cell:Forecast:1:B7',
            worksheetId: 'ws:Forecast:1',
            location: { worksheetName: 'Forecast', sheetIndex: 1, a1: 'B7' },
            sourceA: { value: '=SUM(B2:B6)', displayValue: '=SUM(B2:B6)', formula: '=SUM(B2:B6)', type: 'formula', exists: true },
            sourceB: { value: '=SUM(B2:B6)-B4', displayValue: '=SUM(B2:B6)-B4', formula: '=SUM(B2:B6)-B4', type: 'formula', exists: true },
          },
        ],
        conflicts: [
          {
            id: 'conf-3',
            changeType: 'formula_changed',
            severity: 'critical',
            location: { worksheetName: 'Forecast', sheetIndex: 1, a1: 'B7' },
            reason: 'La fórmula requiere revisión.',
            cellRefs: ['cell:Forecast:1:B7'],
          },
        ],
      },
    ],
    conflicts: [],
  };

  return {
    sessionId: 'session-1',
    updatedAt: '2026-03-23T18:00:00Z',
    sourceA: { workbookId: 'wb-left', label: 'Ventas_Q1_Base.xlsx' },
    sourceB: { workbookId: 'wb-right', label: 'Ventas_Q1_Actualizado.xlsx' },
    sourceAWorkbook,
    sourceBWorkbook,
    workbookDiff,
    mergeDecisions: [
      { id: 'decision:conf-1', targetId: 'conf-1', userDecision: 'take_b', finalState: 'accepted_b' },
      { id: 'decision:conf-2', targetId: 'conf-2', userDecision: 'take_b', finalState: 'accepted_b' },
    ],
  };
}

test('validateSessionConsistency detects orphan decisions', () => {
  const session = buildSession();
  session.mergeDecisions.push({ id: 'decision:oops', targetId: 'conf-x', userDecision: 'take_a' });
  const validation = validateSessionConsistency(session);

  assert.equal(validation.valid, false);
  assert.match(validation.issues[0], /no pertenece al workbookDiff actual/i);
});

test('buildFinalReviewModel summarizes resolved, pending and guard state', () => {
  const model = buildFinalReviewModel(buildSession());

  assert.equal(model.resolvedConflictCount, 2);
  assert.equal(model.pendingCount, 1);
  assert.equal(model.criticalPendingCount, 1);
  assert.equal(model.exportGuard.canContinue, false);
  assert.equal(model.decisionsByType[0].decisionType, 'take_b');
  assert.deepEqual(model.affectedSheets.sort(), ['Clientes', 'Forecast']);
});

test('createWorkbookBinaryFromPayload writes workbook cells through XLSX adapter', () => {
  const calls = [];
  const fakeXlsx = {
    utils: {
      book_new() {
        return { Sheets: {}, SheetNames: [] };
      },
      book_append_sheet(workbook, sheet, name) {
        workbook.Sheets[name] = sheet;
        workbook.SheetNames.push(name);
      },
      decode_cell(address) {
        const column = address.charCodeAt(0) - 65;
        const row = Number(address.slice(1)) - 1;
        return { c: column, r: row };
      },
      encode_range(range) {
        return `${range.s.c}:${range.s.r}-${range.e.c}:${range.e.r}`;
      },
    },
    write(workbook, options) {
      calls.push({ workbook, options });
      return new Uint8Array([1, 2, 3]);
    },
  };

  const binary = createWorkbookBinaryFromPayload({
    worksheets: [
      {
        name: 'Clientes',
        cells: [
          { address: 'A1', value: 'Hola', displayValue: 'Hola', type: 'string' },
          { address: 'B2', value: 10, displayValue: '10', type: 'number' },
        ],
      },
    ],
  }, fakeXlsx);

  assert.deepEqual([...binary], [1, 2, 3]);
  assert.equal(calls[0].options.bookType, 'xlsx');
  assert.equal(calls[0].workbook.Sheets.Clientes['!ref'], '0:0-1:1');
});

test('generateFinalWorkbookArtifacts materializes merged payload and binary', () => {
  const session = buildSession();
  session.mergeDecisions.push({ id: 'decision:conf-3', targetId: 'conf-3', userDecision: 'take_a', finalState: 'accepted_a' });

  const fakeXlsx = {
    utils: {
      book_new() {
        return { Sheets: {}, SheetNames: [] };
      },
      book_append_sheet(workbook, sheet, name) {
        workbook.Sheets[name] = sheet;
        workbook.SheetNames.push(name);
      },
      decode_cell(address) {
        const column = address.charCodeAt(0) - 65;
        const row = Number(address.slice(1)) - 1;
        return { c: column, r: row };
      },
      encode_range(range) {
        return `${range.s.c}:${range.s.r}-${range.e.c}:${range.e.r}`;
      },
    },
    write() {
      return new Uint8Array([9, 9, 9]);
    },
  };

  const result = generateFinalWorkbookArtifacts(session, { xlsxLib: fakeXlsx });
  const clientesSheet = result.xlsxPayload.worksheets.find((sheet) => sheet.name === 'Clientes');
  const forecastSheet = result.xlsxPayload.worksheets.find((sheet) => sheet.name === 'Forecast');

  assert.deepEqual([...result.binary], [9, 9, 9]);
  assert.equal(result.mergeOutcome.summary.unresolvedConflictCount, 0);
  assert.equal(clientesSheet.cells.find((cell) => cell.address === 'D18').value, 'Inactivo');
  assert.equal(forecastSheet.cells.find((cell) => cell.address === 'B7').formula, '=SUM(B2:B6)');
});
