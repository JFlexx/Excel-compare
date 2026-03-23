import * as XLSX from '../../../services/merge-engine/node_modules/xlsx/xlsx.mjs';
import { normalizeWorkbook } from '../../../services/merge-engine/src/xlsx-normalizer.js';
import {
  createWorkbookSelection,
  createSessionFromCanonicalWorkbooks,
  MVP_COMPARE_OPTIONS,
} from './compare-session.js';
import { generateFinalWorkbookArtifacts } from './final-review.js';

const READ_OPTIONS = {
  type: 'buffer',
  cellDates: true,
  cellFormula: true,
  cellNF: false,
  cellStyles: false,
  cellText: true,
};

function decodeBase64Workbook(base64) {
  return Buffer.from(String(base64), 'base64');
}

function parseWorkbookFromBase64(fileName, base64) {
  const buffer = decodeBase64Workbook(base64);
  const workbook = XLSX.read(buffer, READ_OPTIONS);
  return normalizeWorkbook(workbook, fileName);
}

export function createSessionFromWorkbookPayload({
  baseWorkbook,
  comparedWorkbook,
  normalizationOptions,
  compareOptions = MVP_COMPARE_OPTIONS,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!baseWorkbook?.fileName || !baseWorkbook?.base64) {
    throw new Error('baseWorkbook.fileName y baseWorkbook.base64 son obligatorios.');
  }
  if (!comparedWorkbook?.fileName || !comparedWorkbook?.base64) {
    throw new Error('comparedWorkbook.fileName y comparedWorkbook.base64 son obligatorios.');
  }

  const canonicalA = parseWorkbookFromBase64(baseWorkbook.fileName, baseWorkbook.base64, normalizationOptions);
  const canonicalB = parseWorkbookFromBase64(comparedWorkbook.fileName, comparedWorkbook.base64, normalizationOptions);
  const sourceASelection = createWorkbookSelection('base', baseWorkbook.fileName, {
    fileName: baseWorkbook.fileName,
    label: baseWorkbook.fileName,
    role: 'Libro base',
  });
  const sourceBSelection = createWorkbookSelection('compared', comparedWorkbook.fileName, {
    fileName: comparedWorkbook.fileName,
    label: comparedWorkbook.fileName,
    role: 'Libro comparado',
  });

  return createSessionFromCanonicalWorkbooks({
    sourceASelection,
    sourceBSelection,
    canonicalA,
    canonicalB,
    compareOptions,
    createdAt,
    normalizationOptions,
  });
}

export function exportSessionToWorkbook(session) {
  const artifacts = generateFinalWorkbookArtifacts(session, { xlsxLib: XLSX });
  return {
    ...artifacts,
    binary: Buffer.from(artifacts.binary),
  };
}
