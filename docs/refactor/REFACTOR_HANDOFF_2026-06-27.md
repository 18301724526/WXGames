# Refactor Program — Handoff (2026-06-27)

Continuation doc for the **"align to big-company quality / kill spreading tech debt"** program.
The previous conversation got too long to keep refactoring in. Read this top-to-bottom before
touching code. Everything here is verified, not assumed.

---

## 0. Read first (cold start)

1. **`docs/project_decomposition_2026-06-27.md`** — the evidence-based decomposition of all 415
   gameplay source files (read in full, not inferred): player-feature → files, system/subsystem
   tree, "chaos" (boundary) list, exact backend fan-in. THE map. Headline claims were mechanically
   verified — but see Rule 4 below, it still **undercounts**.
2. Auto-memory (`<memory dir>/MEMORY.md` + the linked files), especially:
   `line-endings-lf.md`, `deploy-lint-gate.md`, `architecture-refactor.md`,
   `frontend-ecs-bridge-retirement.md`, `project-decomposition-completeness-rule.md`,
   `local-dev-env.md`, `github-push-https.md`, `refactor-server-push-deploy-502-fix.md`.

---

## 1. The 铁律 (non-negotiable — these ARE the standard)

1. **One source of truth per concept** (state AND logic). Everywhere else REFERENCES it. Never a
   second mutable copy.
2. **Remove/derive copies — do NOT just guard them.** A guarded copy still _looks_ like a source,
   so a future reader/AI wires new logic into it or grows it in one place (the guard stays green if
   both copies move together), and the mirror disease spreads. The guard is the LOCK against
   re-introduction, NOT a substitute for deletion. (This was the user's mid-session correction —
   apply it everywhere. We initially only guarded the ECS vocab; we then DERIVED the copies away.)
3. **Variants ≠ duplicates.** Same name + different behavior = SEPARATE, honest-named sources.
   Verify byte/behavior identity (md5 / read both) before merging. Never force-merge. Examples this
   session: `toNonNegativeInteger`, `cloneIfObject`, `nowIsoSafe`, `sanitizeText` (3 behaviors).
4. **Verify-before-trust.** The decomposition AND sub-agents UNDERCOUNT and are sometimes WRONG.
   Cross-check every claim with an independent grep/read before acting. This session: decomposition
   said blocking-panel = 5 files (really 13); said `GuideTaskCanvasRenderer` was a dead stub (really
   a live 376-line renderer); my own mojibake detector flagged 78 strings, 66 of which were
   legitimate Chinese it would have CORRUPTED — only 12 were real.
5. **Full gate, green, before every commit:** `npm test` (expect **1699** pass — P1 Cluster 2
   removed 2 fallback-pinning tests; was 1701) +
   `node scripts/run-architecture-smoke.js` (exit 0) + `npm run lint` (exit 0) +
   **`npm run format:check`** (prettier, exit 0 — run `npx prettier --write .` on anything it flags) +
   `git diff --check` (clean). The **Edit tool writes CRLF; the repo is LF** (`.gitattributes * -text`)
   — normalize every edited/new file: `sed -i 's/\r$//' <files>` or `git diff --check` fails.
   **DEPLOY-GATE TRAP (cost a multi-session stuck deploy):** the server gate
   `scripts/test-server-ci-gate.sh` runs MORE than the above — `lint` → **`format:check`** →
   `lint:baseline:check` (suppressions budget vs `main`) → `npm test` → `test:architecture`(=smoke) →
   `npm run check --prefix backend` (`node --check server.js`). It aborts BEFORE the PM2 restart on
   ANY failure, but `git push` still exits 0, so the ref lands while the server keeps serving the OLD
   commit. The local `npm test`/smoke do NOT run prettier — so a green local run can still wedge the
   deploy. Run `format:check` + the backend check locally before every push. See [[deploy-lint-gate]].
6. **Commit in clean logical units** (`git add <explicit paths>` or `git add -u`, NEVER `git add -A` —
   it sweeps untracked working files like `march-*.md` into the commit). Push ONLY when asked:
   `git push private <branch>` → auto-deploys to the refactor test server (detached). Verify it LANDED
   (not just that push exited 0): served `https://kodagame.top/wxgame-refactor/…` `?v=` flips to
   `deploy-<commit>`; deploy log `/opt/wxgame-refactor/.wxgame/push-deploy.log` (SSH root, user holds pw).
7. After deleting code, prune orphaned suppressions:
   `npx eslint . --prune-suppressions --suppressions-location eslint-suppressions.json`.

## 2. Working method that worked

- Map first with a parallel **Workflow** (read-only agents), then **cross-check the map yourself**
  with a grep, THEN execute. For a big mechanical fan-out (e.g. 13 identical files), a Workflow with
  one agent per file (disjoint files = no conflict) works well; you own the shared wiring
  (index.html, guards) + the gate.
