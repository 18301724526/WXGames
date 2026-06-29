# Frontend ECS Migration Progress - 2026-06-25

## Current Status

| Field                  | Value                                        |
| ---------------------- | -------------------------------------------- |
| Branch                 | `codex/refactor-tutorial-guide-architecture` |
| Current batch          | `8. Bridge Retirement`                       |
| Batch state            | `8F Ready for Migration Owner Review`        |
| Runtime code migration | TargetPicker mirror removed; snapshot-owned  |
| ECS dependency         | `bitecs@0.4.0` installed exactly             |
| Last updated           | `2026-06-27 01:09:27 +08:00`                 |

## Batch 0A Checklist

| Step                                          | Status    | Completed At                 | Evidence                                                                                                                                                                                                            |
| --------------------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0A-1. Produce mode boolean inventory          | Completed | `2026-06-25 13:14:11 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md`                                                                                                                                       |
| 0A-2. Produce bridge inventory                | Completed | `2026-06-25 13:14:11 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0a-bridge-shrink-baseline.md`                                                                                                                                        |
| 0A-3. Deploy mode ownership report-only guard | Completed | `2026-06-25 13:14:11 +08:00` | `scripts/report-frontend-ecs-mode-ownership.js`                                                                                                                                                                     |
| 0A-4. Deploy bridge shrink report-only guard  | Completed | `2026-06-25 13:14:11 +08:00` | `scripts/report-frontend-ecs-bridge-shrink.js`                                                                                                                                                                      |
| 0A-5. Migration owner review                  | Completed | `2026-06-25 14:01:38 +08:00` | `codex/external-review` approved the 0A baseline for completion                                                                                                                                                     |
| 0A-6. Update progress document                | Completed | `2026-06-25 14:01:38 +08:00` | This file records 0A as completed after review                                                                                                                                                                      |
| 0A-7. Update operating plan                   | Completed | `2026-06-25 14:01:38 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md` records 0A as completed                                                                                                                 |
| 0A-8. Commit and server branch push           | Completed | `2026-06-25 14:53:09 +08:00` | Completion, deploy-gate formatting, and deploy evidence commits were pushed to `origin/codex/refactor-tutorial-guide-architecture`; refactor test server deployed commit `8ebedeb48d7ea3220ee35233f084a24e3a270761` |

## Report-Only Guard Baseline

| Guard                    | Files Scanned |             Findings / Candidates | Blocking?       | Command                                                            |
| ------------------------ | ------------: | --------------------------------: | --------------- | ------------------------------------------------------------------ |
| Mode ownership guard     |           213 |          960 findings, 25 symbols | No, report-only | `node scripts/report-frontend-ecs-mode-ownership.js --summary`     |
| Bridge shrink guard      |           213 | 39 candidates, 1911 branch tokens | No, report-only | `node scripts/report-frontend-ecs-bridge-shrink.js --summary`      |
| Renderer authority guard |            97 |                      315 findings | No, report-only | `node scripts/report-frontend-ecs-renderer-authority.js --summary` |
| Input branch guard       |            14 |                      203 findings | No, report-only | `node scripts/report-frontend-ecs-input-branch.js --summary`       |
| Literal duplicate guard  |           213 |                    10417 findings | No, report-only | `node scripts/report-frontend-ecs-literal-duplicate.js --summary`  |
| ECS core guard           |           218 |                      0 violations | Yes, blocking   | `node scripts/check-frontend-ecs-core-guard.js`                    |
| ECS boundary guard       |           222 |                      0 violations | Yes, blocking   | `node scripts/check-frontend-ecs-boundary-skeleton.js`             |
| ECS mode spine guard     |           222 |                      0 violations | Yes, blocking   | `node scripts/check-frontend-ecs-mode-ownership-spine.js`          |

## Batch 0B Checklist

| Step                                 | Status    | Updated At                   | Evidence                                                                                                                                       |
| ------------------------------------ | --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0B-1. Renderer authority report      | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0b-renderer-authority-baseline.md`                                                              |
| 0B-2. Input branch report            | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0b-input-branch-baseline.md`                                                                    |
| 0B-3. Literal / duplicate report     | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-0b-literal-duplicate-baseline.md`                                                               |
| 0B-4. Guard tests                    | Completed | `2026-06-25 16:43:55 +08:00` | New `node:test` coverage for renderer authority, input branch, and literal duplicate guards                                                    |
| 0B-5. Architecture smoke integration | Completed | `2026-06-25 16:43:55 +08:00` | `scripts/run-architecture-smoke.js` runs all 0A and 0B report-only guards with `--summary`                                                     |
| 0B-6. Progress document update       | Completed | `2026-06-25 16:43:55 +08:00` | This document records 0B commands, artifacts, status, and migration owner review completion                                                    |
| 0B-7. Operating plan update          | Completed | `2026-06-25 16:43:55 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md` records 0B completed                                               |
| 0B-8. Commit and push                | Completed | `2026-06-25 16:43:55 +08:00` | Commit `b3454765` reached the server branch; refactor test server deploy was manually completed with the same wrapper after push-side HTTP 504 |

## Batch 1 Checklist

| Step                                | Status    | Updated At                   | Evidence                                                                                                                                       |
| ----------------------------------- | --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-1. ECS core ADR                   | Completed | `2026-06-25 18:33:08 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-batch-1-core-adr.md` selects `bitecs` and records Batch 1 non-goals                             |
| 1-2. ECS core blocking guard        | Completed | `2026-06-25 18:33:08 +08:00` | `scripts/check-frontend-ecs-core-guard.js` blocks local ECS core primitives and non-`bitecs` ECS packages                                      |
| 1-3. Guard tests                    | Completed | `2026-06-25 18:33:08 +08:00` | `scripts/check-frontend-ecs-core-guard.test.js` covers scan scope, allowed imports, blocked local core patterns, and CLI behavior              |
| 1-4. Architecture smoke integration | Completed | `2026-06-25 18:33:08 +08:00` | `scripts/run-architecture-smoke.js` runs the ECS core guard as a blocking gate                                                                 |
| 1-5. Progress document update       | Completed | `2026-06-25 18:33:08 +08:00` | This document records Batch 1 artifacts, commands, status, and review blocker                                                                  |
| 1-6. Commit and server branch push  | Completed | `2026-06-25 18:33:08 +08:00` | Commit `22bf9106` reached the server branch; refactor test server deploy was manually completed with the same wrapper after push-side HTTP 504 |
| 1-7. Migration owner review         | Completed | `2026-06-25 18:33:08 +08:00` | `codex/external-review` approved Batch 1 for completion                                                                                        |

## Batch 2 Checklist

| Step                                | Status    | Updated At                   | Evidence                                                                                                                                              |
| ----------------------------------- | --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2-1. Exact ECS dependency pin       | Completed | `2026-06-25 20:16:29 +08:00` | `package.json` and `package-lock.json` pin `bitecs` to exact version `0.4.0`; `npm ls bitecs` resolves `bitecs@0.4.0`                                 |
| 2-2. ECS core boundary skeleton     | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/core/EcsCoreBoundary.js` is the only production boundary touching `bitecs`; it forwards approved primitives without local core logic |
| 2-3. ECS manifest skeleton          | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/registry/EcsBoundaryManifest.js` declares owner roles, component families, mode keys, snapshot keys, and bridge lifecycle policy     |
| 2-4. Boundary documentation         | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/README.md` states Batch 2 is a Node/CommonJS architecture boundary and is not loaded by H5 or minigame entrypoints                   |
| 2-5. Boundary blocking guard        | Completed | `2026-06-25 20:16:29 +08:00` | `scripts/check-frontend-ecs-boundary-skeleton.js` blocks direct `bitecs` imports outside the boundary, ECS reverse dependencies, and runtime loading  |
| 2-6. Guard and skeleton tests       | Completed | `2026-06-25 20:16:29 +08:00` | `frontend/js/ecs/**/*.test.js` and `scripts/check-frontend-ecs-boundary-skeleton.test.js` cover boundary exports, manifest facts, and guard behavior  |
| 2-7. Architecture smoke integration | Completed | `2026-06-25 20:16:29 +08:00` | `scripts/run-architecture-smoke.js` checks new ECS files/tests and runs the boundary guard as blocking                                                |
| 2-8. Commit and server branch push  | Completed | `2026-06-25 20:16:29 +08:00` | Commit `08acdf88` reached the server branch; refactor test server manual deploy completed and health confirmed deployed commit `08acdf88`             |

