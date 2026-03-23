# Normalización de workbooks `.xlsx`

Este documento describe el formato canónico propuesto para la etapa de **ingesta y normalización** del motor `services/merge-engine/`.

## Objetivo

Transformar un workbook Excel en una estructura interna comparable, estable y fácil de serializar antes de calcular diffs o conflictos.

## Campos mínimos normalizados

Cada workbook normalizado debe incluir al menos:

- `workbookName`
- `sheetOrder`
- `worksheets[]`
  - `name`
  - `index`
  - `order`
  - `dimensions`
    - `rangeA1`
    - `startRow`
    - `endRow`
    - `startColumn`
    - `endColumn`
  - `cells[]`
    - `address`
    - `row`
    - `column`
    - `visibleValue`
    - `formula`
    - `valueType`

## Regla MVP para celdas vacías

En el MVP se considera **celda vacía no relevante** cualquier celda que, una vez parseada, no tenga:

- `visibleValue`, y
- `formula`.

Estas celdas se ignoran por defecto mediante la opción `ignoreIrrelevantEmptyCells: true` para reducir ruido en la comparación inicial.

## API propuesta

El módulo expone funciones separadas para cada responsabilidad:

- `loadWorkbook(filePath)` → carga el `.xlsx` desde disco.
- `iterateWorksheets(workbook)` → recorre worksheets en el orden del libro.
- `normalizeExcelCellToCanonical(address, cell)` → transforma una celda Excel en un objeto canónico.
- `shouldIgnoreCell(cell, options)` → aplica la regla MVP para filtrar vacíos irrelevantes.
- `normalizeWorkbook(workbook, workbookName, options)` → construye la representación interna comparable.
- `loadAndNormalizeWorkbook(filePath, options)` → atajo de carga + normalización.

## Ejemplo de entrada lógica

Workbook `budget.review.xlsx`:

- Hoja `Summary`
  - `A1 = "Concept"`
  - `B1 = "Amount"`
  - `A2 = "Revenue"`
  - `B2 = 1200`
  - `B3 = SUM(B2:B2)` con valor visible `1200`
- Hoja `Notes`
  - `A1 = "Status"`
  - `A2 = "Ready"`

## Ejemplo de salida canónica

Ver `schemas/workbook-normalized.example.json` para un ejemplo serializado completo.
