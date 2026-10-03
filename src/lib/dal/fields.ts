import "server-only";

// How each kind of column is validated on the way in and shaped on the way out.
// Values from the client are untrusted: every parser accepts `unknown`.

export type Field = { label: string } & (
  | { kind: "text" }
  | { kind: "int"; min?: number; nullable?: true; fallback?: number }
  | {
      kind: "real";
      min?: number;
      max?: number;
      /** Must be more than 0, not just 0 or more. */
      positive?: true;
      /** A 0–1 fraction the user sees as a percentage. */
      percent?: true;
      fallback?: number;
    }
  | { kind: "date"; nullable?: true }
  | { kind: "time" }
  | { kind: "ref"; nullable?: true }
  /** Many references, stored in a join table: (user_id, ownKey, refKey). */
  | { kind: "refs"; join: { table: string; ownKey: string; refKey: string } }
);

/** A message safe to show the user as is. */
export class UserError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isEmpty(value: unknown) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

/**
 * Turns a client value into what the column stores. `undefined` means "leave
 * it to the database default" and is only returned on insert.
 */
export function parseField(
  field: Field,
  value: unknown,
  mode: "insert" | "update",
): unknown {
  if (field.kind === "refs") return parseRefs(field, value);

  if (isEmpty(value)) {
    if ("nullable" in field && field.nullable) return null;
    if ("fallback" in field && field.fallback !== undefined) {
      return mode === "insert" ? field.fallback : fail(field, "can't be empty");
    }
    return fail(field, mode === "insert" ? "is required" : "can't be empty");
  }

  switch (field.kind) {
    case "text": {
      const text = String(value).trim();
      if (text.length > 200) fail(field, "is too long");
      return text;
    }
    case "int": {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        fail(field, "must be a whole number");
      }
      return checkMin(field, value as number, field.min);
    }
    case "real": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(field, "must be a number");
      }
      const number = checkMin(field, value as number, field.min);
      if (field.positive && number <= 0) fail(field, "must be more than 0");
      if (field.percent && (number < 0 || number > 1)) {
        fail(field, "must be between 0% and 100%");
      }
      if (field.max !== undefined && number > field.max) {
        fail(field, `must be ${field.max} or less`);
      }
      return number;
    }
    case "date": {
      // Dates travel as Date objects (UTC midnight) or YYYY-MM-DD strings.
      const text =
        value instanceof Date && !Number.isNaN(value.getTime())
          ? value.toISOString().slice(0, 10)
          : String(value);
      if (!DATE.test(text)) fail(field, "must be a date");
      return text;
    }
    case "time": {
      if (typeof value !== "string" || !TIME.test(value)) {
        fail(field, "must be a time like 08:30");
      }
      return (value as string).slice(0, 5);
    }
    case "ref": {
      if (!isId(value)) fail(field, "must be picked from the list");
      return value;
    }
  }
}

function parseRefs(field: Field, value: unknown): string[] {
  const ids = value ?? [];
  if (!Array.isArray(ids) || !ids.every(isId)) {
    fail(field, "must be picked from the list");
  }
  return [...new Set(ids as string[])];
}

function checkMin(field: Field, value: number, min = 0) {
  if (value < min) fail(field, `must be ${min} or more`);
  return value;
}

function fail(field: Field, problem: string): never {
  throw new UserError(`${field.label} ${problem}.`);
}

/** Database value → what the client table expects. */
export function toCell(field: Field, value: unknown): unknown {
  if (value == null) return undefined;
  // `date` columns come back as YYYY-MM-DD (see db.ts); the table uses UTC midnight.
  if (field.kind === "date") return new Date(`${value}T00:00:00Z`);
  if (field.kind === "time") return String(value).slice(0, 5);
  return value;
}

/** "HH:MM" → minutes since midnight. */
export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