- Frontend has **no bundler**: modules are `(function(global){ ... global.X = ... })(...)` IIFEs
  loaded via `<script>` tags in `frontend/index.html`; "import" = read a global with a
  `require()` fallback for Node tests. A frontend "single source" = one module defines + attaches to
  a global, added to the index.html manifest (before its first consumer), others reference the
  global. Load order matters (consumers destructure the global at load).
- Guards live in `scripts/check-*.js` (+ a `.test.js`), wired into
  `scripts/run-architecture-smoke.js` in THREE places: the CHECK_FILES list (~line 388), the
  TEST_FILES list (~line 590), and a `run(...)` block (~line 690). Model new guards on
  `scripts/check-source-encoding.js` or `scripts/check-frontend-blocking-panel-snapshot-calls.js`.

---

## 3. Program state (what's done)

6 commits on branch `codex/refactor-tutorial-guide-architecture`, pushed to `private` (deploying):

| commit                     | what                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `2c518b15`                 | docs: 415-file decomposition                                                                                      |
| `bd5761ab`                 | P0: helpers → shared single sources (numbers/objects/time) + fix 12 UTF8-as-GBK mojibake + strip 6 BOM + 2 guards |
| `03b4b8d0`                 | P0: remove 3 verified-dead code sites                                                                             |
| `09e64367`                 | P1: blocking-panel snapshot wrappers 13 copies → 1 source + guard                                                 |
| `953eabde`                 | P1: ECS mode-vocab drift guards (vocab-match + bundle-fresh)                                                      |
| `74811aa9`                 | P1: derive the ECS vocab copies from ModeKeys (remove, not just guard)                                            |
| `6945f143`…`01b8a119` (13) | **P1 Cluster 2 DONE** — coord/tileId fallback single-source (see §4)                                              |
| `7e32401f`…`a7ed32ce` (4)  | **P2 DONE** — tutorial-advance 3-copy single-source + guard (see §5)                                              |

**Guards added this session** (the enforcement surface — extend, never bypass):
`check-duplicate-shared-helpers` (now 8 helpers, backend), `check-source-encoding` (no BOM +
mojibake denylist), `check-frontend-blocking-panel-snapshot-calls`, `check-frontend-ecs-mode-vocab`,
`check-frontend-ecs-runtime-bundle-fresh`, **`check-duplicate-coord-helpers`** (P1 Cluster 2: bans
inline `tile_${...}` outside TileCoord/WorldMarchCoreAdapter/WorldMarchTrace),
**`check-tutorial-advance-single-source`** (P2: bans `phaseCompleted:` construction outside
`backend/services/tutorial/`). Dev tool: `scripts/scan-mojibake.ps1` (Windows GBK round-trip
mojibake detector).

**Shared single sources created:** `shared/numberUtils.js`, `shared/objectUtils.js`,
`shared/timeUtils.js`, `frontend/js/platform/CanvasBlockingPanelSnapshotCalls.js`.

---

## 4. DONE — P1 Cluster 2: coordinate / tileId fallbacks (the deferred RISKY one)

**Status: COMPLETE** (commits `6945f143`…`01b8a119`, 13 commits, gate green per commit, NOT pushed).
Outcome: the `tile_${x}_${y}` tileId format now lives in exactly **3 honest sources** —
`TileCoord.js` (world-map canonical), `WorldMarchCoreAdapter.js` (march family), `WorldMarchTrace.js`
(debug, deliberately non-floored). Down from **38 inline copies across ~33 files**. Locked by
`scripts/check-duplicate-coord-helpers.js` (strict: bans `tile_${` outside those 3).

**Corrections the verification forced on the plan below (Rule 4 in action — the §4 plan as first
written was wrong in 3 ways):**

1. **Undercount.** The "~18 sites" was really 28 delegating wrappers + facade `normalizeTileCoord` +
   `coordKey` + inline runtime/trace builders = ~33 files / 38 `tile_${}`. The decomposition's own
   headline (`TileCoord(28，且各处有 fallback 副本)`) already disagreed with the 18.
2. **`ClientOperationLog` was NOT a clean collapse — it's a LOAD-ORDER TRAP** (loads index.html:17,
   before TileCoord:24, load-time capture → `null` in browser → fallback was the LIVE path; Node
   tests stayed green = false confidence). Fixed by converting to a **call-time** `getTileCoord()`
   first, then collapsing (user-chosen option).
