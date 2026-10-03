import { type CreateTableBuilder, type Kysely, sql } from "kysely";

// Everything needed to describe production, orders, and schedules.
//
// Every table carries `user_id`, and every reference is a composite foreign key
// on (user_id, <ref>_id) → (user_id, id). The database itself then guarantees a
// row can only point at rows of the same user, so the app never has to check.
//
// Child rows (a product's phases, an order's lines, …) cascade with their
// parent. Other references use the default NO ACTION: deleting a supply that a
// phase still uses fails instead of silently changing the phase. Skill links
// are the exception: deleting a skill just removes it wherever it was used.

type Table = CreateTableBuilder<string, string>;

/** id, user_id, created_at, and the (user_id, id) key that references point at. */
function owned(db: Kysely<any>, name: string) {
  return db.schema
    .createTable(name)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint(`${name}_user_id_id_key`, ["user_id", "id"]);
}

/** Composite reference to `target`, scoped to the same user. */
function ref(
  table: Table,
  name: string,
  column: string,
  target: string,
  onDelete: "cascade" | "no action" = "no action",
): Table {
  return table.addForeignKeyConstraint(
    `${name}_${column}_fkey`,
    ["user_id", column],
    target,
    ["user_id", "id"],
    (fk) => fk.onDelete(onDelete),
  );
}

async function index(db: Kysely<any>, table: string, column: string) {
  await db.schema
    .createIndex(`${table}_${column}_idx`)
    .on(table)
    .column(column)
    .execute();
}

