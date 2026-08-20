```doc-meta
role: working
lifecycle: in-flight
```

# PLANNING — contest-wrp

`contest-wrp` is the planning epic for the full keep-it-tight app: workout
and meal-photo logging for points among three friends, per `NORTH-STAR.md`.

**Confirmed tier: FULL** (operator, 2026-08-20).

**Rationale:** the ask fails every Quick criterion — unknowns to research
(photo storage and serving, lowest-friction auth for three known users,
hosting fit), architecture to lock (stack, data model, the points/scoring
contract), every interface new (greenfield), and a blast radius well past
3 beads.

This file is working state, not an archive. It is deleted in the handoff
commit; git history is the archive. Substages append below in order:
FRAMING, RESEARCH, ARCHITECTURE, TEST-STRATEGY, RECORD, DECOMPOSITION.

## FRAMING

Approved substage deliverable. Operator rulings taken live 2026-08-20.

### Scoring model (operator rulings, 2026-08-20)

The **schedule is the contract**: each member declares which days are
workout days and which are rest days. Points come from doing workouts;
the schedule legitimizes rest (no shame for resting on a declared rest
day) and makes a *missed* scheduled day visible — the trash-talk fuel.

- **Score basis:** raw completed-workout count decides the weekly winner.
- **Extra credit:** an unscheduled workout (on a rest day) earns bonus
  points on top. Volume wins.
- **Meal photos earn zero points.** They exist to flex on the feed.
- **Edit rule:** the schedule is editable until a day passes — future
  days of the current week may change; past days are frozen. No
  retroactive rest days.
- Exact point values are locked in ARCHITECTURE, not here.

### User stories (stable IDs)

- **S1 — Identify:** As one of the three members, I open the app on my
  phone and am recognized with minimal sign-in friction.
- **S2 — Schedule:** As a member, I declare my weekly schedule (workout
  days vs rest days) and may edit any day that has not yet passed.
- **S3 — Check-off:** As a member, I check off today's scheduled workout
  and earn standard points. Honor system; no proof required.
- **S4 — Extra workout:** As a member, I log a workout on a declared
  rest day and earn bonus points.
- **S5 — Meal photo:** As a member, I upload a meal photo to the feed.
  Zero points; flex only.
- **S6 — Leaderboard:** As a member, I see the weekly race (completed
  count plus bonuses) and the all-time tally at a glance.
- **S7 — Feed:** As a member, I see recent activity — check-offs, extra
  workouts, meal photos — and missed scheduled days are visible.

### Non-goals

Inherited verbatim from `NORTH-STAR.md` (public signup/multi-tenancy,
coaching, nutrition analysis, integrations, native apps). Framing adds
two rulings of the same force:

- **No in-app banter surface** — no comments, no reactions. The app
  shows the numbers; trash-talk stays in the group chat.
- **No workout proof** — honor system; no photo requirement on S3/S4.

### Epic success metric

The north star's success condition, made countable: all three members
perform a logging action (check-off, extra workout, or meal photo) on at
least 4 distinct days per week, measured from the app's own data.

### Narrowest valuable wedge

S1 + S2 + S3 + S6 (weekly race only): three fixed accounts, declare a
schedule, check off workouts, see who's winning this week — deployed and
usable on phones. S4, S5, S7, and the all-time tally land after the
wedge proves out.

### Prerequisites

None. Repository onboarding is complete (`contest-nnn`, the closed
setup bead: br store, merge driver, agent contract, remote).

## RESEARCH

Substage deliverable, 2026-08-20 (Sherlock, greenfield mode). Everything below is **provisional** — evidence-anchored input to ARCHITECTURE, not rulings. Machine evidence cites absolute paths on this machine; external facts cite sources verified today (free-tier limits change; re-verify at implementation if months pass).

### 1. Environment prior art (machine evidence)

