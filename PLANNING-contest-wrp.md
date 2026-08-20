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

## ARCHITECTURE

Substage deliverable, 2026-08-20. **Producer substitution (recorded per
the gate protocol):** the default producer (gaudi, inline) is
inapplicable — gaudi's epic mode requires child beads, which
DECOMPOSITION authors two substages later; its --feature mode is
unimplemented (v2). The orchestrator produced this section inline using
gaudi's discipline: named decisions, locked tradeoffs, single-owner
constants, interface contracts. The sequencing gap is jotted.

### FRAMING amendment (operator, ARCHITECTURE gate)

Two FRAMING scoring rulings are **amended by the operator**:
- The rest-day bonus is removed: a workout is worth the same wherever it
  lands. S4 remains a story (logging a rest-day workout) but scores
  identically to S3.
- Multiple workouts per day are allowed and each earns credit
  (two-a-days rewarded). The one-credit-per-day cap proposed at this
  gate is rejected.
Consequence: the never-schedule exploit identified at this gate
disappears (there is no bonus to farm), and the schedule's role is
purely accountability visibility — a declared workout day with no
workout logged renders as **missed**.

### D1 — Stack (locked)

Next.js 16 App Router + React 19 + TypeScript + Tailwind 4, vitest 4,
zod, `@/` alias — the twine/qbrs house pattern. Deployed to Vercel under
the **operator's personal Hobby scope** (operator ruling; keeps Vercel
Blob and bandwidth inside free allotments). Mobile-web-first UI; no
native apps (north star).

### D2 — Data layer (locked)

Neon Postgres free plan, provisioned via `vercel integration add neon`.
Drizzle ORM with in-repo migrations (`drizzle/`), schema at
`src/db/schema.ts`, lazy `getDb()` at `src/db/index.ts` (no top-level
client construction; no Proxy wrappers). **One driver everywhere:**
`drizzle-orm/node-postgres` over `pg` Pool — Neon's pooled TCP URL in
production, local Docker Postgres in dev/test. This keeps prod and test
on the identical query path (integration-value rank 1) instead of
splitting neon-http/prod vs pg/test. drizzle-kit invocations use
dotenv-cli (does not auto-load `.env.local`).

### D3 — Schema contract (locked)

- `members(id serial PK, name text not null, email text unique not null,
  password_hash text not null, created_at timestamptz default now())` —
  exactly three rows, seeded by script; no signup path exists.
- `schedule_days(member_id int FK, date date, is_workout boolean not
  null, PK (member_id, date))` — a row is an **explicit declaration**
  (workout or rest); absence of a row = undeclared. Rows whose date is
  past in the group zone are **frozen**: the server rejects
  insert/update/delete for them.
- `workouts(id serial PK, member_id int FK not null, date date not
  null, created_at timestamptz default now())` — **no** unique
  constraint on (member_id, date); each row is one point. The check-off
  UI writes one row for group-zone-today; additional rows per day are
  legitimate (two-a-days).
- `meal_photos(id serial PK, member_id int FK not null, blob_url text
  not null, blob_pathname text not null, date date not null, created_at
  timestamptz default now())` — post-wedge.
- No sessions table: sessions are stateless sealed cookies (D5).

### D4 — Time contract (locked; adopts RESEARCH §4 in full)

`src/lib/week.ts` is the **single owner** of time semantics:
`GROUP_TZ = 'America/Toronto'`, `todayInGroupZone(now)`,
`weekStartMonday(date)` (ISO week), `isPastInGroupZone(date, now)` —
pure functions of an injected clock, unit-tested for midnight
boundaries, Sunday→Monday rollover, and both DST transitions. The
server clock is the only clock; clients never send "today". Week math
lives in TypeScript only — SQL receives computed date ranges as
parameters, never re-derives zone logic (prevents the same rule living
in two places, where the copies drift apart — the classic duplicated-
knowledge smell).

### D5 — Auth (locked: self-auth; operator ruling)

