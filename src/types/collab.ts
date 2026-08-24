// --- СИСТЕМА ТИПОВ ДЛЯ ДОКУМЕНТОВ (DOCS) ---
export type DocBlockType = 
  | 'heading_1' 
  | 'heading_2' 
  | 'heading_3' 
  | 'paragraph' 
  | 'bullet_list' 
  | 'numbered_list' 
  | 'todo_list' 
  | 'quote' 
  | 'code_block' 
  | 'divider' 
  | 'callout'
  | 'image';

export interface DocBlock {
  id: string;
  type: DocBlockType;
  content: string;
  checked?: boolean; // для todo_list
  language?: string; // для code_block
  calloutType?: 'info' | 'warning' | 'success' | 'alert';
  imageUrl?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  bgColor?: string;
  fontSizePx?: number;
  fontFamily?: string;
}

export type DocAccessLevel = 'private' | 'company_view' | 'company_edit' | 'specific_users';
export type UserDocRole = 'editor' | 'commenter' | 'viewer';

export interface WorkspaceDocument {
  id: string;
  tenantId: string;
  title: string;
  icon?: string;
  coverUrl?: string;
  folderId?: string;
  authorStaffId: string;
  authorName?: string;
  lastEditedByStaffId: string;
  blocks: DocBlock[];
  isLocked: boolean;
  accessLevel?: DocAccessLevel;
  permissionsMap?: Record<string, UserDocRole>;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// --- СИСТЕМА ТИПОВ ДЛЯ ТАБЛИЦ (SHEETS) ---
export type CellDataType = 'text' | 'number' | 'currency' | 'percent' | 'date';
export type CellTextAlign = 'left' | 'center' | 'right';

export interface CellStyle {
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  align?: CellTextAlign;
  format?: CellDataType;
}

export interface SheetCellData {
  rawValue: string;        // Что ввел юзер: "1500" или "=SUM(A1:A10)"
  computedValue: string;   // Результат вычисления: "15000" или "#ERROR"
  style?: CellStyle;
}

export interface SheetColumnConfig {
  id: string; // "A", "B", "C"...
  widthPx: number;
  title?: string;
}

export interface SheetRowConfig {
  index: number; // 1, 2, 3...
  heightPx: number;
}

export interface WorkspaceSpreadsheet {
  id: string;
  tenantId: string;
  title: string;
  authorStaffId: string;
  lastEditedByStaffId: string;
  columnsCount: number; // по умолчанию 26 (A-Z)
  rowsCount: number;    // по умолчанию 100
  columnsConfig?: Record<string, SheetColumnConfig>;
  cells: Record<string, SheetCellData>; // Ключ в формате "A1", "C12"
  createdAt: number;
  updatedAt: number;
}
