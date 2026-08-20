```doc-meta
role: contract
lifecycle: active
```

# CONTEST — North Star

Established 2026-08-20 by operator interview (`/north-star`, establish mode).
Amendments happen only through revise mode, never as a consequence of an
inconvenient check. The amendment log is at the end of this document.

This document states the goal. It is not a design; binding technical
decisions live wherever this repository later records them, and this file
cites rather than restates them.

## Thesis

Contest makes workouts and eating well visible to a small group of friends
so that points, a shared scoreboard, and the resulting trash-talk create the
accountability to keep going. Members log workout sessions and meal photos,
earn points, and compete against each other. The competition is the
mechanism; accountability is the product.

## Beneficiary

The operator and 1–2 friends, personally. The value they receive is
sustained motivation — the points make a skipped session visible — plus the
social fun of ribbing each other over the leaderboard. A durable fitness
history is explicitly not the value and never justifies work on its own.

## Success condition

All three participants use the app at least 4 days per week, observable
directly from the logging data, without being reminded to.

## Non-goals

Scoped to this thesis. Each may be revisited through revise mode — an
explicit operator act; none is admissible as "future-facing" work while it
stands here.

1. **Public signups or multi-tenancy.** It is these three people, not a
   product for strangers.
2. **Workout programming or coaching.** The app logs what happened; it never
   tells anyone what to do.
3. **Nutrition analysis.** Meal photos earn points; there is no calorie,
   macro, or ingredient tracking.
4. **Wearable or fitness-app integrations** — Strava, Apple Health,
   MyFitnessPal, or any successor.
5. **Native mobile apps.** A web app opened on a phone is the delivery
   surface.

## Kill criteria

Nobody is using the app one month after launch. Usage at zero means the
accountability loop failed; the response is to stop or pivot, not to add
features to re-attract users.

## Test values

The classes of test this repository runs, ranked by value. Values and ranks
only — binding numeric caps live in planning documents that cite this
ranking. The operator's global contract requires unit and integration
coverage on every code change; this ranking orders them, it does not repeat
that rule.

| class | rank | why it earns the rank here | cost class |
|---|---|---|---|
| integration (real DB, real HTTP routes) | 1 | at this scale nearly every real defect lives in the composition, not the units | effectively-free |
| unit (pure logic: scoring, streaks) | 2 | fast, precise coverage of the points rules — the one part with real logic | effectively-free |

End-to-end and smoke tests are deliberately not run in this repository
(operator ruling, 2026-08-20): with three known users on one surface, manual
use covers what a browser suite would, at none of its cost.

## Amendment log

- none
