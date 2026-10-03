import { config } from "dotenv";
import { Kysely, PostgresDialect, type Transaction } from "kysely";
import { Pool } from "pg";

import type { DB } from "../src/lib/db-types";

config({ path: ".env.local" });

// Resets every table to a fixed starting set: everything the user has is
// deleted and the same rows are inserted every time, in the same order.
// Dates are relative to today, so orders and schedules stay current.
//
//   npm run seed                            # every user
//   npm run seed -- me@example.com
//   npm run seed -- --dry-run [email]       # do it all, then roll back

/* -------------------------------------------------------------------------- */
/*  The data                                                                  */
/* -------------------------------------------------------------------------- */

// Plenty of office supplies, so tables have several pages to browse.
const OFFICE_ITEMS = [
  "Paper towels",
  "Printer paper",
  "Ballpoint pens",
  "Sticky notes",
  "Staples",
  "Binder clips",
  "Trash bags",
  "Hand soap",
  "Dish detergent",
  "Coffee beans",
  "Tea bags",
  "Sugar packets",
  "Paper cups",
  "Batteries (AA)",
  "Batteries (AAA)",
  "Light bulbs",
  "Masking tape",
  "Envelopes",
  "Folders",
  "Whiteboard markers",
  "Disinfectant wipes",
  "Gloves",
  "Face masks",
  "First aid kits",
  "Cable ties",
];
const VARIANTS = ["Small", "Medium", "Large", "Bulk pack", "Eco", "Premium"];

// What the phases below actually use.
const WORKSHOP_SUPPLIES: Record<string, number> = {
  "Wood board": 120,
  "Steel tube": 300,
  "Steel sheet": 80,
  "Welding rod": 500,
  Sandpaper: 200,
  "Paint (litre)": 60,
  Screws: 5000,
};

const SKILLS = [
  "Welding",
  "CNC",
  "Plasma cutting",
  "Sanding",
  "Painting",
  "Assembly",
  "Inspection",
];

const TOOLS: Record<string, number> = {
  "Welding station": 3,
  "CNC router": 1,
  "Plasma cutter": 1,
  "Paint booth": 1,
  Sander: 4,
  Workbench: 6,
};

const SHIFTS = [
  { name: "Morning", start_time: "06:00", end_time: "14:00" },
  { name: "Afternoon", start_time: "14:00", end_time: "22:00" },
  { name: "Night", start_time: "22:00", end_time: "06:00" },
];

const EMPLOYEES: { name: string; shift: string; skills: string[] }[] = [
  { name: "Anna Kovács", shift: "Morning", skills: ["Welding", "Inspection"] },
  { name: "Ben Szabó", shift: "Morning", skills: ["Welding"] },
  { name: "Csilla Tóth", shift: "Morning", skills: ["CNC", "Sanding"] },
  { name: "Dávid Nagy", shift: "Morning", skills: ["Painting", "Sanding"] },
  { name: "Eszter Horváth", shift: "Afternoon", skills: ["Assembly"] },
  { name: "Ferenc Varga", shift: "Afternoon", skills: ["Assembly", "CNC"] },
  {
    name: "Gábor Kiss",
    shift: "Afternoon",
    skills: ["Plasma cutting", "Welding"],
  },
  { name: "Hanna Molnár", shift: "Afternoon", skills: ["Inspection"] },
  { name: "István Farkas", shift: "Night", skills: ["Sanding", "Painting"] },
  { name: "Judit Balogh", shift: "Night", skills: ["Welding", "Assembly"] },
];

const MIN = 60;

