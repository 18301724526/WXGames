# Tile World Map V2 Codex Handoff

Handoff date: 2026-06-01

App version: `0.1.188`

Feature version: `tile-world-map-v2-lab-runtime`

## Current State

The game runtime now uses the tile-map lab semantics for the military world map. The important fix is that new and old world maps both receive the same v2 micro-terrain bootstrap, so entering the game should no longer show only the old radar or a partial one-tile map when the server state is fresh.

## Key Files

- `backend/services/WorldMapService.js`: v2 micro terrain, ocean template selection, river ports, river-mouth conflict rules, capital protection.
- `frontend/js/config/TileMapAssetManifest.js`: runtime asset manifest for terrain, sites, water loops, river templates, ocean templates, and transition templates.
- `frontend/js/state/UIStatePresenter.js`: converts persisted `worldMap.tiles` into renderer-ready `templateAssets` and water metadata.
- `frontend/js/platform/CanvasGameRenderer.js`: isometric crop, template-water composition, dry-template fallback, overlay placement, and tile-map rendering.
- `frontend/js/platform/CanvasGameApp.js` and `frontend/js/platform/CanvasGameShell.js`: water animation re-render timer.
- `frontend/tools/tile-map-lab.js`: still the calibration and semantic reference tool, not a runtime dependency.

## Runtime Contract

`worldMap.version = 2` tiles may include:

```js
{
  id: "tile_4_1",
  q: 4,
  r: 1,
  terrain: "ocean",
  oceanTemplates: ["river-mouth-sw"],
  riverPorts: [],
  transitionKey: "",
  siteId: null
}
```

Renderer-ready frontend tiles additionally include:

```js
{
  templateAssets: [{ key: "river-mouth-sw", type: "ocean", asset: "..." }],
  water: { kind: "ocean", asset: "...", uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 }
}
```

Do not infer template roles from filenames in new code. Use `oceanTemplates`, `riverPorts`, `transitionKey`, and `TileMapAssetManifest`.

## Important Rules

- `full` ocean means looping ocean water only, not shore.
- Single-side shore edges wrap ocean sides.
- Shore corner tiles fill the four diagonal corner gaps.
- River mouths replace a single-side ocean shore edge only when the tile is not an ocean shore corner.
- Ocean shore corners and river paths conflict; no river should pass through those corner tiles.
- The capital tile always remains `terrain: "capital"`.

## Verification Commands

```powershell
node --check backend\services\WorldMapService.js frontend\js\config\TileMapAssetManifest.js frontend\js\state\UIStatePresenter.js frontend\js\platform\CanvasGameRenderer.js frontend\js\platform\CanvasGameShell.js frontend\js\platform\CanvasGameApp.js frontend\js\controllers\TerritoryController.js
node --test backend\tests\world-map-service.test.js backend\tests\territory-service.test.js backend\tests\game-state-repository.test.js frontend\tests\ui-state-presenter.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\resource-art.test.js frontend\tests\tile-map-lab.test.js frontend\tests\version-number.test.js frontend\tests\stage5-version.test.js
```

Browser smoke:

1. Start the backend and local preview server.
2. Open `http://127.0.0.1:8080/`.
3. Confirm `/api/version` and `/api/game/state` do not return 500.
4. Confirm loaded script URLs include `tile-world-map-v2-lab-runtime`.
5. Enter military world view and confirm the tile map is visible instead of the radar fallback.

## Likely Failure Points

- Server not running or bad local state can still produce `/api/version` or `/api/game/state` 500s.
- If `territoryState.worldMap.tiles` is empty, the renderer intentionally falls back to radar.
- If image assets fail to load, the renderer falls back to colored diamonds; check Network for missing `assets/art/tile-map/...` files.
- If a future procedural generator changes ocean cores without updating shore and river-mouth rules, shore corners can conflict with rivers again.

## Rollback Notes

Rollback by reverting the v2 commit. For a frontend-only emergency rollback, restore the previous V1 HTML cache strings and renderer/presenter files. For a backend rollback, revert `WorldMapService` and related tests together; do not leave the v2 frontend expecting `templateAssets` if the backend no longer provides `worldMap.version = 2`.
