import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from '../../../services/merge-engine/node_modules/xlsx/xlsx.mjs';

import { createSessionFromWorkbookPayload, exportSessionToWorkbook } from '../src/server-session.js';

function workbookToBase64(worksheetName, cellValue) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([['Header'], [cellValue]]);
  XLSX.utils.book_append_sheet(workbook, worksheet, worksheetName);
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  return Buffer.from(buffer).toString('base64');
}

test('createSessionFromWorkbookPayload compares two workbook payloads', () => {
  const session = createSessionFromWorkbookPayload({
    baseWorkbook: { fileName: 'left.xlsx', base64: workbookToBase64('Summary', 'Activo') },
    comparedWorkbook: { fileName: 'right.xlsx', base64: workbookToBase64('Summary', 'Inactivo') },
    compareOptions: { conflictOnValueMismatch: true },
  });

  assert.equal(session.sourceA.label, 'left.xlsx');
  assert.equal(session.sourceB.label, 'right.xlsx');
  assert.ok(session.conflicts.length >= 1);
});

test('exportSessionToWorkbook materializes an xlsx binary when there are no pending conflicts', () => {
  const session = createSessionFromWorkbookPayload({
    baseWorkbook: { fileName: 'left.xlsx', base64: workbookToBase64('Summary', 'Activo') },
    comparedWorkbook: { fileName: 'right.xlsx', base64: workbookToBase64('Summary', 'Inactivo') },
    compareOptions: { conflictOnValueMismatch: true },
  });

  for (const conflict of session.conflicts) {
    session.mergeDecisions.push({
      id: `decision:${conflict.id}`,
      targetId: conflict.id,
      userDecision: 'take_b',
      finalState: 'accepted_b',
    });
  }

  const result = exportSessionToWorkbook(session);
  assert.ok(Buffer.isBuffer(result.binary));
  assert.match(result.fileName, /\.xlsx$/i);
  assert.ok(result.binary.length > 0);
});
