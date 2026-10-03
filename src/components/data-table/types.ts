export type ColumnType =
  | "string"
  | "number"
  | "date"
  /** `HH:MM` text. */
  | "time"
  /** Seconds, shown as "1h 30m" and typed the same way (a bare number is minutes). */
  | "duration"
  /** 0–1, shown and typed as 0–100%. */
  | "percent"
  /** One id, picked by its label from `options`. */
  | "option"
  /** Several ids (`string[]`), picked by label from `options`. */
  | "multiOption"
  | "table";

type BaseColumn<K extends ColumnType> = {
  accessor: string;
  type: K;
  label: string;
  /** The insert dialog won't submit until this field has a value. */
  required?: boolean;
  /**
   * Shows a value worked out from the row (e.g. a total, or a detail of the
   * referenced row) instead of a stored one. Computed columns are read-only.
   */
  compute?: (row: Row) => Cell | undefined;
};

/** Extra fields per column type. Add a type here and it joins the `Column` union. */
type ColumnExtras = {
  string: unknown;
  number: unknown;
  date: unknown;
  time: unknown;
  duration: unknown;
  percent: unknown;
  option: { options: Option[] };
  multiOption: { options: Option[] };
  /** Cells of a table column hold `Row[]`; the column only describes their shape. */
  table: { columns: Column[] };
};

export type Column = {
  [K in ColumnType]: BaseColumn<K> & ColumnExtras[K];
}[ColumnType];

/** A choice for an option column: the stored `value` (an id) and what's shown. */
export type Option = { value: string; label: string };

export type OptionColumn = Extract<Column, { type: "option" }>;
export type MultiOptionColumn = Extract<Column, { type: "multiOption" }>;
export type TableColumn = Extract<Column, { type: "table" }>;

export type Cell = string | number | Date | string[];

export interface Row {
  id: string;
  [accessor: string]: Cell | Row[] | undefined;
}

/** Points at one cell. A path of these walks down through nested tables. */
export type CellAddress = {
  rowId: string;
  columnId: string;
};

export type InsertRowArgs = {
  /** Path to the table the row goes into: `[]` for the top level. */
  cellAddress: CellAddress[];
  row: Row;
};

export type UpdateCellArgs = {
  /** Path to the edited cell; the last entry is the cell itself. */
  cellAddress: CellAddress[];
  value: Cell | undefined;
};

export type DeleteRowArgs = {
  /** Path to the table the rows are in: `[]` for the top level. */
  cellAddress: CellAddress[];
  rowsId: string[];
};

/** What a handler may report back; an `error` keeps the insert dialog open. */
export type HandlerResult = void | { error?: string };

export type DataTableHandlers = {
  /** Shown above the table, and above every nested table opened from it. */
  error?: string;
  insertRow: (args: InsertRowArgs) => HandlerResult | Promise<HandlerResult>;
  updateRow: (args: UpdateCellArgs) => void | Promise<void>;
  deleteRow: (args: DeleteRowArgs) => void | Promise<void>;
};

export type DataTableProps = DataTableHandlers & {
  /** Keep this reference stable (module constant or memoized); new columns reset cell state. */
  columns: Column[];
  data: Row[];
};
