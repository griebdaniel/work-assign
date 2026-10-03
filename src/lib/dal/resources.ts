import "server-only";

import type { Entity, Trx } from "./engine";
import { toMinutes, UserError } from "./fields";

// Every editable table, as the client sees it. Keys are the page routes
// (/supply, /product-order, …); `children` are the nested tables in each row.

const name = { label: "Name", kind: "text" } as const;

/* Resources ---------------------------------------------------------------- */

const supply: Entity = {
  table: "supply",
  fields: {
    name,
    quantity: { label: "Quantity", kind: "int", fallback: 0 },
  },
};

const skill: Entity = { table: "skill", fields: { name } };

const tool: Entity = {
  table: "tool",
  fields: {
    name,
    count: { label: "Count", kind: "int", fallback: 0 },
  },
};

const shift: Entity = {
  table: "shift",
  fields: {
    name,
    start_time: { label: "Start", kind: "time" },
    end_time: { label: "End", kind: "time" },
  },
  hooks: { check: checkShift },
};

const employee: Entity = {
  table: "employee",
  fields: {
    name,
    shift_id: { label: "Shift", kind: "ref", nullable: true },
    skill_ids: {
      label: "Skills",
      kind: "refs",
      join: {
        table: "employee_skill",
        ownKey: "employee_id",
        refKey: "skill_id",
      },
    },
  },
};

/* Phases and products ------------------------------------------------------ */

const phase: Entity = {
  table: "phase",
  fields: {
    name,
    setup_time: { label: "Setup time", kind: "int", fallback: 0 },
    unit_time: { label: "Time per unit", kind: "int", fallback: 0 },
    max_batch: { label: "Max batch", kind: "int", min: 1, nullable: true },
  },
  children: {
    supplies: {
      table: "phase_supply",
      parentKey: "phase_id",
      fields: {
        supply_id: { label: "Supply", kind: "ref" },
        quantity: { label: "Quantity", kind: "real", fallback: 1 },
      },
    },
    tools: {
      table: "phase_tool",
      parentKey: "phase_id",
      fields: {
        tool_id: { label: "Tool", kind: "ref" },
        count: { label: "Count", kind: "int", min: 1, fallback: 1 },
      },
    },
    workers: {
      table: "phase_worker",
      parentKey: "phase_id",
      fields: {
        skill_ids: {
          label: "Skills",
          kind: "refs",
          join: {
            table: "phase_worker_skill",
            ownKey: "phase_worker_id",
            refKey: "skill_id",
          },
        },
      },
    },
  },
};

const sortOrder = {
  label: "Order",
  kind: "int",
  min: 1,
  fallback: 1,
} as const;

const product: Entity = {
  table: "product",
  fields: { name },
  children: {
    phases: {
      table: "product_phase",
      parentKey: "product_id",
      fields: {
        phase_id: { label: "Phase", kind: "ref" },
        sort_order: sortOrder,
      },
    },
  },
};

/* Orders ------------------------------------------------------------------- */

const supplyOrder: Entity = {
  table: "supply_order",
  fields: {
    name,
    order_date: { label: "Order date", kind: "date" },
    arrival_date: { label: "Arrival date", kind: "date", nullable: true },
  },
  children: {
    items: {
      table: "supply_order_item",
      parentKey: "supply_order_id",
      fields: {
        supply_id: { label: "Supply", kind: "ref" },
        quantity: { label: "Quantity", kind: "real", positive: true },
      },
    },
  },
};

const productOrder: Entity = {
  table: "product_order",
  fields: {
    name,
    order_date: { label: "Order date", kind: "date" },
    due_date: { label: "Due date", kind: "date", nullable: true },
  },
  children: {
    items: {
      table: "product_order_item",
      parentKey: "product_order_id",
      fields: {
        product_id: { label: "Product", kind: "ref" },
        count: { label: "Count", kind: "int", min: 1, fallback: 1 },
      },
      hooks: {
        afterInsert: snapshotPhases,
        afterUpdate: async (trx, userId, id, key) => {
          if (key === "product_id") await resnapshotPhases(trx, userId, id);
        },
        check: checkOrderItem,
      },
      children: {
        progress: {
          table: "phase_progress",
          parentKey: "product_order_item_id",
          fields: {
            phase_id: { label: "Phase", kind: "ref" },
            sort_order: sortOrder,
          },
          children: {
            batches: {
              table: "batch",
              parentKey: "phase_progress_id",
              fields: {
                quantity: {
                  label: "Quantity",
                  kind: "int",
                  min: 1,
                  fallback: 1,
                },
                progress: {
                  label: "Progress",
                  kind: "real",
                  percent: true,
                  fallback: 0,
                },
              },
              hooks: { check: checkBatch },
            },
          },
        },
      },
    },
  },
};

/* Schedules ---------------------------------------------------------------- */

const schedule: Entity = {
  table: "schedule",
  fields: { date: { label: "Date", kind: "date" } },
  children: {
    shifts: {
      table: "schedule_shift",
      parentKey: "schedule_id",
      fields: { shift_id: { label: "Shift", kind: "ref" } },
      children: {
        work: {
          table: "work",
          parentKey: "schedule_shift_id",
          fields: {
            employee_id: { label: "Employee", kind: "ref" },
            batch_id: { label: "Batch", kind: "ref" },
            start_time: { label: "Start", kind: "time" },
            end_time: { label: "End", kind: "time" },
          },
        },
      },
    },
  },
};