Signed, HttpOnly, SameSite=Lax sealed session cookie (iron-session
pattern, `SESSION_SECRET` env) over bcrypt password hashes in
`members`. `src/lib/auth.ts` owns: `verifyLogin(email, password)`,
`createSession(memberId)`, `requireMember(request)` (returns the member
or throws 401). Login is a route handler; sign-out clears the cookie.
Middleware (`proxy.ts`) redirects unauthenticated page loads to
`/login`; every mutating handler independently calls `requireMember()`
(defense in depth — the middleware is convenience, the handler check is
the contract). Seed script `scripts/seed-members.ts` provisions the
three accounts. No signup surface exists anywhere. Rationale over
Clerk: hermetic integration tests (rank-1 value, 30 s budget) and zero
external dependency at three users.

### D6 — API seam (locked)

All **mutations** are route handlers under `src/app/api/*` accepting
JSON validated by zod schemas from `src/lib/validation.ts`:
- `POST /api/login` {email, password} → sets cookie
- `POST /api/logout`
- `PUT /api/schedule` {days: [{date, is_workout}]} → upserts only
  non-past dates; any past date in payload → 422 whole-request reject
- `POST /api/workouts` {} → inserts workout for group-zone-today
- `DELETE /api/workouts/:id` → undo, own workouts only, today only
- (post-wedge) `POST /api/meals` multipart/base64 → Blob put + row
**Reads** for pages go through shared query functions in
`src/lib/queries.ts`, used by server components directly. Integration
tests import route-handler functions and invoke them with real
`Request` objects against local Postgres (RESEARCH §5 seam). Scoring
reads (`weeklyScores`, `allTimeScores`, `missedDays`) live in
`src/lib/queries.ts` and delegate arithmetic to `src/lib/scoring.ts`.

### D7 — Scoring contract (locked; operator rulings incl. amendment)

`src/lib/scoring.ts` is the single owner of point arithmetic:
`POINTS_PER_WORKOUT = 1`; weekly score = count of workout rows dated in
the group-zone ISO week × 1; all-time = total count × 1. Ties display
as ties. `missedDays(member, week)` = declared workout days, past, with
zero workout rows that date — display-only, never a penalty.
Pure functions over row arrays (unit-tested); `queries.ts` may
implement the same totals in SQL for efficiency but the pure function
is the reference implementation and the two are asserted equal in one
integration test.

### D8 — Consistency and caching (locked)

Single Postgres, strong consistency (a read after a write sees the
write — the safe default; no replicas, no caches to invalidate).
Leaderboard computed per request; at three users there is no
performance case for caching, and adding cache invalidation would be
speculative complexity. Neon scale-to-zero cold start (~hundreds of ms
on first request after idle) is accepted and documented as expected
behavior, not a bug.

### D9 — Photos (locked, post-wedge)

Client-side compression (canvas → JPEG, ~1600 px longest edge, q≈0.8;
never list image/heic in accept — RESEARCH §2) → `POST /api/meals` →
server-side `@vercel/blob` `put()` with **public access + random
pathname suffix** (unguessable URL, CDN-served, free Hobby transfer).
Rationale over private-access: meal photos are low-sensitivity flex
content; private access is beta and routes every view's bytes through a
function. Revisit only on operator objection.

### D10 — Smell risks identified

- **Duplicated knowledge (change-amplification) risk** on time and
  points constants → prevented by single-owner modules (D4, D7).
- **Shallow-module risk** on `queries.ts` growing into a grab-bag →
  bounded: it owns exactly page-read functions and score reads; any
  logic beyond SQL shaping belongs in scoring.ts/week.ts.
- No migration risk (greenfield); no smell beads filed (nothing exists
  to refactor).

### Research assumptions changed

None silently. Explicit deltas: FRAMING scoring amendment (above);
RESEARCH's open auth question resolved to self-auth; deploy scope
resolved to personal Hobby; Blob access posture resolved to
public-unguessable (research had leaned private — overridden with
rationale in D9).

## TEST-STRATEGY

