import type { SortingState } from "@tanstack/react-table";

import type {
  Cell,
  CellAddress,
  Column,
  DeleteRowArgs,
  InsertRowArgs,
  Option,
  Row,
  UpdateCellArgs,
} from "./types";

/** What a cell holds: the stored value, or the computed one for computed columns. */
export function cellValue(column: Column, row: Row) {
  return column.compute ? column.compute(row) : row[column.accessor];
}

/** How a cell reads as text: shown in read-only cells and matched by search. */
export function formatCell(column: Column, value: unknown): string {
  if (value == null) return "";
  switch (column.type) {
    case "date":
      return toDateInput(value);
    case "duration":
      return typeof value === "number" ? formatDuration(value) : "";
    case "percent":
      return typeof value === "number" ? `${toPercent(value)}%` : "";
    case "option":
      return labelOf(column.options, value);
    case "multiOption":
      return Array.isArray(value)
        ? value.map((id) => labelOf(column.options, id)).join(", ")
        : "";
    case "table":
      return "";
    default:
      return String(value);
  }
}

/** The text an input starts with when editing a cell. */
export function toInputText(column: Column, value: unknown): string {
  if (column.type === "percent") {
    return typeof value === "number" ? String(toPercent(value)) : "";
  }
  return formatCell(column, value);
}

/** Turns an input's text back into a cell value; empty input clears the cell. */
export function parseInput(column: Column, text: string): Cell | undefined {
  if (text === "") return undefined;
  switch (column.type) {
    case "number":
      return finite(Number(text));
    case "percent":
      return finite(Number(text.replace("%", "")) / 100);
    case "duration":
      return parseDuration(text);
    case "date":
      return new Date(text);
    default:
      return text;
  }
}

/** `<input type="date">` works in `YYYY-MM-DD`; dates are stored as UTC midnight. */
export function toDateInput(value: unknown): string {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString().slice(0, 10)
    : "";
}

function labelOf(options: Option[], id: unknown) {
  return options.find((option) => option.value === id)?.label ?? "";
}

function finite(number: number) {
  return Number.isFinite(number) ? number : undefined;
}

/** 0.333 → 33.3 */
function toPercent(fraction: number) {
  return Math.round(fraction * 1000) / 10;
}

/* -------------------------------------------------------------------------- */
/*  Times and durations                                                                 */
/* -------------------------------------------------------------------------- */

const UNITS = [
  ["d", 86400],
  ["h", 3600],
  ["m", 60],
  ["s", 1],
] as const;

/** Seconds from one `HH:MM` to another, wrapping past midnight (22:00 → 06:00 is 8h). */
export function timeSpan(start: unknown, end: unknown): number | undefined {
  if (typeof start !== "string" || typeof end !== "string") return undefined;
  const minutes = (time: string) => {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
  };
  const day = 24 * 60;
  return ((minutes(end) - minutes(start) + day) % day) * 60;
}

/** 5400 → "1h 30m", 45 → "45s". Only the units that aren't zero are shown. */
export function formatDuration(seconds: number): string {
  let rest = Math.round(seconds);
  const parts: string[] = [];
  for (const [unit, size] of UNITS) {
    const count = Math.floor(rest / size);
    if (count > 0) parts.push(`${count}${unit}`);
    rest -= count * size;
  }
  return parts.length > 0 ? parts.join(" ") : "0m";
}

/**
 * Seconds from "1h 30m", "90m", "45s", "2d 4h", or "1:30" (h:mm). A bare
 * number is minutes. Returns undefined if the text isn't a duration.
 */
export function parseDuration(text: string): number | undefined {
  const input = text.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(input)) return Math.round(Number(input) * 60);

  const clock = input.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (clock) {
    const [, hours, minutes, seconds = "0"] = clock;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  const parts = [...input.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/g)];
  // Every character must belong to a part, so "1h x" isn't read as "1h".
  if (parts.length === 0 || input.replace(/[\d.\sdhms]/g, "") !== "") {
    return undefined;
  }
  let seconds = 0;
  for (const [, amount, unit] of parts) {
    const size = UNITS.find(([name]) => name === unit)?.[1] ?? 0;
    seconds += Number(amount) * size;
  }
  return Math.round(seconds);
}

/* -------------------------------------------------------------------------- */
/*  Rows                                                                      */
/* -------------------------------------------------------------------------- */

export function createEmptyRow(columns: Column[]): Row {
  const row: Row = { id: crypto.randomUUID() };
  for (const column of columns) {
    if (column.type === "table") row[column.accessor] = [];
  }
  return row;
}

/* -------------------------------------------------------------------------- */
/*  Sorting                                                                   */
/* -------------------------------------------------------------------------- */

/** What a cell sorts by: text ignores case, options by label, dates by time, empty cells have none. */
function sortKey(column: Column, row: Row): string | number | undefined {
  const value = cellValue(column, row);
  if (column.type === "option" || column.type === "multiOption") {
    return formatCell(column, value).toLowerCase() || undefined;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number") return value;
  return undefined;
}

/** Row ids ordered by `sorting`; empty cells go last in either direction. */
export function sortRowIds(
  rows: Row[],
  columns: Column[],
  sorting: SortingState,
): string[] {
  const byId = new Map(columns.map((column) => [column.accessor, column]));
  return rows
    .toSorted((a, b) => {
      for (const { id, desc } of sorting) {
        const column = byId.get(id);
        if (!column) continue;
        const x = sortKey(column, a);
        const y = sortKey(column, b);
        if (x === y) continue;
        if (x === undefined) return 1;
        if (y === undefined) return -1;
        return (x > y ? 1 : -1) * (desc ? -1 : 1);
      }
      return 0;
    })
    .map((row) => row.id);
}

/** Puts `rows` in the order of `ids`; rows not listed (new ones) keep theirs, after the rest. */
export function orderRows(rows: Row[], ids: string[]): Row[] {
  if (ids.length === 0) return rows;
  const rank = new Map(ids.map((id, index) => [id, index]));
  return rows.toSorted(
    (a, b) => (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length),
  );
}

/* -------------------------------------------------------------------------- */
/*  Immutable updates, for callers that keep table data in local state.       */
/*  e.g. `insertRow={(args) => setData((data) => insertRow(data, args))}`     */
/* -------------------------------------------------------------------------- */

/** Replaces the rows array at the end of `path` with `update(rows)`. */
function updateRowsAt(
  rows: Row[],
  path: CellAddress[],
  update: (rows: Row[]) => Row[],
): Row[] {
  const [head, ...rest] = path;
  if (!head) return update(rows);
  return rows.map((row) => {
    if (row.id !== head.rowId) return row;
    const nested = row[head.columnId];
    return {
      ...row,
      [head.columnId]: updateRowsAt(
        Array.isArray(nested) ? (nested as Row[]) : [],
        rest,
        update,
      ),
    };
  });
}

export function insertRow(data: Row[], { cellAddress, row }: InsertRowArgs) {
  return updateRowsAt(data, cellAddress, (rows) => [...rows, row]);
}

export function updateRow(data: Row[], { cellAddress, value }: UpdateCellArgs) {
  const cell = cellAddress.at(-1);
  if (!cell) return data;
  return updateRowsAt(data, cellAddress.slice(0, -1), (rows) =>
    rows.map((row) =>
      row.id === cell.rowId ? { ...row, [cell.columnId]: value } : row,
    ),
  );
}

export function deleteRow(data: Row[], { cellAddress, rowsId }: DeleteRowArgs) {
  const ids = new Set(rowsId);
  return updateRowsAt(data, cellAddress, (rows) =>
    rows.filter((row) => !ids.has(row.id)),
  );
}
