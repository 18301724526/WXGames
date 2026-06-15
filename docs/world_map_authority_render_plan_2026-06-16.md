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

The live implementation still has several narrow authority leaks:

- persisted empty transition/template facts can be recomputed during normalization
- route preview data can overwrite or mask known map facts
- return/stop route previews are not rebuilt as first-class server data
- idle actor projection can render from frontend target fields instead of backend position
- reset and camera hydration are not yet proven against the 5x5/new-capital contract

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

## Non-Goals

- No frontend redesign.
- No isolated per-account fake world.
- No single god service for world-map, spawn, tutorial, marching, and rendering.
- No local production-data rewrite without an explicit migration/test step.
- No one-shot rewrite of the full map stack.
