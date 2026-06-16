# World Map Authority And Render Continuity Plan - 2026-06-16

## Goal

Bring the world-map implementation back in line with the shared-world SLG contract:

- one real shared world map, not account-isolated fake worlds
- server-owned terrain, water, edge templates, visibility, ownership, reset results, and march authority
- spawn selection prefers usable low-density areas in the real world
- tutorial guidance avoids blocked or impossible targets
- stable 5x5 starting visibility around the capital
- account reset clears player-owned state without deleting another player's world facts
- render-ahead tiles support smooth marching without changing known terrain or edge templates
- frontend planned data and animation snapshots never override authoritative world-map facts

## Confirmed Live Issues

Evidence source:

- `C:/Users/18301/Downloads/wxgame-oplog-test1-20260615-183407Z.json`
- readonly production DB checks against `/opt/wxgame-workspace/backend/civilization.db`
- current deployed commit observed as `1c145314041106acf792558b4ff466d6305b8c44`

Confirmed facts:

- Same-tile transition/template flips are real, not only visual suspicion.
- Log examples include `tile_0_3`, `tile_1_-6`, `tile_2_-7`, `tile_2_-5`, `tile_0_5`, and `tile_-1_4`.
- Around `seq 740`, transition data disappears for known tiles.
- Around `seq 790`, the same transition data reappears.
- Production global authority stores empty `transitionKey` for those coordinates.
- `WorldMapTiles.decorateTile()` currently uses `tile.transitionKey || getTerrainTransitionKey(...)`, so an authoritative empty string can be treated as missing and recomputed.
- Recomputing those coordinates as plains produces the same transition keys seen in the frontend log, which explains the flip.
- No confirmed terrain `A => B` mutation was proven by that log, but transition/template mutation is already enough to violate the map contract.

March and preview issues confirmed or strongly evidenced:

- Long-distance march animation can snap at the final step.
- Log evidence: a march to `tile_0_6` has a route count of 6, then render state shows the active unit at `tile_0_6`; later the server state has no active mission and render state shows `idle:tile_0_5:6`.
- `WorldMarchProgressSnapshot.buildActorFromProgress()` draws idle actors at `row.target`, which can disagree with the backend position after completion or return.
- Return/stop commands can lose the route preview footprint.
- `returnWorldMarch` responses in the log have `plannedTiles.count = 0`.
- `WorldExplorerActions.returnWorldMarch()` and `stopWorldMarch()` rebase routes without carrying or rebuilding planned route footprint data.
- Render-ahead one-ring behavior is not guaranteed in the frontend.
- Backend route planning can create one-ring footprint planned tiles, but `WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles()` filters planned tiles unless they are already server-revealed or render-ready, and render-ready is based on route steps rather than the full one-ring footprint.

Reset and starting view issues to keep in scope:

- `START_REVEAL_RADIUS = 2`, so the intended initial visibility is 5x5, 25 tiles.
- If reset shows only one visible tile, the constant is not the intended behavior; the reset hydration, visibility authority, or frontend post-reset view chain is suspect.
- Reset camera should follow the new capital after the reset state is applied.
- Reset must release player-owned land/cities for that account while preserving global terrain facts owned by the shared world.

## Current Gap

The existing architecture documents already define the right direction:

- materialized global terrain is first-writer-wins
- player visibility is separate from global terrain
- `plannedTiles` are exploration previews before reveal, not world facts
- frontend render caches and presenters must not become gameplay authority
- simulation state is owned outside the renderer

The live implementation still has several narrow authority leaks and evidence limits:

- persisted empty transition/template facts can be recomputed during normalization
- route preview data can overwrite or mask known map facts
- return/stop route previews are not rebuilt as first-class server data
- idle actor projection can render from frontend target fields instead of backend position
- reset and camera hydration now have one public-H5 proof for `codexqa` at `tmp/verification/online-reset-spawn-visible-fixed-codexqa/2026-06-16T03-15-12-038Z/`; migration/repair of older live accounts remains a separate unproven step

## Step 1 - Stable Transition/Template Authority

Scope:

- Backend tile decoration and persistence boundary only.
- Preserve explicit authoritative empty `transitionKey`.
- Still compute deterministic transition keys for newly generated tiles that do not yet carry a `transitionKey`.
- Do not change marching, reset, camera, spawn, frontend render merge, or ownership logic in this step.

Implementation rule:

- A string `transitionKey`, including `''`, is an authored/materialized fact.
- A missing/non-string `transitionKey` means the tile still needs deterministic decoration.
- New generated tiles may compute transition keys.
- Persisted global tiles with `transitionKey: ''` must reload as `''` and must not be recomputed.

Automated test target:

```bash
node --test backend/tests/GameStateRepository.test.js backend/tests/WorldMapArchitecture.test.js
```

Manual test target:

- Use the current account without resetting.
- In the same visible area, march out and return through already rendered tiles.
- Only observe tile edge/transition templates on those already rendered tiles.
- Pass condition: the same known tile does not lose and regain its edge/transition template while moving out and back.
- Ignore actor snapping, return preview gaps, reset visibility, and camera position in this round.

## Step 2 - Return/Stop Route Footprint Authority

Scope:

- Backend world-explorer return/stop route rebasing.
- Rebuild or carry server-provided planned route footprint when a mission changes direction.
- Return-home routing must respect materialized world-map authority, including a spawned capital whose natural seed terrain would otherwise be blocked.
- Do not change actor interpolation or reset in this step.

Implementation rule:

- Return/stop responses should include planned route footprint data for the route the actor is about to traverse.
- The footprint must be server-generated and must not require the frontend to invent terrain.
- Route traversal checks use materialized `worldMap.tiles` before falling back to deterministic seed terrain, so authoritative capital/home tiles remain traversable.

Automated test target:

```bash
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameStateRepository.test.js
node --test backend/tests/WorldExplorerService.test.js
```

Manual test target:

- Start a medium-distance march.
- Click return before the march finishes.
- Only observe whether the return path reaches the capital/home tile and keeps route preview/render-ahead tiles.
- Ignore final-step snapping and reset/camera issues in this round.

## Step 3 - Idle Actor Position Follows Backend Position

Scope:

- Frontend actor projection for completed/idle march rows.
- Do not change backend route planning in this step.

Implementation rule:

- Active march animation can interpolate along route progress.
- Idle actor projection must use backend current/position fields, not stale target fields.
- Completion should not visually snap to a tile different from backend authority.

Automated test target:

```bash
node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/state/UIStatePresenter.test.js
```

Manual test target:

- March from the capital to a far tile.
- Only watch the final two steps and the first step after clicking return.
- Pass condition: the actor does not teleport to the final target before the route actually completes, and return starts from the backend current tile.
- Ignore reset/camera and one-ring preview details in this round.

## Step 4 - Route Footprint One-Ring Render-Ahead

Scope:

- Frontend planned tile normalization and render readiness.
- Preserve server authority: planned footprint data may add missing render-ahead tiles but must not overwrite known world-map tiles.
- Keep route-step progress separate from area visibility, especially on return-home routes where the capital can be inside the previous step's reveal radius.

