import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { TEST_DATABASE_URL } from "./helpers/db";
import { assertMembersTableDidNotGrow } from "./global-teardown";

// Migrations run once per session, not per test file. drizzle's migrator is
// idempotent, so a warm database stays warm across runs.
export async function setup(): Promise<void> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SESSION_SECRET =
    "integration-test-session-secret-that-is-at-least-thirty-two-bytes";

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });

  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}

export async function teardown(): Promise<void> {
  await assertMembersTableDidNotGrow();
}