Batch 2 notes:

- `bitecs@0.4.0` exposes the planned `defineComponent`, `Types`, `defineQuery`, `enterQuery`, and `exitQuery` API through the official `bitecs/legacy` export. This surface is allowed only inside `frontend/js/ecs/core/EcsCoreBoundary.js`.
- `bitecs/serialization` remains an approved external ECS surface in the Batch 1 ADR, but Batch 2 code does not import it yet.
- `frontend/index.html` and `frontend/minigame/game.js` are not modified and do not load `frontend/js/ecs`.

## Batch 3 Checklist

| Step                                    | Status    | Updated At                   | Evidence                                                                                                                                                                                                                        |
| --------------------------------------- | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-1. Mode ECS owner modules             | Completed | `2026-06-25 21:01:23 +08:00` | `frontend/js/ecs/mode/ModeKeys.js`, `ModeComponents.js`, `ModeResolver.js`, `ModeWorld.js`, and `EcsModeRuntimeEntry.js` create the singleton mode owner and frozen snapshot                                                    |
| 3-2. Generated runtime bundle           | Completed | `2026-06-25 21:01:23 +08:00` | `scripts/build-frontend-ecs-runtime.js` builds `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` with exact `esbuild@0.23.1`                                                                                                    |
| 3-3. Legacy mode bridge                 | Completed | `2026-06-25 21:01:23 +08:00` | `frontend/js/platform/CanvasModeOwnershipBridge.js` reads legacy app/shell fields as ingress facts and exposes mode snapshot helpers                                                                                            |
| 3-4. App/Shell centralized mode routing | Completed | `2026-06-25 21:01:23 +08:00` | `CanvasGameAppInputRouter.js` and `CanvasGameShellInputRouter.js` prefer mode snapshot helpers for blocking overlay, entity battle, world map, and tech-tree route decisions                                                    |
| 3-5. H5/minigame runtime loading        | Completed | `2026-06-25 21:01:23 +08:00` | `frontend/index.html` and `frontend/minigame/game.js` load only the generated ECS mode runtime bundle plus `CanvasModeOwnershipBridge.js`                                                                                       |
| 3-6. Blocking guards                    | Completed | `2026-06-25 21:01:23 +08:00` | `scripts/check-frontend-ecs-mode-ownership-spine.js` blocks legacy mode-decision growth; boundary guard now allows only the approved runtime bundle                                                                             |
| 3-7. Guard and behavior tests           | Completed | `2026-06-25 21:01:23 +08:00` | Mode world, bridge, boundary guard, mode spine guard, script manifest, and App/Shell focused tests pass locally                                                                                                                 |
| 3-8. Progress / operating plan update   | Completed | `2026-06-25 21:01:23 +08:00` | This document and `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md` record Batch 3 as Completed                                                                                                       |
| 3-9. Commit and server branch push      | Completed | `2026-06-25 23:02:25 +08:00` | Implementation commits `8969451a` and `51d3b265` reached the server branch; refactor test server manual deploy passed the gate and health returned `status: ok` with deployed commit `51d3b2657a35dfac2b206b3bfbe9761c03f4bf2d` |
| 3-10. Migration owner review            | Completed | `2026-06-25 23:02:25 +08:00` | `codex/external-review` signed off the Batch 3 mode ownership spine; this completion commit marks Batch 3 as Completed                                                                                                          |

Batch 3 notes:

- The new mode owner is `frontend/js/ecs/mode/ModeWorld.js`; it owns a singleton ECS mode entity.
- `CanvasModeOwnershipBridge.js` is a temporary bridge and only derives serializable facts from old fields. It does not own concrete modal payloads.
- Generic blocking overlays still treat the tech command panel as blocking, while tech-tree routing uses `techTreeBlockingOverlayActive` to preserve the old `hasBlockingOverlayExceptTechTree()` behavior.
- Batch 3 does not migrate physical input intent, concrete modal ownership, renderer snapshot contracts, gameplay serializable gameplay state, or tutorial flow ownership.

## Batch 4 Checklist

| Step                                           | Status           | Updated At                   | Evidence                                                                                                                                       |
| ---------------------------------------------- | ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 4-1. Input intent vocabulary + resolver        | Ready for Review | `2026-06-26 01:02:16 +08:00` | `frontend/js/ecs/input/InputIntent.js` and `InputIntentResolver.js` are pure, frozen, and pass unit tests                                      |
| 4-2. Runtime bundle regeneration               | Ready for Review | `2026-06-26 01:02:16 +08:00` | `EcsModeRuntimeEntry.js` exposes the input API; `EcsModeRuntimeBundle.js` regenerated by exact `esbuild@0.23.1`                                |
| 4-3. Bridge resolve helper                     | Ready for Review | `2026-06-26 01:02:16 +08:00` | `CanvasModeOwnershipBridge.resolveInputIntent` reads the snapshot and delegates to the resolver, null when unavailable                         |
| 4-4. App/Shell router adapters                 | Ready for Review | `2026-06-26 01:02:16 +08:00` | Covered-mode routing goes through the resolver with legacy fallback; App/Shell router tests stay green                                         |
| 4-5. Input intent blocking guard + tests       | Ready for Review | `2026-06-26 01:02:16 +08:00` | `scripts/check-frontend-ecs-input-intent-spine.js` reports 0 violations (current 30 = baseline 30); guard + unit tests pass                    |
| 4-6. Manifest + architecture smoke integration | Ready for Review | `2026-06-26 01:02:16 +08:00` | `EcsBoundaryManifest` lists `frontend/js/ecs/input/**` owner-source-only; smoke runs the guard + new tests as blocking                         |
| 4-7. Commit and server branch push             | Completed        | `2026-06-26 01:24:26 +08:00` | Commit `eab8452e` reached the server branch; refactor test server deploy health confirmed commit `eab8452e`, deployedAt `2026-06-25T17:14:38Z` |
| 4-8. Migration owner review                    | Completed        | `2026-06-26 01:24:26 +08:00` | `codex/external-review` signed off (Batch 4 Passed)                                                                                            |

Batch 4 notes:

- Route precedence is kind-aware (drag/tap: entity-battle > tech-tree > world-map; gesture: entity-battle > world-map > tech-tree), matching the existing routers; `city` is the implicit fallback route.
- Scope held: no tutorial, panel/modal payload, renderer/`getHitTarget`, or gameplay ownership migrated; `CanvasModeOwnershipBridge` gained no new source-of-truth fields.
- An adversarial review (scope / behavior / guard-correctness lenses) returned the scope and behavior lenses clean; the lone low-severity note (the guard approved-path allowlist is a forward-looking safety net) is documented inline in the guard.

## Batch 6A Checklist