export async function up(db: Kysely<any>): Promise<void> {
  // Existing table: give it the key that references point at.
  await db.schema
    .alterTable("supply")
    .addUniqueConstraint("supply_user_id_id_key", ["user_id", "id"])
    .execute();

  /* Resources ------------------------------------------------------------ */

  await owned(db, "skill")
    .addColumn("name", "text", (col) => col.notNull())
    .execute();

  await owned(db, "tool")
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("count", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`count >= 0`),
    )
    .execute();

  // A shift may cross midnight (22:00–06:00), so end < start is allowed.
  await owned(db, "shift")
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("start_time", "time", (col) => col.notNull())
    .addColumn("end_time", "time", (col) => col.notNull())
    .execute();

  await ref(
    owned(db, "employee")
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("shift_id", "uuid"),
    "employee",
    "shift_id",
    "shift",
  ).execute();

  await ref(
    ref(
      db.schema
        .createTable("employee_skill")
        .addColumn("user_id", "text", (col) => col.notNull())
        .addColumn("employee_id", "uuid", (col) => col.notNull())
        .addColumn("skill_id", "uuid", (col) => col.notNull())
        .addPrimaryKeyConstraint("employee_skill_pkey", [
          "employee_id",
          "skill_id",
        ]),
      "employee_skill",
      "employee_id",
      "employee",
      "cascade",
    ),
    "employee_skill",
    "skill_id",
    "skill",
    "cascade",
  ).execute();

  /* Phases and products -------------------------------------------------- */

  // Batch time = setup_time + unit_time × quantity, in seconds.
  await owned(db, "phase")
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("setup_time", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`setup_time >= 0`),
    )
    .addColumn("unit_time", "integer", (col) =>
      col.notNull().defaultTo(0).check(sql`unit_time >= 0`),
    )
    // null = no limit on units per batch
    .addColumn("max_batch", "integer", (col) => col.check(sql`max_batch > 0`))
    .execute();

  // Supplies used per unit.
  await ref(
    ref(
      owned(db, "phase_supply")
        .addColumn("phase_id", "uuid", (col) => col.notNull())
        .addColumn("supply_id", "uuid", (col) => col.notNull())
        .addColumn("quantity", "float8", (col) =>
          col.notNull().defaultTo(1).check(sql`quantity >= 0`),
        ),
      "phase_supply",
      "phase_id",
      "phase",
      "cascade",
    ),
    "phase_supply",
    "supply_id",
    "supply",
  ).execute();

  await ref(
    ref(
      owned(db, "phase_tool")
        .addColumn("phase_id", "uuid", (col) => col.notNull())
        .addColumn("tool_id", "uuid", (col) => col.notNull())
        .addColumn("count", "integer", (col) =>
          col.notNull().defaultTo(1).check(sql`count > 0`),
        ),
      "phase_tool",
      "phase_id",
      "phase",
      "cascade",
    ),
    "phase_tool",
    "tool_id",
    "tool",
  ).execute();

  // One row per employee the phase needs; its skills are what that employee must have.
  await ref(
    owned(db, "phase_worker").addColumn("phase_id", "uuid", (col) =>
      col.notNull(),
    ),
    "phase_worker",
    "phase_id",
    "phase",
    "cascade",
  ).execute();

  await ref(
    ref(
      db.schema
        .createTable("phase_worker_skill")
        .addColumn("user_id", "text", (col) => col.notNull())
        .addColumn("phase_worker_id", "uuid", (col) => col.notNull())
        .addColumn("skill_id", "uuid", (col) => col.notNull())
        .addPrimaryKeyConstraint("phase_worker_skill_pkey", [
          "phase_worker_id",
          "skill_id",
        ]),
      "phase_worker_skill",
      "phase_worker_id",
      "phase_worker",
      "cascade",
    ),
    "phase_worker_skill",
    "skill_id",
    "skill",
    "cascade",
  ).execute();

  await owned(db, "product")
    .addColumn("name", "text", (col) => col.notNull())
    .execute();

  // Phases with a lower sort_order must finish first; equal ones run in parallel.
  await ref(
    ref(
      owned(db, "product_phase")
        .addColumn("product_id", "uuid", (col) => col.notNull())
        .addColumn("phase_id", "uuid", (col) => col.notNull())
        .addColumn("sort_order", "integer", (col) =>
          col.notNull().defaultTo(1).check(sql`sort_order >= 1`),
        ),
      "product_phase",
      "product_id",
      "product",
      "cascade",
    ),
    "product_phase",
    "phase_id",
    "phase",
  ).execute();

  /* Supply orders -------------------------------------------------------- */

  await owned(db, "supply_order")
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("order_date", "date", (col) =>
      col.notNull().defaultTo(sql`current_date`),
    )
    .addColumn("arrival_date", "date")
    .execute();

  await ref(
    ref(
      owned(db, "supply_order_item")
        .addColumn("supply_order_id", "uuid", (col) => col.notNull())
        .addColumn("supply_id", "uuid", (col) => col.notNull())
        .addColumn("quantity", "float8", (col) =>
          col.notNull().defaultTo(1).check(sql`quantity > 0`),
        ),
      "supply_order_item",
      "supply_order_id",
      "supply_order",
      "cascade",
    ),
    "supply_order_item",
    "supply_id",
    "supply",
  ).execute();

  /* Product orders and their progress ------------------------------------ */

  await owned(db, "product_order")
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("order_date", "date", (col) =>
      col.notNull().defaultTo(sql`current_date`),
    )
    .addColumn("due_date", "date")
    .execute();

  await ref(
    ref(
      owned(db, "product_order_item")
        .addColumn("product_order_id", "uuid", (col) => col.notNull())
        .addColumn("product_id", "uuid", (col) => col.notNull())
        .addColumn("count", "integer", (col) =>
          col.notNull().defaultTo(1).check(sql`count > 0`),
        ),
      "product_order_item",
      "product_order_id",
      "product_order",
      "cascade",
    ),
    "product_order_item",
    "product_id",
    "product",
  ).execute();

  // A snapshot of the product's phases, taken when the order line is created.
  await ref(
    ref(
      owned(db, "phase_progress")
        .addColumn("product_order_item_id", "uuid", (col) => col.notNull())
        .addColumn("phase_id", "uuid", (col) => col.notNull())
        .addColumn("sort_order", "integer", (col) =>
          col.notNull().defaultTo(1).check(sql`sort_order >= 1`),
        ),
      "phase_progress",
      "product_order_item_id",
      "product_order_item",
      "cascade",
    ),
    "phase_progress",
    "phase_id",
    "phase",
  ).execute();

  // progress: 0 = planned, 1 = finished.
  await ref(
    owned(db, "batch")
      .addColumn("phase_progress_id", "uuid", (col) => col.notNull())
      .addColumn("quantity", "integer", (col) =>
        col.notNull().defaultTo(1).check(sql`quantity > 0`),
      )
      .addColumn("progress", "float8", (col) =>
        col.notNull().defaultTo(0).check(sql`progress >= 0 and progress <= 1`),
      ),
    "batch",
    "phase_progress_id",
    "phase_progress",
    "cascade",
  ).execute();

  /* Schedules ------------------------------------------------------------ */

  await owned(db, "schedule")
    .addColumn("date", "date", (col) => col.notNull())
    .addUniqueConstraint("schedule_user_id_date_key", ["user_id", "date"])
    .execute();

  await ref(
    ref(
      ref(
        owned(db, "schedule_assignment")
          .addColumn("schedule_id", "uuid", (col) => col.notNull())
          .addColumn("shift_id", "uuid", (col) => col.notNull())
          .addColumn("employee_id", "uuid", (col) => col.notNull()),
        "schedule_assignment",
        "schedule_id",
        "schedule",
        "cascade",
      ),
      "schedule_assignment",
      "shift_id",
      "shift",
    ),
    "schedule_assignment",
    "employee_id",
    "employee",
  ).execute();

  await ref(
    ref(
      owned(db, "work")
        .addColumn("schedule_assignment_id", "uuid", (col) => col.notNull())
        .addColumn("batch_id", "uuid", (col) => col.notNull())
        .addColumn("start_time", "time", (col) => col.notNull())
        .addColumn("end_time", "time", (col) => col.notNull()),
      "work",
      "schedule_assignment_id",
      "schedule_assignment",
      "cascade",
    ),
    "work",
    "batch_id",
    "batch",
  ).execute();

  /* Indexes: every list is loaded per user, every child per parent -------- */

  for (const table of TABLES) await index(db, table, "user_id");
  for (const [table, column] of PARENT_KEYS) await index(db, table, column);
}

