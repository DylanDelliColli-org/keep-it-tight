#!/usr/bin/env bash
# Brings up the Postgres this repository's integration tests run against.
# Port 5433 is deliberate: the Supabase local stack owns 54322 on this machine.
set -euo pipefail

CONTAINER=contest-test-pg
PORT=5433

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
    exit 0
  fi
  sleep 0.5
done

echo "${CONTAINER} did not become ready on port ${PORT}" >&2
exit 1