Implementation rule:

- Before the actor steps into a route tile, that tile and its one-ring neighboring footprint should already be renderable.
- Known `worldMap.tiles` remain authoritative over terrain, water, transition, visibility, sites, ownership, and intel.
- Planned tiles only fill missing coordinates for preview/render-ahead.
- The render-ready footprint is derived from server-provided `plannedTiles`; the frontend may admit those planned tiles into the view, but must not synthesize terrain for coordinates the server did not provide.
- `revealedTileIds` means explored/visible map area; it must not mark an explicitly unrevealed `route[]` step as arrived.
- For legacy records that omitted `route[].revealed`, coordinate aliases may still canonicalize old revealed ids, but explicit `revealed: false` wins for route progress.

Additional issue found while testing Step 4:

- Return routes can reveal the home tile as part of the previous step's 3x3 area.
- The DTO mapper and frontend march snapshot were treating that map visibility as route arrival, which could project the return actor to the capital one tile early.
- The fix keeps the home tile visible/renderable while preserving the final route step as unreached until its own step time or backend route flag says it is reached.

Automated test target:

```bash
node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js frontend/js/state/UIStatePresenter.test.js backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js
```

Manual test target:

- Start a march into an unrevealed area.
- Only observe render-ahead behavior.
- Pass condition: before entering each route step, the destination tile and its adjacent one-ring footprint are already rendered.
- Ignore reset/camera and actor final-step snapping in this round.

## Step 5 - Known World Tiles Cannot Be Overwritten By Planned Tiles

Scope:

- Frontend view-state composition.
- This is the broader terrain/metadata overwrite guard after transition authority is stable.

Implementation rule:

- `worldMap.tiles` are authoritative for already known coordinates in the frontend view state.
- `plannedTiles` may add missing coordinates for render-ahead.
- `plannedTiles` must not overwrite terrain, water, transition, visibility, site, ownership, or intel fields of an existing `worldMap.tiles` entry.
- Derived render metadata for known tiles must also stay based on known/non-render-only map facts; render-only planned neighbors can draw themselves, but must not change a known tile's terrain-dependent render metadata such as mountain-neighbor counts.

Automated test target:

```bash
node --test frontend/js/state/UIStatePresenter.test.js frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js
```

Manual test target:

- Use an account with a visible tile near the capital.
- Start tutorial or manual march toward/through that already visible tile.
- Only observe whether the known tile's terrain/water/site/edge metadata changes after selecting the target, starting the march, or while the march is active.

## Step 6 - Reset 5x5 Visibility And Camera Audit

Scope:

- Reset lifecycle, player visibility cleanup, capital placement, and frontend post-reset camera.
- Confirm reset uses the new server state before moving the world camera.

Implementation rule:

- Reset releases the account's old owned territories/cities.
- Reset preserves shared global terrain facts that are not owned player state.
- New capital receives the intended `START_REVEAL_RADIUS = 2` starting area, meaning 25 visible tiles.
- Frontend camera centers on the new capital after receiving the reset state.

Automated test target:

```bash
node --test backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/auth.test.js frontend/js/state/UIStatePresenter.test.js
```

Implementation record:

- Added a repository reset contract test that resets an account to spawn `18,-4`, then verifies both the returned saved state and a fresh repository read keep `worldMap.origin = { q: 18, r: -4 }`, exactly 25 visible tiles, a controlled capital tile at the new spawn, and no previous player-only explored tile.
- Added a frontend action-controller contract test where the shell still has stale `0,0` state but `lastGame.state` has the new capital at `18,-4`; account-reset camera centering must use the updated game state behind the shell.
- Existing implementation already satisfies these contracts on this branch; this step protects the reset/camera behavior before changing later map systems.
- Public-H5 evidence added later in Step 19:
  - evidence path: `tmp/verification/online-reset-spawn-visible-fixed-codexqa/2026-06-16T03-15-12-038Z/`
  - before origin/capital: `tile_28_9`
  - before owned territories: `capital`, `site_30_11`
  - after origin/capital: `tile_-8_-25`
  - after visible tiles: `25`
  - after owned territories: `capital` only
  - capital was in render context and had a visible canvas hit target
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`, `verdict.pass = true`
- Post-reset tutorial closure evidence added later in Step 20:
  - evidence path: `tmp/verification/online-post-reset-tutorial-smoke/2026-06-16T03-20-54-068Z/`
  - verifier continued from the Step 19 post-reset state with `PLAYTEST_RESET_ACCOUNT=0`
  - starting capital: `-8,-25`
  - `stopReason = tutorial-completed`, `finalStep = 36`, `tutorialCompleted = true`
  - `visualFindings = 0`, `verificationFailures = 0`, `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`

Manual test target:

- Finish tutorial enough to own a city.
- Reset the account.
- Only check old ownership release, new capital 5x5 visibility, and camera centered on the new capital.

## Step 7 - Spawn Spacing And Reset Occupancy Avoidance

Scope:

- Spawn allocation and reset spawn lifecycle only.
- Fix the root cause where reset can allocate the new capital onto or too near an existing owned/shared city such as `123`.
- Do not hide another player's city by frontend or client-projection priority.

Implementation rule:

- New capitals must not be allocated onto any occupied city coordinate.
- Reset allocation must still treat the current account's pre-reset capital and owned cities as occupied while selecting the new spawn; those lands are released only after the new spawn is chosen.
- Default capital spacing must require more than 20 tiles from existing occupied coordinates. Distance 20 is still too close; distance 21 is the first acceptable boundary.
- Shared occupied city projection remains authoritative for other players' cities. The correct fix is spawn avoidance, not making the local capital cover another city.

Automated test target:

```bash
node --test backend/tests/SpawnAllocator.test.js backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js backend/tests/TerritoryClientAssembler.test.js
```

Manual test target:

- Use the account that previously reset into/onto `123`.
- Reset the account again.
- Only check that the new capital is not on `123`, not on any old owned city coordinate, has clear spacing from existing capitals/cities, and still has the 5x5 starting visibility.

## Step 8 - Planned Tutorial Site Materialization Guard

Scope:

- World explorer progression only.
- Prevent a planned tutorial empty-city site from being materialized over an already existing territory coordinate in the current authoritative player state.
- Do not change route planning, marching interpolation, frontend rendering, or reset behavior in this step.

Implementation rule:

- Before `materializePlannedSitesForStep()` inserts a planned site and binds it to a tile, it must check whether another territory already owns that coordinate.
- If the coordinate is already occupied by a different territory id, keep the planned site unmaterialized, do not overwrite the existing territory, do not bind the tile to the planned site, and do not grant `firstExploreEmptyCity`.
- Cross-player projection-aware re-planning during online progression remains a separate step because progression currently runs from canonical player state, while route planning receives shared-world projection at action time.

Automated test target:

```bash
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/WorldExplorerService.test.js backend/tests/GameRoutesTutorial.test.js
```

Manual test target:

- Start guided first-city exploration normally.
- Before the planned site materializes, create or simulate an existing territory at that same coordinate in the authoritative state.
- Only check that the existing territory is not overwritten and the tutorial first-city grant is not assigned to the stale planned site.

## Step 9 - Projection-Aware Online Progression Guard

Scope:

- Online/runtime progression context only.
- Ensure planned tutorial site materialization sees shared-world occupied coordinates during real user requests and background worker ticks.
- Do not change march interpolation, route generation, frontend rendering, or account reset behavior in this step.

Implementation rule:

- `applyOnlineProgress()` and `advanceRuntimeState()` must pass `planningContext` into world-explorer progression.
- `/api/game/action`, `/api/game/tasks/claim`, `/api/buildings/build`, and `WorldWorkerService` must provide the current `getClientProjectionForPlayer()` projection when they advance runtime state.
- `materializePlannedSitesForStep()` must reject a planned tutorial empty-city site when `planningContext.sharedWorldTerritories` already owns that coordinate.

Automated test target:

```bash
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameStateProjectionArchitecture.test.js backend/tests/WorldWorkerService.test.js backend/tests/GameRoutesTutorial.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Confirm the deployed frontend asset version matches the deployed commit.
- Start or continue the guided world exploration flow; only check that the game still loads and the world canvas is interactive after the projection-aware progression change.

