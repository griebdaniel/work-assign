import { type Kysely, sql } from "kysely";

// Gives supplies a stable display order: by creation, not by name, so a row
// doesn't move when it's renamed and new rows land where they were added.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("supply")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("supply").dropColumn("created_at").execute();
}
