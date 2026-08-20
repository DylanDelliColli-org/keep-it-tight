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
