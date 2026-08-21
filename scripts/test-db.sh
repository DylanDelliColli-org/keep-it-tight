#!/usr/bin/env bash
# Brings up the Postgres this repository's integration tests run against.
# Port 5433 is deliberate: the Supabase local stack owns 54322 on this machine.
set -euo pipefail

CONTAINER=contest-test-pg
PORT=5433
DEFAULT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres"
# Resolve the target the way the harness does, honoring the same override, so
# this script can never bring up or approve a database Vitest will not use.
# An explicitly empty override is rejected rather than silently defaulted:
# ${VAR:-default} would treat empty as absent, while the harness's ?? would
# not, and the two would then resolve different databases.
if [ -n "${CONTEST_TEST_DATABASE_URL+set}" ] && [ -z "${CONTEST_TEST_DATABASE_URL// /}" ]; then
  echo "CONTEST_TEST_DATABASE_URL is set but empty; unset it to use the default test database" >&2
  exit 1
fi

TEST_DATABASE_URL="${CONTEST_TEST_DATABASE_URL:-$DEFAULT_DATABASE_URL}"

# CI provides Postgres as a service container before this script runs. Check
# the resolved URL so local and CI runs keep a single entry point without
# asking CI to manage Docker itself.
if node --input-type=module --eval '
import pg from "pg";

const client = new pg.Client({
  connectionString: process.argv[1],
  connectionTimeoutMillis: 500,
});

try {
  await client.connect();
  await client.query("select 1");
} catch {
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
' "$TEST_DATABASE_URL"; then
  echo "Contest integration database already reachable: ${TEST_DATABASE_URL}"
  exit 0
fi

# The container serves the default URL only. An override that is unreachable
# is the caller's own database to bring up; starting ours would hand them a
# different one than the harness will connect to.
if [ "$TEST_DATABASE_URL" != "$DEFAULT_DATABASE_URL" ]; then
  echo "CONTEST_TEST_DATABASE_URL is not reachable: ${TEST_DATABASE_URL}" >&2
  exit 1
fi

if [ -n "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
  :
elif [ -n "$(docker ps -aq -f "name=^${CONTAINER}$")" ]; then
  docker start "$CONTAINER" >/dev/null
else
  docker run -d \
    --name "$CONTAINER" \
    -p "${PORT}:5432" \
    -e POSTGRES_PASSWORD=postgres \
    postgres:17 >/dev/null
fi

# The suite's wall-clock budget assumes a warm container, so this normally
# returns on the first attempt.
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -q -U postgres; then
    echo "Contest integration database: ${TEST_DATABASE_URL}"
    exit 0
  fi
  sleep 0.5
done

echo "${CONTAINER} did not become ready on port ${PORT}" >&2
exit 1
