import "server-only";

import type { Kysely, Transaction } from "kysely";

import type { CellAddress } from "@/components/data-table/types";
import { db as typedDb } from "@/lib/db";
import type { DB } from "@/lib/db-types";

import { type Field, isId, parseField, toCell, UserError } from "./fields";

// Generic create/read/update/delete for any table described by an `Entity`.
// The client DataTable addresses nested tables by path (row id + column per
// level); `resolveTable` walks that path through `children` to find the table.
//
// Every query filters by user_id, and every reference is a (user_id, id)
// foreign key, so a user can only ever read or link their own rows.

// Table names come from the entity definitions, so queries here are untyped.
const db = typedDb as unknown as Kysely<any>;

export type Trx = Transaction<DB>;

export type Entity = {
  table: string;
  /** Column pointing at the parent row; set on nested tables. */
  parentKey?: string;
  /** Editable columns, keyed by the accessor the client uses (= column name). */
  fields: Record<string, Field>;
  /** Nested tables, keyed by the accessor of the column that shows them. */
  children?: Record<string, Entity>;
  hooks?: {
    afterInsert?: (trx: Trx, userId: string, id: string) => Promise<void>;
    afterUpdate?: (
      trx: Trx,
      userId: string,
      id: string,
      key: string,
    ) => Promise<void>;
    /** Runs after every insert and update; throw a UserError to undo it. */
    check?: (trx: Trx, userId: string, id: string) => Promise<void>;
  };
};

export type LoadedRow = { id: string; [key: string]: unknown };

/* -------------------------------------------------------------------------- */
/*  Read                                                                      */
/* -------------------------------------------------------------------------- */

const ROOT = "";

/** All of the user's rows of `entity`, with nested tables filled in. */
export async function loadRows(entity: Entity, userId: string) {
  return (await loadGrouped(entity, userId)).get(ROOT) ?? [];
}

/** Rows grouped by parent id. Each table is one query, however deep it sits. */
async function loadGrouped(
  entity: Entity,
  userId: string,
): Promise<Map<string, LoadedRow[]>> {
  const [records, children, links] = await Promise.all([
    db
      .selectFrom(entity.table)
      .selectAll()
      .where("user_id", "=", userId)
      // Creation order keeps rows in place when they're edited or added.
      .orderBy("created_at")
      .orderBy("id")
      .execute(),
    Promise.all(
      Object.entries(entity.children ?? {}).map(
        async ([key, child]) =>
          [key, await loadGrouped(child, userId)] as const,
      ),
    ),
    Promise.all(
      refsFields(entity).map(
        async ([key, field]) => [key, await loadLinks(field, userId)] as const,
      ),
    ),
  ]);

  const grouped = new Map<string, LoadedRow[]>();
  for (const record of records) {
    const row: LoadedRow = { id: record.id };
    for (const [key, field] of Object.entries(entity.fields)) {
      if (field.kind !== "refs") row[key] = toCell(field, record[key]);
    }
    for (const [key, byOwner] of [...links, ...children]) {
      row[key] = byOwner.get(record.id) ?? [];
    }
    push(grouped, entity.parentKey ? record[entity.parentKey] : ROOT, row);
  }
  return grouped;
}

async function loadLinks(field: RefsField, userId: string) {
  const { table, ownKey, refKey } = field.join;
  const links = await db
    .selectFrom(table)
    .select([ownKey, refKey])
    .where("user_id", "=", userId)
    .execute();
  const byOwner = new Map<string, string[]>();
  for (const link of links) push(byOwner, link[ownKey], link[refKey]);
  return byOwner;
}

/* -------------------------------------------------------------------------- */
/*  Write                                                                     */
/* -------------------------------------------------------------------------- */

