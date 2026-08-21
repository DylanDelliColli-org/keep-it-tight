import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

// The same node-postgres driver production uses, so tests and the app share
// one query path.
export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5433/postgres";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });

export const testDb = drizzle(pool, { schema });

export async function closeTestPool(): Promise<void> {
  await pool.end();
}

// Time-sensitive handlers read the clock through week.ts, so tests that need a
// fixed "today" pin it with vi.useFakeTimers({ toFake: ["Date"] }). Faking only
// Date leaves the pg socket's timers alone; faking every timer hangs the pool.