## Step 10 - Tutorial Shield Debug Reset Guard

Evidence:

- Real online browser verification on `http://47.116.32.216/wxgame/` showed that clicking the visible tutorial dialogue `continue` area could open the `reset game progress` confirmation dialog.
- The old frontend contract intentionally let the debug reset action sit above tutorial shields, which conflicts with guided input safety.

Scope:

- Canvas tutorial/input guard only.
- Do not change spawn allocation, route planning, march interpolation, tile rendering, or backend progression in this step.

Implementation rule:

- The canvas debug reset account button must not render or register a hit target while a tutorial intro, tutorial highlight, or tutorial advisor dialogue is active.
- The shell input router must not allow `debugResetAccount` reset actions to bypass tutorial input blocking.
- Reward reveal close and explicit tutorial target actions remain allowed.

Automated test target:

```bash
node --test frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Confirm the deployed frontend asset version matches the deployed commit.
- On the guided tutorial dialogue screen, click the visible `continue` area once.
- Only check that the reset confirmation dialog does not appear and the tutorial/game canvas remains responsive.

## Step 11 - Tutorial Advisor Continue Hit Target Guard

Evidence:

- After Step 10, the same real online browser click no longer opened reset confirmation, but the visible tutorial `continue` area still did not advance because tutorial input blocking rejected the dialogue `closeAdvisor` action.

Scope:

- Canvas shell input routing only.
- Do not change tutorial flow steps, backend tutorial state, spawn allocation, route planning, march interpolation, or tile rendering in this step.

Implementation rule:

- `closeAdvisor` may pass tutorial input blocking only when a tutorial advisor dialogue is currently active and the action source matches that dialogue, or uses the generic tutorial advisor dialogue source.
- Stale `closeAdvisor` actions must remain blocked during guided highlights.
- Debug reset remains blocked during tutorial overlays.

Automated test target:

```bash
node --test frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Confirm the deployed frontend asset version matches the deployed commit.
- On the guided tutorial dialogue screen, click the visible `continue` area once.
- Only check that the current tutorial advisor dialogue closes or advances, and that no reset confirmation appears.

## Step 12 - Tutorial Advisor Hit Target Shield Priority

Evidence:

- Real online browser verification on deployed commit `c827cae0eb32` confirmed the frontend assets were current, and the tutorial advisor dialogue was visible.
- A calibrated click inside the visible advisor dialogue panel did not advance the dialogue.
- The map-home render order draws the tutorial advisor dialogue before the tutorial highlight; the later tutorial highlight adds a full-screen `blockCanvasModal` hit target above the dialogue hit target.

Scope:

- Canvas hit target priority only.
- Do not change tutorial flow steps, backend tutorial state, spawn allocation, route planning, march interpolation, tile rendering, or reset behavior in this step.

Implementation rule:

- A `closeAdvisor` hit target with an explicit tutorial dialogue `source` may pass through the tutorial shield hit target layer.
- A generic or stale `closeAdvisor` action without a source remains blocked by tutorial input routing.
- Debug reset and unrelated actions remain blocked during tutorial overlays.

Automated test target:

```bash
node --test frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Confirm the deployed frontend asset version matches the deployed commit.
- On the guided tutorial dialogue screen, click the visible `continue` area once.
- Only check that the current tutorial advisor dialogue closes or advances, and that no reset confirmation appears.

## Step 13 - Client Capital Projection Uses Current Origin

Evidence:

- Real online API verification on deployed commit `0b19d934c76f` for `test1` returned `worldMap.origin = { q: -6, r: 28 }`.
- The same response also returned two client capital tiles: stale `tile_0_0` and current `tile_-6_28`.
- The stale client capital can make camera targeting, tutorial highlight selection, and site hit targets prefer the wrong city after reset.

Scope:

- Backend client DTO/projection boundary only.
- Do not delete global world terrain facts.
- Do not hide or override another player's occupied non-capital city.
- Do not change spawn scoring, march interpolation, route footprint, or frontend rendering.

Implementation rule:

- The player's own `capital` territory in client projection must use `worldMap.origin` as the authoritative coordinate.
- A visible tile outside `worldMap.origin` must not be emitted as `siteId: "capital"` or `terrain: "capital"` to that player.
- Historical/global terrain can remain in authority tables, but stale legacy capital markers must not leak into the per-player client map.

Automated test target:

```bash
node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameStateProjectionArchitecture.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Confirm the deployed frontend asset version matches the deployed commit.
- Login `test1` and only check the starting tutorial/capital view.
- Pass condition: API/client state has exactly one capital tile at `worldMap.origin`; the canvas highlights the current capital, not stale `tile_0_0` or an old `123` city.

## Step 14 - Tutorial Capital Anchor Remains Clickable

Evidence:

- Real online playtest on deployed commit `3f487610d6ce600e22cf8d17ce6455f0265fa7c0` failed at `introStep = city`.
- The API state for the test account had `worldMap.origin = { q: 28, r: -7 }`, 25 visible `worldMap.tiles`, and one `capital` tile at `tile_28_-7`.
- The frontend world-tile view cache also had 25 tiles and a `capital` site, so this was not a backend 1-tile visibility failure.
- The final main HUD hit target list had no `openWorldSite`; it only had drag/background/UI targets and the tutorial shield.
- `TutorialCanvasRenderer.resolveTutorialIntroTarget()` could fall back to `getWorldSiteCanvasAnchor()` for the visual spotlight, but the anchor did not always carry an action. That produced a visible tutorial highlight without a click-through `openWorldSite` target.

Scope:

