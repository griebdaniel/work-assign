import { promises as fs } from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import { Kysely, PostgresDialect } from "kysely";

import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";

config({ path: ".env.local" });

async function migrate() {
  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(process.cwd(), "migrations"),
    }),
  });

  const direction = process.argv[2] === "down" ? "down" : "up";
  const { error, results } =
    direction === "down"
      ? await migrator.migrateDown()
      : await migrator.migrateToLatest();

  results?.forEach((r) =>
    console.log(`${r.status}: ${r.migrationName} (${r.direction})`),
  );

  if (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  await db.destroy();
}

migrate();
