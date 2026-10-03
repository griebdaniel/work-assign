import { Kysely, PostgresDialect } from "kysely";
import { Pool, types } from "pg";
import type { DB } from "@/lib/db-types";

// Keep `date` columns as YYYY-MM-DD strings. pg's default turns them into a
// Date at *local* midnight, which shifts the day once converted to UTC.
types.setTypeParser(types.builtins.DATE, (value) => value);

const globalForDb = globalThis as unknown as { pool?: Pool };

// Reuse the pool across hot reloads in dev
const pool =
  globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({ pool }),
});