const TABLES = [
  "skill",
  "tool",
  "shift",
  "employee",
  "phase",
  "phase_supply",
  "phase_tool",
  "phase_worker",
  "product",
  "product_phase",
  "supply_order",
  "supply_order_item",
  "product_order",
  "product_order_item",
  "phase_progress",
  "batch",
  "schedule",
  "schedule_assignment",
  "work",
];

const PARENT_KEYS = [
  ["phase_supply", "phase_id"],
  ["phase_tool", "phase_id"],
  ["phase_worker", "phase_id"],
  ["product_phase", "product_id"],
  ["supply_order_item", "supply_order_id"],
  ["product_order_item", "product_order_id"],
  ["phase_progress", "product_order_item_id"],
  ["batch", "phase_progress_id"],
  ["schedule_assignment", "schedule_id"],
  ["work", "schedule_assignment_id"],
];

export async function down(db: Kysely<any>): Promise<void> {
  // Children before parents, so no drop trips over a foreign key.
  for (const table of [
    "work",
    "schedule_assignment",
    "schedule",
    "batch",
    "phase_progress",
    "product_order_item",
    "product_order",
    "supply_order_item",
    "supply_order",
    "product_phase",
    "product",
    "phase_worker_skill",
    "phase_worker",
    "phase_tool",
    "phase_supply",
    "phase",
    "employee_skill",
    "employee",
    "shift",
    "tool",
    "skill",
  ]) {
    await db.schema.dropTable(table).execute();
  }
  await db.schema
    .alterTable("supply")
    .dropConstraint("supply_user_id_id_key")
    .execute();
}
