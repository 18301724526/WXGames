# EXECUTE: Main Unification + Button-Scheduler Rebase Plan

Status: **ACTIVE ORDER — approved by the project owner, 2026-07-09.**
Supersedes: `!!!-STOP-READ-FIRST-branch-base-mismatch.md` (the base-mismatch dispute is
resolved by owner decision: unify everything into `main`).
Executor: Codex (main driver). Authority order: this document > refactor spec > coordination rules.
The refactor spec remains the architecture contract for Phase 4.

Owner's end-state requirement, verbatim intent:
1. Everything merges into a single `main`.
2. All redundant branches are deleted afterward.

## Verified facts this plan is built on (2026-07-09, do not re-derive, but re-verify before destructive steps)

- `main` (96ea25b5) is a **strict ancestor** of `codex/pvpve-systems` (38dbaab6):
  `git rev-list --count codex/pvpve-systems..main` = 0. The "merge" is a fast-forward.
- `codex/pvpve-systems` is 2 commits ahead of `origin/codex/pvpve-systems`.
- Every local branch is fully contained in `codex/pvpve-systems` EXCEPT
  `codex/battle-core-test-server`, which has **10 unique commits** (world-march
  passability single-source M1, ocean-block fixes, auth constant-time compare,
  schema-migration lock recovery — `shared/worldMarchPassability.js` etc., 28 files).
  This content does NOT exist on pvpve and the owner wants it in `main`.
- Your button-scheduler work (36 entries) is **entirely uncommitted** in this worktree;
  its branch has 0 unique commits. Committing it is the first preservation step.
- Main repo working tree (`F:\AI Project\WXGamesLocal`, on `codex/pvpve-systems`) is
  dirty: deleted docs (PROGRESS.md, march manuals, health report), modified refactor
  spec, two untracked spec docs. These must be committed before any branch switching.

## Hard rules (apply to every phase)

- NEVER force-push. NEVER rewrite history of `main`.
- The `main` update in Phase 1 must be `--ff-only` / local-push fast-forward. If it is
  not a clean fast-forward, STOP and write a blocker report (see Reporting).
- Do NOT push to the `private` or `local` remotes in any phase — those trigger
  auto-deploys. Only `origin` (GitHub over HTTPS). Deploy is a separate owner decision.
- Repo line endings are LF (`.gitattributes * -text`). Keep every file you touch LF.
- Run `npm run lint` before declaring any phase with code changes complete (stale
  eslint suppressions abort deploys in this repo).
- If any verification gate fails, STOP that phase and write
  `docs/architecture/EXECUTION-BLOCKER-REPORT.md` with the failing command output.
  Do not improvise around a failed gate.

## Phase 0 — Preserve everything (no deletions in this phase)

In `F:\AI Project\WXGamesLocal` (on `codex/pvpve-systems`):

1. Commit the dirty working tree as-is (docs cleanup + spec updates), e.g.
   `docs: finalize panel refactor specs + retire stale progress docs`.
2. `git push origin codex/pvpve-systems` (backs up the 2+1 commits).

In `F:\AI Project\WXGamesLocal-button-scheduler-root-cause` (this worktree):

3. Commit ALL current work on `codex/button-scheduler-panel-root-cause` (one commit is
   acceptable; message must say it is a wrong-base construction snapshot kept as a
   reference implementation, e.g.
   `wip(panel-refactor): main-base construction snapshot — reference for mainline port`).
   Include `docs/architecture/` (specs, baseline doc, this file, the STOP doc — they are
   part of the record).
4. `git push origin codex/button-scheduler-panel-root-cause` (backup).

Gate: `git status --porcelain` is empty in BOTH working trees.

## Phase 1 — Fast-forward `main` to pvpve content

From `F:\AI Project\WXGamesLocal`:

1. `git push . codex/pvpve-systems:main`
   (local ref push; fails unless fast-forward — that failure means STOP + blocker report).
2. Verify: `git rev-list --count codex/pvpve-systems..main` = 0 AND
   `git rev-list --count main..codex/pvpve-systems` = 0.
3. `git push origin main`.

## Phase 2 — Merge the battle branch's unique work into `main`

From `F:\AI Project\WXGamesLocal`:

1. `git checkout main` (tree is clean after Phase 0).
2. `git merge codex/battle-core-test-server`
   (a real merge; 28 files, march-adjacent — conflicts with pvpve's march spine work are
   possible).
   Conflict policy: the passability single-source (`shared/worldMarchPassability.js`,
   `worldMarchCore` UMD change, architecture gates) is the newer standard — keep it;
   preserve pvpve-side march spine / ETA / spine-rendering features. If more than ~20
   files conflict or any resolution is semantically uncertain, abort the merge
   (`git merge --abort`), STOP, blocker report.
