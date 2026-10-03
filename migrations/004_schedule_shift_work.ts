import { type Kysely, sql } from "kysely";

// Schedule was day → (shift + employee) → work. It becomes day → shift → work,
// with the employee on each work entry, so a shift appears once per day.
//
// Existing rows are carried over: one schedule_shift per (day, shift), and each
// work entry takes the employee of the assignment it was under. Assignments
// without any work held nothing else and are dropped.

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("schedule_shift")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("schedule_id", "uuid", (col) => col.notNull())
    .addColumn("shift_id", "uuid", (col) => col.notNull())
    .addUniqueConstraint("schedule_shift_user_id_id_key", ["user_id", "id"])
    // Each shift once per day.
    .addUniqueConstraint("schedule_shift_schedule_id_shift_id_key", [
      "schedule_id",
      "shift_id",
    ])
    .addForeignKeyConstraint(
      "schedule_shift_schedule_id_fkey",
      ["user_id", "schedule_id"],
      "schedule",
      ["user_id", "id"],
      (fk) => fk.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "schedule_shift_shift_id_fkey",
      ["user_id", "shift_id"],
      "shift",
      ["user_id", "id"],
    )
    .execute();

  await sql`
    insert into schedule_shift (user_id, schedule_id, shift_id, created_at)
    select user_id, schedule_id, shift_id, min(created_at)
    from schedule_assignment
    group by user_id, schedule_id, shift_id
  `.execute(db);

  await db.schema
    .alterTable("work")
    .addColumn("schedule_shift_id", "uuid")
    .addColumn("employee_id", "uuid")
    .execute();

  await sql`
    update work
    set schedule_shift_id = ss.id, employee_id = a.employee_id
    from schedule_assignment a
    join schedule_shift ss
      on ss.schedule_id = a.schedule_id and ss.shift_id = a.shift_id
    where work.schedule_assignment_id = a.id
  `.execute(db);

  await db.schema
    .alterTable("work")
    .alterColumn("schedule_shift_id", (col) => col.setNotNull())
    .alterColumn("employee_id", (col) => col.setNotNull())
    .execute();
  await db.schema
    .alterTable("work")
    .addForeignKeyConstraint(
      "work_schedule_shift_id_fkey",
      ["user_id", "schedule_shift_id"],
      "schedule_shift",
      ["user_id", "id"],
      (fk) => fk.onDelete("cascade"),
    )
    .execute();
  await db.schema
    .alterTable("work")
    .addForeignKeyConstraint(
      "work_employee_id_fkey",
      ["user_id", "employee_id"],
      "employee",
      ["user_id", "id"],
    )
    .execute();
  await db.schema
    .alterTable("work")
    .dropColumn("schedule_assignment_id")
    .execute();

  await db.schema.dropTable("schedule_assignment").execute();

  for (const [table, column] of [
    ["schedule_shift", "user_id"],
    ["schedule_shift", "schedule_id"],
    ["work", "schedule_shift_id"],
  ]) {
    await db.schema
      .createIndex(`${table}_${column}_idx`)
      .on(table)
      .column(column)
      .execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("schedule_assignment")
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn("schedule_id", "uuid", (col) => col.notNull())
    .addColumn("shift_id", "uuid", (col) => col.notNull())
    .addColumn("employee_id", "uuid", (col) => col.notNull())
    .addUniqueConstraint("schedule_assignment_user_id_id_key", [
      "user_id",
      "id",
    ])
    .addForeignKeyConstraint(
      "schedule_assignment_schedule_id_fkey",
      ["user_id", "schedule_id"],
      "schedule",
      ["user_id", "id"],
      (fk) => fk.onDelete("cascade"),
    )
    .addForeignKeyConstraint(
      "schedule_assignment_shift_id_fkey",
      ["user_id", "shift_id"],
      "shift",
      ["user_id", "id"],
    )
    .addForeignKeyConstraint(
      "schedule_assignment_employee_id_fkey",
      ["user_id", "employee_id"],
      "employee",
      ["user_id", "id"],
    )
    .execute();

  // One assignment per (day, shift, employee) that has work.
  await sql`
    insert into schedule_assignment (user_id, schedule_id, shift_id, employee_id, created_at)
    select ss.user_id, ss.schedule_id, ss.shift_id, w.employee_id, min(w.created_at)
    from work w
    join schedule_shift ss on ss.id = w.schedule_shift_id
    group by ss.user_id, ss.schedule_id, ss.shift_id, w.employee_id
  `.execute(db);

  await db.schema
    .alterTable("work")
    .addColumn("schedule_assignment_id", "uuid")
    .execute();

  await sql`
    update work
    set schedule_assignment_id = a.id
    from schedule_shift ss
    join schedule_assignment a
      on a.schedule_id = ss.schedule_id and a.shift_id = ss.shift_id
    where work.schedule_shift_id = ss.id and a.employee_id = work.employee_id
  `.execute(db);

  await db.schema
    .alterTable("work")
    .alterColumn("schedule_assignment_id", (col) => col.setNotNull())
    .execute();
  await db.schema
    .alterTable("work")
    .addForeignKeyConstraint(
      "work_schedule_assignment_id_fkey",
      ["user_id", "schedule_assignment_id"],
      "schedule_assignment",
      ["user_id", "id"],
      (fk) => fk.onDelete("cascade"),
    )
    .execute();
  await db.schema
    .alterTable("work")
    .dropColumn("schedule_shift_id")
    .dropColumn("employee_id")
    .execute();

  await db.schema.dropTable("schedule_shift").execute();

  for (const [table, column] of [
    ["schedule_assignment", "user_id"],
    ["schedule_assignment", "schedule_id"],
    ["work", "schedule_assignment_id"],
  ]) {
    await db.schema
      .createIndex(`${table}_${column}_idx`)
      .on(table)
      .column(column)
      .execute();
  }
}