- Tutorial intro renderer hit target boundary only.
- Do not change backend spawn, reset lifecycle, world-map projection, route planning, march interpolation, or tile rendering.
- Do not create map facts. Only attach an input action to an already resolved current-capital canvas anchor.

Implementation rule:

- If the tutorial intro finds an existing `openWorldSite` target, keep using it.
- If it falls back to a world-site canvas anchor for the current capital, synthesize the same `openWorldSite` input action from that anchor's `siteId`/`tileId`.
- The spotlight focus rect itself must register that action so the tutorial shield can pass the intended tap through.

Automated test target:

```bash
node --test frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/CanvasGameShell.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Use a fresh or reset tutorial account at the first city intro dialogue.
- Only click the highlighted/visible capital area once.
- Pass condition: the intro advances to the next tutorial step or opens the capital flow; it must not stay stuck on the `点一下首都看看` dialogue and must not open reset confirmation.

## Step 15 - Render-Space Origin Keeps Current Capital On Canvas

Evidence:

- Real online playtest against public H5 failed after resetting the QA account on deployed commit `57ef27d4c5463341c58cf6c0b69c6e27cac4aa4b`.
- Failure evidence was saved under `tmp/verification/online-user-request-visual/2026-06-15T22-57-02-479Z/`.
- The API/frontend state had `worldMap.origin = { q: 28, r: 9 }`, capital `tile_28_9`, and 25 world-map tiles.
- The tutorial `openWorldSite` target existed, but its visible ratio was `0.000` and its fallback rect was `1x1` at the canvas edge. This proves the capital facts existed but were projected outside the playable canvas.

Scope:

- Frontend render-space projection only.
- Do not change backend spawn scoring, reset lifecycle, world authority, tile facts, site ownership, march timing, or tutorial flow.
- Absolute world coordinates such as `tile_28_9` remain authoritative in data, actions, logs, and server API payloads.

Implementation rule:

- Carry `worldMap.origin` into the tile-map presenter as a render viewport origin.
- Render projection subtracts the viewport world origin from absolute tile coordinates before computing screen centers.
- Screen-to-tile picking adds the same world origin back so clicks still dispatch absolute tile ids.
- Fog, map cache keys, site anchors, march actors, and layout fallbacks must share the same render-origin contract so one layer cannot drift from another.

Automated test target:

```bash
node --test frontend/js/domain/TileMapGeometry.test.js frontend/js/domain/WorldMarchGeometry.test.js frontend/js/domain/WorldMapRenderSnapshot.test.js frontend/js/platform/renderers/WorldMapLayoutModel.test.js frontend/js/platform/renderers/WorldMapLayoutFacade.test.js frontend/js/domain/WorldFogVisualSnapshot.test.js frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js frontend/js/domain/WorldMapPickingModel.test.js frontend/js/domain/WorldMapInputActionMap.test.js frontend/js/platform/renderers/WorldMapHitTargetModel.test.js frontend/js/platform/renderers/WorldMapHitTargetFacade.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Reset or use a fresh tutorial QA account.
- Only check the first tutorial city/capital target.
- Pass condition: the current capital at `worldMap.origin` is visible inside the canvas and the tutorial city target is clickable; the canvas must not be black/empty and must not point to an old `123` city.

## Step 16 - Camera Recenters With Render-Space Origin After Panels

Evidence:

- Real online browser playtest on deployed commit `cad6426576f315d96dd8e055448ed81d29f351c6` reached tutorial step `20` and then failed to reopen the capital for formation setup.
- Evidence was saved under `tmp/verification/online-world-march-full-flow/2026-06-15T23-17-02-670Z/`.
- Before closing the famous-person panel, the state had `worldPanX = 0`, `worldPanY = 0`, 48 tile hit targets, and two `openWorldSite` capital targets for `tile_28_9`.
- Immediately after closing the famous-person panel, the same state had `worldPanX = -1130.88`, `worldPanY = -1075.84`, no tile/site hit targets, and the screenshot showed an empty/black world-map area.
- The world tile view cache still had 25 tiles and the capital at `worldMap.origin = { q: 28, r: 9 }`, so this was a camera projection bug, not a backend visibility or tile-data loss.

Scope:

- Frontend world-map camera recentering only.
- Do not change backend spawn, reset, world facts, tutorial flow, panel state, route planning, or march interpolation.
- Keep manual drag pan behavior intact.

Implementation rule:

- Any camera recentering that projects a site coordinate must use the same render-space origin contract as tile rendering.
- For a capital at `worldMap.origin`, recentering should calculate from relative coordinate `0,0`, not from the absolute world coordinate.
- Closing panels, reset-world-pan, and account-reset camera recentering must not push the current capital outside the canvas when the world origin is non-zero.

Automated test target:

```bash
node --test frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/js/platform/CanvasGameShell.test.js frontend/js/platform/CanvasShellActionHandlers.test.js frontend/js/domain/TileMapGeometry.test.js frontend/js/platform/renderers/WorldMapLayoutModel.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Progress to the tutorial famous-person step and close the famous-person panel.
- Only check the returned world-map view.
- Pass condition: the 5x5 area and current capital remain visible/clickable after the panel closes; the canvas must not become empty/black and must not lose world tile hit targets.

Implementation and verification record:

- Commit `8f623fe57a094a12bf85da83785ec6d532f4732d` is deployed on the development server.
- Focused frontend/world-map tests passed: 124 pass.
- Architecture smoke passed locally and during remote deployment: 925 pass.
- Real online H5 verification on `http://47.116.32.216/wxgame/` with `codexqa / 123456` passed the Step 16 target.
- Evidence path: `tmp/verification/online-camera-origin-fix/2026-06-15T23-27-07-837Z/`.
- Key post-panel state: `worldPanX = 0`, `worldPanY = 25.28`, `openWorldSiteTargets = 5`, `pageErrors = 0`, `requestFailures = 0`, `badResponses = 0`.
- Screenshot evidence:
  - `highlight-closeFamousPersons-28-after-step-20-full.png`
  - `highlight-openWorldSite-29-before-full.png`
  - `highlight-openArmyFormation-32-after-step-21-full.png`
- Extended real online tutorial verification also passed from reset to tutorial completion on the same deployed commit.
- Extended evidence path: `tmp/verification/online-full-tutorial-after-camera-fix/2026-06-15T23-32-54-588Z/`.
- Extended result: `stopReason = tutorial-completed`, `finalStep = 36`, `actionCount = 51`, `verificationFailures = 0`, `visualFindings = 0`, `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`.
- This proves the Step 16 camera fix no longer blocks the guided tutorial chain, including formation setup, guided march start, first-city discovery, conquest, naming, and tutorial completion.
- This does not prove free long-distance manual marching or active return-home behavior. Those remain separate verification targets.

## Step 17 - Free Manual March And Return-Home Online Verification

Scope:

- Verification-first step for player-controlled free march after tutorial completion.
- Use the deployed H5 and real browser/player flow only.
- Do not change backend route planning, actor interpolation, render-ahead, camera, spawn, reset, or tutorial code until online evidence identifies the narrow failing boundary.