**The default stack assumption is validated, with exact versions.** The two most recent sibling apps — twine (`/home/ddc/dev-environment/twine/frontend/package.json`) and qbrs (`/home/ddc/dev-environment/qbrs/package.json`) — are Next.js 16.1.6 + React 19, App Router, Tailwind v4, vitest 4, `@supabase/ssr` (^0.8–0.9) + `supabase-js` (^2.95+), all deployed to Vercel under one org (`team_k4wULKWTqJv6rtKbwpu2posh`; `.vercel/` dirs present). Shared idioms: shadcn/Radix, zod v4, `@/` alias. Twine's `src/lib/supabase/{client,server,admin}.ts` split (browser anon client via `createBrowserClient`, server client with cookie adapter, service-role admin client marked server-only at `/home/ddc/dev-environment/twine/frontend/src/lib/supabase/admin.ts:10`) plus env validation via `@t3-oss/env-nextjs` (`/home/ddc/dev-environment/twine/frontend/src/env.ts`) is the strongest house pattern. Confidence: high.

**How the shared instance is shared: one Postgres schema per project, no table prefixes.** The central migrations dir (`/home/ddc/dev-environment/supabase/migrations/`, 68 files, 2026-04 → 2026-08) creates 13 schemas (`core`, `open_toronto`, `moneyball`, `market_intel`, …). Two binding mechanics discovered:
- **PostgREST exposure is a global, overwrite-only list.** `/home/ddc/dev-environment/supabase/migrations/20260507180100_expose_open_toronto_to_postgrest.sql:29` sets `ALTER ROLE authenticator SET pgrst.db_schemas = '<full list>'` and carries a "FULL-LIST DISCIPLINE" warning: any migration adding a `contest` schema must re-list *every* existing schema and mirror the list in `config.toml [api] schemas`. A regression test guards this in another project. This is the #1 foot-gun for our first migration. Confidence: high.
- **Non-public schemas need explicit GRANTs before RLS even applies** (header of `/home/ddc/dev-environment/supabase/migrations/20260708210000_create_market_intel_market_briefs.sql:20-38` — missing GRANT yields `42501` regardless of policies). Also: `ALTER DEFAULT PRIVILEGES` auto-grants `anon` on `public` (revoked deliberately in `20260608120100_restrict_market_comparable_projects_grants.sql:13`) — another reason to use a dedicated `contest` schema, not `public`.
- **RLS house style:** policies granted `TO authenticated` gated by a `SECURITY DEFINER` helper (`public.is_user_approved()`, defined `20260408000000_baseline_squash.sql:2622`), one policy per table per verb. Contest should mirror the shape with its own membership predicate (see §3).
- Migration naming: `YYYYMMDDHHMMSS_verb_led_snake_case.sql`, opening `WHAT THIS DOES / WHY` comment citing the authorizing bead. Confidence: high.

**One tension to surface honestly:** the sole prior *standalone consumer* app (twine) got its **own** Supabase project (own `config.toml`, 45 own migrations) rather than a schema in the shared instance. The operator's global rule (CLAUDE.md: all DDL via the central dir, one shared project `ypdmvfspmtypifuhilxc`) is binding for contest, so the working assumption is a `contest` schema in the shared instance — but ARCHITECTURE should ratify this consciously, because the shared instance imposes instance-global auth and storage settings (§2, §3) that a dedicated project would not. Confidence in the facts: high; the ratification is ARCHITECTURE's call.

### 2. Photo upload / storage / serving (S5, post-wedge)

