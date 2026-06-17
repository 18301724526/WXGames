# World Map Render State Authority Fix

Date: 2026-06-16

## Problem

Online operation logs showed a confirmed one-frame world-map disappearance:

- API response returned `gameState.worldMap.version=7` with `tileCount=25`.
- The next client render snapshot briefly saw `version=0`, `rawTileCount=0`, and `drawTileCount=0`.
- The following render restored `version=7` and `drawTileCount=25`.

This means the server did not send an empty map. The client briefly rendered from a stale or empty local state source.

## Root Cause

`CanvasGameShell` extends `CanvasGameApp` for compatibility, so it inherits App render methods and also has an inherited `this.state` initialized before the real H5 game state is mounted.

The real authoritative game state for the shell is `shell.lastGame.state`. Any Shell render path that accidentally uses inherited App render entrypoints can read Shell's own empty `this.state`, producing a 0-tile world-map view for one frame.

Tutorial, advisor, event, or Spine UI lifecycles can trigger these render paths, but they are only correlated UI events. The architectural issue is state ownership and render input authority.

## Design

### State Authority

`H5GameHost` / the mounted game remains the sole owner of game state. `CanvasGameShell` is a render shell and must render from:

- `this.lastGame.state`, or
- an explicit state passed into `renderReadOnly()`.

Shell compatibility render entrypoints now normalize into:

`renderCanvasSurface(activeTab, options) -> renderReadOnly(this.lastGame.state, activeTab, options)`

This prevents inherited App render methods from reading Shell's empty compatibility state.

### Render-Layer Defense

The world-map layer no longer clears the physical layer before validating that the next tile map is renderable.

If tile input is empty but a previous renderable `lastWorldTileMapContext` exists, the renderer:

- keeps the current world-map canvas untouched,
- returns success so Shell keeps the layer visible,
- records `lastWorldMapLayerRenderResult = { rendered: true, drewFrame: false, preserved: true }`.

If there is no previous renderable context, empty input still fails normally. Real loading/empty-map states can opt out through `preserveOnEmptyWorldMap: false` or `clearOnEmptyWorldMap: true`.

### Runtime Cache Semantics

The Runtime render pipeline distinguishes "layer is still displayable" from "a new map frame was drawn".

Only a real drawn frame (`drewFrame !== false`) may:

- commit `hasBakedMapLayer`,
- clear `mapBakeDirty`,
- update baked layer identity,
- refresh actor layer from a new frame context,
- mark baked camera.

A preserved empty-input frame keeps the old map visible but remains dirty so a later valid state can redraw and commit normally.

## Performance

The steady-state overhead is O(1):

- one state-source dispatch in Shell render entrypoints,
- a few tile-count/context checks before clear,
- one small render-result object per world-map layer render.

There are no deep clones, pixel reads, `getImageData()`, screenshots, or extra full map rebuilds. The existing baked layer, snapshot, and runtime-cache model stays intact.

## Files

- `frontend/js/platform/CanvasGameShellRenderingRuntime.js`
- `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js`
- `frontend/js/platform/WorldMapRuntimeRenderPipeline.js`
- `frontend/js/platform/CanvasGameShell.test.js`
- `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js`
- `frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js`

## Regression Tests

```bash
node --test frontend/js/platform/CanvasGameShell.test.js
node --test frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js
node --test frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js
node --test frontend/js/platform/CanvasGameRendererPageFacades.test.js frontend/js/platform/CanvasGameRendererCompositionFactory.test.js frontend/js/platform/CanvasGameRendererCoreFacades.test.js frontend/js/platform/CanvasGameAppWorldMapRuntimeBridge.test.js frontend/js/platform/CanvasGameShellWorldMapLayerBridge.test.js
node --test frontend/js/platform/WorldMapRuntime.test.js frontend/js/platform/WorldMapRuntimeRenderPolicy.test.js frontend/js/platform/WorldMapRuntimeHitTargetPolicy.test.js frontend/js/platform/WorldMapRuntimeCoordinator.test.js frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js
```

## Review Position

This is an architecture-level fix, not a tutorial-specific or Spine-specific patch:

- state ownership is explicit,
- renderer clearing is guarded by renderable input,
- cache commits are tied to real drawn frames,
- performance remains bounded,
- regression tests cover Shell authority, render-layer preservation, and Runtime commit semantics.