Implementation rule:

- The free manual route must be tested separately from the guided tutorial march because the tutorial only covers a short scripted exploration path.
- Evidence must include screenshots and JSON state around: target selection, march start, mid-route movement, return-home click, first return frame, final arrival or failure.
- If a failure is found, the next code change must choose only one owner: backend route authority, frontend actor projection, render-ahead normalization, or camera/hit target routing.

Automated test target:

```bash
node --test frontend/js/domain/WorldMarchProgressSnapshot.test.js frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js frontend/js/state/UIStatePresenter.test.js backend/tests/WorldExplorerService.test.js backend/tests/WorldExplorerDtoMapper.test.js backend/tests/WorldExplorerArchitecture.test.js
```

Manual/browser test target:

- Open the deployed game in the real browser at `http://47.116.32.216/wxgame/`.
- Use an account after tutorial completion with a saved formation.
- Start a longer manual march from the capital, click return-home while the actor is still moving, and observe only this route.
- Pass condition: the actor does not skip the final outbound tile, return starts from the current backend tile instead of flashing backward, the route preview stays visible, and the actor reaches the capital/home tile without stopping one tile early or snapping early.

### Step 17A - Online Tutorial Precondition Blocker: Action Revision Conflict

Evidence:

- Before free manual march can be verified, the QA account must first complete the deployed tutorial again after account reset.
- Real online H5 playtest against `http://47.116.32.216/wxgame/` with `codexqa / 123456` failed during tutorial step 25 on deployed commit `8f623fe57a094a12bf85da83785ec6d532f4732d`.
- Evidence path: `tmp/verification/online-step17-rerun-tutorial/2026-06-15T23-53-52-487Z/`.
- Screenshot evidence includes `highlight-conquer-44-before-full.png` and `highlight-conquer-44-after-step-25-full.png`.
- Frontend clicked the correct conquest target: `territoryId = site_3_-25`.
- API request body was `{ "action": "startConquest", "territoryId": "site_3_-25", "expedition": { "soldiers": 100 } }`.
- The deployed backend returned HTTP 500.
- Dev-server PM2 logs under user `www` showed the real cause: `Error: Game state revision conflict` from `GameStateRepository.save`.
- This is a gateway/worker concurrent-save conflict, not a frontend hit-target, route-choice, or world-render bug.

Scope:

- Backend `/api/game/action` route resilience only.
- Do not change map spawning, camera, world generation, marching interpolation, tutorial targets, or frontend render code in this step.
- Treat a single save revision conflict as retryable because the world worker may save the same player state between the route load and route save.

Implementation rule:

- Execute the action once on the latest loaded state.
- If `repository.save` throws `GAME_STATE_REVISION_CONFLICT`, reload the latest player state and retry the same action once.
- If the retry also conflicts, return HTTP 409 with `retryable: true` instead of HTTP 500.
- Keep the action validation and response view-building path identical between the first attempt and retry.

Automated test target:

```bash
node --check backend/routes/gameRoutes.js
node --test backend/tests/GameRoutesTutorial.test.js backend/tests/GameStateRepository.test.js backend/tests/WorldWorkerService.test.js
```

Manual/browser test target:

- Deploy this narrow backend retry fix to the development server.
- Open the deployed game in a real browser at `http://47.116.32.216/wxgame/`.
- Reset/login `codexqa / 123456` and rerun the tutorial automation until at least the first-city conquest step.
- Pass condition for this step only: the step-25 conquest action no longer returns HTTP 500; the browser evidence directory must contain screenshots and `summary.json`.
- After this passes, continue Step 17 free manual march/return-home verification as a separate target.

Implementation and verification record:

- Commit `402048df285641293c513bf9b739bb46f216a08a` was deployed on the development server.
- Local focused backend tests passed: 41 pass.
- Local and remote architecture smoke passed: 925 pass.
- Public `/api/version` confirmed `deployedCommit = 402048df285641293c513bf9b739bb46f216a08a`.
- The first real online H5 rerun after deployment did not reach the browser/tutorial action stage because `POST /api/player/login` returned HTTP 500.
- Server PM2 logs showed this new earlier blocker was also `GAME_STATE_REVISION_CONFLICT`, now from `backend/routes/playerRoutes.js` during login save.
- Therefore Step 17A fixed the game-action boundary but did not yet unblock the full browser test chain.

### Step 17B - Online Login Precondition Blocker: Login Revision Conflict

Evidence:

- Real online H5 playtest command:
  `npm.cmd run playtest:online-tutorial`
- Output directory requested: `tmp/verification/online-action-revision-retry/`.
- The run failed before browser screenshots because the first `POST http://47.116.32.216:3000/api/player/login` returned HTTP 500.
- Dev-server PM2 logs under user `www` showed `Error: Game state revision conflict` at `backend/routes/playerRoutes.js` during `AuthService.loginPlayer`.
- This is another gateway/worker concurrent-save boundary, not a frontend visual/rendering result.

Scope:

- Backend `/api/player/login` route resilience only.
- Do not change account whitelist rules, token generation, reset lifecycle, spawn assignment, game-action routing, world generation, camera, march, or frontend code in this step.
- Keep the auth service behavior stable; the route owns retrying the request because it owns the repository callbacks.

Implementation rule:

- Call `authService.loginPlayer` once with the same repository callbacks as before.
- If `repository.save` throws `GAME_STATE_REVISION_CONFLICT`, retry the same login once so it reloads the latest player state.
- If the retry also conflicts, return HTTP 409 with `retryable: true` instead of HTTP 500.
- Assemble the response from the successfully returned normalized state exactly as before.

Automated test target:

```bash
node --check backend/routes/playerRoutes.js
node --test backend/tests/GameStateProjectionArchitecture.test.js backend/tests/AuthServiceBotAccounts.test.js backend/tests/GameRoutesTutorial.test.js
npm.cmd run test:architecture
```

Manual/browser test target:

- Deploy this narrow login retry fix to the development server.
- Confirm public `/api/version` reports the new commit.
- Rerun the real online H5 tutorial automation with `codexqa / 123456`.
- Pass condition for this step only: login/reset/tutorial automation gets past `POST /api/player/login` without HTTP 500 and produces browser screenshots/`summary.json`.
- After this passes, re-check Step 17A conquest and then continue the separate Step 17 free manual march/return-home target.

Implementation and verification record:

- Commit `e5e39b9d0c49cb5077cb29d390b74b8debb182b2` is deployed on the development server.
- Local focused backend tests passed: 29 pass.
- Local architecture smoke passed: 926 pass.
- Remote pre-deploy architecture smoke passed: 926 pass.
- Public `/api/version` confirmed `deployedCommit = e5e39b9d0c49cb5077cb29d390b74b8debb182b2`.
- Real online H5 tutorial automation against `http://47.116.32.216/wxgame/` with `codexqa / 123456` passed from account reset to tutorial completion.
- Evidence path: `tmp/verification/online-login-action-revision-retry/2026-06-16T00-17-51-677Z/`.
- Result summary:
  - `stopReason = tutorial-completed`
  - `finalStep = 36`
  - `actionCount = 51`
  - `evidenceCount = 49`
  - `verificationReportCount = 53`
  - `badResponses = 0`
  - `requestFailures = 0`
  - `pageErrors = 0`
  - `verificationFailures = 0`
  - `visualFindings = 0`
