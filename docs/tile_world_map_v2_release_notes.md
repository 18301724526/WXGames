# Tile World Map V2 Release Notes

Release date: 2026-06-01

App version: `0.1.188`

Feature version: `tile-world-map-v2-lab-runtime`

Data version: `worldMap.version = 2`

## Scope

This release fixes the gap between the tile-map lab and the in-game military world view. V1 only connected a simplified tile map into the game; V2 moves the lab-approved ocean, shoreline, river, river-mouth, transition, crop, water-loop, and overlay semantics into the runtime path.

The military world view now renders the tile map first when `territoryState.worldMap.tiles` exists. The old radar remains only as a fallback for missing map data.

## Backend Changes

- `WorldMapService` now uses `WORLD_MAP_VERSION = 2`.
- New and upgraded world maps bootstrap the same micro terrain layout used by the lab.
- The capital tile is protected from ocean/river semantic overrides, even when adjacent to the central lake.
- Ocean semantics include full water, shore edges, shore corners, and river-mouth templates.
- River semantics include fixed river ports for the current micro terrain river path.
- River mouths attach only to single-side ocean shore edges, and ocean shore corner coordinates block river mouths to avoid tile conflicts.

## Frontend Changes

- `TileMapAssetManifest` exposes lab-aligned terrain, site, water, river-template, ocean-template, and transition-template assets.
- `UIStatePresenter.buildWorldTileMapViewState` forwards `templateAssets`, `water`, `riverPorts`, `oceanTemplates`, and `transitionKey` to the renderer.
- `CanvasGameRenderer.renderWorldTileMap` now uses the standard isometric crop from the lab and calibrated overlay offsets.
- Ocean and river tiles animate loop textures through template masks when available.
- River-mouth tiles split water into ocean shore-edge and river-bank layers, then draw the dry river-mouth template over them.
- If mask composition is unavailable in a target runtime, the renderer falls back to a visible diamond water fill plus template draw instead of rendering an empty or broken tile.
- H5 cache query strings for tile-map runtime scripts were bumped to `tile-world-map-v2-lab-runtime`.

## Verification

- `node --check` for changed backend/frontend runtime files.
- Backend world-map, territory, and repository tests.
- Frontend presenter, renderer, resource, tile-map-lab, and version tests.
- Browser smoke against local `http://127.0.0.1:8080/` and backend API endpoints is required before deployment sign-off.
- Test case workbook: `docs/tile_world_map_v2_test_cases.xlsx`.

## Known Risks

- V2 uses a deterministic micro-terrain bootstrap, not a full procedural world generator.
- Canvas template masking depends on browser canvas readback. The fallback path is visible and stable, but less precise than the lab-style mask composite.
- Existing old saves are upgraded on normalize; if a player already has unusual custom `worldMap` tiles, the v2 bootstrap may add surrounding lab micro-terrain around them.
- The old radar fallback still exists for safety. If `worldMap.tiles` is missing, the player may still see radar instead of the tile map.
- Full mobile visual QA should still check dense site clusters, long scout routes, and water animation performance.

## Rollback

Preferred rollback is a full revert of the `0.1.188 / tile-world-map-v2-lab-runtime` commit.

The database can keep the `worldMap` column. Older code that does not read `worldMap.version = 2` will ignore the extra semantic fields. If only the frontend must be rolled back, restore the previous HTML cache strings and the V1 renderer/presenter files; the backend can continue storing v2 world-map data but it will not be visible as the new tile map.
