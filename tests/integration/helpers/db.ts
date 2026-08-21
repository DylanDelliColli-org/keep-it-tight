import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parse } from "pg-connection-string";

import * as schema from "@/db/schema";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
type TestDatabaseEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveTestDatabaseUrl(
  environment: TestDatabaseEnvironment = process.env,
): string {
  const override = environment.CONTEST_TEST_DATABASE_URL;

  // An explicitly empty override is a mistake, not a request for the default.
  // Rejecting it here keeps this resolver and scripts/test-db.sh agreeing:
  // shell ${VAR:-default} would silently treat empty as absent.
  if (override !== undefined && override.trim() === "") {
    throw new Error(
      "CONTEST_TEST_DATABASE_URL is set but empty; unset it to use the default test database",
    );
  }

  const connectionString = override ?? DEFAULT_TEST_DATABASE_URL;
  const { host } = parse(connectionString);

  if (host === null || !LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `Integration tests require a loopback database host; received ${host ?? "<missing>"}`,
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
