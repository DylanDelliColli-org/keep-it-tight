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
