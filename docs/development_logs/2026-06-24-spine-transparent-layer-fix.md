# 2026-06-24 Spine Transparent Layer Fix

## Problem

When the tutorial advisor Spine animation appeared, the tile map could disappear and expose the background image. The failure was reproducible when the Spine layer was present, which pointed to physical canvas composition rather than terrain rendering.

## Root Cause

The tutorial advisor Spine renderer created a WebGL visual surface outside the registered physical canvas stack. That surface could occupy the full game frame above `worldMap` and `worldActor`, so WebView canvas compositing could hide the tile map even though the map layer was still alive and populated.

This was not a world-map cache invalidation issue and not a case for adding map clear or repaint workarounds.

## Fix

- Registered `tutorialSpine` in `CanvasLayerRegistry` as a transparent WebGL screen-overlay layer above `mainHud`.
- Registered `tutorialDialogue` as a transparent 2D screen-overlay layer above `tutorialSpine`.
- Routed tutorial Spine and dialogue layer creation through `ensureCanvasLayer()` when shell helpers are available.
- Added runtime fallback wrapping with `CanvasLayerRegistry.getLayerOptions()` so fallback creation still uses registered z-index, context type, and pointer policy.
- Removed detached/offscreen Spine canvas fallback and deleted the old `createTutorialSpineCanvas` facade path.
- Removed fixed Spine `viewFocus` support from `SpineWebglPlayer`.
- Added skeleton-bounds reporting from `SpineWebglPlayer` and fitted the physical `tutorialSpine` rect from the requested portrait rect plus actual Spine bounds.
- Kept player input ownership on `mainHud`; tutorial overlay layers use `pointer-events: none`.

## Non-Goals

- No map/HUD clear strategy was introduced.
- No full-screen Spine overlay was retained.
- No hardcoded Spine crop rectangle or fixed view-focus constant was retained.

## Regression Coverage

- `CanvasLayerRegistry.test.js` verifies tutorial overlay layer registration and stack order.
- `H5CanvasRuntime.test.js` verifies fixed overlay rect clipping and metrics.
- `TutorialCanvasRenderer.test.js` verifies registered clipped Spine layer creation, skeleton-bounds rect fitting, and runtime fallback registry options.
- `WorldMapLayerOwnershipContract.test.js` rejects detached Spine canvas fallback and fixed view-focus restoration.

## Verification

```powershell
node --check frontend/js/platform/renderers/TutorialAdvisorCanvasRenderer.js
node --check frontend/js/platform/SpineWebglPlayer.js
node --check frontend/js/platform/renderers/CanvasAssetRenderer.js
node --check frontend/js/platform/CanvasGameRendererCoreFacades.js
node --check frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js
node --test frontend/js/platform/CanvasLayerRegistry.test.js frontend/js/platform/H5CanvasRuntime.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/CanvasAssetRenderer.test.js frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js
```

Result: 56 focused tests passed.

## Risk And Rollback

Main risk is tutorial advisor animation failing to initialize on a browser with unavailable Spine WebGL support. In that case the renderer falls back to the static advisor image rather than creating an unregistered Spine surface.

Rollback should revert the registered tutorial layer change as one unit. Do not reintroduce full-screen or detached Spine canvases as a rollback shortcut.
