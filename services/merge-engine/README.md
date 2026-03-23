# services/merge-engine

Motor compartido para comparar workbooks, normalizar celdas, capturar decisiones de merge y materializar el workbook final.

## API pública

El façade principal está en `src/index.js` y expone estas funciones:

### Diff

- `compare_workbooks(sourceA, sourceB, options)`
- `compare_worksheets(worksheetA, worksheetB, options)`
- `compare_cells(cellA, cellB, options)`

### Normalización

- `getWorksheetDimensions(worksheet)`
- `iterateWorksheets(workbook)`
- `loadAndNormalizeWorkbook(input, options)`
- `loadWorkbook(input, options)`
- `normalizeExcelCellToCanonical(cell, context)`
- `normalizeWorkbook(workbook, options)`
- `normalizeWorksheet(worksheet, context)`
- `shouldIgnoreCell(cell, options)`

### Decisiones de merge

- `validateManualEdit(conflict, rawValue)`
- `createManualEditDecision(options)`
- `createAcceptLeftDecision(options)`
- `createAcceptRightDecision(options)`
- `createMergeDecision(options)`
- `applyDecisionToSession(session, decision)`

### Aplicación final

- `apply_merge_decisions(leftWorkbook, rightWorkbook, diff, decisions, options)`
- `buildXlsxPayload(resultWorkbook)`

## Organización interna

- `src/index.js`: punto de entrada y re-exportador del motor.
- `src/diff.js`: comparación estructural y de contenido.
- `src/xlsx-normalizer.js`: carga y normalización a formato canónico.
- `src/merge-decisions.js`: helpers para validación, creación y aplicación de decisiones a una sesión.
- `src/apply-merge-decisions.js`: materialización del workbook final y payload XLSX.

## Compatibilidad

- `src/manual-decisions.js` se mantiene como alias mínimo para los helpers manuales existentes.
- El façade conserva los exports consumidos actualmente por los tests y por integraciones del motor.
