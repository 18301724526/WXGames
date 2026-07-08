# 2026-06-24 Spine Transparent Layer Fix

## Problem

When the tutorial advisor Spine animation appeared, the tile map could disappear and expose the background image. The failure was reproducible when the Spine layer was present, which pointed to physical canvas composition rather than terrain rendering.

## Root Cause

The tutorial advisor Spine renderer created a WebGL visual surface outside the registered physical canvas stack. That surface could occupy the full game frame above `worldMap` and `worldActor`, so WebView canvas compositing could hide the tile map even though the map layer was still alive and populated.

Follow-up inspection found a second active failure mode: when the registered Spine layer reached `ready`, the advisor renderer called the generic asset-change hook. That hook is correct for shared PNG/JPG assets, but it invalidates world-map tile caches and schedules a render. In the map-home runtime path, a same-frame render can hit stale baked-layer metadata or throttling while the shell still uses the frame-state result to drive `worldMap` visibility. The visible symptom is the physical `worldMap` canvas being hidden or left without a committed redraw while the background remains visible.

The deterministic chain is:

1. Tutorial advisor Spine becomes ready.
2. `TutorialAdvisorCanvasRenderer` calls generic `handleAssetsChanged()`.
3. The main renderer invalidates world tile caches and schedules a shell render.
4. `CanvasGameShell.renderReadOnly()` evaluates the runtime map frame while the baked layer is stale or inside the frame throttle window.
5. `setWorldMapLayerVisible(false)` can hide the map layer, exposing the background image.

This was not fixed by adding map clear strategies. The fix keeps Spine as an independent transparent layer and prevents it from owning world-map cache or visibility policy.

## Fix

- Registered `tutorialSpine` in `CanvasLayerRegistry` as a transparent WebGL screen-overlay layer above `mainHud`.
- Registered `tutorialDialogue` as a transparent 2D screen-overlay layer above `tutorialSpine`.
- Routed tutorial Spine and dialogue layer creation through `ensureCanvasLayer()` when shell helpers are available.
- Added runtime fallback wrapping with `CanvasLayerRegistry.getLayerOptions()` so fallback creation still uses registered z-index, context type, and pointer policy.
- Removed detached/offscreen Spine canvas fallback and deleted the old `createTutorialSpineCanvas` facade path.
- Removed fixed Spine `viewFocus` support from `SpineWebglPlayer`.
- Added skeleton-bounds reporting from `SpineWebglPlayer` and fitted the physical `tutorialSpine` rect from the requested portrait rect plus actual Spine bounds.
- Kept player input ownership on `mainHud`; tutorial overlay layers use `pointer-events: none`.
- Retired the remaining `getTutorialAdvisorSpineFrame` facade/fallback path so Spine cannot be treated as a frame source drawn back into the HUD canvas.
- Changed Spine `ready` handling to request a narrow overlay render frame when available, and never invoke the generic asset-change hook that invalidates world-map caches.
- Hardened map-home rendering so an invalid baked world-map layer forces a runtime redraw and cannot be hidden by a same-frame throttle race.

## Advisor Tuning Follow-Up

The tutorial advisor placement now uses the hand-tuned 430px-wide 9:16 baseline supplied from `frontend/tools/tutorial-spine-tuner.html`:

- `targetRect`: `{ x: 0, y: 433, width: 158, height: 330 }`
- `view`: `{ viewScale: 1.41, viewOffsetX: 2, viewOffsetY: 85, fitPadding: 1 }`
- `clip`: `{ mode: 'autoFromSkeletonBounds', clipPadding: 4 }`
- `dialogueLeft`: `126`

These values are centralized in `TutorialAdvisorSpineLayoutConfig` and projected onto the active game frame. The tuner `previewClipRect` remains a diagnostic readout only; production code does not store or consume it. Physical clipping is still derived from the actual Spine skeleton bounds plus padding, while scale and position stay under the independent view transform.

## Runtime Verification Note

After deploying the tuned layout, the advisor briefly looked missing during user verification. Follow-up observation confirmed this was a network/resource-loading delay rather than a layout, clipping, or scale regression. Once the Spine resource finished loading, the advisor appeared in the expected screen area.

Do not compensate for a transient missing animation by changing `targetRect`, `viewScale`, offsets, or physical clip policy. If this symptom returns, first inspect asset load timing, network errors, and the static-image fallback path.

## Non-Goals

- No map/HUD clear strategy was introduced.
- No full-screen Spine overlay was retained.
- No hardcoded Spine crop rectangle or fixed view-focus constant was retained.
- No Spine readiness callback is allowed to invalidate world-map tile caches.
- No tuner `previewClipRect` is allowed to become a production crop rectangle.

## Regression Coverage

- `CanvasLayerRegistry.test.js` verifies tutorial overlay layer registration and stack order.
- `H5CanvasRuntime.test.js` verifies fixed overlay rect clipping and metrics.
- `TutorialCanvasRenderer.test.js` verifies registered clipped Spine layer creation, skeleton-bounds rect fitting, and runtime fallback registry options.
- `TutorialCanvasRenderer.test.js` verifies the tuned advisor baseline, responsive projection, and independent view transform.
- `TutorialCanvasRenderer.test.js` verifies Spine readiness requests an overlay render frame without calling `handleAssetsChanged()`, and does not fall back to asset invalidation when no render callback is injected.
- `CanvasGameShell.test.js` verifies stale baked world-map backing stores force a redraw instead of hiding the world-map layer.
- `WorldMapLayerOwnershipContract.test.js` rejects detached Spine canvas fallback, retired Spine frame fallbacks, fixed view-focus restoration, and tuner preview crop rectangles in production runtime files.

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

Follow-up verification:

```powershell
node --test frontend/js/platform/renderers/TutorialCanvasRenderer.test.js
node --test frontend/js/platform/CanvasGameShell.test.js
node --test frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js
npm run test:architecture
```

Result: focused tests passed, and architecture smoke passed with 1107 tests.

## Risk And Rollback

Main risk is tutorial advisor animation failing to initialize on a browser with unavailable Spine WebGL support. In that case the renderer falls back to the static advisor image rather than creating an unregistered Spine surface.

Rollback should revert the registered tutorial layer change as one unit. Do not reintroduce full-screen or detached Spine canvases as a rollback shortcut.