3. **5 "collapse onto TileCoord" targets are march-shape RESHAPE wrappers** (`{q,r,tileId}`, no x/y,
   test-pinned): VisibilityModel/EntitySnapshot/FogVisualSnapshot/ProgressSnapshot/ExplorerNormalizer.
   A bare `TileCoord.normalizeCoord` swap changes the shape and breaks tests — KEPT the wrapper,
   deleted only the dead inner fallback, routed the tileId format to the canonical.

Decisions taken (user): **strict** single-source (route every kept wrapper/facade/variant tileId
through the canonical so `tile_${}` survives in only 3 files); **ClientOperationLog** = lazy-capture
then collapse. The 2 trap tests (`TileMapGeometry.test.js`, `WorldRevealStore.test.js`) that pinned
the fallback via `require.cache` eviction were DELETED (TileCoord.test.js covers the canonical
behavior) → test baseline 1701 → **1699**.

The original plan (kept below for reference):

This is correctness-critical (coordinate math). Go slow. Apply Rule 2 (derive/remove the copies,
not just guard) and Rule 4 (verify each before touching).

**Canonical:** `frontend/js/domain/TileCoord.js` (`global.TileCoord`) — exposes `normalizeCoord`,
`normalizeDelta`, `offset`, `equals`, `readCoordAxis`, `tileId`, `toInteger`, `toLegacy`, `toNumber`.
Loaded at `index.html:24`, before every delegating consumer.

**The duplication (~24 sites):** the dominant pattern is a delegating wrapper with an INLINE
FALLBACK: `if (TileCoord?.normalizeCoord) return TileCoord.normalizeCoord(...)` then a hand-rolled
fallback copy. The active path equals TileCoord; the fallback is **dead** when TileCoord is loaded
(always, in browser via load order + in Node via each file's `global.TileCoord || require('./TileCoord')`
shim). **The fallbacks are NOT byte-identical to TileCoord** — latent divergences: (a) `??` (nullish)
where `TileCoord.readCoordAxis` uses `!== undefined` (a literal `null` x is treated as absent →
falls through to q instead of coercing to 0); (b) most return a plain object, not `Object.freeze`;
(c) none honor `options.preserveTileId`. They are dormant because the path is dead — so the fix is
"delete the dead fallback, keep the active TileCoord call", NOT "merge, they're the same".