3. Gate: `npm run lint` passes; `node --test shared/` passes; run the march/battle
   focused backend tests (`node --test backend/tests/` march & battle files); full
   `npm test` frontend green (backend tests requiring `better-sqlite3` need root
   `node_modules` — run them from this main repo, which has it).
4. `git push origin main`.

## Phase 3 — Re-freeze Slice 0 on the TRUE base

Create the mainline work branch from the new `main`:

1. `git checkout -b codex/button-scheduler-panel-mainline main`
   (work in the main repo checkout, or re-point this worktree — your choice; keep ONE
   active construction site).
2. Re-run Slice 0 per spec §7 against this base. The famous panel reference path now
   ACTUALLY EXISTS (`CanvasPanelSurfaceManager.js`, `panels/FamousPersonsPanel.js`,
   `baseHitTargetsByPanel`, `syncOpenPanelSurfacesAfterBaseRender`, tutorial open gate).
   Overwrite `button-scheduler-manager-panel-slice0-baseline-2026-07-09.md` with the new
   baseline (focus command results, behavior locks, callback orders — including what the
   REAL seek/accept/dismiss/assign do to `famousPersonsPage`; that is now the
   equivalence truth, not the old-main behavior you characterized before).

## Phase 4 — Port the refactor onto the true base (spec Slices 1–8b)

Use your wrong-base snapshot commit as the construction map. Port rules:

**Carry over nearly as-is** (adapt requires/paths only):
- `CanvasPanelActionRegistry.js`, `CanvasPanelActionRunner.js`,
  `CanvasPanelActionContextAdapter.js`, `CanvasStageScheduler.js` + their tests
  (the §6.11 quartet — signatures already conform; keep the fixed hook order:
  lifecycle → flush dirty → after-hooks, and its order-lock test).
- `CanvasSurfaceRenderer` hit-target pool implementation + pool tests, including the
  `blocksBaseHitTargets`-aware outside-click background logic (your click-through fix).
- `CanvasPanelCompatibilityRetirement.test.js` (retirement guard).

**Discard from the snapshot** (the true base already has the real thing):
- All `CanvasLayerRegistry.js` changes — pvpve's registry already has `panelOverlay`
  in an 8-layer `PHYSICAL_LAYER_ORDER`. Do not re-add or reorder anything.
- Your green-field `CanvasPanelSurfaceManager.js`, `panels/CanvasPanelRegistry.js`,
  `panels/FamousPersonsPanel.js` — the real implementations exist here. Instead, GRAFT:
  add `projectModalLayer()` + projection-owned outside-click to the REAL manager,
  upgrade the REAL registry entry to the §6.2 rich shape, keep the REAL panel's
  behavior (its close sweep, tooltip clearing, tutorial gate) as the equivalence truth.
- Your `CanvasFamousActionHandlers.js` rewrite — redo the wrapper/retirement moves
  against this base's actual controller/handler layout.

**Redo against this base's file versions** (they differ from old main):
- `CanvasActionDispatchRegistry` descriptor branch + famous `RENDER_ACTIONS` removal
  (they exist here per spec §4.2), dispatcher-first InputRouter switches (keep the
  `canHandle()` fallback boundary — it was correct), RenderingRuntime changes,
  App/Shell commands, `index.html` / `minigame/game.js` load order.
- Slice 7 completion on the real base: pools replace `baseHitTargetsByPanel` and
  `syncOpenPanelSurfacesAfterBaseRender` — DELETE both only behind the spec §6.10 gates
  (focused tests: base rebuild cannot erase modal targets; counter stays zero). Route
  tutorial/guide targets into the `guide` pool with resolver order guide → modal → base.

**Mandatory fixes folded into this port** (from the monitoring review, all verified):
1. **Silent reopen (ISSUE-009)**: after seek/accept/dismiss/assign success, reopening
   the famous panel must NOT fire `tutorialOnOpened`/`tutorialOnDetailOpened`.
   Spec §6.6 side-effect column: seek fires ONLY `onFamousPersonSought`;
   accept/dismiss/assign fire none. Implement via a trusted options argument to
   `runner.run(action, context, options)` (e.g. `options.suppressAfterHooks`,
   `options.bypassOpenVeto`) — NOT via fields on the action object, so renderer-emitted
   actions can never carry bypass flags. Match the Slice 0 (Phase 3) truth for
   `famousPersonsPage` retention on each command.