Substage deliverable, 2026-08-20 (Columbo, non-interview mode — derived entirely from NORTH-STAR test values, FRAMING S1–S7 with the ARCHITECTURE-gate scoring amendment, RESEARCH §5 + addendum seam, and ARCHITECTURE D1–D10). No beads minted and no skeleton files written — DECOMPOSITION owns both.

### Ground rules

- **Layers.** Per NORTH-STAR test values: integration (rank 1) and unit (rank 2) only. E2E and smoke are deliberately not run (operator ruling 2026-08-20), so no E2E tag exists in this repo; tags are [INT] and [UNIT].
- **Extend-vs-new is moot.** The repo is greenfield (verified at planning time: no src/, no tests/, no package.json; measured existing suite = 0 s). Every proposal below is new by necessity. Said once, not repeated.
- **Budget.** FULL_SUITE_WALL_CLOCK_BUDGET_SECONDS = 30; the full 30 s is remaining budget. All runtimes below are ESTIMATES (nothing exists to measure). The first implementation PR should record actuals next to these estimates.
- **Harness mechanics** (adopts RESEARCH §5 discipline via the addendum's revised seam, plus D2/D4/D6):
  - Two vitest configs (qbrs/twine pattern): `vitest.config.ts` (unit; excludes tests/integration) and `vitest.integration.config.ts` (`environment: 'node'`, `fileParallelism: false` — integration estimates are therefore additive).
  - Integration seam: import route-handler functions from `src/app/api/**` and invoke them with real `Request` objects against the dedicated dockerized Postgres 17 on port 5433. Drizzle migrations applied once per session in vitest `globalSetup`. Seed/cleanup closures per fixture; never a per-run db reset.
  - Budget excludes container boot: the suite assumes a warm contest-postgres container (RESEARCH risk 5 carried over). The run script may `docker start` a stopped container; a cold `docker run`/image pull is outside the 30 s.
  - **Clock control:** handlers obtain now via `new Date()` and pass it into week.ts's injected-clock functions (D4). Integration tests pin time with `vi.useFakeTimers({ toFake: ['Date'] })` — Date only, so pg socket timers are unaffected. This is what makes every freeze/midnight case below deterministic.
  - **bcrypt fixtures at cost 4.** Production seeding (scripts/seed-members.ts) uses a real cost; test fixtures hash at cost 4 so login cases don't eat the budget. The contract is "any valid bcrypt hash", so this is legitimate.

### Story-by-test matrix

Wedge = S1/S2/S3/S6; post-wedge = S4/S5/S7.

| Story | Covering tests | Layer |
|---|---|---|
| S1 Identify (wedge) | auth.test.ts: login success / bad password / unknown email, cookie attributes, table-driven no-cookie 401 across every mutating handler | INT |
| S2 Schedule (wedge) | schedule.test.ts: upsert, freeze 422 whole-request reject, midnight-boundary flip; week.test.ts: isPastInGroupZone | INT + UNIT |
| S3 Check-off (wedge) | workouts.test.ts: server-computed today, two-a-day, near-midnight determinism, undo restrictions; scoring.test.ts: multi-row counting | INT + UNIT |
| S4 Extra workout (post-wedge; scores identically to S3 after the ARCHITECTURE-gate amendment) | scoring.test.ts: rest-day-workout-equals-one-point case, pinning no-bonus. No dedicated integration case: post-amendment the POST /api/workouts handler has no schedule-dependent branch, so S3's integration cases ARE S4's | UNIT |
| S5 Meal photo (post-wedge) | deferred — see "Post-wedge delta": auth gate + row-write INT with stubbed Blob put; client-side compression is manual-use territory per the no-E2E ruling | INT (partial), later |
| S6 Leaderboard (wedge) | scores.test.ts: D7 reference-vs-SQL equality, tie behavior, weekly/all-time split, zero-score member present; scoring.test.ts: tie + week-window cases | INT + UNIT |
| S7 Feed (post-wedge) | missedDays specced NOW because it is D7 wedge logic: scoring.test.ts UNIT + scores.test.ts INT; recent-activity feed query deferred | UNIT + INT |
| Cross-cutting D4 time contract | week.test.ts: DST both directions, Sunday→Monday rollover, midnight boundary, cross-year ISO week | UNIT |

### Proposed test files and cases

Dates below use real 2026 facts: Toronto is EDT (UTC−4) in August, so group-zone midnight = 04:00Z; 2026-08-17 is a Monday and 2026-08-20 a Thursday; DST spring-forward is 2026-03-08 02:00 EST, fall-back 2026-11-01 02:00 EDT.

#### tests/unit/week.test.ts [UNIT] — src/lib/week.ts (pure, injected clock) — est. 0.5 s

1. Midnight boundary: todayInGroupZone(2026-08-20T03:59:00Z) = '2026-08-19'; at 04:00:00Z = '2026-08-20'. Why: at both instants the UTC date is already 08-20 — this pair catches a UTC-based implementation.
2. Sunday→Monday rollover: at 2026-08-24T03:59:00Z (Sunday 23:59 Toronto) weekStartMonday(todayInGroupZone(now)) = '2026-08-17'; at 04:00:00Z (Monday 00:00) = '2026-08-24'. Why: the weekly race resets exactly at Monday 00:00 group time.
3. weekStartMonday semantics: weekStartMonday('2026-08-17') = '2026-08-17' (Monday maps to itself); weekStartMonday('2026-08-23') = '2026-08-17' (Sunday belongs to the week begun the previous Monday — ISO semantics).
4. Cross-year ISO week: weekStartMonday('2026-01-01') = '2025-12-29' (Jan 1 2026 is a Thursday). Why: year-clamped week math breaks exactly here.
5. DST spring forward (23 h day): todayInGroupZone(2026-03-08T06:59:00Z) = '2026-03-08' (01:59 EST); (2026-03-08T07:00:00Z) = '2026-03-08' (03:00 EDT — the skipped hour); day-before boundary still at 05:00Z (04:59:00Z → '2026-03-07', 05:00:00Z → '2026-03-08'); day-after boundary shifts to 04:00Z (2026-03-09T03:59:00Z → '2026-03-08', 04:00:00Z → '2026-03-09'). Why: proves boundaries follow local wall clock through the offset change; a fixed-offset implementation fails the last pair.
6. DST fall back (25 h day): todayInGroupZone(2026-11-01T05:30:00Z) = '2026-11-01' (01:30 EDT, first pass); (2026-11-01T06:30:00Z) = '2026-11-01' (01:30 EST, repeated hour — same date); next midnight at 05:00Z (2026-11-02T04:59:00Z → '2026-11-01', 05:00:00Z → '2026-11-02').
7. isPastInGroupZone freeze predicate: with clock 2026-08-20T04:00:00Z — ('2026-08-19') = true, ('2026-08-20') = false (today is editable), ('2026-08-21') = false; and with clock 2026-08-20T03:59:00Z — ('2026-08-19') = false. Why: the exact D ≥ today comparison, tested on both sides of the midnight flip.

#### tests/unit/scoring.test.ts [UNIT] — src/lib/scoring.ts (D7 pure reference implementation) — est. 0.5 s

1. Multi-workout-per-day counting: rows dated 2026-08-17, 2026-08-19, 2026-08-19 → weekly score for week '2026-08-17' = 3. Why: pins the amendment — two-a-days each earn credit, no per-day cap.
2. Week-window exclusion: add rows 2026-08-16 (Sunday, prior ISO week) and 2026-08-24 (next Monday) → weekly score still 3.
3. POINTS_PER_WORKOUT: 3 rows → exactly 3 points (integer equality; guards a drive-by change to the constant).
4. Rest-day equivalence (S4 post-amendment): schedule declares 2026-08-18 rest; workout rows on 2026-08-17 (scheduled) and 2026-08-18 (rest day) → weekly score = 2 exactly. Why: pins "no bonus" so the pre-amendment bonus rule cannot silently resurface.
5. Tie behavior: members A and B with 2 rows each in the week → both score 2 and are represented as tied (equal rank, no hidden tiebreaker ordering).
6. Zero-score member present: a member with no rows appears with score 0, not absent. Why: the skipped session must be visible — that invisibility is the product failure the app exists to prevent.
7. missedDays display logic: schedule Mon 08-17 workout, Tue 08-18 workout, Wed 08-19 rest, Thu 08-20 workout; workout rows only on 08-17; clock 2026-08-20T12:00:00Z → missedDays = ['2026-08-18'] exactly: 08-17 done, 08-19 rest is never missable, 08-20 is today (not past), and undeclared days (08-16, no row) never appear. Why: absence-of-row = undeclared, and missed is strictly declared + past + zero rows.
8. missedDays never penalizes: same fixture — weekly score = 1 (display-only, nothing subtracted).

#### tests/integration/auth.test.ts [INT] — login/logout handlers, requireMember, API-surface guard — est. 3.0 s

Fixture: 3 seeded members (bcrypt cost 4), cleanup closure.

1. Login success: POST /api/login {email: seeded, password: correct} → 200; Set-Cookie carries HttpOnly and SameSite=Lax; a follow-up POST /api/workouts with that cookie succeeds as that member (round-trips the session end to end).
2. Bad password: correct email + 'wrong-password' → 401, no Set-Cookie.
3. Unknown email: 'nobody@example.com' → 401 (same status as bad password; no user-enumeration distinction).
4. No cookie never reaches handler logic: table-driven over EVERY mutating handler in D6 — PUT /api/schedule, POST /api/workouts, DELETE /api/workouts/:id (POST /api/meals joins when it lands) — request without Cookie → 401 AND the corresponding table's row count unchanged. Why: D5 makes the handler check the contract and middleware mere convenience; this proves defense-in-depth at the seam, not in proxy.ts.
5. Tampered cookie: Cookie: session=garbage on PUT /api/schedule → 401, zero schedule rows written.
6. API-surface guard (negative space): enumerate src/app/api/**/route.ts on disk; assert the mutating surface equals exactly the D6 list, and assert no path segment matching signup/register/sign-up exists anywhere under src/app. Why: any new mutation path must consciously join the 401 table in case 4, and the no-signup non-goal is enforced mechanically rather than by memory.
7. Logout: POST /api/logout with a valid cookie → response issues a clearing Set-Cookie; a request with the emptied cookie → 401. (Sealed stateless cookies cannot be revoked server-side — an old copied cookie stays valid until expiry; accepted at this threat model, noted for DECOMPOSITION.)

#### tests/integration/schedule.test.ts [INT] — PUT /api/schedule, freeze rule — est. 2.5 s

Fixture: one seeded member + session cookie; clock pinned per case.

1. Upsert non-past days: clock 2026-08-20T12:00:00Z (today = Thu 08-20); payload {days:[{date:'2026-08-20',is_workout:true},{date:'2026-08-22',is_workout:false}]} → 200, both rows present with those booleans. Re-PUT {date:'2026-08-22',is_workout:true} → row flipped, still exactly one row for that date (PK upsert, no duplicates).
2. Freeze — whole-request 422, nothing partially applied: pre-seed frozen row (member, '2026-08-19', is_workout=true). Payload mixing past + future: [{date:'2026-08-19',is_workout:false},{date:'2026-08-21',is_workout:true}] → 422; assert '2026-08-19' still is_workout=true (no retroactive rest day) AND no row exists for '2026-08-21' (the valid half was NOT applied). Why: the atomicity contract — reject-all, never skip-bad.
3. Today is editable: {date:'2026-08-20'} accepted at the same clock (D ≥ today includes today).
4. Midnight flip distinguishes group zone from UTC: payload {date:'2026-08-20',is_workout:true} at clock 2026-08-21T03:59:00Z (Toronto Aug 20, 23:59) → 200; identical payload at 2026-08-21T04:00:00Z (Toronto Aug 21, 00:00) → 422. Why: at BOTH instants the UTC date is already 08-21 — a UTC-based freeze wrongly rejects the first request; this pair catches it.
5. Shape validation: {days:[{date:'2026-8-2',is_workout:true}]} (malformed date) and {days:[{date:'2026-08-22',is_workout:'yes'}]} → 400, zero rows written (zod boundary per D6; status-code contract below).

#### tests/integration/workouts.test.ts [INT] — POST /api/workouts, DELETE /api/workouts/:id — est. 3.0 s

Fixture: members A and B seeded, session cookies for both.

1. Check-off writes group-zone-today: clock 2026-08-20T12:00:00Z; POST {} with A's cookie → 2xx; exactly one new row with member_id = A and date = '2026-08-20', server-computed.
2. Client-supplied date never overrides server today: POST {date:'2026-08-01'} → 400 via strict empty-object zod schema, zero rows written (proposed contract below; the guarantee either way is that no row ever carries a client-chosen date).
3. Two-a-day: POST {} twice with A's cookie at the same clock → two rows both dated '2026-08-20'; weeklyScores via queries shows A = 2.
4. Near-midnight determinism: POST at clock 2026-08-21T03:59:30Z → row date '2026-08-20'; POST at 2026-08-21T04:00:30Z → row date '2026-08-21'. Why: D4's "a tap at 23:59 arriving 00:01 counts for the new day, deterministically" made executable.
5. Undo own + today: A checks off today, DELETE /api/workouts/:id with A's cookie → 2xx, row gone.
6. Cannot delete another member's workout: seed a row owned by B dated today; DELETE with A's cookie → 404 (proposed: not-found rather than 403, no existence leak), row still present.
7. Undo restricted to today: seed a row owned by A dated '2026-08-19'; DELETE with A's cookie at clock 2026-08-20T12:00:00Z → 403, row still present. Why: history is frozen the same way the schedule is; undo is a same-day fat-finger fix, not retroactive editing.

#### tests/integration/scores.test.ts [INT] — queries.ts read seam + D7 equality — est. 2.5 s

Fixture: 3 members; clock 2026-08-20T12:00:00Z.

1. D7 reference-vs-SQL equality (the locked assertion): seed a deliberately messy set — member 1: rows 2026-08-17, 2026-08-19 twice, 2026-08-16 (prior ISO week); member 2: 2026-08-18, 2026-08-23 (Sunday — still week '2026-08-17'); member 3: none. Assert queries.weeklyScores('2026-08-17') (SQL path) deep-equals scoring.weeklyScores over the fetched raw rows (pure reference) AND both say member1=3, member2=2, member3=0. Same double-path assertion for all-time (member1=4, member2=2, member3=0). Why: D7 names the pure function the reference implementation and requires the SQL copy proven equal in one integration test — this is that test.
2. Tie through the read seam: members 1 and 2 at 2 rows each this week → weeklyScores represents them as tied (equal score, equal rank, no tiebreak), through real SQL.
3. missedDays through the seam: the unit-case-7 fixture seeded into real tables → queries.missedDays(member1, '2026-08-17') = ['2026-08-18']; weekly score unaffected (= 1). Why: same contract as the unit case, but proven against real DATE columns with week ranges passed as parameters (D4: SQL never re-derives zone logic).
4. Weekly vs all-time split: member with rows 2026-07-06 and 2026-08-17 → weekly('2026-08-17') = 1, all-time = 2.

### Negative space — what must NOT exist or happen

| Must not | Enforced by |
|---|---|
| No signup route/handler anywhere (NORTH-STAR non-goal 1, D5) | auth case 6 filesystem guard: no signup/register path under src/app, mutating surface = exactly D6's list; plus the teardown invariant below |
| Past schedule rows immutable via every mutation path | auth case 6 proves PUT /api/schedule is the ONLY schedule mutation path; schedule cases 2 and 4 prove that path rejects past dates atomically |
| One member cannot delete another's workout | workouts case 6 |
| Unauthenticated requests never reach handler logic | auth cases 4 and 5 — 401 AND row counts unchanged, per handler |
| Client-supplied dates never override server-computed today | workouts case 2 (strict schema), cases 1 and 4 (date server-derived), case 7 (undo cannot reach back) |
| Members table never grows | integration global-teardown asserts members row count equals the seeded count after the full suite — no code path creates members |

### Budget

| File | Est. |
|---|---|
| tests/unit/week.test.ts | 0.5 s |
| tests/unit/scoring.test.ts | 0.5 s |
| unit config startup | 1.0 s |
| tests/integration/auth.test.ts | 3.0 s |
| tests/integration/schedule.test.ts | 2.5 s |
| tests/integration/workouts.test.ts | 3.0 s |
| tests/integration/scores.test.ts | 2.5 s |
| integration startup + drizzle migrate (once per session) | 3.0 s |
| **Wedge total (estimated)** | **~16 s of 30 s** |

Roughly 45 cases, inside RESEARCH §5's 30–60 fit. The ~14 s headroom is deliberate: post-wedge additions (meals INT with stubbed Blob, feed query cases appended to scores.test.ts) are estimated +4–5 s, landing the end-state suite around 21 s. If actuals blow past estimates, cut by unique-confidence in this order: schedule case 5 (shape validation — mostly library behavior), one side of workouts case 4 (one boundary side suffices once week.test.ts is green), auth case 3 (unknown email). Never cut the D7 equality, the freeze-atomicity case, or either midnight-flip pair — those carry the highest unique confidence per second.

### Proposed status-code contracts (stated loudly, not assumed silently)

Engineering defaults for DECOMPOSITION to bake into bead acceptance criteria — adjust there if desired, then the cases above adjust with them:
- 422 = semantically rejected (freeze violations — per the locked whole-request-reject contract); 400 = shape-invalid (zod parse failure, including unknown fields via strict schemas, which is what makes workouts case 2 mechanical).
- DELETE of a workout that is not yours → 404 (no existence leak); DELETE of your own non-today workout → 403.
- POST /api/workouts body schema: strict empty object.

### Post-wedge delta (S5/S7 marker for DECOMPOSITION)

When bundle E is decomposed: tests/integration/meals.test.ts — auth gate (joins auth case 4's table), zod rejection of a non-image payload, row written with blob_url/blob_pathname from a stubbed @vercel/blob put. The stub is the one permitted fake in the suite: the real seam is a remote billed service, and the E2E layer that would otherwise cover it is banned by NORTH-STAR ruling; client-side canvas compression is manual-use territory under the same ruling. S7's recent-activity feed query cases append to scores.test.ts. This is a delta marker, not a full spec — spec it when E is decomposed.

## RECORD

Substage deliverable, 2026-08-20. An ADR was warranted and produced:
`docs/adr/0001-app-architecture-and-scoring-contract.md` — the durable
record of the product contract, technical contract, and test contract.
Status flips from proposed to accepted at this substage's operator gate.

### Review-gate evidence (design-document review pair, both fresh Codex contexts)

**Bloat review** (subtraction-only, judged against NORTH-STAR.md): six
cuts proposed. Operator dispositions: cuts 1–2 (defer photos/feed,
defer all-time tally) already satisfied by the gated wedge sequencing —
reaffirmed, no change; cut 3 (defer undo) REJECTED — undo stays; cut 4
ACCEPTED as shrink — the dual scoring implementation and SQL-equality
assertion are removed, `scoring.ts` survives as sole owner of
`POINTS_PER_WORKOUT` and the missedDays rule; cut 5 (flatten error
taxonomy) REJECTED; cut 6 (drop negative-space guards) REJECTED.
Side record: the bloat reviewer's context ran unsanctioned tracker and
git commands despite a read-only sandbox flag (bead contest-whi and
commit cf0c59e record its self-audit; push failed; observation jotted
against the codex skill). Operator midstream correction, binding for
future reviews: adversarial reviewers run in fresh herdr panes.

**Spec validation** (refinement-only, on the post-bloat document, fresh
Codex herdr pane): eight findings, all resolved. Mechanical fixes
applied to the ADR: (1) login/logout explicitly outside the
requireMember invariant — first login is possible again; (5) POST
/api/workouts strict-empty-object schema restored to the durable
record; (6) zero-score-member-always-present guarantee preserved in
the durable test contract; (8) ADR status corrected to proposed until
this gate. Operator rulings on the other four: (2) undeclared days are
LEGAL and unpenalized — recorded as an explicit decision; (3) edit
horizon is ANY future date (FRAMING amendment — not limited to the
current week); (4) PUT /api/schedule becomes WEEK-REPLACE semantics —
omitted future day = undeclared, which is how un-declaring works; (7)
resolved at the root by a further operator amendment: **schedule edits
are allowed strictly for D > today** — today and past days are frozen,
so feed labels are stable by construction and render-time computation
is safe.

### Amendments locked at this substage (supersede earlier sections)

1. Freeze rule is **D > today** (was: D ≥ today in ARCHITECTURE; was:
   "editable until the day passes" in FRAMING). No same-day schedule
   edits, ever.
2. Edit horizon: any strictly-future date, any week.
3. PUT /api/schedule: week-replace (payload names one week's Monday +
   declarations; atomically replaces that week's strictly-future
   declarations; omitted day = undeclared; any non-strictly-future or
   outside-week date = 422 whole-reject, nothing applied).
4. No dual scoring path, no SQL-equality test (bloat shrink).
5. Undeclared days legal; missed = declared workout day + past + zero
   workout rows, unchanged.

### TEST-STRATEGY deltas (DECOMPOSITION must bake these in; the
TEST-STRATEGY section above predates the amendments)

- week.test.ts case 7: predicate becomes isEditableScheduleDate(D,
  now) = D > todayInGroupZone(now). With clock 2026-08-20T04:00:00Z:
  '2026-08-19' → false, '2026-08-20' (today) → **false**, '2026-08-21'
  → true; with clock 2026-08-20T03:59:00Z: '2026-08-20' → true (still
  strictly future at that instant).
- schedule.test.ts case 1: payload dates must be strictly future at
  the pinned clock (use 2026-08-21/2026-08-22 under the Aug-20 clock);
  semantics become week-replace — a re-PUT of the same week omitting a
  previously declared future day must DELETE that row; payload shape
  gains the week's Monday date.
- schedule.test.ts case 3 INVERTS: {date: today} → 422 (today is
  frozen), nothing written.
- schedule.test.ts case 4 (midnight pair, still UTC-bug-hunting):
  payload {date:'2026-08-21'} at clock 2026-08-21T03:59:00Z (Toronto
  Aug 20 23:59 — strictly future) → 200; identical payload at
  2026-08-21T04:00:00Z (Toronto Aug 21 00:00 — now today) → 422. At
  both instants the UTC date is already 08-21.
- schedule.test.ts: add one outside-named-week date → 422 whole-reject
  case (new week-replace boundary).
- scores.test.ts case 1: dual-path equality assertion REMOVED; keep
  the expected-value assertions through the SQL read path only
  (member1=3, member2=2, member3=0 weekly; 4/2/0 all-time) — member3's
  presence at 0 is the preserved zero-score guarantee.
- auth.test.ts: unchanged; login/logout being outside requireMember is
  now explicit in the ADR rather than implied.
- workouts.test.ts: unchanged (check-off and undo both operate on
  today; the schedule freeze does not touch them).
- Budget effect: net-zero to slightly negative (one case removed, one
  added, one inverted); estimate stays ~16 s.

### Substitutions and open questions

Producer substitutions this run: ARCHITECTURE produced inline by the
orchestrator (gaudi epic mode requires children that DECOMPOSITION has
not yet minted — jotted); RECORD review pair ran as Codex contexts
(bloat via codex exec before the operator's herdr-pane correction; spec
validation in a fresh herdr pane). Open questions: none — every
reviewer finding carries an operator disposition above.
