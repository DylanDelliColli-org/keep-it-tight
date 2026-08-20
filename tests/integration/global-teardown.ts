import { Pool } from "pg";

import { TEST_DATABASE_URL } from "./helpers/db";

/**
 * Guards a north-star non-goal mechanically: this app has exactly three
 * accounts and no signup path, so no code path may create a member. Fixtures
 * clean up after themselves, so the suite must leave the table empty.
 */
export async function assertMembersTableDidNotGrow(): Promise<void> {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });

  try {
    const { rows } = await pool.query<{ count: string }>(
      "select count(*)::text as count from members",
    );

    if (rows[0].count !== "0") {
      // Vitest reports a throw from teardown but still exits 0, which would
      // make this guard advisory. Fail the process explicitly.
      process.exitCode = 1;

      throw new Error(
        `members table grew during the suite: ${rows[0].count} rows left behind`,
      );
    }
  } finally {
    await pool.end();
  }
}