/** setup/unit times in seconds; workers lists the skills of each employee needed. */
const PHASES: {
  name: string;
  setup: number;
  unit: number;
  maxBatch: number | null;
  supplies: Record<string, number>;
  tools: Record<string, number>;
  workers: string[][];
}[] = [
  {
    name: "Cut",
    setup: 10 * MIN,
    unit: 2 * MIN,
    maxBatch: null,
    supplies: { "Wood board": 0.5 },
    tools: { "CNC router": 1 },
    workers: [["CNC"]],
  },
  {
    name: "Plasma cut",
    setup: 5 * MIN,
    unit: 3 * MIN,
    maxBatch: null,
    supplies: { "Steel sheet": 1 },
    tools: { "Plasma cutter": 1 },
    workers: [["Plasma cutting", "Welding"]],
  },
  {
    name: "Weld",
    setup: 0,
    unit: 10 * MIN,
    maxBatch: null,
    supplies: { "Steel tube": 2, "Welding rod": 4 },
    tools: { "Welding station": 1 },
    workers: [["Welding"]],
  },
  {
    name: "Sand",
    setup: 0,
    unit: 5 * MIN,
    maxBatch: null,
    supplies: { Sandpaper: 2 },
    tools: { Sander: 1 },
    workers: [["Sanding"]],
  },
  {
    name: "Assemble",
    setup: 0,
    unit: 15 * MIN,
    maxBatch: null,
    supplies: { Screws: 12 },
    tools: { Workbench: 1 },
    // Two people: one holds, one screws.
    workers: [["Assembly"], ["Assembly"]],
  },
  {
    name: "Paint",
    setup: 30 * MIN,
    unit: 0,
    maxBatch: 10,
    supplies: { "Paint (litre)": 0.5 },
    tools: { "Paint booth": 1 },
    workers: [["Painting"]],
  },
  {
    name: "Inspect",
    setup: 0,
    unit: 2 * MIN,
    maxBatch: null,
    supplies: {},
    tools: {},
    workers: [["Inspection"]],
  },
];

/** [phase, order]: a lower order must finish first, equal orders run side by side. */
const PRODUCTS: Record<string, [string, number][]> = {
  Table: [
    ["Cut", 1],
    ["Weld", 2],
    ["Sand", 2],
    ["Inspect", 3],
    ["Paint", 4],
    ["Inspect", 5],
  ],
  Chair: [
    ["Cut", 1],
    ["Sand", 2],
    ["Assemble", 3],
    ["Paint", 4],
  ],
  Shelf: [
    ["Plasma cut", 1],
    ["Weld", 2],
    ["Paint", 3],
    ["Inspect", 4],
  ],
};

const SUPPLY_ORDERS: {
  name: string;
  ordered: number;
  arrives: number | null;
  items: Record<string, number>;
}[] = [
  {
    name: "Steel restock",
    ordered: -10,
    arrives: -3,
    items: { "Steel tube": 200, "Steel sheet": 50, "Welding rod": 300 },
  },
  {
    name: "Paint and sanding",
    ordered: -2,
    arrives: 5,
    items: { "Paint (litre)": 40, Sandpaper: 150 },
  },
  {
    name: "Wood for chairs",
    ordered: 0,
    arrives: null,
    items: { "Wood board": 100, Screws: 2000 },
  },
];

/**
 * Orders, with batches recorded per phase (by position in the product's
 * phase list): [units, progress].
 */
const PRODUCT_ORDERS: {
  name: string;
  ordered: number;
  due: number | null;
  lines: {
    product: string;
    count: number;
    batches?: Record<number, [number, number][]>;
  }[];
}[] = [
  {
    name: "Acme tables",
    ordered: -1,
    due: 18,
    lines: [
      {
        product: "Table",
        count: 10,
        batches: {
          0: [[10, 1]], // cut, all at once
          1: [
            [6, 1],
            [1, 0.3],
            [1, 0.4],
          ], // weld: two tables in progress side by side
          2: [[8, 1]], // sand
          3: [
            [5, 1],
            [1, 0.5],
          ], // inspect
          4: [
            [2, 1],
            [3, 0],
          ], // paint: one batch done, one planned
        },
      },
    ],
  },
  {
    name: "Café furniture",
    ordered: -3,
    due: 30,
    lines: [
      {
        product: "Chair",
        count: 25,
        batches: { 0: [[25, 1]], 1: [[10, 0.6]] },
      },
      { product: "Table", count: 4 },
    ],
  },
  {
    name: "Library shelves",
    ordered: 0,
    due: null,
    lines: [{ product: "Shelf", count: 6 }],
  },
];

/* -------------------------------------------------------------------------- */
/*  Writing it                                                                */
/* -------------------------------------------------------------------------- */

type Trx = Transaction<DB>;

const id = () => crypto.randomUUID();

