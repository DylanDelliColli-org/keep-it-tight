```doc-meta
role: contract
lifecycle: active
```

# ADR 0001: keep-it-tight architecture and scoring contract

- **Status:** accepted 2026-08-20 at the RECORD gate of the
  contest-wrp Full planning run (contest-wrp is the planning epic for
  the whole app), after the bloat-review/spec-validation pair; every
  substage carries an operator gate approval of this date.
- **Deciders:** operator (all rulings), orchestrator session (record),
  sherlock-type producer (research), columbo-type producer (test
  contract).
- **Authority:** `NORTH-STAR.md` (thesis, non-goals, test values);
  FRAMING/RESEARCH/ARCHITECTURE/TEST-STRATEGY sections of
  `PLANNING-contest-wrp.md` as gated 2026-08-20 (file deleted at
  handoff; git history is the archive).

## Context

Three friends log workouts and meal photos for points on a shared
leaderboard; the competition mechanism exists to create accountability
(the north star's thesis). The repository is greenfield. The operator
ruled contest off the shared Supabase instance onto a free stack — a
one-off exception to the machine-wide central-migrations rule, recorded
here so nobody "fixes" the exception later.

## Decisions

### Product contract (operator rulings, including two FRAMING amendments)

1. **The schedule is the accountability surface, not the scoring
   input.** Members declare workout/rest days per date. A declared
   workout day in the past with no workout logged renders as
   **missed** — display only, never a points penalty. **Undeclared
   days are legal and unpenalized** (operator ruling at the RECORD
   gate): a day with no declaration can never show as missed; the
   empty or partial schedule is itself visible, and social pressure —
   not a completeness rule — covers it.
2. **Scoring is flat: every workout logged = 1 point.** No rest-day
   bonus (FRAMING amendment: the original bonus ruling was reversed at
   the ARCHITECTURE gate). Multiple workouts per day each earn credit
   (second amendment: two-a-days rewarded; no per-day cap). Weekly
   winner = most points in the ISO week; all-time = cumulative; ties
   display as ties. Meal photos earn zero points — feed flex only.
3. **Schedule days freeze when they begin.** A schedule day D is
   editable iff **D > today** in the group zone at the moment the
   server processes the edit — today and all past days are frozen
   (operator ruling at the RECORD gate, superseding both FRAMING's
   "editable until the day passes" and the earlier D ≥ today rule).
   No retroactive rest days, and no same-day relabeling either: what
   today is was decided before today started. Any future date may be
   declared or edited (second FRAMING amendment: the horizon is not
   limited to the current week — set up next week on Sunday night).
   Check-offs are unaffected (workouts always log for today); workout
   undo is own-workouts, same-day only.
4. **One clock rules everything: America/Toronto,** on the server.
   Weeks start Monday 00:00 group-zone time. Clients never send
   "today". DST follows the named IANA zone's wall clock.
5. **Honor system.** No workout proof, no in-app banter surface
   (scoreboard and feed only), no signup path — exactly three
   pre-provisioned accounts.

### Technical contract

6. **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4,
   vitest 4, zod — the house pattern evidenced in the operator's twine
   and qbrs projects. Deployed on Vercel under the **operator's
   personal Hobby scope** (keeps Vercel Blob and bandwidth inside free
   allotments; the Pro team org would bill Blob from the first byte).
7. **Data:** Neon Postgres (free plan) via the Vercel marketplace
   integration; drizzle ORM with in-repo migrations; lazy `getDb()`;
   **one driver everywhere** (`drizzle-orm/node-postgres` over `pg`) so
   production and tests share the identical query path — Neon's pooled
   TCP URL in prod, dockerized Postgres 17 locally.
8. **Schema:** `members` (exactly three rows, seeded by script;
   bcrypt password hashes), `schedule_days` (PK member_id+date; a row
   is an explicit declaration, absence = undeclared), `workouts` (one
   row = one point; deliberately **no** unique constraint on
   member+date), `meal_photos` (post-wedge). No sessions table.
9. **Auth: self-auth.** Sealed HttpOnly SameSite=Lax session cookie
   (iron-session pattern) + bcrypt. Middleware redirects pages;
   **every authenticated application-data mutation independently
   enforces `requireMember()`** — the handler check is the contract,
   middleware is convenience. Two handlers sit outside that invariant
   by definition: `POST /api/login` is reachable without a session
   (credentials in, cookie out), and `POST /api/logout` clears the
   cookie without requiring a valid one.
   Chosen over Clerk to keep integration tests hermetic (no remote API
   in the auth path) at three users. Known limitation, accepted at
   this threat model: sealed stateless cookies cannot be revoked
   server-side before expiry.
10. **API seam:** all mutations are zod-validated route handlers.
    `PUT /api/schedule` uses **week-replace semantics** (operator
    ruling at the RECORD gate): the payload names one week (its
    Monday date) plus that week's declarations, and the server
    atomically replaces ALL of the member's declarations for the
    strictly-future days of that week — an omitted future day becomes
    undeclared (this is how un-declaring works). Any payload date
    that is not strictly future, or falls outside the named week, is
    a 422 whole-request reject with nothing applied.
    `POST /api/workouts` — body schema is a **strict empty object**,
    so a client-supplied date is a 400 and "today" is always
    server-computed. `DELETE /api/workouts/:id` (undo), `POST
    /api/login`, `POST /api/logout`, and post-wedge `POST /api/meals`
    complete the surface. Reads go through shared query functions
    used by server components. Feed labels ("extra workout" vs
    check-off) are computed at render time from current schedule
    state — stable by construction, since neither today nor past
    days can change. Status codes: 400 shape-invalid (strict zod),
    422 semantic rejection (freeze violations, whole-request atomic
    reject), 404 for another member's workout (no existence leak),
    403 for own non-today undo.
11. **Single-owner modules for the two dispute-prone constants:**
    `src/lib/week.ts` owns time semantics (pure, injected clock; SQL
    receives computed date ranges, never re-derives zone logic);
    `src/lib/scoring.ts` owns `POINTS_PER_WORKOUT` and the missedDays
    rule (pure, unit-tested). Score totals are computed directly in
    SQL by the read queries — with flat 1-point counting there is no
    second scoring implementation and no parity assertion (bloat-review
    shrink, operator-accepted 2026-08-20; the pre-shrink dual-path
    design is in git history if scoring ever grows real arithmetic).
12. **Consistency:** one Postgres, strong consistency, no caches.
    Neon scale-to-zero cold starts (~hundreds of ms after idle) are
    expected behavior. Photos (post-wedge): client-side canvas
    compression to JPEG (~1600 px, q≈0.8; never list `image/heic` in
    accept), server-side `@vercel/blob` `put()` with public access +
    random unguessable pathname.

### Test contract

13. Layers per the north star: integration rank 1, unit rank 2, **no
    e2e/smoke**. Full-suite wall-clock budget 30 s; the gated wedge
    suite is ~44 cases estimated at ~16 s (the dual-path scoring
    equality case was removed with the decision-11 shrink; the score
    read seam is still integration-covered by expected-value
    assertions against seeded rows). Integration tests import route
    handlers and invoke them with real `Request` objects against local
    Postgres; time is pinned via fake `Date` only; the one permitted
    fake is the Blob client (remote billed service). Preserved
    guarantees the suite must keep asserting: a member with zero
    workouts appears on every leaderboard read with score 0, never
    absent (invisibility of a skipped week is the product failure the
    app exists to prevent). Two mechanical negative-space guards: no
    signup path may exist under `src/app`, and the members table may
    never grow during the suite.

## Consequences

- The wedge (identify, schedule, check-off, weekly leaderboard) ships
  first; photos, feed, and the all-time tally land after it proves out.
- Every scoring question has exactly one answer derivable from the
  database plus this document — by design, arguments at the
  leaderboard get settled by pointing here.
- The free stack is fully self-contained in this repository: no shared
  migration directory, no shared instance, nothing another project can
  break or be broken by.
- Reversal costs are low and stated: Blob access posture (public →
  private) is one flag plus a serving route; the group timezone is one
  constant before launch; point values are one constant in one module.

## Alternatives rejected

- **Supabase (shared instance or dedicated project):** operator ruling
  at the RESEARCH gate — free stack instead; also removed the
  PostgREST global schema-list foot-gun and instance-global auth
  constraints from contest's blast radius entirely.
- **Clerk auth:** free at this scale but puts a remote API inside
  every integration test's auth path; restricted-signup plan gating
  unverified.
- **Magic links:** Supabase-era finding, moot after the pivot, but the
  general lesson stands — email round-trips are the wrong friction for
  three known phones.
- **Completion-percentage or bonus-weighted scoring:** operator ruled
  raw volume; flat 1-point scoring also eliminated the never-schedule
  bonus exploit identified at the ARCHITECTURE gate.
- **Per-user timezones:** a dispute generator by construction in a
  trash-talk app; one named zone, one server clock instead.
