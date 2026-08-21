export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'percent';
}

export interface CellData {
  raw: string; // User input or formula (e.g. "=SUM(A1:A5)")
  computed?: string | number; // Evaluated formula result or number
  style?: CellStyle;
}

export interface SheetData {
  id: string;
  name: string;
  rowCount: number;
  colCount: number;
  cells: Record<string, CellData>; // key is cell coordinate e.g. "A1", "B5"
}

export interface SpreadsheetMeta {
  id: string;
  tenantId: string;
  title: string;
  sheets: SheetData[];
  updatedAt?: any;
  createdAt?: any;
}