- Step 17A conquest was re-verified in the same run:
  - `highlight-conquer-43-before-full.png`
  - `highlight-conquer-43-after-step-26-full.png`
  - `highlight-claimConquest-44-after-step-27-full.png`
- Final completion screenshot:
  - `close-advisor-step-35-after-step-36-full.png`
- In-app browser public-H5 screenshot:
  - `tmp/verification/in-app-public-e5e39b9d/public-h5-current.png`
- This proves the deployed H5 can reset/login the QA account, complete the guided tutorial, and pass the formerly failing first-city conquest step without HTTP 500.
- This still does not prove free long-distance manual marching or active return-home behavior. That remains the next Step 17 manual/browser test target.

### Step 17C - Online Free Manual March Active Return Verification

Evidence:

- Added repeatable online browser playtest command:
  `npm.cmd run playtest:online-manual-march`
- The playtest opens the deployed public H5 at `http://47.116.32.216/wxgame/`, logs in through the public API, clicks real canvas hit targets, starts a free manual march with formation slot 1, waits for a mid-route backend tile, clicks active return-home, and captures screenshots plus JSON state before and after every important action.
- First calibration run failed at `wait-open-picker` because canvas hit-target coordinates were being clicked as page coordinates while the canvas was centered in the browser viewport. Evidence path: `tmp/verification/online-manual-march-return/2026-06-16T00-34-02-581Z/`. This was a test harness coordinate-space issue, not product evidence.
- Second calibration run reached `startWorldMarch` but selected a one-step route because formation slot 1 was already idle outside the capital from prior testing. Evidence path: `tmp/verification/online-manual-march-return/2026-06-16T00-35-54-702Z/`. This proved the harness could click the real canvas flow, but the route was too short for the active return target.
- The harness now chooses a long target relative to the current formation position, not merely relative to the capital. This keeps the test valid when a saved formation is already parked away from home.
- Passing online evidence path: `tmp/verification/online-manual-march-return/2026-06-16T00-38-20-015Z/`.
- Public deployed version during the passing run:
  - `deployedCommit = 556f3abe8d610c8f13e7468b16e86e09e4cbebcf`
  - `deployedAt = 2026-06-16T00:24:21Z`
- Passing run summary:
  - `routeCount = 5`
  - selected target `tile_26_7`, distance 10 from the current formation start coordinate
  - active return clicked while the actor was at `tile_27_8`
  - immediately after return click, position stayed `tile_27_8`
  - first return frame position stayed `tile_27_8`
  - final position reached home/capital `tile_28_9`
  - `badResponses = 0`
  - `requestFailures = 0`
  - `pageErrors = 0`
  - `verdict.pass = true`
- Key screenshots:
  - `00-loaded-full.png`
  - `01-select-target-tile_26_7-after-full.png`
  - `03-start-march-slot-1-after-full.png`
  - `05-before-return-click-full.png`
  - `07-return-command-visible-full.png`
  - `08-click-return-home-after-full.png`
  - `10-first-return-frame-full.png`
  - `11-final-return-home-full.png`

Result:

- Step 17 active return-home behavior passed on the deployed H5 for the tested long manual route.
- This specifically proves: active return starts from the current backend tile, does not flash backward on the first return frame, and reaches the capital/home tile without stopping one tile early or snapping home early.
- This does not independently prove the no-return outbound final-step animation case. If the player still sees "walk from 1 to 6, then snap from 5 to 6" without clicking return, that should be the next separate target with its own screenshot/state evidence.

Next manual/browser test target:

- Open `http://47.116.32.216/wxgame/`.
- Use `codexqa / 123456` or another tutorial-completed account with a saved formation.
- Start a free manual march to a visibly long route relative to the formation's current parked position.
- For this step only, click return-home while the actor is still moving.
- Pass condition: the actor does not jump backward when return is clicked and ends on the capital/home tile.
- Ignore no-return final outbound snapping unless this new separate target is being tested.

### Step 17D - Online Free Manual March Complete Verification

Evidence:

- Added repeatable online browser playtest command:
  `npm.cmd run playtest:online-manual-march-complete`
- The playtest uses the deployed public H5 at `http://47.116.32.216/wxgame/`, public API `http://47.116.32.216:3000/api`, QA account `codexqa / 123456`, real browser canvas clicks, full-page screenshots, and JSON state snapshots. It does not use a local temporary server.
- The pre-fix online complete-mode run reproduced the reported no-return final-step problem:
  - Evidence path: `tmp/verification/online-manual-march-complete/2026-06-16T00-56-43-644Z/`
  - `routeCount = 6`
  - target `tile_26_7`
  - failure: `active actor disappeared during final route phase for 2 samples`
  - during the failure window, backend state still reported the mission active at `tile_27_8`, but actor hit targets were missing from the frontend render state.
- Fix commit deployed for the passing runs:
  - `141440eb2c37b2c9a206042e66bff36af3b53e63`
  - commit title: `keep manual march actor visible at final arrival`
  - public `/api/version` confirmed `deployedCommit = 141440eb2c37b2c9a206042e66bff36af3b53e63`
  - `deployedAt = 2026-06-16T01:05:31Z`
- First post-fix passing online evidence:
  - `tmp/verification/online-manual-march-complete-after-fix/2026-06-16T01-06-36-051Z/`
  - `routeCount = 7`
  - target `tile_33_14`
  - `activeActorDisappearances = []`
  - saw both penultimate and final route indices
  - final position reached `tile_33_14`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
- User-complaint rerun on the same deployed version:
  - `tmp/verification/online-manual-march-complete-rerun-user-complaint/2026-06-16T01-09-59-784Z/`
  - `routeCount = 8`
  - start/current formation origin `tile_33_14`
  - selected target `tile_25_6`
  - pre-final position `tile_26_7`
  - final position `tile_25_6`
  - final route indices sampled: `[6, 6, 6, 7]`
  - `activeActorDisappearances = []`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Key screenshots for the rerun:
  - `05-before-final-route-steps-full.png`
  - `complete-final-phase-step-06-1-full.png`
  - `complete-final-phase-step-06-2-full.png`
  - `complete-final-phase-step-06-3-full.png`
  - `complete-final-phase-step-07-4-full.png`
  - `06-final-route-complete-full.png`

Result:

- Step 17D no-return complete-mode behavior passed on the deployed public H5 for the tested long route.
- This specifically proves: during the final active route phase the actor remains represented in frontend hit targets, the script saw the penultimate route index and final route index, and the mission finishes on the selected target tile.
- The in-app Browser public-H5 screenshot taken during this loop proves the public page was opened, but it only showed the online H5 loading/tutorial surface. The behavioral proof is the real-browser Playwright screenshot/state evidence above.

