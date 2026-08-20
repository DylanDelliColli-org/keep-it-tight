```doc-meta
role: contract
lifecycle: active
```

# Agents

You are in the **contest** repository: a workout-and-meal logging
competition app for the operator and 1–2 friends. One page; the links are
the authority.

## Orientation

- **`NORTH-STAR.md`** is the standard every proposal is judged against.
  Read it before proposing anything — its non-goals and test-values ranking
  are binding. End-to-end and browser suites are deliberately not run here.
- **Work state lives in `br`.** There is no other tracker and no TODO
  lists. This store mints **`contest-*`** ids. Never point this repo's `br`
  at any other store, or the reverse.
- Planning runs through the ABACUS flow:
  `~/dev-environment/abacus/.claude/skills/abacus-plan/SKILL.md`.

## Working a bead

```sh
br ready                      # what is available
br show <id>                  # your full scope — the description is the spec
br update <id> --claim        # claim before you start
br close <id>                 # only after the work is verified
```

Never use `br edit` (opens an editor and hangs you). Update fields with
`br update <id> --description "..."` / `--notes "..."`.

## Tracker merge driver

`.gitattributes` assigns `.beads/issues.jsonl` to the `beads-jsonl` merge
driver. Merge-driver configuration is local to each clone; configure it
after cloning (with `abacus` on `PATH`):

```sh
git config merge.beads-jsonl.driver 'abacus merge-jsonl %A %O %B'
```

## Worktrees

`br` on this machine resolves through `~/.local/shims/br` (the abacus
`br-shim`), which binds commands run in linked worktrees to the main
checkout's `.beads` store. On a machine without the shim, bind inline:

```sh
BEADS_DIR=<main-checkout>/.beads br <arguments>
```