| Step                                              | Status    | Updated At                   | Evidence                                                                                                                                                  |
| ------------------------------------------------- | --------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6A-1. Renderer snapshot boundary module           | Completed | `2026-06-26 16:05:54 +08:00` | `frontend/js/ecs/snapshot/RendererSnapshotBoundary.js` builds frozen `renderer-snapshot-v1` snapshots for sealed Batch 5 modal/panel facts                |
| 6A-2. Runtime bundle export                       | Completed | `2026-06-26 16:05:54 +08:00` | `EcsModeRuntimeEntry.js` exports `RendererSnapshotBoundary`; `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` regenerated by `npm run build:ecs-runtime` |
| 6A-3. Bridge read-only helpers                    | Completed | `2026-06-26 16:05:54 +08:00` | `CanvasModeOwnershipBridge.buildRendererSnapshot` / `getRendererSnapshot` expose null-safe read-only snapshot helpers                                     |
| 6A-4. Renderer snapshot boundary guard            | Completed | `2026-06-26 16:05:54 +08:00` | `scripts/check-frontend-ecs-renderer-snapshot-boundary.js` blocks new direct renderer reads beyond the Batch 6A baseline                                  |
| 6A-5. Guard baseline and batch document           | Completed | `2026-06-26 16:05:54 +08:00` | `docs/development_logs/2026-06-25-frontend-ecs-batch-6a-snapshot-boundary.md` records 139 grandfathered direct renderer reads                             |
| 6A-6. Manifest and architecture smoke integration | Completed | `2026-06-26 16:05:54 +08:00` | `EcsBoundaryManifest` declares `RendererSnapshot`; `scripts/run-architecture-smoke.js` runs the new tests and guard                                       |
| 6A-7. Progress / operating plan update            | Completed | `2026-06-26 16:05:54 +08:00` | This document and the operating plan record 6A as Completed after migration owner sign-off                                                                |

Batch 6A notes:

- 6A is `Completed` after migration owner sign-off. It remains scaffold-only: it does not migrate renderer readers, gameplay/serializable gameplay state, `getHitTarget`, renderer caches, or hit-target authority.
- Snapshot payload is deliberately narrow: sealed Batch 5 modal/panel facts plus whitelisted mode-routing facts only.
- Existing direct renderer reads remain grandfathered by the new guard baseline; later Batch 6 sub-slices should reduce the baseline by migrating one reader group at a time.

## Batch 7A Checklist

| Step                                             | Status    | Updated At                   | Evidence                                                                                                                                 |
| ------------------------------------------------ | --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 7A-1. Battle owner                        | Completed | `2026-06-26 17:18:00 +08:00` | `frontend/js/ecs/owner/BattleOwner.js` owns frozen `battle-owner-v1` overlay/session facts                                       |
| 7A-2. Runtime and snapshot exposure              | Completed | `2026-06-26 17:18:00 +08:00` | `EcsModeRuntimeEntry.js` exports `BattleOwner`; `RendererSnapshotBoundary` emits `snapshot.battle`                                 |
| 7A-3. Canonical battle adapter routing           | Completed | `2026-06-26 17:18:00 +08:00` | `CanvasGameAppBattleScene.js` writes owner on battleScene/entityBattle open, update, and close while preserving compatibility mirrors    |
| 7A-4. Snapshot path without new bridge wrappers  | Completed | `2026-06-26 17:18:00 +08:00` | `CanvasModeOwnershipBridge.js` only extends existing `buildRendererSnapshot` facts; no `openBattle*Owner` / `closeBattle*Owner` wrappers |
| 7A-5. Battle owner guard                  | Completed | `2026-06-26 17:18:00 +08:00` | `scripts/check-frontend-ecs-battle-owner.js` blocks new canonical battle writes outside approved owner/adapter paths              |
| 7A-6. 7B mirror cleanup plan                     | Completed | `2026-06-26 17:18:00 +08:00` | 7B target is App-side `this.battleScene`; cleanup order is recorded in the 7A batch doc                                                  |
| 7A-7. Progress / operating plan / batch document | Completed | `2026-06-26 17:18:00 +08:00` | 7A signed off and pushed at commit `2818aab8`                                                                                            |

Batch 7A notes:

- 7A does not migrate BattleSimCore, AI stepping, camera math, renderer drawing, timers, or server resolve behavior.
- `entityBattle` keeps its live mutable mirror in 7A because current rendering and input paths still depend on scratch fields such as `_viewFit` and `_rstate`.
- 7B must delete App-side `this.battleScene`; this mirror deletion target is not deferred to Batch 8.

## Batch 7B Checklist

| Step                                             | Status    | Updated At                   | Evidence                                                                                                                                    |
| ------------------------------------------------ | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 7B-1. Renderer options snapshot source           | Completed | `2026-06-26 18:09:12 +08:00` | App/Shell render options pass `battleScene` only from `getRendererSnapshot().battle.battleScene`                                            |
| 7B-2. App replay flow snapshot reads             | Completed | `2026-06-26 18:09:12 +08:00` | `CanvasGameAppBattleScene.js` uses `getBattleSceneSession()` for replay turn duration, advance, skip, animation, and close checks           |
| 7B-3. App/Shell mirror deletion                  | Completed | `2026-06-26 18:09:12 +08:00` | App/Shell constructor `this.battleScene = null` removed; Shell `startBattleScene` / `closeBattleScene` forward to `lastGame` without mirror |
| 7B-4. App-to-Shell sync removal                  | Completed | `2026-06-26 18:09:12 +08:00` | `syncBattleSceneToShell()` removed; bridge reads `lastGame.__ecsBattleOwner` instead of shell/app mirrors                             |
| 7B-5. Guard upgrade                              | Completed | `2026-06-26 18:09:12 +08:00` | `scripts/check-frontend-ecs-battle-owner.js` forbids App/Shell `battleScene` mirror reads/writes and reports 0 violations            |
| 7B-6. Snapshot-only evidence                     | Completed | `2026-06-26 18:09:12 +08:00` | `CanvasModeOwnershipBridge.test.js` ignores removed mirrors; `CanvasGameShell.test.js` reads battle render options from owner snapshot only |
| 7B-7. Progress / operating plan / batch document | Completed | `2026-06-26 18:09:12 +08:00` | 7B is completed after migration owner sign-off and pushed at commit `3db83d51`                                                              |

## Batch 8A Checklist

| Step                                               | Status                           | Updated At                   | Evidence                                                                                                                                   |
| -------------------------------------------------- | -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 8A-1. Delete App/Shell naming mirror fields        | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | Removed constructor initialization and all App/Shell `this.naming` / `canvasShell.naming` production accesses                              |
| 8A-2. Remove naming bridge wrappers                | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | Deleted `openNamingModal`, `closeNamingOwner`, and `updateNamingPayload` from `CanvasModeOwnershipBridge.js`                               |
| 8A-3. Route naming reads through renderer snapshot | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | Render/input/tutorial paths read `snapshot.modal['modal:naming']` through `CanvasModalSnapshotAdapter` and generic modal owner APIs        |
| 8A-4. Retire renderer fallback                     | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | App/Shell render options pass `naming` only from the snapshot-derived naming payload; no compatibility fallback remains                    |
| 8A-5. Guard upgrade                                | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | New `scripts/check-frontend-ecs-naming-mirror-retirement.js` forbids naming mirror reads/writes and retired wrapper names; guard reports 0 |
| 8A-6. Behavior and guard tests                     | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | Focused tests cover owner snapshot reads, shell-to-app owner updates, renderer options, tutorial reads, and guard behavior                 |
| 8A-7. Progress / operating plan / batch document   | Ready for Migration Owner Review | `2026-06-26 18:19:04 +08:00` | This document, the operating plan, and the 8A batch doc record Ready for Review, not Completed                                             |