2. **§6.10 observability counters** — all five, test/dev-only, BEFORE any retirement
   commit: `panelSurface.syncAfterBaseRender.count`, `panelSurface.baseHitTargetsSnapshot.count`,
   `panelAction.controllerWrapper.count`, `panelAction.dispatcherFallback.count`,
   `panelSurface.refreshAlias.count`.
3. **§6.11 controller binding**: `CanvasActionController.prototype.getPanelActionContext()`
   must exist and be what wrappers use while they live.
4. Generic `projectModalLayer()` must not hardcode famous fields
   (`famousPersonsPage`/`selectedFamousPersonId`) — panel render options come from the
   entry/panel, not the manager.
5. Band ordering: explicit rank map (`panel` < `dialog` paints later), not
   `localeCompare`.
6. Scheduler `flush('modal')` must be fail-closed: a missing manager or a `false`
   projection is a recorded failure, not `handled=true`; dirty flags clear only after
   success or recorded failure (§6.9).
7. No blanket "re-project modal after every base render" repair layer (you already
   removed yours — do not reintroduce it on this base; async/state writers flush modal
   explicitly per §6.4).

**Process requirements**: one commit per spec slice (1, 2, 3, 4, 5, 6, 7, 8a, 8b),
focused tests green before the next slice's code, per coordination rules §5.
Slice 8a = the full §8 equivalence run against the Phase 3 baseline. Slice 8b =
retirement (guard test + counters zero).

## Phase 5 — Merge to `main`

1. On the work branch: full `npm test` (frontend AND backend from the main repo root)
   + `npm run lint` green.
2. `git checkout main && git merge codex/button-scheduler-panel-mainline`
   (fast-forward or merge commit both acceptable).
3. `git push origin main`.

## Phase 6 — Branch and worktree cleanup (only after Phase 5 is pushed)

Re-verify before EVERY deletion: `git rev-list --count main..<branch>` must be 0.
If it is not 0 for a branch listed below, do not delete it — blocker report.

1. Remove worktrees first (from `F:\AI Project\WXGamesLocal`):
   `git worktree remove .claude/worktrees/brave-chaum-5ac2ae`,
   `.claude/worktrees/intelligent-mcnulty-36632b`,
   `.claude/worktrees/lucid-lumiere-2a86d5`,
   `.claude/worktrees/nostalgic-curran-8a2b47`, and
   `git worktree remove "F:/AI Project/WXGamesLocal-button-scheduler-root-cause"`
   (use `--force` only if the tree is clean but locked). Then `git worktree prune`.
   NOTE: if you are running INSIDE the button-scheduler worktree, relocate to the main
   repo before removing it.
2. Delete local branches (all verified 0-unique vs pvpve at plan time):
   `claude/brave-chaum-5ac2ae`, `claude/busy-euclid-2e6198`,
   `claude/compassionate-shirley-69ed4d`, `claude/cool-almeida-db88c6`,
   `claude/intelligent-mcnulty-36632b`, `claude/interesting-albattani-f4c3ec`,
   `claude/lucid-lumiere-2a86d5`, `claude/nostalgic-curran-8a2b47`,
   `codex-battle`, `codex/design-march-eta`, `codex/refactor-tutorial-guide-architecture`,
   and — after confirming containment in main — `codex/battle-core-test-server`,
   `codex/pvpve-systems`, `codex/button-scheduler-panel-root-cause`,
   `codex/button-scheduler-panel-mainline`.
   Use `git branch -d` (not `-D`); `-d` refusing = containment check failed = stop.
3. Delete the same branches on `origin` where they exist (`git branch -r` to check;
   `git push origin --delete <branch>`). Do NOT delete anything on `private`/`local`
   remotes — deploy remotes are the owner's to manage.
4. End state check: `git branch` lists `main` only; `git worktree list` shows the main
   repo only; `git status` clean; `origin/main` == `main`.

## Reporting

Write `docs/architecture/main-unification-completion-report-2026-07-09.md` containing:
per-phase receipts (coordination rules §8 format), merge conflict resolutions made in
Phase 2, the Slice 0 v2 baseline summary, the §8 equivalence results (8a), final test
totals, the final branch list, and anything skipped or deferred with reasons.
If blocked at any point, `EXECUTION-BLOCKER-REPORT.md` instead — a clean stop with a
good report is success; improvisation past a failed gate is not.