Next manual/browser test target:

- Open `http://47.116.32.216/wxgame/`.
- Use a tutorial-completed account with a saved formation.
- Start one visibly long free manual march and do not click return-home.
- Watch only the final two route steps.
- Pass condition: the actor remains visible through the penultimate step, enters the final target tile, and finishes on that target tile without disappearing or snapping to completion.
- Ignore active return-home in this manual pass; that was Step 17C.

### Step 17H - Online Complete-Mode Final-Step Retest With Hit-Target Layer Diagnostics

Evidence:

- Improved `npm.cmd run playtest:online-manual-march-complete` diagnostics without changing product code.
- The playtest now records hit target ownership by layer:
  - `hitTargetLayers.renderer`
  - `hitTargetLayers.worldMapRuntime`
  - `hitTargetLayers.actorLayer`
  - per-sample `layerActorCounts`
- Calibration run before the diagnostic refinement:
  - `tmp/verification/online-manual-march-complete-final-step-visible-retest/2026-06-16T02-26-33-167Z/`
  - `routeCount = 5`
  - target `tile_33_13`
  - verdict failed with `active actor disappeared during final route phase for 1 samples`
  - screenshots still showed the actor visually present, so this was not enough to prove a visual disappearance; it proved the old verifier could not distinguish renderer/runtime/actor-layer hit-target ownership.
- Calibration run after first diagnostic refinement:
  - `tmp/verification/online-manual-march-complete-hit-target-layers/2026-06-16T02-34-08-382Z/`
  - stopped before marching at `wait-open-picker`
  - selected target `tile_24_7` was near the top HUD area
  - this was a verifier precondition miss, not final-step behavior evidence.
- Passing online evidence after restoring the main click surface while keeping layer diagnostics:
  - `tmp/verification/online-manual-march-complete-hit-target-layers/2026-06-16T02-36-00-505Z/`
  - public H5, visible browser, no local server
  - `routeCount = 9`
  - selected target `tile_24_6`
  - sampled final route indices `[7, 7, 7, 8]`
  - final position `tile_24_6` matched target
  - `activeActorDisappearances = []`
  - final phase renderer actor target count stayed at `2`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Key screenshots:
  - `05-before-final-route-steps-full.png`
  - `complete-final-phase-step-07-1-full.png`
  - `complete-final-phase-step-07-2-full.png`
  - `complete-final-phase-step-07-3-full.png`
  - `complete-final-phase-step-08-4-full.png`
  - `06-final-route-complete-full.png`

Result:

- Step 17H passed on the deployed public H5 for the tested 9-step route.
- This step strengthens Step 17D by proving the no-return final-step path with explicit renderer/runtime/actor-layer hit-target diagnostics.
- The previous single failed sample is now classified as insufficiently instrumented evidence, not a confirmed product regression.

Next manual/browser test target:

- Open `http://47.116.32.216/wxgame/`.
- Start one long free manual march, ideally 7 or more route steps, and do not click return-home.
- Watch only the final two route steps.
- Pass condition: the actor remains visible/clickable through the penultimate step, enters the target tile, and completes on that target tile.

### Step 17E - Online Known Tile Visual Template Stability Verification

Evidence:

- Added repeatable online browser playtest command:
  `npm.cmd run playtest:online-manual-march-templates`
- The playtest uses the deployed public H5 at `http://47.116.32.216/wxgame/`, public API `http://47.116.32.216:3000/api`, QA account `codexqa / 123456`, real browser canvas clicks, screenshots, and JSON state snapshots. It does not use a local temporary server.
- The test captures rendered tile signatures from the actual frontend render context and compares known tiles across the march flow.
- First calibration run exposed a test-harness false positive:
  - Evidence path: `tmp/verification/online-manual-march-templates-short/2026-06-16T01-39-11-670Z/`
  - Failure was caused by including `renderReady` in the visual signature.
  - The changed fields were state-only render lifecycle fields; `terrain`, `asset`, `water`, `templates`, `river`, `ocean`, `transition`, and `site` did not change.
- The harness was corrected so visual stability only compares fields that can change the tile's displayed appearance:
  - `terrain`
  - `asset`
  - `water`
  - `templates`
  - `river`
  - `ocean`
  - `transition`
  - `site`
- Passing online evidence:
  - `tmp/verification/online-manual-march-templates-visual/2026-06-16T01-41-59-372Z/`
  - `routeCount = 1`
  - selected target `tile_29_9`
  - `knownTileChangeCount = 0`
  - `stateOnlyChangeCount = 9`, all from `renderReady` changing from `1` to `0`
  - route render-ahead coverage for target `tile_29_9`: target rendered and all 6 neighboring tiles rendered
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Key screenshots:
  - `04-active-mission-started-full.png`
  - `05-template-short-route-complete-full.png`
  - `iab-public-h5-visible.png`

Result:

- Step 17E passed on the deployed public H5 for the tested short route.
- This specifically proves: known rendered tiles did not change visual identity across the tested march completion flow, and route-ahead coverage had the next target plus its six adjacent tiles rendered before completion.
- This does not prove every long-route edge/transition case yet. It is a regression guard and evidence harness for the exact complaint class: "the same known tile visibly changes while marching."

Next manual/browser test target:

- Open `http://47.116.32.216/wxgame/`.
- Use a tutorial-completed account with a saved formation.
- Pick one nearby visible land tile and start a free manual march.
- Watch only the already-visible tiles around the actor and target.
- Pass condition: the same visible tile keeps the same terrain/edge/transition/resource or city appearance while the actor moves and after the movement completes.
- Ignore long-route return-home behavior in this pass; Step 17C already covered that.

### Step 17F - Online Long Route Return With Known Tile Visual Stability

Evidence:

- Improved `npm.cmd run playtest:online-manual-march-templates` so long-route target selection records and filters by estimated route step count, not only hex distance.
- The harness now avoids clicking the moving actor while it overlaps a known site tile, because the public H5 can legitimately open the city/site panel instead of the marching troop command panel.
- Calibration evidence before the harness fix:
  - `tmp/verification/online-manual-march-templates-long-return/2026-06-16T01-47-34-484Z/`
  - selected target had `distance = 4`, but backend route only had `routeCount = 2`; this proved hex distance was not a reliable long-route test gate.
  - known tile visual signatures still had `knownTileChangeCount = 0`.
- Calibration evidence for site-overlap click:
  - `tmp/verification/online-manual-march-templates-long-return-routecount/2026-06-16T01-49-56-804Z/`
  - selected target had `routeStepCount = 4`, but the chosen return click occurred while the actor overlapped capital tile `tile_28_9`.
  - screenshot `06-select-active-actor-after-full.png` shows the capital/city command panel opened instead of the marching troop panel.
  - this was a harness click-target issue, not a tile-template conclusion.
