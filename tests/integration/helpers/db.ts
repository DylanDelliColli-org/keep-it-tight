import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
type TestDatabaseEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveTestDatabaseUrl(
  environment: TestDatabaseEnvironment = process.env,
): string {
  const connectionString =
    environment.CONTEST_TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const host = new URL(connectionString).hostname;

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `Integration tests require a loopback database host; received ${host}`,
    );
  }

  return connectionString;
}

// The same node-postgres driver production uses, so tests and the app share
// one query path.
export const TEST_DATABASE_URL = resolveTestDatabaseUrl();

const pool = new Pool({ connectionString: TEST_DATABASE_URL });

export const testDb = drizzle(pool, { schema });

export async function closeTestPool(): Promise<void> {
  await pool.end();
}

// Time-sensitive handlers read the clock through week.ts, so tests that need a
// fixed "today" pin it with vi.useFakeTimers({ toFake: ["Date"] }). Faking only
// Date leaves the pg socket's timers alone; faking every timer hangs the pool.
