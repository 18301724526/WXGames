# Tile World Map V2 Release Notes

Release date: 2026-06-01

App version: `0.1.189`

Feature version: `tile-world-map-v2-lab-parity`

Data version: `worldMap.version = 2`

## Scope

This release fixes the remaining visual gap between the tile-map lab and the in-game military world view. V2 already moved the lab-approved ocean, shoreline, river, river-mouth, transition, crop, water-loop, and overlay semantics into the runtime path; `0.1.189` tightens the renderer so the game uses the same draw metrics and overlay anchoring as the lab instead of approximations.

The military world view now renders the tile map first when `territoryState.worldMap.tiles` exists. The old radar remains only as a fallback for missing map data.

## Backend Changes

- `WorldMapService` now uses `WORLD_MAP_VERSION = 2`.
- New and upgraded world maps start from the persisted capital tile; newly scouted coordinates derive terrain from deterministic world rules.
- The capital tile is protected from ocean/river semantic overrides, even when adjacent to the central lake.
- Ocean semantics include full water, shore edges, shore corners, and river-mouth templates.
- River semantics derive a stable river channel and river-mouth template from the ocean basin rules.
- River mouths attach only to single-side ocean shore edges, and ocean shore corner coordinates block river mouths to avoid tile conflicts.
- Scout site outcomes now evaluate the revealed area and bind the site to the highest-scoring valid land tile, instead of forcing the mission target coordinate to host the site.
- Scout missions now choose the controlled border that is farthest in the requested direction as their route origin, so exploration continues outward from occupied territory instead of always starting at the active city.

## Frontend Changes

- `TileMapAssetManifest` exposes lab-aligned terrain, site, water, river-template, ocean-template, and transition-template assets.
- `UIStatePresenter.buildWorldTileMapViewState` forwards `templateAssets`, `water`, `riverPorts`, `oceanTemplates`, and `transitionKey` to the renderer.
- `CanvasGameRenderer.renderWorldTileMap` now uses the standard isometric crop from the lab and calibrated overlay offsets.
- Terrain draw rectangles use the lab overdraw (`edgeOverdraw = 1.5`) instead of a hand-written game-only size.
- Tile source crops now come from each asset's alpha bounds. Ocean and transition templates use the plains tile alpha bounds exactly like the lab.
- Forest and mountain terrain now render as plains base tiles plus tree/mountain overlays, matching the lab composition model.
- Tree, mountain, hills, waste, and site overlays now use lab-style alpha crop, aspect ratio, deterministic jitter, shadow ellipses, and owner dot placement.
- Ocean and river tiles animate loop textures through template masks when available.
- River-mouth tiles split water into ocean shore-edge and river-bank layers, then draw the dry river-mouth template over them.
- River/ocean transparent water masks now use the plains terrain alpha when available, matching the lab's mask builder.
- Water UV phase now uses tile world coordinates rather than screen center approximations, so adjacent water tiles stay visually coherent while panning.
- Water/dry-template caches no longer permanently cache an unloaded image as a missing mask.
- If mask composition is unavailable in a target runtime, the renderer falls back to a visible diamond water fill plus template draw instead of rendering an empty or broken tile.
- H5 cache query strings for tile-map runtime scripts were bumped to `tile-world-map-v2-lab-parity`.

## Verification

- `node --check` for changed backend/frontend runtime files.
- Backend world-map, territory, and repository tests.
- Frontend presenter, renderer, resource, tile-map-lab, and version tests.
- Browser smoke against local `http://127.0.0.1:8080/` and backend API endpoints is required before deployment sign-off.
- Test case workbook: `docs/tile_world_map_v2_test_cases.xlsx`.

## Known Risks

- V2 uses a deterministic micro-terrain bootstrap, not a full procedural world generator.
- Canvas template masking and alpha-bound cropping depend on browser canvas readback. The fallback path is visible and stable, but less precise than the lab-style mask composite.
- Existing old saves are upgraded on normalize; if a player already has unusual custom `worldMap` tiles, the v2 bootstrap may add surrounding lab micro-terrain around them.
- The old radar fallback still exists for safety. If `worldMap.tiles` is missing, the player may still see radar instead of the tile map.
- The game view is clipped by the military panel and scaled to fit that panel, so it should match the lab's tile composition and anchoring, but not the lab's full-page framing controls.
- Full mobile visual QA should still check dense site clusters, long scout routes, and water animation performance.

## Rollback

Preferred rollback is a full revert of the `0.1.189 / tile-world-map-v2-lab-parity` commit.

The database can keep the `worldMap` column. Older code that does not read `worldMap.version = 2` will ignore the extra semantic fields. If only the frontend must be rolled back, restore the previous HTML cache strings and the V1 renderer/presenter files; the backend can continue storing v2 world-map data but it will not be visible as the new tile map.