export const resources = {
  supply,
  skill,
  tool,
  shift,
  employee,
  phase,
  product,
  "supply-order": supplyOrder,
  "product-order": productOrder,
  schedule,
} satisfies Record<string, Entity>;

export type Resource = keyof typeof resources;

/* -------------------------------------------------------------------------- */
/*  Rules that a single column can't express                                  */
/* -------------------------------------------------------------------------- */

/** Shifts may not overlap; one that ends before it starts runs past midnight. */
async function checkShift(trx: Trx, userId: string, id: string) {
  const shifts = await trx
    .selectFrom("shift")
    .select(["id", "name", "start_time", "end_time"])
    .where("user_id", "=", userId)
    .execute();
  const changed = shifts.find((s) => s.id === id);
  if (!changed) return;
  if (changed.start_time === changed.end_time) {
    throw new UserError("A shift can't start and end at the same time.");
  }
  const other = shifts.find((s) => s.id !== id && overlaps(changed, s));
  if (other) {
    throw new UserError(`${changed.name} overlaps the ${other.name} shift.`);
  }
}

type TimeRange = { start_time: string; end_time: string };

/** Minute ranges within one day; a shift past midnight becomes two. */
function ranges({ start_time, end_time }: TimeRange): [number, number][] {
  const start = toMinutes(start_time);
  const end = toMinutes(end_time);
  return start < end
    ? [[start, end]]
    : [
        [start, 24 * 60],
        [0, end],
      ];
}

function overlaps(a: TimeRange, b: TimeRange) {
  return ranges(a).some(([startA, endA]) =>
    ranges(b).some(([startB, endB]) => startA < endB && startB < endA),
  );
}

/** Copies the product's phases onto a new order line, so later product edits don't change it. */
async function snapshotPhases(trx: Trx, userId: string, itemId: string) {
  const phases = await trx
    .selectFrom("product_order_item as item")
    .innerJoin("product_phase as pp", "pp.product_id", "item.product_id")
    .select(["pp.phase_id", "pp.sort_order"])
    .where("item.id", "=", itemId)
    .where("item.user_id", "=", userId)
    .orderBy("pp.sort_order")
    .orderBy("pp.created_at")
    .execute();
  if (phases.length === 0) return;

  // Rows are listed by creation time: space them apart to keep this order.
  const now = Date.now();
  await trx
    .insertInto("phase_progress")
    .values(
      phases.map((phase, index) => ({
        ...phase,
        user_id: userId,
        product_order_item_id: itemId,
        created_at: new Date(now + index),
      })),
    )
    .execute();
}

/** A new product means new phases, as long as no work was recorded on the old ones. */
async function resnapshotPhases(trx: Trx, userId: string, itemId: string) {
  const batch = await trx
    .selectFrom("batch")
    .innerJoin("phase_progress as pp", "pp.id", "batch.phase_progress_id")
    .select("batch.id")
    .where("pp.product_order_item_id", "=", itemId)
    .where("batch.user_id", "=", userId)
    .executeTakeFirst();
  if (batch) {
    throw new UserError(
      "This line already has batches. Delete them before changing the product.",
    );
  }
  await trx
    .deleteFrom("phase_progress")
    .where("product_order_item_id", "=", itemId)
    .where("user_id", "=", userId)
    .execute();
  await snapshotPhases(trx, userId, itemId);
}

/** No phase may have batches for more units than the line orders. */
async function checkOrderItem(trx: Trx, userId: string, itemId: string) {
  const item = await trx
    .selectFrom("product_order_item")
    .select("count")
    .where("id", "=", itemId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!item) return;
  const largest = await trx
    .selectFrom("batch")
    .innerJoin("phase_progress as pp", "pp.id", "batch.phase_progress_id")
    .select((eb) => eb.fn.sum<string>("batch.quantity").as("units"))
    .where("pp.product_order_item_id", "=", itemId)
    .where("batch.user_id", "=", userId)
    .groupBy("pp.id")
    .orderBy("units", "desc")
    .executeTakeFirst();
  if (largest && Number(largest.units) > item.count) {
    throw new UserError(
      `A phase already has batches for ${largest.units} units; the count can't go below that.`,
    );
  }
}

/** A batch must fit the phase's machine, and a phase's batches the order line. */
async function checkBatch(trx: Trx, userId: string, batchId: string) {
  const batch = await trx
    .selectFrom("batch")
    .innerJoin("phase_progress as pp", "pp.id", "batch.phase_progress_id")
    .innerJoin("phase", "phase.id", "pp.phase_id")
    .innerJoin(
      "product_order_item as item",
      "item.id",
      "pp.product_order_item_id",
    )
    .select([
      "batch.quantity",
      "batch.phase_progress_id",
      "phase.name",
      "phase.max_batch",
      "item.count",
    ])
    .where("batch.id", "=", batchId)
    .where("batch.user_id", "=", userId)
    .executeTakeFirst();
  if (!batch) return;

  if (batch.max_batch !== null && batch.quantity > batch.max_batch) {
    throw new UserError(
      `${batch.name} fits at most ${batch.max_batch} units per batch.`,
    );
  }
  const { units } = await trx
    .selectFrom("batch")
    .select((eb) => eb.fn.sum<string>("quantity").as("units"))
    .where("phase_progress_id", "=", batch.phase_progress_id)
    .executeTakeFirstOrThrow();
  if (Number(units) > batch.count) {
    throw new UserError(
      `${batch.name} would have batches for ${units} units, but the line orders ${batch.count}.`,
    );
  }
}
