import "server-only";

import type { Kysely } from "kysely";

import type { Option, Row } from "@/components/data-table/types";
import { db } from "@/lib/db";

import { loadRows } from "./engine";
import { type Resource, resources } from "./resources";

// Reads for the pages: a resource's rows, and the choices for reference columns.

export async function getRows(resource: Resource, userId: string) {
  // Loaded rows only hold table cell values, which is what `Row` describes.
  return (await loadRows(resources[resource], userId)) as Row[];
}

type Named =
  | "supply"
  | "skill"
  | "tool"
  | "shift"
  | "employee"
  | "phase"
  | "product";

/** `{ value: id, label: name }` for every row of a named table, A–Z. */
export async function getOptions(table: Named, userId: string) {
  // The tables share id/name/user_id, but Kysely can't type a union of them.
  return (db as unknown as Kysely<any>)
    .selectFrom(table)
    .select(["id as value", "name as label"])
    .where("user_id", "=", userId)
    .orderBy("name")
    .execute() as Promise<Option[]>;
}

/** What the product page shows next to each phase it references. */
export async function getPhaseDetails(userId: string) {
  return db
    .selectFrom("phase")
    .select(["id", "setup_time", "unit_time", "max_batch"])
    .where("user_id", "=", userId)
    .execute();
}

export type PhaseDetails = Awaited<ReturnType<typeof getPhaseDetails>>[number];

/** Every batch, labelled with where it belongs: "Order · Product · Phase (3 units)". */
export async function getBatchOptions(userId: string): Promise<Option[]> {
  const batches = await db
    .selectFrom("batch")
    .innerJoin("phase_progress as pp", "pp.id", "batch.phase_progress_id")
    .innerJoin("phase", "phase.id", "pp.phase_id")
    .innerJoin(
      "product_order_item as item",
      "item.id",
      "pp.product_order_item_id",
    )
    .innerJoin("product", "product.id", "item.product_id")
    .innerJoin("product_order as po", "po.id", "item.product_order_id")
    .select([
      "batch.id",
      "batch.quantity",
      "batch.progress",
      "phase.name as phase",
      "product.name as product",
      "po.name as order",
    ])
    .where("batch.user_id", "=", userId)
    .orderBy("po.created_at")
    .orderBy("item.created_at")
    .orderBy("pp.created_at")
    .orderBy("batch.created_at")
    .execute();

  return batches.map((batch) => ({
    value: batch.id,
    label: `${batch.order} · ${batch.product} · ${batch.phase} (${batch.quantity} ${
      batch.quantity === 1 ? "unit" : "units"
    }, ${Math.round(batch.progress * 100)}%)`,
  }));
}