export async function insertRow(
  root: Entity,
  userId: string,
  path: unknown,
  row: unknown,
) {
  const { entity, parentId } = resolveTable(root, path);
  if (!isRecord(row) || !isId(row.id)) throw new UserError("Invalid row.");
  const id = row.id;

  const values: Record<string, unknown> = { id, user_id: userId };
  if (entity.parentKey) values[entity.parentKey] = parentId;
  const links: [RefsField, string[]][] = [];
  for (const [key, field] of Object.entries(entity.fields)) {
    const value = parseField(field, row[key], "insert");
    if (field.kind === "refs") links.push([field, value as string[]]);
    else if (value !== undefined) values[key] = value;
  }

  await db.transaction().execute(async (trx) => {
    await trx.insertInto(entity.table).values(values).execute();
    for (const [field, ids] of links) {
      await link(trx, field, userId, id, ids);
    }
    await entity.hooks?.afterInsert?.(trx, userId, id);
    await entity.hooks?.check?.(trx, userId, id);
  });
}

/** `path` ends at the edited cell: its row id and column. */
export async function updateCell(
  root: Entity,
  userId: string,
  path: unknown,
  value: unknown,
) {
  const cell = Array.isArray(path) ? path.at(-1) : undefined;
  if (!isAddress(cell)) throw new UserError("Invalid cell.");
  const { entity } = resolveTable(root, (path as unknown[]).slice(0, -1));
  const key = cell.columnId;
  const field = Object.hasOwn(entity.fields, key)
    ? entity.fields[key]
    : undefined;
  if (!field) throw new UserError("That column can't be edited.");
  const parsed = parseField(field, value, "update");

  await db.transaction().execute(async (trx) => {
    const found =
      field.kind === "refs"
        ? await trx
            .selectFrom(entity.table)
            .select("id")
            .where("id", "=", cell.rowId)
            .where("user_id", "=", userId)
            .executeTakeFirst()
        : await trx
            .updateTable(entity.table)
            .set({ [key]: parsed })
            .where("id", "=", cell.rowId)
            .where("user_id", "=", userId)
            .returning("id")
            .executeTakeFirst();
    if (!found) throw new UserError("That row no longer exists.");

    if (field.kind === "refs") {
      await trx
        .deleteFrom(field.join.table)
        .where(field.join.ownKey, "=", cell.rowId)
        .where("user_id", "=", userId)
        .execute();
      await link(trx, field, userId, cell.rowId, parsed as string[]);
    }
    await entity.hooks?.afterUpdate?.(trx, userId, cell.rowId, key);
    await entity.hooks?.check?.(trx, userId, cell.rowId);
  });
}

export async function deleteRows(
  root: Entity,
  userId: string,
  path: unknown,
  ids: unknown,
) {
  const { entity } = resolveTable(root, path);
  if (!Array.isArray(ids) || !ids.every(isId)) {
    throw new UserError("Invalid rows.");
  }
  if (ids.length === 0) return;
  // Children go with their parent (ON DELETE CASCADE).
  await db
    .deleteFrom(entity.table)
    .where("id", "in", ids)
    .where("user_id", "=", userId)
    .execute();
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

type RefsField = Extract<Field, { kind: "refs" }>;

function refsFields(entity: Entity) {
  return Object.entries(entity.fields).filter(
    (entry): entry is [string, RefsField] => entry[1].kind === "refs",
  );
}

async function link(
  trx: Transaction<any>,
  field: RefsField,
  userId: string,
  ownerId: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  const { table, ownKey, refKey } = field.join;
  await trx
    .insertInto(table)
    .values(
      ids.map((id) => ({ user_id: userId, [ownKey]: ownerId, [refKey]: id })),
    )
    .execute();
}

/** Follows a client path (`[]` = top level) down to the table it names. */
function resolveTable(root: Entity, path: unknown) {
  if (!Array.isArray(path)) throw new UserError("Invalid path.");
  let entity = root;
  let parentId: string | undefined;
  for (const step of path) {
    const children = entity.children ?? {};
    if (!isAddress(step) || !Object.hasOwn(children, step.columnId)) {
      throw new UserError("Invalid path.");
    }
    entity = children[step.columnId];
    parentId = step.rowId;
  }
  return { entity, parentId };
}

function isAddress(value: unknown): value is CellAddress {
  return (
    isRecord(value) && isId(value.rowId) && typeof value.columnId === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