## Batch 8B Checklist

| Step                                                      | Status                           | Updated At                   | Evidence                                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8B-1. Delete App/Shell confirmDialog mirror fields        | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | Removed Shell constructor initialization and all App/Shell `this.confirmDialog` / `canvasShell.confirmDialog` production accesses                                    |
| 8B-2. Remove confirmDialog bridge wrappers                | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | Deleted `openConfirmDialogModal`, `closeConfirmDialogOwner`, `updateConfirmDialogPayload`, and `resolveConfirmDialogCallback` from `CanvasModeOwnershipBridge.js`    |
| 8B-3. Route confirmDialog reads through renderer snapshot | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | Render/input/action-handler paths read `snapshot.modal['modal:confirmDialog']` through `CanvasModalSnapshotAdapter` and generic modal owner APIs                     |
| 8B-4. Preserve generic callback registry path             | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | Confirm callbacks resolve through `resolveConfirmDialogSnapshotCallback()`, which delegates to generic `resolveModalCallback('modal:confirmDialog', ...)`            |
| 8B-5. Guard upgrade                                       | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | New `scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js` forbids confirmDialog mirror reads/writes and retired wrapper names; guard reports 0 violations |
| 8B-6. Behavior and guard tests                            | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | Focused tests cover snapshot reads, submitting updates, callback resolve, renderer options, reset action source, and guard behavior                                  |
| 8B-7. Progress / operating plan / batch document          | Ready for Migration Owner Review | `2026-06-26 18:39:03 +08:00` | This document, the operating plan, and the 8B batch doc record Ready for Review, not Completed                                                                       |

## Batch 8C Checklist

| Step                                                            | Status                           | Updated At                   | Evidence                                                                                                                                                                |
| --------------------------------------------------------------- | -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8C-1. Delete App/Shell rewardReveal mirror fields               | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | Removed App and Shell constructor initialization of `this.rewardReveal`                                                                                                 |
| 8C-2. Remove rewardReveal bridge wrappers                       | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | Deleted `openRewardRevealModal` and `closeRewardRevealOwner` from `CanvasModeOwnershipBridge.js`                                                                        |
| 8C-3. Route rewardReveal reads/writes through renderer snapshot | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | Shell/App open/close, render options, input routers, and tutorial gate use `CanvasModalSnapshotAdapter` rewardReveal helpers and `snapshot.modal['modal:rewardReveal']` |
| 8C-4. Retire renderer fallback                                  | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | App/Shell render options pass `rewardReveal` only from the snapshot-derived payload; no mirror fallback remains                                                         |
| 8C-5. Guard upgrade                                             | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | New `scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js` forbids rewardReveal mirror reads/writes and retired wrapper names; guard reports 0 violations       |
| 8C-6. Behavior and guard tests                                  | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | Focused tests cover owner snapshot open/close, renderer options, city reward grant, tutorial reads, and guard behavior                                                  |
| 8C-7. Progress / operating plan / batch document                | Ready for Migration Owner Review | `2026-06-26 21:03:46 +08:00` | This document, the operating plan, and the 8C batch doc record Ready for Review, not Completed                                                                          |

## Batch 8D Checklist

| Step                                                             | Status                           | Updated At                   | Evidence                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8D-1. Delete App/Shell activeEventId mirror fields               | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | Removed App and Shell constructor initialization of `this.activeEventId`                                                                                                                                                      |
| 8D-2. Remove event bridge wrappers                               | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | Deleted `openEventModal` / `closeEventOwner` (+ syncEventMirrors/collectEventMirrorTargets) from `CanvasModeOwnershipBridge.js`                                                                                               |
| 8D-3. Route activeEventId reads/writes through renderer snapshot | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | Action handlers, commands, resets, input routers, render runtimes, and the tutorial layer use `CanvasModalSnapshotAdapter` event helpers; 2-way/3-way closes collapse to one `closeEventSnapshot()` (snapshot merge fans out) |
| 8D-4. Preserve EventController cursor + control-flow token       | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | `EventController.activeEventId` cursor untouched; `closePanels(['activeEventId'])` keep-set string token preserved                                                                                                            |
| 8D-5. Guard upgrade (extended)                                   | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | New `scripts/check-frontend-ecs-event-mirror-retirement.js` adds setIfChanged + patch-key detection and excludes EventController.js; guard reports 0 violations                                                               |
| 8D-6. Behavior and guard tests                                   | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | Snapshot fan-out, cursor untouched, retired-wrapper absence; full `npm test` 1684/0                                                                                                                                           |
| 8D-7. Progress / operating plan / batch document                 | Ready for Migration Owner Review | `2026-06-26 23:38:10 +08:00` | This document, the operating plan, and the 8D batch doc record Ready for Review, not Completed                                                                                                                                |

## Batch 8E Checklist

| Step                                                         | Status                           | Updated At                   | Evidence                                                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8E-1. Delete picker mirror fields                            | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | Removed `worldTargetPicker` seed + vestigial clears from `TerritoryController`; `pickerOpen` peeled off `worldMarchTarget`                                                            |
| 8E-2. Remove picker bridge wrappers                          | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | Deleted the 3 picker wrappers + dead syncTerritoryUiStateMirror/resolveTerritoryUiState/collectTerritoryMirrorTargets                                                                 |
| 8E-3. Route picker reads/writes through the owner (Option B) | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | Action handlers open/close via the snapshot adapter; the picker is threaded to the HUD as a dedicated `options.targetPicker` render option; territoryUiState carries no picker fields |
| 8E-4. Tutorial gate + scope normalizers                     | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | `isWorldMarchFormationPickerOpen` reads the owner snapshot; the two scope normalizers stopped copying `pickerOpen`; world-march scope data untouched                                |
| 8E-5. Guard upgrade + reconcile                              | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | New `check-frontend-ecs-target-picker-mirror-retirement.js` (0 violations); existing ownership guard reconciled; both wired into the smoke                                            |
| 8E-6. Behavior and guard tests                               | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | Snapshot fan-out + render threading + tutorial gate; full `npm test` 1686/0                                                                                                           |
| 8E-7. Progress / operating plan / batch document             | Ready for Migration Owner Review | `2026-06-27 01:09:27 +08:00` | This document, the operating plan, and the 8E batch doc record Ready for Review, not Completed                                                                                        |

> Review note: the pre-existing `check-frontend-ecs-target-picker-ownership.js`
> required picker opens to route through the now-deleted bridge wrappers, so its
> invariant became obsolete. An adversarial review flagged it as
> self-contradictory, so it was removed (with its test and smoke wiring). The new
> `check-frontend-ecs-target-picker-mirror-retirement.js` is the single
> authoritative seal for targetPicker.

## Batch 8F Checklist