/** YYYY-MM-DD, `offset` days from today. */
function day(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Looks a name up in a name → id map, failing loudly on a typo above. */
function lookup(map: Map<string, string>, name: string) {
  const found = map.get(name);
  if (!found) throw new Error(`Seed data refers to unknown "${name}".`);
  return found;
}

async function reset(trx: Trx, userId: string) {
  // Parents cascade to their children; delete what's referenced last.
  for (const table of [
    "schedule",
    "product_order",
    "supply_order",
    "product",
    "phase",
    "employee",
    "shift",
    "tool",
    "skill",
    "supply",
  ] as const) {
    await trx.deleteFrom(table).where("user_id", "=", userId).execute();
  }

  // Rows are listed by creation time: space them a millisecond apart so
  // every table shows them in seed order.
  let clock = Date.now() - 1_000_000;
  const stamp = () => ({ user_id: userId, created_at: new Date(clock++) });

  /** Inserts rows (each gets an id) and returns name → id when rows have a name. */
  async function insert<T extends keyof DB>(
    table: T,
    rows: Record<string, unknown>[],
  ) {
    const withIds = rows.map(
      (row): Record<string, unknown> & { id: string } => ({
        id: id(),
        ...stamp(),
        ...row,
      }),
    );
    if (withIds.length > 0) {
      await trx
        .insertInto(table)
        .values(withIds as never)
        .execute();
    }
    return new Map(withIds.map((row) => [String(row.name ?? row.id), row.id]));
  }

  const supplies = await insert("supply", [
    ...Object.entries(WORKSHOP_SUPPLIES).map(([name, quantity]) => ({
      name,
      quantity,
    })),
    ...OFFICE_ITEMS.flatMap((item, i) =>
      VARIANTS.map((variant, j) => ({
        name: `${item} – ${variant}`,
        quantity: (i * 37 + j * 53) % 250,
      })),
    ),
  ]);
  const skills = await insert(
    "skill",
    SKILLS.map((name) => ({ name })),
  );
  const tools = await insert(
    "tool",
    Object.entries(TOOLS).map(([name, count]) => ({ name, count })),
  );
  const shifts = await insert("shift", SHIFTS);

  const employees = await insert(
    "employee",
    EMPLOYEES.map(({ name, shift }) => ({
      name,
      shift_id: lookup(shifts, shift),
    })),
  );
  await insertLinks(
    trx,
    "employee_skill",
    EMPLOYEES.flatMap((employee) =>
      employee.skills.map((skill) => ({
        user_id: userId,
        employee_id: lookup(employees, employee.name),
        skill_id: lookup(skills, skill),
      })),
    ),
  );

  const phases = await insert(
    "phase",
    PHASES.map((phase) => ({
      name: phase.name,
      setup_time: phase.setup,
      unit_time: phase.unit,
      max_batch: phase.maxBatch,
    })),
  );
  for (const phase of PHASES) {
    const phaseId = lookup(phases, phase.name);
    await insert(
      "phase_supply",
      Object.entries(phase.supplies).map(([supply, quantity]) => ({
        phase_id: phaseId,
        supply_id: lookup(supplies, supply),
        quantity,
      })),
    );
    await insert(
      "phase_tool",
      Object.entries(phase.tools).map(([tool, count]) => ({
        phase_id: phaseId,
        tool_id: lookup(tools, tool),
        count,
      })),
    );
    for (const workerSkills of phase.workers) {
      const [workerId] = (
        await insert("phase_worker", [{ phase_id: phaseId }])
      ).values();
      await insertLinks(
        trx,
        "phase_worker_skill",
        workerSkills.map((skill) => ({
          user_id: userId,
          phase_worker_id: workerId,
          skill_id: lookup(skills, skill),
        })),
      );
    }
  }

  const products = await insert(
    "product",
    Object.keys(PRODUCTS).map((name) => ({ name })),
  );
  for (const [product, steps] of Object.entries(PRODUCTS)) {
    await insert(
      "product_phase",
      steps.map(([phase, order]) => ({
        product_id: lookup(products, product),
        phase_id: lookup(phases, phase),
        sort_order: order,
      })),
    );
  }

  for (const order of SUPPLY_ORDERS) {
    const [orderId] = (
      await insert("supply_order", [
        {
          name: order.name,
          order_date: day(order.ordered),
          arrival_date: order.arrives === null ? null : day(order.arrives),
        },
      ])
    ).values();
    await insert(
      "supply_order_item",
      Object.entries(order.items).map(([supply, quantity]) => ({
        supply_order_id: orderId,
        supply_id: lookup(supplies, supply),
        quantity,
      })),
    );
  }

  // Batches, for the schedule to point at: [label, id].
  const batches: [string, string][] = [];
  for (const order of PRODUCT_ORDERS) {
    const [orderId] = (
      await insert("product_order", [
        {
          name: order.name,
          order_date: day(order.ordered),
          due_date: order.due === null ? null : day(order.due),
        },
      ])
    ).values();
    for (const line of order.lines) {
      const [lineId] = (
        await insert("product_order_item", [
          {
            product_order_id: orderId,
            product_id: lookup(products, line.product),
            count: line.count,
          },
        ])
      ).values();
      // The same snapshot of the product's phases the app takes.
      const steps = PRODUCTS[line.product];
      for (const [index, [phase, order]] of steps.entries()) {
        const [progressId] = (
          await insert("phase_progress", [
            {
              product_order_item_id: lineId,
              phase_id: lookup(phases, phase),
              sort_order: order,
            },
          ])
        ).values();
        const recorded = await insert(
          "batch",
          (line.batches?.[index] ?? []).map(([quantity, progress]) => ({
            phase_progress_id: progressId,
            quantity,
            progress,
          })),
        );
        for (const batchId of recorded.values()) {
          batches.push([`${line.product} ${phase}`, batchId]);
        }
      }
    }
  }

  // Yesterday and today, on the Acme tables' batches.
  const batch = (label: string, nth = 0) =>
    batches.filter(([name]) => name === label)[nth][1];
  const schedules = await insert("schedule", [
    { date: day(-1) },
    { date: day(0) },
  ]);
  const [yesterday, today] = schedules.values();
  // Day → shift → [employee, batch, start, end].
  const plan: [string, string, [string, string, string, string][]][] = [
    [
      yesterday,
      "Morning",
      [
        ["Csilla Tóth", batch("Table Cut"), "06:00", "08:00"],
        ["Anna Kovács", batch("Table Weld", 0), "06:00", "10:00"],
        ["Anna Kovács", batch("Table Inspect", 0), "10:30", "13:30"],
      ],
    ],
    [
      today,
      "Morning",
      [
        // Two tables welded side by side.
        ["Anna Kovács", batch("Table Weld", 1), "06:00", "09:00"],
        ["Ben Szabó", batch("Table Weld", 2), "06:00", "09:00"],
        ["Dávid Nagy", batch("Table Paint", 1), "09:00", "09:30"],
      ],
    ],
    [
      today,
      "Afternoon",
      [["Hanna Molnár", batch("Table Inspect", 1), "14:00", "14:30"]],
    ],
  ];
  for (const [scheduleId, shift, work] of plan) {
    const [scheduleShiftId] = (
      await insert("schedule_shift", [
        { schedule_id: scheduleId, shift_id: lookup(shifts, shift) },
      ])
    ).values();
    await insert(
      "work",
      work.map(([employee, batchId, start_time, end_time]) => ({
        schedule_shift_id: scheduleShiftId,
        employee_id: lookup(employees, employee),
        batch_id: batchId,
        start_time,
        end_time,
      })),
    );
  }

  return supplies.size;
}

async function insertLinks(
  trx: Trx,
  table: "employee_skill" | "phase_worker_skill",
  rows: Record<string, string>[],
) {
  if (rows.length === 0) return;
  await trx
    .insertInto(table)
    .values(rows as never)
    .execute();
}

/* -------------------------------------------------------------------------- */

class DryRun extends Error {}

async function seed() {
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  });

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const email = args.find((arg) => !arg.startsWith("--"));

  let users = db.selectFrom("user").select(["id", "email"]);
  if (email) users = users.where("email", "=", email);
  const targets = await users.execute();
  if (targets.length === 0) {
    console.error(email ? `No user with email ${email}.` : "No users yet.");
    process.exit(1);
  }

  for (const user of targets) {
    try {
      await db.transaction().execute(async (trx) => {
        const supplies = await reset(trx, user.id);
        console.log(
          `${dryRun ? "Would reset" : "Reset"} ${user.email}: ${supplies} supplies, ` +
            `${PHASES.length} phases, ${Object.keys(PRODUCTS).length} products, ` +
            `${PRODUCT_ORDERS.length} product orders.`,
        );
        if (dryRun) throw new DryRun();
      });
    } catch (error) {
      if (!(error instanceof DryRun)) throw error;
    }
  }

  await db.destroy();
}

seed();
