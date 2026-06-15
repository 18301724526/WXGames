# World Map Authority And Render Continuity Plan - 2026-06-16

## Goal

Bring the world-map implementation back in line with the shared-world SLG contract:

- one real shared world map
- server-owned terrain, visibility, ownership, and reset results
- stable 5x5 starting visibility around the capital
- account reset clears player-owned state without deleting another player's world facts
- render-ahead tiles support smooth marching without changing known terrain
- frontend planned data never overrides authoritative world-map tiles

## Current Gap

The existing architecture documents already define the right direction:

- materialized global terrain is first-writer-wins
- player visibility is separate from global terrain
- `plannedTiles` are exploration plans before reveal, not world facts
- frontend render caches and presenters must not become gameplay authority

The live code still has a narrow but serious gap in the presentation chain:

- `WorldTileMapPresenter.buildWorldTileMapViewState()` merges `plannedTiles` after `worldMap.tiles`.
- When a planned tile has the same coordinate as an existing world tile, the planned tile can overwrite display fields such as `terrain`.
- This can make a previously rendered tile appear to change during a march or tutorial operation.

## Step 1 - Planned Tiles Cannot Override Known World Tiles

Scope:

- Frontend view-state composition only.
- Preserve existing render-ahead behavior for unknown tiles.
- Do not change backend generation, spawn allocation, reset lifecycle, or persistence in this step.

Implementation rule:

- `worldMap.tiles` are authoritative for already known coordinates in the frontend view state.
- `plannedTiles` may add missing coordinates for render-ahead.
- `plannedTiles` must not overwrite terrain, water, transition, visibility, site, or intel fields of an existing `worldMap.tiles` entry.

Automated test target:

```bash
node --test frontend/js/state/UIStatePresenter.test.js frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js
```

Manual test target:

- Use an account with a visible tile near the capital.
- Start tutorial or manual march toward/through that already visible tile.
- Confirm the tile's terrain does not change after selecting the target, starting the march, or while the march is active.
- Confirm unknown route-ahead tiles still appear before the unit steps into them.

## Step 2 - Route Footprint Render-Ahead Contract

Scope:

- Ensure the frontend renders the route target tile and its one-ring footprint before arrival.
- The footprint must use server-provided planned data or authoritative world-map tiles, not frontend-generated terrain.

Automated test target:

```bash
node --test frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js frontend/js/state/UIStatePresenter.test.js backend/tests/WorldExplorerArchitecture.test.js
```

Manual test target:

- Start a march into an unrevealed area.
- Before the actor enters each route step, confirm the destination tile and its one-ring neighboring tiles are visible/rendered.

## Step 3 - Backend Planned/Reveal Authority Hardening

Scope:

- Make the backend distinction explicit between planned previews and committed global terrain.
- Verify reveal uses first-writer-wins global terrain and does not let stale planned terrain overwrite an already materialized global tile.

Automated test target:

```bash
node --test backend/tests/WorldExplorerArchitecture.test.js backend/tests/GameStateRepository.test.js backend/tests/WorldMapArchitecture.test.js
```

Manual test target:

- Have one account reveal a tile.
- Have another account later route through the same coordinate.
- Confirm both accounts see the same terrain once the second account gains visibility.

## Step 4 - Reset View And Starting Visibility Audit

Scope:

- Confirm reset creates 25 visible starting tiles around the new capital.
- Confirm frontend camera centers on the new capital after reset.
- Confirm old player visibility and owned territories are cleared while global terrain for other players remains.

Automated test target:

```bash
node --test backend/tests/SpawnLifecycleService.test.js backend/tests/GameStateRepository.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js frontend/auth.test.js frontend/js/state/UIStatePresenter.test.js
```

Manual test target:

- Finish tutorial enough to own a city.
- Reset the account.
- Confirm old ownership is released.
- Confirm the new capital shows 5x5 visibility.
- Confirm the camera is centered on the new capital.

## Non-Goals

- No frontend redesign.
- No single god service for world-map, spawn, tutorial, and rendering.
- No local production-data rewrite without an explicit migration/test step.
- No one-shot rewrite of the full map stack.
