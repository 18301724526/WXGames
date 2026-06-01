# Tile World Home Step 1

## Goal

The first step moves the unlocked tile world map from "a military panel" to "the home surface". The player should enter the game already looking at the world, then use lightweight HUD controls to open existing systems.

This step is intentionally structural. It does not redesign city management, army management, events, or conquest rules.

## Three-Layer Interface

Layer 1 is the full-screen tile map. It owns the emotional weight of the home screen: drag, inspect, select cities, sites, routes, and armies.

Layer 2 is the lightweight HUD. The top bar keeps resources and polity status. The bottom dock keeps the existing main entries: home/map, buildings, tech, events, civilization, and military. In this step those entries still use the existing panels.

Layer 3 is contextual detail. Selecting a world site still opens the existing world-site modal. Later steps can replace this with right-side or half-screen context panels.

## Step 1 Scope

When `currentEra >= 5` and `territoryState.worldMap.tiles` exists, the default home view resolves to `military/world` and is flagged as `isMapHome`.

Early saves without an unlocked tile map keep the existing `resources/army` flow so tutorial and era locks are not broken.

H5 and mini-game both use the same presenter helper, `resolveMapHomeViewState`, so startup, state sync, and render calls agree on the active view.

The H5 dual-canvas path renders the passive world map layer in map-home mode. The foreground HUD canvas keeps hit targets, top resources, dock, modals, and tutorial overlays.

## Later Steps

Step 2 should attach city management to map objects. The capital and subcities become first-class map selections.

Step 3 should attach scouting, armies, battle reports, and event points directly to the map, so the world visibly changes while the player plays.

## Test Method

Automated:

- `cd E:\Human\wxgame\backend`
- `node --test ../frontend/tests/ui-state-presenter.test.js ../frontend/tests/h5-canvas-runtime.test.js ../frontend/tests/minigame-platform.test.js ../frontend/tests/shared-canvas-renderer.test.js`
- `npm test`

Manual:

- Open a save at classical era or later with tile world-map data.
- Expected: the first playable screen is the tile map; map drag works; top resources stay visible; dock entries still open existing systems; tapping a discovered site opens the existing site detail.
- Open a pre-classical save.
- Expected: the original early home/tutorial flow remains visible and world/scout views stay locked.

## Expected Result

The game should feel like the player is governing from the world map instead of entering a separate military page. No backend API, database, or saved-state migration is required for this step.
