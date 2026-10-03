"use server";

import { refresh } from "next/cache";

import { deleteRows, insertRow, updateCell } from "@/lib/dal/engine";
import { UserError } from "@/lib/dal/fields";
import { type Resource, resources } from "@/lib/dal/resources";
import { requireSession } from "@/lib/session";

// The three actions behind every editable table. Server actions are public
// POST endpoints: everything here is re-validated, whatever the client sends.
// `path` says which (nested) table of the resource the change is for.

export type ActionResult = { error?: string };

export async function insertRowAction(
  resource: Resource,
  path: unknown,
  row: unknown,
): Promise<ActionResult> {
  return run("save", (userId) =>
    insertRow(entityOf(resource), userId, path, row),
  );
}

export async function updateCellAction(
  resource: Resource,
  path: unknown,
  value: unknown,
): Promise<ActionResult> {
  return run("save", (userId) =>
    updateCell(entityOf(resource), userId, path, value),
  );
}

export async function deleteRowsAction(
  resource: Resource,
  path: unknown,
  ids: unknown,
): Promise<ActionResult> {
  return run("delete", (userId) =>
    deleteRows(entityOf(resource), userId, path, ids),
  );
}

async function run(
  kind: "save" | "delete",
  task: (userId: string) => Promise<void>,
): Promise<ActionResult> {
  const { user } = await requireSession();
  try {
    await task(user.id);
  } catch (error) {
    return { error: toMessage(error, kind) };
  }
  // Re-render the current page so the table shows what was saved.
  refresh();
  return {};
}

function entityOf(resource: unknown) {
  if (typeof resource !== "string" || !Object.hasOwn(resources, resource)) {
    throw new UserError("Unknown table.");
  }
  return resources[resource as Resource];
}

/** Where a row that can't be deleted is still referenced from, by table. */
const USED_IN: Record<string, string> = {
  employee: "by an employee",
  phase_supply: "in a phase's supplies",
  phase_tool: "in a phase's tools",
  product_phase: "in a product's phases",
  supply_order_item: "in a supply order",
  product_order_item: "in a product order",
  phase_progress: "in a product order",
  schedule_shift: "in the schedule",
  work: "in the schedule",
};

/** Turns a failure into something the user can act on. */
function toMessage(error: unknown, kind: "save" | "delete"): string {
  if (error instanceof UserError) return error.message;

  const { code, detail } = (error ?? {}) as { code?: string; detail?: string };
  switch (code) {
    case "23503": {
      // foreign_key_violation
      if (kind === "save") return "The item you picked no longer exists.";
      const table = detail?.match(/from table "(\w+)"/)?.[1] ?? "";
      const place = USED_IN[table] ?? "elsewhere";
      return `It's still used ${place}. Remove it there first.`;
    }
    case "23505": // unique_violation
      return "That already exists.";
    case "23514": // check_violation
      return "A value is out of range.";
  }
  console.error(error);
  return kind === "save" ? "Couldn't save the change." : "Couldn't delete.";
}