**Free-tier numbers (verified today at https://supabase.com/pricing):** 500 MB database, 1 GB file storage, 5 GB egress/month, **image transformations NOT included on Free** (Pro $25/mo: 100 GB storage, 250 GB egress, transforms included). **Unknown: the plan tier of `ypdmvfspmtypifuhilxc`** — with 13 schemas of analytics data the shared DB may already be past 500 MB (implying Pro, making all quota concerns moot). One operator glance at the dashboard settles it; flag for ARCHITECTURE. Confidence in numbers: high; in plan tier: unknown.

**Consequence: compression is client-side, and it solves HEIC for free.** With no server-side transforms on Free (and even on Pro, egress discipline is cheap to buy here), the pipeline should be: `<input type="file" accept="image/*" capture>` → decode in-browser → canvas downscale to ~1600 px longest edge, re-encode `image/jpeg` q≈0.8 (~200–400 KB) → upload. iPhone HEIC behavior (verified): iOS historically transcodes to JPEG for `accept="image/*"` inputs, but **Safari 17+ can hand the page a `.heic` file when `image/heic` appears in `accept`** (https://developer.apple.com/forums/thread/743049; background: https://shkspr.mobi/blog/2020/12/coping-with-heic-in-the-browser/). Mitigation: do NOT list `image/heic` in `accept`, and re-encode via canvas regardless — on iOS, WebKit decodes HEIC natively so the canvas path normalizes everything to JPEG. Non-Safari desktop browsers can't decode HEIC, but the three phones are the delivery surface (NORTH-STAR non-goal 5). Confidence: high on behavior, medium on Safari-version specifics (retest on current iOS at implementation).

**Bucket posture: private bucket + signed URLs, not public.** On a *shared* instance a public bucket URL is world-readable and guessable-by-leak; meal photos of known private individuals should sit in a private `contest-meals` bucket with `storage.objects` RLS limited to the three member ids, served via `createSignedUrl` (long expiry is fine — hours/days; the feed regenerates them). Storage math: ~300 KB × ~15 photos/week ≈ 4.5 MB/week — years of headroom even on Free; 5 GB egress supports ~17k image views/month at that size, ample for three users *if* compression happens (uncompressed 4–8 MB originals would burn it 20× faster). Local dev note: the local stack's storage file cap is 50 MiB (`/home/ddc/dev-environment/supabase/config.toml`). Confidence: high.

### 3. Minimal-friction auth for exactly 3 known users (S1)

**Magic links are effectively unusable here: Supabase's built-in SMTP allows ~2 auth emails per hour** (verified: https://supabase.com/docs/guides/auth/auth-smtp; community corroboration https://dreamlit.ai/blog/how-to-send-emails-supabase). Two friends signing in the same evening hits the cap; fixing it means standing up custom SMTP — pure ceremony for 3 users. Confidence: high.

**Recommendation: email+password, three pre-provisioned accounts, no signup flow.** Sign-in is rare (once per phone): supabase-js sessions persist via refresh-token rotation and by default do not expire until sign-out (session time-boxing is an opt-in Pro feature), so each phone signs in approximately once, ever. This is the lowest real-world friction of the three options. A PIN/shared-secret scheme would bypass Supabase Auth entirely, losing `auth.uid()` and therefore RLS — disqualifying on a shared instance. Confidence: high on recommendation; medium-high on session-expiry defaults (verify in ARCHITECTURE).

**Shared-instance RLS implications (binding constraints):** auth settings are instance-global — contest cannot disable public signup or tune email settings for itself alone, and `auth.users` is shared with every other project's users. Therefore `TO authenticated` is NOT a sufficient gate: every contest policy must check membership, e.g. `auth.uid() IN (SELECT user_id FROM contest.members)` via a `SECURITY DEFINER` helper mirroring the existing `is_user_approved()` pattern (§1). The three accounts get provisioned by a seed migration or one-time admin action, and a members table is the sole authority. Confidence: high.

### 4. Time and week semantics (highest risk to the frame)

**Recommended contract — one fixed group timezone, DB-computed, clients never send "today":**
- The group timezone is a single constant (e.g. `America/Toronto` — plausible given the operator's `open_toronto` schemas; confirm with operator, cheap to change pre-launch). All day/week boundaries derive from it for all three members regardless of travel.
- "Today" is computed in Postgres: `(now() AT TIME ZONE 'America/Toronto')::date`. Schedule days are stored as plain `DATE` meaning "that calendar date in the group zone". Server clock is the only clock; client clocks are display-only.
- **Week = ISO week, Monday 00:00 group-zone time** (`date_trunc('week', now() AT TIME ZONE '<zone>')`). Weekly race resets there; the leaderboard key is the ISO week's Monday date.
- **Freeze rule made precise:** day D is editable iff D ≥ group-zone-today at the moment the server processes the edit. Check-offs apply to group-zone-today at server receipt — a tap at 23:59 that arrives at 00:01 counts for the new day, deterministically. No grace window (a grace window reintroduces ambiguity; the honor system tolerates the rare midnight edge).
- **DST is absorbed by the named zone:** boundaries follow local wall clock (the 23h/25h days in March/November are correct behavior, not a bug). Using a named IANA zone rather than a UTC offset is what makes this true.
Why this is the dispute-proof minimum: any per-user-timezone scheme makes "the same week" differ between members' leaderboards, which is a direct dispute generator in a trash-talk app. One constant + one server clock means every scoring question has exactly one answer derivable from the DB. Unit-test surface (rank 2): boundary cases at midnight, Sunday→Monday rollover, DST transitions — all pure functions of (timestamp, zone). Confidence: high on the contract; medium on which zone (operator confirms).

### 5. Integration-test seam under the 30 s budget

**Recommendation: the already-running local Supabase stack + the qbrs/twine two-config vitest pattern. No new infrastructure.** Evidence:
- The `dev-environment` local stack is **already running warm** on this machine: 10 healthy `supabase_*_dev-environment` containers up 45 h (Postgres 17 on 54322, Kong/API on 54321, storage-api, gotrue). Docker 29.1.3, supabase CLI 2.75.0, Node 24. Because contest's migrations live in the central dir (§1), `supabase db reset` on this stack serves contest tables locally with zero extra setup — a dockerized plain Postgres would duplicate the migration path for no gain, and testing against the remote shared instance is disqualified (pollutes shared prod, network latency, secrets in CI).
- Proven harness shape, directly reusable: qbrs `vitest.integration.config.ts` (`environment: 'node'`, `fileParallelism: false`, separate `test:integration` script; `/home/ddc/dev-environment/qbrs/vitest.integration.config.ts:5-11`), seeding via direct `pg` connection to `postgresql://postgres:postgres@127.0.0.1:54322/postgres` with per-fixture `cleanup()` closures (`/home/ddc/dev-environment/qbrs/tests/integration/helpers/seed.ts:4`; note `psql` is not installed on this machine, hence the `pg` npm package). Twine's variant adds env-defaults-before-import in a setup file (`/home/ddc/dev-environment/twine/frontend/src/__tests__/integration/setup.ts:9-24`) and excludes the integration dir from the default unit run (`vitest.config.ts:9-23`) — that split maps exactly onto the NORTH-STAR rank-1/rank-2 budget.
- **The "real HTTP routes" seam:** import route-handler functions directly in vitest node env and invoke them with real `Request` objects against the live local stack — real handler, real auth path, real Postgres, no `next dev` server, per-test cost in low milliseconds. Budget math: no `supabase start` (warm), no per-run `db reset` (seed+cleanup instead, per qbrs precedent — a reset alone could eat the whole 30 s); a suite of 30–60 such tests fits comfortably. One scheduling caveat: only one local Supabase stack can bind 54321–54327 at a time (twine's own stack claims the same ports), so contest tests assume the `dev-environment` stack is the one running — worth one line in the repo README. Confidence: high.
- Architecture coupling: this seam favors **route handlers (or directly-importable server actions) over logic buried in Server Components** — a constraint ARCHITECTURE should adopt deliberately.

### 6. Provisional module fingerprints (all provisional; confidence per line)

- `~/dev-environment/supabase/migrations/2026MMDDHHMMSS_create_contest_schema.sql` — `contest` schema; tables ≈ `members`, `schedule_days` (member, date, kind workout|rest), `workouts` (check-offs incl. rest-day bonus flag), `meal_photos`; membership-gated RLS. Confidence: high that this file-pair exists; medium on table names.
- `~/dev-environment/supabase/migrations/2026MMDDHHMMSS_expose_contest_to_postgrest.sql` — the FULL-LIST `pgrst.db_schemas` re-list + `config.toml [api] schemas` mirror edit. Confidence: high (mechanically required by §1).
- `/home/ddc/dev-environment/contest/src/app/` — App Router pages: home/leaderboard (S6), schedule editor (S2), plus API route handlers under `src/app/api/` (or server actions — ARCHITECTURE call). Confidence: medium-high on `src/app`, medium on exact routes.
- `/home/ddc/dev-environment/contest/src/lib/supabase/{client,server,admin}.ts` + `src/env.ts` — twine-pattern clients + t3-env. Confidence: high.
- `/home/ddc/dev-environment/contest/src/lib/scoring.ts` — pure weekly tally + rest-day bonus logic (the rank-2 unit-test target). Confidence: high a pure module exists; medium on the path.
- `/home/ddc/dev-environment/contest/src/lib/week.ts` — group-timezone date/week helpers (§4). Confidence: medium-high.
- `/home/ddc/dev-environment/contest/tests/integration/**/*.test.ts` + `vitest.integration.config.ts` + `tests/integration/helpers/{supabase,seed}.ts` — qbrs-shape harness. Confidence: medium-high.
- Post-wedge (S5): storage bucket migration (`contest-meals` + storage RLS), `src/components/meal-upload.tsx` (compression), feed page. Confidence: medium.

### 7. Candidate bundle groups (future beads sharing footprints)

- **A — Contract core: schema + scoring + week semantics.** The two central migrations, `scoring.ts`, `week.ts`, their unit tests, and the seed helper. One lane: scoring's shape IS the schema's shape; splitting them across PRs guarantees churn. Predicted overlap: migration files, `scoring.ts`.
- **B — Auth + membership (S1).** Supabase client trio, `env.ts`, login page, members seed, membership RLS helper. Overlaps A only on the schema migration — B follows A in the same lane or immediately after.
- **C — Schedule UI + check-off UI (S2+S3).** Both render the same week-day grid and write adjacent tables; a shared day-grid component is near-certain. One lane. Depends on A+B.
- **D — Leaderboard (S6).** Reads scoring; touches `scoring.ts` read-only + one page. Can lane separately after A; small.
- **E — Photo pipeline (S5, post-wedge).** Bucket migration + upload component + feed. Almost fully disjoint from A–D; a natural independent lane later. S4 (extra-workout bonus) and S7 (feed) attach to C/E respectively with minor overlap.
- Wedge mapping: A → B → C → D is the S1+S2+S3+S6 wedge in dependency order; A+B plausibly one PR, C and D one each.

### Risks to the frame

1. **Instance-global auth on the shared project (constrains S1, does not invalidate it).** Contest cannot disable public signup or alter email settings for itself alone; `authenticated` ≠ member. Every policy must gate on the contest members table. If ARCHITECTURE finds this distasteful, the alternative is a dedicated Supabase project (twine precedent) — but that contradicts the operator's standing central-migrations rule, so it is an operator decision, not a planning default.
2. **Unknown plan tier of `ypdmvfspmtypifuhilxc`.** If Free: 500 MB DB is shared with 13 analytics schemas (possibly already tight) and 1 GB storage / 5 GB egress absorb the meal photos; if Pro: all quota concerns vanish. One dashboard glance resolves it; recommend checking before ARCHITECTURE locks the storage plan. Image transforms are Pro-only either way — client-side compression stands regardless.
3. **Magic-link assumption, if anyone was carrying it.** The 2-emails/hour built-in SMTP cap makes magic links effectively broken out of the box; S1's "minimal friction" survives via password + persistent sessions, but a FRAMING reading that implied passwordless should be corrected now.
4. **The edit rule is only dispute-proof under a single group timezone.** If the three members are ever in different zones AND the group insists on per-user local days, the freeze rule and the weekly race become ambiguous by construction. Recommend ARCHITECTURE hard-codes one named IANA zone as a constant. (Zone choice needs one operator confirmation.)
5. **30 s budget assumes the warm local stack and no per-run `db reset`.** A cold `supabase start` or per-run reset blows the budget on its own; the seed/cleanup discipline (§5) is load-bearing, and only one local stack can hold ports 54321–54327 at a time on this machine.

Sources (external facts verified 2026-08-20): https://supabase.com/pricing · https://supabase.com/docs/guides/auth/auth-smtp · https://developer.apple.com/forums/thread/743049 · https://shkspr.mobi/blog/2020/12/coping-with-heic-in-the-browser/ · https://github.com/orgs/supabase/discussions/14598 · https://dreamlit.ai/blog/how-to-send-emails-supabase

## RESEARCH ADDENDUM — no-Supabase pivot

At the RESEARCH gate (2026-08-20) the operator ruled: **contest does not
use Supabase — it uses a free stack instead, as a one-off exception to
the standing shared-instance rule.** Locked at the same gate: auth is
three pre-provisioned email+password accounts with no signup flow; the
group timezone is **America/Toronto**; the shared Supabase project is
Pro (now moot for contest). Producer substitution for this addendum:
orchestrator inline (marketplace/storage/auth skill discovery + web
verification) instead of a second sherlock dispatch — recorded per the
gate protocol.

### Voided vs standing findings

**Voided** (Supabase-specific): §1 shared-instance mechanics (PostgREST
schema list, GRANTs, RLS house style, central migrations dir — the
standing central-migrations rule is scoped to Supabase and does not
apply here), §2 Supabase Storage posture, §3 Supabase Auth mechanics,
§5's local Supabase stack seam, and every fingerprint referencing
`~/dev-environment/supabase/migrations/`.

**Standing**: §1 stack conventions (Next.js 16 App Router, React 19,
Tailwind 4, vitest 4, shadcn, zod, `@/` alias, Vercel deploy — twine/qbrs
evidence); §2 client-side compression + HEIC handling (storage-provider
independent); §3's conclusion shape (pre-provisioned accounts, rare
sign-in, membership is app-authority); §4 time/week contract in full;
§5's harness discipline (two-config vitest, `fileParallelism: false`,
seed/cleanup not resets, route-handlers-as-seam); the 30 s budget math.

### Database: Neon Postgres (marketplace), free plan

Per the vercel-storage skill's decision matrix (relational data → Neon).
Free plan verified today: $0, 0.5 GB storage per project, 100 CU-hours
compute/month, scale-to-zero, 5 GB transfer/month
(https://neon.com/pricing, https://neon.com/faqs/free-plan-limits-and-quotas)
— orders of magnitude above three users' row data. Provisioned via
`vercel integration add neon` (auto env vars). Client: drizzle ORM over
`@neondatabase/serverless`, lazy `getDb()` init (build-time safety),
no `Proxy` wrappers, migrations in-repo via drizzle-kit (note:
drizzle-kit does not auto-load `.env.local` — use dotenv-cli).
Contest becomes fully self-contained: no cross-project migration dir,
no schema-list foot-gun. Confidence: high.

### Photos: Vercel Blob, Hobby allotment

Hobby (free) includes 1 GB storage, 10 GB transfer/month, 10k simple +
2k advanced ops (https://vercel.com/docs/vercel-blob/usage-and-pricing).
Compressed-photo math from §2 stands: ~4.5 MB/week stored, years of
headroom; exceeding a Hobby cap suspends Blob rather than billing.
Server-side `put()` with `access: 'private'` (public beta) or
unguessable public URLs — ARCHITECTURE call; compression stays
client-side either way. Caveat: Blob free allotments are a **Hobby**
(personal) feature; on a Pro team Blob is usage-billed from the first
byte. Recommendation: deploy under the operator's personal Hobby scope,
not the team org — ratify in ARCHITECTURE. Confidence: high on numbers,
medium on private-access beta details.

### Auth: two candidates, ARCHITECTURE decides

- **Clerk** (auth skill's recommended provider; native marketplace,
  `vercel integration add clerk`): free plan covers this scale; supports
  invite-only/restricted sign-up with manual user creation
  (https://clerk.com/docs/guides/secure/restricting-access — whether
  restricted mode is free-plan needs one verification at lock time).
  Cost: every integration test's auth path acquires a remote dependency
  (Clerk's API), fighting the hermetic 30 s suite.
- **Self-auth: Auth.js credentials provider or iron-session + bcrypt**
  against a `members` table in Neon: zero external service, fully
  hermetic integration tests, no signup surface to restrict — but
  session/password handling is our code. At exactly three users with
  membership already app-authoritative, the surface is small.
Tension recorded honestly: the plugin's preferred-provider guidance
favors the real integration (Clerk); the north star's rank-1
integration-test value favors hermetic self-auth. Operator/ARCHITECTURE
decides. Confidence: high on both options' shapes.

### Integration-test seam, revised

Dockerized **Postgres 17** container dedicated to contest (distinct
port, e.g. 5433 — the Supabase local stack owns 54322), drizzle
migrations applied once per session, qbrs-shape seed/cleanup per
fixture, route handlers imported directly and invoked with real
`Request` objects. Same budget math as §5: 30–60 tests fit the 30 s
budget. Testing against Neon itself is disqualified for the suite
(network latency, CU-hour burn) but fine for a one-time smoke of the
provisioned instance. Confidence: high.

### Fingerprints, revised (provisional)

- `src/db/schema.ts` + `drizzle/` (in-repo migrations) — members,
  schedule_days, workouts, meal_photos. Confidence: high.
- `src/db/index.ts` — lazy `getDb()`. Confidence: high.
- `src/lib/scoring.ts`, `src/lib/week.ts` — unchanged from §6.
- `src/lib/auth/` or Clerk middleware — pending the auth decision.
- `src/app/` routes + `src/app/api/` handlers — unchanged shape.
- `tests/integration/**` + `vitest.integration.config.ts` +
  `tests/integration/helpers/` + a compose/run script for the Postgres
  container. Confidence: medium-high.
- Post-wedge: `src/components/meal-upload.tsx` + Blob token route
  (`src/app/api/upload/route.ts`). Confidence: medium.

### Bundle groups: A–E stand with substitutions

A (schema + scoring + week: now `src/db/*` + drizzle migrations instead
of central SQL files), B (auth + membership: client trio replaced by
db/auth wiring), C (schedule + check-off UI), D (leaderboard), E (photo
pipeline: Vercel Blob instead of Supabase Storage). Wedge order
A → B → C → D unchanged.

### Risks, revised

1. **Neon scale-to-zero cold starts** (~hundreds of ms after idle) hit
   the first request of a session — acceptable for three users, worth
   knowing before anyone calls it a bug. Confidence: medium-high.
2. **Blob-on-team-plan billing**: deploying under the Pro team org
   silently converts "free" into usage-billed Blob. The Hobby-scope
   deploy recommendation exists to prevent this; needs ARCHITECTURE
   ratification.
3. **Clerk restricted-mode plan gating** unverified; if it turns out
   paid-only, self-auth wins by default.
4. Prior risks 4 (single group timezone — resolved: America/Toronto
   locked) and 5 (budget discipline — carried over unchanged).

Addendum sources (verified 2026-08-20): https://neon.com/pricing ·
https://neon.com/faqs/free-plan-limits-and-quotas ·
https://vercel.com/docs/vercel-blob/usage-and-pricing ·
https://clerk.com/docs/guides/secure/restricting-access ·
https://costbench.com/software/developer-tools/clerk/