| Step                                              | Status                           | Updated At   | Evidence                                                                                                                                                                |
| ------------------------------------------------- | -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8F-1. ECS core: 12 per-panel modal subtypes       | Ready for Migration Owner Review | `2026-06-27` | `modal:blockingPanel` split into 12 subtypes across ModeKeys/ModeResolver/RendererSnapshotBoundary/EcsBoundaryManifest; bundle regenerated; existing bit positions kept |
| 8F-2. Adapter `*BlockingPanelSnapshot` API        | Ready for Migration Owner Review | `2026-06-27` | open/close/closeAll-except/isOpen/getCommandPanelValue/buildFacts; toggle-via-open (falsy routes to close); raw-string command value                                    |
| 8F-3. Bridge source flip                          | Ready for Migration Owner Review | `2026-06-27` | `buildRendererPanelFacts` derives the flat-12 from the modal entries; 3 wrappers + mirror helpers removed; tutorialAdvisorDialogue/armyFormationEditor preserved        |
| 8F-4. ~26-file consumer migration                 | Ready for Migration Owner Review | `2026-06-27` | Handlers/commands/runtimes/input-routers/ctors/tutorial/territory routed through the adapter; subset resets preserved; cross-host mirrors dropped; scope untouched     |
| 8F-5. Guard upgrade                               | Ready for Migration Owner Review | `2026-06-27` | New `check-frontend-ecs-blocking-panel-mirror-retirement.js` (0 violations); old ownership guard removed; smoke rewired                                                 |
| 8F-6. Behavior + guard tests + adversarial review | Ready for Migration Owner Review | `2026-06-27` | Axis-3 simultaneity test; full `npm test` 1701/0; 3-lens review (0 behavior regressions; 3 guard-soundness fixes applied)                                               |
| 8F-7. Progress / operating plan / batch document  | Ready for Migration Owner Review | `2026-06-27` | This document, the operating plan, and the 8F batch doc record Ready for Review, not Completed                                                                          |

> Plan gaps caught + fixed during execution: `tutorialAdvisorDialogue` /
> `armyFormationEditor.open` (non-panel blocking signals) preserved as explicit terms;
> `deriveModeFacts.techTreeActive` flipped off the raw `activeCommandPanel` mirror onto
> the `modal:commandPanel` payload. 8F completes the Bridge Retirement batch.

## Verification Commands

Executed before this progress entry:

- `node --test scripts/report-frontend-ecs-mode-ownership.test.js`
- `node --test scripts/report-frontend-ecs-bridge-shrink.test.js`
- `node scripts/report-frontend-ecs-mode-ownership.js --summary`
- `node scripts/report-frontend-ecs-bridge-shrink.js --summary`

Executed before commit/push:

- `node --test scripts/report-frontend-ecs-renderer-authority.test.js`
- `node --test scripts/report-frontend-ecs-input-branch.test.js`
- `node --test scripts/report-frontend-ecs-literal-duplicate.test.js`
- `node scripts/report-frontend-ecs-renderer-authority.js --summary`
- `node scripts/report-frontend-ecs-input-branch.js --summary`
- `node scripts/report-frontend-ecs-literal-duplicate.js --summary`
- `npm run format:check`
- `npm run test:architecture`
- `git diff --check`
- `git status --short`

Executed for Batch 1 before this progress entry:

- `node --test scripts/check-frontend-ecs-core-guard.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-core-guard.js --json`
- `npm run format:check`
- `npm run test:architecture`
- `git diff --check`

Executed for Batch 2 before this progress entry:

- `npm ls bitecs`
- `node --test frontend/js/ecs/**/*.test.js`
- `node --test scripts/check-frontend-ecs-boundary-skeleton.test.js`
- `node --test scripts/check-frontend-ecs-core-guard.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-core-guard.js --json`
- `node scripts/check-frontend-ecs-boundary-skeleton.js`
- `node scripts/check-frontend-ecs-boundary-skeleton.js --json`
- `npm run format:check`
- `npm run test:architecture`

Batch 2 local verification result:

- `npm ls bitecs`: passed, resolved `bitecs@0.4.0`.
- ECS skeleton tests: passed, 7 tests.
- Boundary guard tests: passed, 8 tests.
- ECS core guard: passed, 0 violations.
- ECS boundary guard: passed, 0 violations across 222 scanned files.
- `npm run format:check`: passed.
- `npm run test:architecture`: passed, 1140 tests and all architecture guards.

Executed for Batch 3 before this progress entry:

- `npm run build:ecs-runtime`
- `node --test frontend/js/ecs/mode/**/*.test.js`
- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js`
- `node --test scripts/check-frontend-ecs-boundary-skeleton.test.js`
- `node --test scripts/check-frontend-ecs-mode-ownership-spine.test.js`
- `node scripts/check-frontend-ecs-core-guard.js`
- `node scripts/check-frontend-ecs-boundary-skeleton.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js`
- `node scripts/check-frontend-script-manifest.js`
- `node --test frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js`

Batch 3 local verification result so far:

- ECS mode tests: passed, 4 tests.
- Mode bridge tests: passed, 4 tests.
- Boundary guard tests: passed, 9 tests.
- Mode spine guard tests: passed, 5 tests.
- ECS core guard: passed, 0 violations.
- ECS boundary guard: passed, 0 violations across 229 scanned files.
- ECS mode spine guard: passed, 0 violations across 222 scanned files; current mode findings are 1045, with 960 legacy findings matching the 0A baseline after approved owner/bridge/vocabulary paths are excluded.
- Frontend script manifest guard: passed, 219 local scripts and 1 stylesheet.
- App/Shell focused tests: passed, 89 tests.
- `npm run format:check`: passed.
- `npm run test:architecture`: passed, 1154 tests and all architecture guards.
- `git diff --check`: passed.

Executed for Batch 6A before this progress entry:

- `npm run build:ecs-runtime`
- `node --test frontend/js/ecs/snapshot/RendererSnapshotBoundary.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js scripts/check-frontend-ecs-renderer-snapshot-boundary.test.js frontend/js/ecs/registry/EcsBoundaryManifest.test.js scripts/check-frontend-ecs-mode-ownership-spine.test.js`
- `node scripts/check-frontend-ecs-renderer-snapshot-boundary.js`
- `node scripts/check-frontend-ecs-mode-ownership-spine.js`
- `node scripts/check-frontend-ecs-blocking-panel-ownership.js`
- `node scripts/check-frontend-ecs-target-picker-ownership.js`
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture`
- `git diff --check`

Batch 6A local verification result:

- Targeted snapshot/bridge/guard/manifest tests: passed, 33 tests.
- Renderer snapshot boundary guard: passed, 0 violations; baseline findings 139 and current findings 139.
- Mode ownership spine guard: passed, 0 violations.
- BlockingPanel ownership guard: passed, 0 violations.
- TargetPicker ownership guard: passed, 0 violations.
- `npm run lint`: passed.
- `npm run format:check`: passed.
- `npm run test:architecture`: passed, 1219 tests and all architecture guards.
- `git diff --check`: passed.

## Review Gate

0A, 0B, and Batch 1 are marked completed in this document because migration owner review passed.

Batch 2 is `Completed` after migration owner review.

Batch 3 is `Completed` after migration owner review.

Required owner sign-off record:

