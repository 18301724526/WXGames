# Main Unification — Completion Report (2026-07-09)

Executor: Codex (Phases 0-5, most of 6) + supervising monitor (final Phase 6 arbitration).
Plan: `!!-EXECUTE-main-unification-plan-2026-07-09.md` (archived on `origin/codex/button-scheduler-panel-root-cause` and in the monitor archive).

## End state (verified)

- `main` = `9aab2ea0` (button-scheduler root-cause loop Slice 8b tip), `origin/main` identical.
- Full gate on merged main: `npm test` **2260 passed / 0 failed** (independently re-run by the monitor), `npm run lint` pass, `git diff --check` pass.
- Local branches: **`main` only.** Local worktrees: main repo only (a transient empty locked dir under `.claude/worktrees/` may linger until its holding process exits).
- No pushes to `private`/`local` deploy remotes; deployment remains an owner decision.

## What main now contains

1. Everything from `codex/pvpve-systems` (fast-forward, 473 commits incl. docs finalize).
2. `codex/battle-core-test-server`'s 10 unique commits via merge `3bc2aa9b` (world-march passability single source M1, auth constant-time compare, schema-migration lock recovery); 11 conflicts resolved faithfully (axis-aligned + passability semantics merged; the older coast-clamp had already been superseded within that branch).
3. Button-scheduler → panel refactor, re-implemented on the true base as Slices 0-8b (`531be022`..`9aab2ea0`): descriptor registry, runner + context adapter (flush-before-after-hooks order locked by test), modal stage scheduler, rich panel registry entries, dispatcher-first routing with context-aware `canHandle`, open-set modal projection, **named hit-target pools replacing `baseHitTargetsByPanel` + `syncOpenPanelSurfacesAfterBaseRender` (retired behind §6.10 gates with counters + retirement guard test)**, Slice 8a equivalence report, 8b compatibility retirement.

## Phase 6 arbitration (the two blocked deletion gates)

- `claude/nostalgic-curran-8a2b47`: dirty worktree held **real unfinished session work** (13 files, +163/−81: battle/skill-gen/presenters/tutorial). Preserved as snapshot commit `395b18c5`, pushed to **`origin/claude/nostalgic-curran-8a2b47`**, then worktree and local branch removed. Nothing lost.
- `codex/button-scheduler-panel-root-cause`: its unique commit `5f6894b1` is the wrong-base construction snapshot (reference implementation; intentionally never merged). Already backed up on **`origin/codex/button-scheduler-panel-root-cause`**; worktree dirt was only the monitor's own plan-doc edit (docs archived to the monitor directory). Worktree and local branch removed.

## Remaining archive branches on origin (owner may delete anytime)

- `origin/claude/nostalgic-curran-8a2b47` — unfinished session WIP snapshot (review or discard later).
- `origin/codex/button-scheduler-panel-root-cause` — wrong-base construction snapshot + that night's spec/receipt docs (audit trail).

Delete with: `git push origin --delete <branch>` when no longer wanted.

## Also landed in this commit

- `docs/design/resource-node/` — the resource-node feature design pipeline output (brief → draft → three model reviews → arbitration → v2 → spec cover `04-spec-draft.md`). Implementation is gated per the spec cover's three gates; upstream gate A (button-scheduler on main) is now satisfied.
- `EXECUTION-BLOCKER-REPORT.md` retained with resolution appended, as the Phase 5/6 audit record.

## Follow-ups (not part of this unification)

- Root cause A of the panel-overlay debt (tutorial highlight painted under panelOverlay — visual layer order) remains open; B is root-fixed (pools), C likely fixed by open-set projection (verify on device).
- Real-device pass over famous panel + tutorial chain is still the one-shot final acceptance for the refactor.
- Deploy of unified main to test servers when the owner chooses.
