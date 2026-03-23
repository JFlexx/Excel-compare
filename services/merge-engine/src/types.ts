export interface WorkbookNormalizationOptions {
  /**
   * Si es true, ignora celdas sin valor visible ni fórmula.
   * MVP: activado por defecto para reducir ruido en el diff inicial.
   */
  ignoreIrrelevantEmptyCells?: boolean;
}

export interface SheetDimensions {
  rangeA1: string | null;
  startRow: number | null;
  endRow: number | null;
  startColumn: number | null;
  endColumn: number | null;
}

export interface CanonicalCell {
  address: string;
  row: number;
  column: number;
  visibleValue: string | null;
  formula: string | null;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'error' | 'blank' | 'unknown';
}

export interface CanonicalWorksheet {
  name: string;
  index: number;
  order: number;
  dimensions: SheetDimensions;
  cells: CanonicalCell[];
}

export interface CanonicalWorkbook {
  workbookName: string;
  sheetOrder: string[];
  worksheets: CanonicalWorksheet[];
}