| Reviewer                | Review Time                  | Decision | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codex/external-review` | `2026-06-25 14:01:38 +08:00` | Passed   | Guard data matched inventory documents; report-only behavior, architecture smoke integration, baseline format, and operating-plan status were accepted. Two minor findings remain review follow-ups: inspect unknown writes for missed source-of-truth owners, and clean bridge false positives during 0B/manual review.                                                                                                                                      |
| `codex/external-review` | `2026-06-25 16:43:55 +08:00` | Passed   | 0B renderer authority, input branch, and literal/duplicate baselines are accepted for completion. Batch 1 may start after this completion commit reaches the server branch.                                                                                                                                                                                                                                                                                   |
| `codex/external-review` | `2026-06-25 18:33:08 +08:00` | Passed   | Batch 1 ADR, blocking guard, guard tests, architecture smoke integration, no-runtime-change scope, and no-dependency-install scope are accepted. Review follow-ups for Batch 2: ADR should add why other ECS libraries were not selected, define a bitECS maintenance/exit strategy, and pin an exact `bitecs` version when installing the dependency.                                                                                                        |
| `codex/external-review` | `2026-06-25 20:16:29 +08:00` | Passed   | Batch 2 dependency pin, ECS core boundary, manifest skeleton, boundary blocking guard, no-runtime-loading scope, H5/minigame entrypoint safety, ADR follow-up updates, and progress records are accepted for completion.                                                                                                                                                                                                                                      |
| `codex/external-review` | `2026-06-25 23:02:25 +08:00` | Passed   | Batch 3 mode ownership spine accepted: the singleton ECS mode entity is approved as the first runtime ECS owner; `CanvasModeOwnershipBridge.js` is accepted as a narrow temporary bridge; the mode spine guard blocks legacy mode-decision growth while allowing owner/bridge/vocabulary paths; the generated IIFE runtime bundle is accepted until a broader frontend build pipeline exists.                                                                 |
| `codex/external-review` | `2026-06-26 01:24:26 +08:00` | Passed   | Batch 4 input intent boundary accepted: pure kind-aware resolver, bridge pass-through with null fallback, `esbuild@0.23.1` bundle, count-preserving router adapters (guard 30 = baseline 30), scope clean; the gesture/tap fall-through deferred to Batch 6 was accepted.                                                                                                                                                                                     |
| `codex/external-review` | `2026-06-26 02:59:52 +08:00` | Passed   | Batch 5 slice 5a (naming) modal ownership accepted: ECS modal owner + token registry, bridge naming wrappers (no shadowing), per-host owner with `this.naming` mirror, seal enforced by the existing mode-ownership-spine guard; the HIGH closeNamingModal collision + LOW mirror fixes were accepted.                                                                                                                                                        |
| `codex/external-review` | `2026-06-26 04:01:40 +08:00` | Passed   | Batch 5 slice 5a confirmDialog modal ownership accepted: owner-sourced state with `this.confirmDialog` mirror, bridge wrappers (no shadowing), kind-dispatch preserved, registry wired resolve-if-present, critical reset flow unchanged; mode-ownership-spine guard 0 violations. Slice 5a (naming + confirmDialog) is complete.                                                                                                                             |
| `codex/external-review` | `2026-06-26 13:59:23 +08:00` | Passed   | Batch 5 slice 5b event modal ownership accepted after rewardReveal: approved lighter design, bridge wrappers, canonical open/close routing, central closePanels owner-close routing, host/game/canvasShell mirror sync, scattered legacy mirror clear scope, and `EventController.activeEventId` claim-cursor isolation. Slice 5b (event + rewardReveal) is complete.                                                                                         |
| `codex/external-review` | `2026-06-26 15:34:13 +08:00` | Passed   | Batch 5 slice 5d blockingPanel modal ownership accepted: lighter umbrella owner, bridge mirror sync, canonical shell/city/famous handler routing, central closePanels owner-close ordering, scoped blocking guard with 0 violations, and explicit tutorial coordinator grandfathering. Slice 5d and Batch 5 are complete; Batch 6 may start.                                                                                                                  |
| `codex/external-review` | `2026-06-26 16:05:54 +08:00` | Passed   | Batch 6A snapshot boundary scaffold accepted: v1 frozen/serializable snapshot contract, owner-direct modal reads, bridge read-only API, dedicated renderer snapshot boundary guard (139 baseline / 139 current / 0 violations), mode-spine guard 0 violations, and 1219 tests. Follow-up condition: 6B/6C sub-slices must include mirror retire targets; first 6B sub-slice must delete at least one mirror and migrate its renderer readers to the snapshot. |

## Push / Deploy Evidence

| Remote / Hook                                       | Result                                | Evidence                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `d4919fde`              | Server accepted `8aa553d9..d4919fde`                                                                                                                                                                                                                                                                                                                  |
| Refactor test server deploy hook                    | Failed after checkout                 | Hook checked out `d4919fde`, then `npm` failed with `EACCES: permission denied, rmdir '/www/wwwroot/h5-refactor-worktree/node_modules/.bin'`                                                                                                                                                                                                          |
| `github codex/refactor-tutorial-guide-architecture` | Failed                                | HTTPS remote was used. Schannel reported `failed to receive handshake`; OpenSSL retry reported `unexpected eof while reading`                                                                                                                                                                                                                         |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `87876c1a`              | Remote branch resolved to `87876c1a6e37ace396759201c503a9aeb3f21a2f` after the push timeout; local branch is aligned with `origin`                                                                                                                                                                                                                    |
| Refactor test server permission repair              | Completed                             | Root-owned ignored dependency directories were removed and `/www/wwwroot/h5-refactor-worktree` plus `/opt/wxgame-refactor/.wxgame` were restored to `www:www`; `node_modules`, `node_modules/.bin`, and `backend/node_modules` now resolve as `www:www`                                                                                               |
| Refactor test server deploy                         | Completed                             | `/opt/wxgame-refactor/.wxgame/current-deploy.json` records environment `refactor-test`, branch `codex/refactor-tutorial-guide-architecture`, commit `87876c1a6e37ace396759201c503a9aeb3f21a2f`, deployed at `2026-06-25T06:24:43Z`                                                                                                                    |
| Refactor test server health                         | Passed                                | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok` and deployed commit `87876c1a6e37ace396759201c503a9aeb3f21a2f`                                                                                                                                                                                                                |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `8ebedeb4`              | Deploy hook ran the full test-server gate: `npm run format:check`, `npm test`, `npm run test:architecture`, backend syntax check, and frontend manifest check                                                                                                                                                                                         |
| Runtime backend permission repair                   | Completed                             | `/opt/wxgame-refactor/backend/node_modules` was also root-owned from an earlier root install; it was removed and recreated by `www` during deploy                                                                                                                                                                                                     |
| Root PM2 refactor process cleanup                   | Completed                             | Root-owned `wxgame-refactor-server` and `wxgame-refactor-world-worker` were removed from root PM2 because they occupied port `3003`; `www` PM2 now owns the refactor server and worker                                                                                                                                                                |
| Refactor test server final deploy                   | Completed                             | Deploy script completed successfully for `8ebedeb48d7ea3220ee35233f084a24e3a270761`; PM2 listener confirmed port `3003`, worker confirmed online, and health returned `status: ok` with deployedAt `2026-06-25T06:53:04Z`                                                                                                                             |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `b3454765`              | Initial push returned HTTP 504 after about five minutes, but `git ls-remote origin refs/heads/codex/refactor-tutorial-guide-architecture` resolved to `b345476557adb7fbc0aa287c606484b73ba79222`; local tracking was refreshed with `git fetch`                                                                                                       |
| Refactor test server deploy hook                    | Incomplete over push                  | Health stayed on deployed commit `048531425993ba7d6502cde3f2a53be6810a55cc` after the 504, while `/www/wwwroot/h5-refactor-worktree` had been refreshed to the new checkout; no successful deploy record was written by the push-side hook                                                                                                            |
| Refactor test server manual deploy                  | Completed                             | Ran the same refactor wrapper as `www`: `REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`; gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks                                                                                      |
| Refactor test server health                         | Passed                                | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `b345476557adb7fbc0aa287c606484b73ba79222`, deployedAt `2026-06-25T07:57:40Z`, and deploymentId `5b461b9c46ce8d33`                                                                                                                                           |
| `github codex/refactor-tutorial-guide-architecture` | Failed                                | HTTPS remote was used (`https://github.com/18301724526/WXGames.git`). Push failed with `schannel: failed to receive handshake, SSL/TLS connection failed`; credentials and remote URL were not changed                                                                                                                                                |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `22bf9106`              | Initial push returned HTTP 504 after about five minutes, but `git ls-remote origin refs/heads/codex/refactor-tutorial-guide-architecture` resolved to `22bf910653dd2503ea98d12f9557d900c60ca12b`; local tracking was refreshed with `git fetch`                                                                                                       |
| Refactor test server deploy hook                    | Incomplete over push                  | Health stayed on deployed commit `1c190fa87c3d897869d20666d575f77c77f7172d` after the 504; the server branch had the new commit but no successful deploy record had been written by the push-side hook                                                                                                                                                |
| Refactor test server manual deploy                  | Completed                             | Ran the same refactor wrapper as `www`: `REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`; gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks                                                                                      |
| Refactor test server health                         | Passed                                | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `22bf910653dd2503ea98d12f9557d900c60ca12b`, deployedAt `2026-06-25T09:46:04Z`, and deploymentId `bea2ce6afb3fa219`                                                                                                                                           |
| `github codex/refactor-tutorial-guide-architecture` | Failed                                | HTTPS remote was used (`https://github.com/18301724526/WXGames.git`). Push failed with `schannel: failed to receive handshake, SSL/TLS connection failed`; credentials and remote URL were not changed                                                                                                                                                |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `08acdf88`              | Initial push returned HTTP 504 after about five minutes, but `git ls-remote origin refs/heads/codex/refactor-tutorial-guide-architecture` resolved to `08acdf8810e3220c75b46b5c9382dd8ceb2786a8`; local tracking was refreshed with `git fetch`                                                                                                       |
| Refactor test server deploy hook                    | Incomplete over push                  | Health stayed on deployed commit `748e9c6c3e21b3bc6327563298ed1d080557beb2` after the push-side 504; the server branch had the new commit but no successful deploy record had been written by the push-side hook                                                                                                                                      |
| Refactor test server manual deploy                  | Completed                             | Ran the same refactor wrapper as `www`: `REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`; gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks                                                                                      |
| Refactor test server health                         | Passed                                | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `08acdf8810e3220c75b46b5c9382dd8ceb2786a8`, deployedAt `2026-06-25T11:45:26Z`, and deploymentId `e2fa9eb6fcbe78d4`                                                                                                                                           |
| `github codex/refactor-tutorial-guide-architecture` | Failed                                | HTTPS remote was used (`https://github.com/18301724526/WXGames.git`), but `.git/config` routes GitHub through `http://127.0.0.1:7897`; the local proxy was not listening, so push failed with `Could not connect to server`. Credentials and remote URL were not changed                                                                              |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commits `6dfc9f56`, `b27b7681` | Both pushes returned HTTP 502 during the synchronous deploy hook; `git ls-remote` resolved the branch to `b27b7681509fb9a5e855ee7cb581c90978c7f9b1`                                                                                                                                                                                                   |
| Refactor test server manual deploy                  | Completed                             | Ran the refactor wrapper as `www` over SSH (`REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`); gate passed lint, format, tests, architecture smoke, backend syntax, and manifest checks                                                                                 |
| Refactor test server health                         | Passed                                | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `b27b7681509fb9a5e855ee7cb581c90978c7f9b1`, deployedAt `2026-06-25T15:57:00Z`, deploymentId `8d6ba1306e934cf7`                                                                                                                                               |
| Post-receive hook 502 fix                           | Completed                             | `/home/git/wxgame.git/hooks/post-receive` `deploy_refactor` now launches the gate detached and as `www` via `/usr/local/sbin/wxgame-refactor-async-deploy.sh` (setsid + flock); refactor pushes return promptly and the deploy survives client disconnect; backup `post-receive.bak-async502-20260625T160350Z`; `deploy_main`/`deploy_test` unchanged |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `eab8452e`              | Async post-receive hook returned in about one second (no 502); `git ls-remote` resolved the branch to `eab8452e1a8acd94c5bc54529811c1f0b8cd4f5d`                                                                                                                                                                                                      |
| Refactor test server deploy                         | Completed                             | Push-triggered detached deploy ran the full gate (lint, format, tests, architecture smoke including the new input-intent spine blocking guard) with `rc=0`; PM2 restarted on port `3003`                                                                                                                                                              |
| Refactor test server health                         | Passed                                | `http://47.116.32.216/wxgame-refactor-api/health` returned `status: ok`, deployed commit `eab8452e1a8acd94c5bc54529811c1f0b8cd4f5d`, deployedAt `2026-06-25T17:14:38Z`, deploymentId `d262130fc48fbf35`                                                                                                                                               |
| `origin codex/refactor-tutorial-guide-architecture` | Pushed commit `58a77bbf`              | Async post-receive hook returned promptly and launched the refactor deploy in the background; `git ls-remote` resolved the branch to `58a77bbff4f21dba081badd04f0fa062e4900697`                                                                                                                                                                       |

