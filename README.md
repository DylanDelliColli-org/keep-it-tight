# Contest

A small workout-and-meal logging competition for three friends.

## Development

Copy `.env.example` to `.env.local`, install dependencies with `npm install`,
and run the app with `npm run dev`.

Run unit tests with `npm test`, type-check with `npx tsc --noEmit`, and generate
database migrations with `npm run db:generate`.

## Tests

`npm run test:all` runs both layers and is the suite the 30-second budget
applies to. Integration tests run against a `contest-test-pg` container on port
5433, which `npm run test:integration` starts for you. The port is deliberate:
only one stack can own a port, and the Supabase local stack uses 54322 on this
machine. The harness ignores an ambient `DATABASE_URL`; set
`CONTEST_TEST_DATABASE_URL` only when a different loopback test database is
needed. Non-loopback test database hosts are rejected. This repository does not
run end-to-end or browser tests.