- Passing online evidence after avoiding known site overlap:
  - `tmp/verification/online-manual-march-templates-long-return-safe-step/2026-06-16T01-54-21-135Z/`
  - `routeCount = 4`
  - selected target `tile_28_7`
  - `routeStepCount = 4`
  - return clicked from `tile_28_8`
  - first return frame stayed at `tile_28_8`
  - final return position `tile_28_9` matched home/capital
  - `knownTileChangeCount = 0`
  - `stateOnlyChangeCount = 25`, all render lifecycle noise such as `renderReady`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Key screenshots:
  - `05-before-return-click-full.png`
  - `07-return-command-visible-full.png`
  - `08-click-return-home-after-full.png`
  - `10-first-return-frame-full.png`
  - `11-final-return-home-full.png`

Result:

- Step 17F passed on the deployed public H5 for the tested 4-step route.
- This specifically proves: during a longer route with a real return-home action, known rendered tiles did not change visual identity, the return action started from the current backend tile, did not jump on the first return frame, and ended at the home/capital tile.
- It also exposed a verifier sampling risk: route render-ahead coverage was not fully proven for every route step in that run. The suspected missing neighbor must not be treated as a product bug until the harness captures a render snapshot at each route-index transition.

Next manual/browser test target:

- Open `http://47.116.32.216/wxgame/`.
- Start a visibly longer free manual march, ideally at least 4 route steps.
- Click return-home while the actor is on a non-city/non-site tile.
- Watch only two things:
  - the same already-visible terrain/edge/transition/resource/city visuals do not change while leaving and returning;
  - the actor starts return from its current tile and ends on the capital.
- Ignore route-ahead six-neighbor completeness in this pass; Step 17G is the separate verifier target for before-entry coverage.

### Step 17G - Online Route Before-Entry Render Coverage Verification

Evidence:

- Improved `npm.cmd run playtest:online-manual-march-templates` to capture a full render snapshot whenever the active mission `routeIndex` changes:
  - `outbound-step-00-render-full.png`
  - `outbound-step-01-render-full.png`
  - `outbound-step-02-render-full.png`
- The verifier now reports `routeBeforeEntryCoverage` and `missingBeforeEntryCoverage`, so the pass/fail condition is tied to the frame before the actor enters each route step.
- First calibration run before per-route snapshots:
  - `tmp/verification/online-manual-march-templates-before-entry-coverage/2026-06-16T02-06-55-163Z/`
  - reported missing neighbor coverage, but this still used sparse snapshots and was not definitive product evidence.
- Passing online evidence after per-route-index snapshots:
  - `tmp/verification/online-manual-march-templates-before-entry-route-snapshots/2026-06-16T02-11-40-255Z/`
  - `routeCount = 4`
  - selected target `tile_24_7`
  - `knownTileChangeCount = 0`
  - `missingBeforeEntryCoverage = []`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Fresh visible-browser retest on deployed public H5:
  - `tmp/verification/online-manual-march-templates-before-entry-visible-retest/2026-06-16T02-16-15-396Z/`
  - URL confirmed by in-app browser screenshot `iab-public-h5-after-retest.png`: `http://47.116.32.216/wxgame/`
  - page title: `文明火种`
  - `routeCount = 4`
  - selected target `tile_24_7`
  - final return position `tile_28_9` matched home/capital
  - `knownTileChangeCount = 0`
  - `missingBeforeEntryCoverage = []`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Fresh retest before-entry coverage:
  - step 0 `tile_27_8`: before `04-active-mission-started`, self and all 6 neighbors rendered.
  - step 1 `tile_26_7`: before `outbound-step-00-render`, self and all 6 neighbors rendered.
  - step 2 `tile_25_7`: before `outbound-step-01-render`, self and all 6 neighbors rendered.
  - step 3 `tile_24_7`: before `outbound-step-02-render`, self and all 6 neighbors rendered.

Result:

- Step 17G passed on the deployed public H5 for the tested 4-step route.
- The previous suspected missing-neighbor issue is now classified as a verifier sampling flaw, not confirmed product behavior.
- This step specifically proves the tested route's next tile and its adjacent ring were rendered before actor entry, while known tile visual identity stayed stable and return-home still ended on the capital.

Next manual/browser test target:

- Open `http://47.116.32.216/wxgame/`.
- Start a free manual march with about 4 route steps.
- Watch each next tile before the actor enters it.
- Pass condition:
  - the next tile is already visible before actor entry;
  - the next tile's six adjacent tiles are already rendered before actor entry;
  - visible terrain/edge/transition/resource/city identity does not change while the actor passes;
  - return-home starts from the actor's current tile and ends on the capital.

### Step 18 - Evidence-First Public-H5 Render And Return Retest

Evidence:

- This step exists because the manual acceptance flow requires visible browser proof, screenshots, and exact test steps instead of a text-only "passed" report.
- Visible in-app browser proof:
  - URL: `http://47.116.32.216/wxgame/?codexEvidence=public-h5-visible-20260616`
  - screenshot: `tmp/verification/public-h5-browser-visible-20260616/public-h5-visible.png`
  - browser info: `tmp/verification/public-h5-browser-visible-20260616/browser-info.json`
- Passing public-H5 automated evidence:
  - command: `npm.cmd run playtest:online-manual-march-templates`
  - output: `tmp/verification/online-visible-step18-render-return-proof/2026-06-16T02-49-16-094Z/`
  - deployed URL: `http://47.116.32.216/wxgame/?codexManualMarchReturn=2026-06-16T02-49-16-094Z`
  - `routeCount = 4`
  - selected target `tile_28_7`
  - return clicked from `tile_27_7`
  - first return frame stayed at `tile_27_7`
  - final return position `tile_28_9` matched home/capital
  - `knownTileChangeCount = 0`
  - `missingBeforeEntryCoverage = []`
  - `badResponses = 0`, `requestFailures = 0`, `pageErrors = 0`
  - `verdict.pass = true`
- Key screenshots:
  - `outbound-step-00-render-full.png`
  - `outbound-step-01-render-full.png`
  - `outbound-step-02-render-full.png`
  - `05-before-return-click-full.png`
  - `07-return-command-visible-full.png`
  - `11-final-return-home-full.png`

Result:

- Step 18 passed on the deployed public H5 for the tested 4-step route.
- This step proves the tested route's before-entry render coverage, known-tile visual stability, and active return-home completion with visible public-H5 evidence.
- No product code change was made in this step.

Next manual/browser test target:

- Open only `http://47.116.32.216/wxgame/`.
- Start one about-4-step free manual march.
- Watch only:
  - the next route tile and its adjacent ring are rendered before actor entry;
  - already visible terrain/edge/transition/resource/city visuals do not change while the actor passes;
  - return-home starts from the current actor tile and ends on the capital.
- Ignore unrelated tutorial/spawn/camera issues during this specific pass unless they block the test.

## Non-Goals

- No frontend redesign.
- No isolated per-account fake world.
- No single god service for world-map, spawn, tutorial, marching, and rendering.
- No local production-data rewrite without an explicit migration/test step.
- No one-shot rewrite of the full map stack.