Permission root cause:

- Earlier dependency installation ran as `root` inside the isolated refactor worktree, leaving ignored dependency directories owned by `root:root`.
- The deploy checkout uses `git clean -fd`, which does not remove ignored directories such as `node_modules`.
- The deploy gate later runs as `www`; `npm ci` attempted to remove `/www/wwwroot/h5-refactor-worktree/node_modules/.bin` and failed with `EACCES`.
- The same root install pattern also left `/opt/wxgame-refactor/backend/node_modules` owned by `root:root`, which blocked runtime `npm install --omit=dev` until that dependency directory was removed and recreated by `www`.
- A separate root PM2 process pair for the refactor server occupied port `3003`, causing the `www` PM2 restart to loop with `EADDRINUSE`; deleting only the root-owned refactor PM2 apps let the isolated `www` PM2 service own the port.
- The server-side repair removed the polluted dependency directories, restored ownership of the refactor worktree/runtime/deploy state directories to `www:www`, and kept production plus battle test PM2 apps untouched.

## Next Step

0A is officially complete on the server branch after deploy commit `8ebedeb48d7ea3220ee35233f084a24e3a270761`.

0B is officially complete after migration owner review. Batch 1 started after this completion commit reached the server branch.

Batch 1 is officially complete after migration owner review. Batch 2 is officially complete after migration owner review.

Batch 3 is `Completed` after migration owner review. Batch 4 (Input Intent Boundary) may start after this completion commit reaches the server branch.

Batch 4 (Input Intent Boundary) is `Completed` after migration owner review. Batch 5 (Panel/Modal Ownership) may start after this completion commit reaches the server branch.

Batch 5 (Panel/Modal Ownership) planning is recorded in the operating plan as first-window deliverables across slices 5a-5d, with slice 5a (`naming` + `confirmDialog`) approved for the first round and the owner-holds-token callback strategy. Slice 5a implementation is being scoped against the slice-5a mapping (the ECS modal owner needs a serializable JS-side payload store because bitECS components are numeric-only; neither `naming` nor `confirmDialog` stores closures today; demoting the legacy fields to owner-derived mirrors spans about twenty files including hot UI paths).