**Delegating-wrapper sites to collapse onto TileCoord** (delete inline fallback, call TileCoord
directly; keep a one-line passthrough where called many times to minimize diff; do ONE file per
commit and run that file's `*.test.js`): `TileMapGeometry`, `WorldMarchGeometry`,
`WorldMapEntitySnapshot`, `WorldMapPickingModel`, `WorldMapInputIntent`, `WorldMapInputActionMap`,
`WorldMapSelectionResolver`, `WorldMapVisibilityModel`, `WorldMapRenderSnapshot`,
`WorldFogVisualSnapshot`, `WorldRevealStore`, `WorldMarchProgressSnapshot`,
`WorldTileMapTileNormalizer`, `WorldTileMapExplorerNormalizer`, `WorldMapRuntimeBakePolicy`,
`ClientOperationLog`, `CanvasTerritoryActionHandlers`, `WorldFogVisionModel.normalizeCoord`.
Also remove now-orphaned local `toInteger`/`toNumber`/`tileId` IF unused (grep each first — several
use `toNumber` for non-coord math; leave those).

**TRUE VARIANTS — do NOT collapse (different behavior, would break things):**

- `WorldTopology.normalizeCoord` — adds world wrapping (worldWidth/Height/wrapped fields, `options` sig).
- `WorldInterestWindow.normalizeCoord` / `createTileRect` — AOI/window semantics, `options` sig.
- `WorldMarchRoutePolicy.normalizeCoord` — delegates WorldMarchCore, returns `{q,r,tileId}` with NO x/y.
- `WorldMarchCoreAdapter` `inlineCore.normalizeCoord` — `{q,r,tileId}` only, and loads at
  `index.html:23`, ONE LINE BEFORE TileCoord:24 → it CANNOT reference `global.TileCoord` at def time.
  **Load-order trap: do not extend the cluster upward past line 24.**
- `WorldFogVisionModel.normalizeFloatCoord` — deliberately preserves FRACTIONAL coords (opposite of
  TileCoord's integer floor).

**Guard design:** new `scripts/check-duplicate-coord-helpers.js` (model on
`check-duplicate-shared-helpers.js`), scoped `SOURCE_ROOTS=['frontend/js']`,
canonical `frontend/js/domain/TileCoord.js`, forbid local `function normalizeCoord|tileId|getTileId|getCoordinateKey`,
ALLOWLIST by path the canonical + the 5 true-variant owners (TileCoord, WorldTopology,
WorldInterestWindow, WorldMarchRoutePolicy, WorldMarchCoreAdapter; the fractional fog variant has a
distinct name `normalizeFloatCoord` so it isn't matched). Exclude `*.test.js`. Wire into the smoke gate.

**Risks:** coord math is correctness-critical; the fallbacks are NOT byte-identical (safe to delete
only because dead). Before collapsing each file, grep for callers that MUTATE the returned coord
(`.x =` / `.q =`) — TileCoord returns a frozen object. `WorldRevealStore.test.js` and
`TileMapGeometry.test.js` deliberately EVICT TileCoord from `require.cache` — keep their expectations
intact. Snapshot `{x,y,q,r,tileId}` for a few coords (incl. negative + alias-q/r) before/after each
file. Bump the `?v=` cache-buster on each edited file's `<script>` tag in index.html.

---

## 5. After P1 — the rest of the roadmap (from the program plan)

**P1 + P2 done. NEXT TASK = P3 (triple-host mirror).** With P2 closed, all THREE
duplicated-logic clusters the program named (tutorial-advance, coord/tileId, blocking-panel snapshot)
are now single-source + guarded.

Each phase = remove/derive copies + a machine guard; gate-green per commit. Order by safety×leverage,
riskiest god-file surgery last:

- **P2 — tutorial cross-cut DONE** (commits `7e32401f`…`a7ed32ce`): the 3 drifted advance copies
  (`MilitaryService.advanceTutorialStep`, `WorldExplorerTutorial.advanceTutorialStep` [imported by
  WorldExplorerActions/Progression], `TaskCenterService` inline) collapsed onto the canonical
  `TutorialProgression.manualAdvance`. Verified behavior-equivalent (cumulative `createPhaseCompleted`
  makes the copies' merge == canonical replace; normalized inputs; steps ≤ completed); TaskCenterService's
  copy had a real bug (wrong phaseCompleted thresholds: era2 keyed on era3AdvanceReady not lumbermillBuilt,
  scoutFormation never set) — now authoritative. Imported the leaf `tutorial/TutorialProgression` (NOT the
  TutorialService facade) to dodge the pre-existing `TutorialService → TutorialGrantService →
FamousPersonService → … → MilitaryService` require cycle. Guard `check-tutorial-advance-single-source`
  bans `phaseCompleted:` construction outside `backend/services/tutorial/`.
  - Also deduped the tutorial SELECTOR copies (commits `0519dcd5`, `73935fcf`): `getTutorialScoutPersonId`
    (was inlined in WorldExplorerTutorial + MilitaryService) and `getFormationSnapshot` (duplicated
    getFormationMembers' find-logic) now live only in `TutorialSelectors`; the scout-grant read
    (`grants.scoutFamousPerson`) is single-source there. Backend tutorial is now fully deduped.
  - NOT done (separate slices, NOT spreading-logic debt): `TutorialActionValidator` (~300-line
    god-validator → P4 god-file surgery), `TutorialGuideUiStateCoordinator` (frontend dual-host mirror →
    folds into P3).
- **P3 — triple-host mirror** (decomposition §3.13, THE root of "fix one, break another"):
  `game` / `canvasShell` / `lastGame` → one live-state source + selectors; thin host readers; kill
  the Proxy-passthrough `host` god-object (it shows up in the fan-in as `host` / `host.ctx` /
  `host.presenter`). Highest payoff for bug-locality; do after the surface is smaller.
- **P4 — god-file surgery** (decomposition §3, ranked): `gameRoutes.js` (511 lines, all-feature
  integration point), `GameStateNormalizer`↔`GameStateService` (overlapping ownership),
  `GameStateRepository` (40-col schema synced in 3 places → single schema source),
  `CanvasGameAppCommands` (813 lines, 5 features), `GameAPI` (668 lines: transport+RPC+trace). Highest
  blast radius → do LAST with guards + tests in place.
- **P5 — world-map/march subsystem** (177 files, the largest + deepest sub-tree) — apply all the
  now-proven patterns.

**Remember:** finish "杜绝会扩散的债" (structural: mirrors, multi-source, coupling). Do NOT chase
zero-debt perfectionism on contained local imperfections — that stalls the project. Guard the
spreading kind; accept + track the contained kind.

---

## 6. Quick commands

```
npm test                                   # 1699 pass (was 1701 before P1 Cluster 2)
node scripts/run-architecture-smoke.js     # all guards, exit 0
npm run lint                               # exit 0
git diff --check                           # clean (LF)
npm run build:ecs-runtime                  # regenerate the ECS bundle after editing an ecs source
git push private codex/refactor-tutorial-guide-architecture   # deploy (only when asked)
```

Deploy verify: served `https://kodagame.top/wxgame-refactor/index.html` should reflect new `?v=`
tags; deploy log is `/opt/wxgame-refactor/.wxgame/push-deploy.log` on `47.116.32.216` (SSH).