Batch 5 slice 5a (naming) is implemented and `Ready for Migration Owner Review`: the ECS modal owner (`ModalWorld`) + app-side callback registry + bridge modal API are in place, the eight App/Shell naming write sites route through the owner with `this.naming` as the read-only mirror, and the seal is enforced by the existing mode-ownership-spine guard (0 violations). An adversarial review caught and fixed a `closeNamingModal` name collision (renamed the owner wrapper to `closeNamingOwner`, added a non-shadow regression test) and a submit-`finally` mirror staleness. Verified: `npm run test:architecture` 1185 tests, lint, format, and `git diff --check` all pass. Slice 5a (naming) is `Completed` after migration owner sign-off at `2026-06-26 02:59:52 +08:00` (deployed commit `dd01f381`). The confirmDialog sub-step is now implemented and `Ready for Migration Owner Review`: confirmDialog state is owned by the modal owner with `this.confirmDialog` as the mirror, kind-dispatch is kept for the reset continuation, and the callback registry is wired as resolve-if-present (a future closure-continuation modal will be its first heavy use). Verified: `npm run test:architecture` 1186 tests, mode-ownership-spine guard 0 violations, lint (after pruning a stale suppression), format, and `git diff --check`; adversarial review clean. Once confirmDialog is signed off, slice 5a (naming + confirmDialog) is complete; Batch 5 is not Completed until its remaining slices (5b-5d) are signed off.

Batch 5 slice 5b (event + rewardReveal) is `Completed` after migration owner sign-off at `2026-06-26 13:59:23 +08:00`. The `rewardReveal` sub-step is owner-sourced with `this.rewardReveal` as the read-only mirror, sealed via two pure-presentation bridge wrappers and eight single-line owner-routed write sites across six files; readers stay on the mirror. The `event` (`activeEventId`) sub-step uses the approved lighter approach: only canonical `handle_openEvent` / `handle_closeEvent` and central `closePanels` route through the modal owner; bridge wrappers sync host/game/canvasShell mirrors; scattered `activeEventId = null` legacy mirror clears stay untouched; `EventController.activeEventId` remains isolated as its claim cursor. Verified: `npm run test:architecture` 1189 tests, mode-ownership-spine guard 0 violations, lint, format, and `git diff --check`. Batch 5 is not Completed until its remaining slices are signed off; slice 5c (`targetPicker`) is next.

Batch 5 slice 5c (`targetPicker`) is `Completed` after migration owner sign-off at `2026-06-26 14:47:06 +08:00`: the two canonical picker opens (`worldTargetPicker` list picker and `worldMarchTarget.pickerOpen` formation picker) route through `CanvasModeOwnershipBridge` wrappers into `modal:targetPicker`, with `territoryUiState` kept as the renderer/tutorial-facing mirror. Non-picker world-march target state and scattered null clears remain legacy mirror/scope behavior. A dedicated blocking guard, `scripts/check-frontend-ecs-target-picker-ownership.js`, blocks non-owner picker opens outside the approved bridge while allowing null mirror clears. Verified: `npm run test:architecture` 1195 tests, targetPicker ownership guard 0 violations, mode-ownership-spine guard 0 violations, lint, format, and `git diff --check`. Slice 5d (`blockingPanel`) may start and remains gated behind its own sealed slice.

Batch 5 slice 5d (`blockingPanel`) is `Completed` after migration owner sign-off at `2026-06-26 15:34:13 +08:00`: the approved lighter umbrella owner routes canonical shell/city/famous blocking-panel opens through `CanvasModeOwnershipBridge` wrappers into `modal:blockingPanel`, while panel-specific business state stays in existing feature handlers and legacy mirrors remain renderer/tutorial-facing. Central `closePanels` / `closePanelsEverywhere` now close the owner before legacy mirror clearing. A dedicated blocking guard, `scripts/check-frontend-ecs-blocking-panel-ownership.js`, blocks non-owner canonical opens outside the bridge, grandfathers 0A baseline opens, explicitly grandfathers tutorial coordinator scattered opens, and allows legacy clears. Verified: targeted Node owner/action/guard tests, blockingPanel guard 0 violations, mode-ownership-spine guard 0 violations, `npm run lint`, `npm run format:check`, `npm run test:architecture` 1209 tests, and `git diff --check`. With slice 5d signed off, Batch 5 is `Completed`; Batch 6 (`Snapshot Boundary`) may start after this completion commit reaches the server branch.

Batch 6A (`Snapshot Boundary Scaffold`) is `Completed` after migration owner sign-off at `2026-06-26 16:05:54 +08:00`: the renderer snapshot contract is versioned as `renderer-snapshot-v1`, modal snapshot reads come directly from `ModalWorld` owner entries, the bridge exposes null-safe read-only snapshot helpers, and `scripts/check-frontend-ecs-renderer-snapshot-boundary.js` blocks new direct renderer reads beyond the 139-read baseline. Verified: targeted snapshot/bridge/guard/manifest tests (33 tests), renderer snapshot boundary guard 0 violations (139 baseline / 139 current), mode-spine/blockingPanel/targetPicker guards 0 violations, `npm run lint`, `npm run format:check`, `npm run test:architecture` 1219 tests, and `git diff --check`. Batch 7 (`Retired Layer Sealing`) may start after this completion commit reaches the server branch; the first renderer-reader follow-up must include at least one mirror deletion if Batch 6B/6C is resumed before Batch 7 implementation.

Batch 7A (`Battle Owner`) is `Completed` after migration owner sign-off and push at commit `2818aab8`: `BattleOwner` owns frozen `battle-owner-v1` overlay/session facts for replay `battleScene` and interactive/replay `entityBattle`, `RendererSnapshotBoundary` emits `snapshot.battle`, and canonical battle open/update/close paths write the owner while preserving compatibility mirrors. No Battle open/close wrappers were added to `CanvasModeOwnershipBridge.js`; Battle sync uses the existing renderer snapshot path. 7B cleanup target is App-side `this.battleScene`, with deletion order recorded in the 7A batch doc.

Batch 7B (`BattleScene Mirror Removal`) is `Completed` after migration owner sign-off and push at commit `3db83d51`: App/Shell `this.battleScene` replay overlay mirrors were deleted, renderer options now pass `battleScene` only from `getRendererSnapshot().battle.battleScene`, App replay flow reads owner snapshot via `getBattleSceneSession()`, and App-to-Shell `battleScene` mirror sync was removed. The battle scope guard now forbids App/Shell `battleScene` mirror reads/writes and reports 0 violations. `entityBattle` remains the live mutable compatibility mirror for a later Battle slice.

Batch 8A (`Naming Mirror Removal`) is `Ready for Migration Owner Review`: App/Shell `this.naming` mirrors and App-to-Shell `canvasShell.naming` sync were removed, `openNamingModal` / `closeNamingOwner` / `updateNamingPayload` were deleted from `CanvasModeOwnershipBridge.js`, render/input/tutorial readers now go through `snapshot.modal['modal:naming']` via `CanvasModalSnapshotAdapter`, and the dedicated naming mirror retirement guard reports 0 violations. Verified: targeted Node suite 157 tests, naming/render-snapshot/mode/input/battle/blockingPanel/targetPicker guards 0 violations, `npm run lint`, `npm run format:check`, `npm run test:architecture` 1240 tests, and `git diff --check`. Batch 8A is not marked Completed until migration owner sign-off.

Batch 8B (`ConfirmDialog Mirror Removal`) is `Ready for Migration Owner Review`: App/Shell `this.confirmDialog` mirrors were removed, `openConfirmDialogModal` / `closeConfirmDialogOwner` / `updateConfirmDialogPayload` / `resolveConfirmDialogCallback` were deleted from `CanvasModeOwnershipBridge.js`, render/input/action-handler readers now go through `snapshot.modal['modal:confirmDialog']` via `CanvasModalSnapshotAdapter`, and the dedicated confirmDialog mirror retirement guard reports 0 violations. Verified: targeted Node suite 173 tests, confirmDialog/naming/render-snapshot/mode/input/battle/blockingPanel/targetPicker guards 0 violations, `npm run lint`, `npm run format:check`, `npm run test:architecture` 1248 tests, and `git diff --check`. Batch 8B is not marked Completed until migration owner sign-off.
