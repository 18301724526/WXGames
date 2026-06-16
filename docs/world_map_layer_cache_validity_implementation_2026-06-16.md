# World Map Layer Cache Validity Implementation

Date: 2026-06-16

## Problem

The H5 world map is rendered into a dedicated canvas layer and the HUD is rendered on a separate canvas. The runtime currently treats `hasBakedMapLayer && !mapBakeDirty` as enough evidence to skip a world-map redraw. Browser canvas backing stores are volatile: assigning `canvas.width` or `canvas.height`, recreating a layer, changing pixel ratio, or restoring a page can clear the bitmap while JavaScript state still says the map is baked.

When this happens, `renderReadOnly()` keeps rendering HUD/advisor UI with `skipWorldMapLayer: true`, but the actual world-map layer is blank until a later action forces a map render.

## Design

Treat the world-map layer as an explicit render cache resource.

### Layer Backing Store Epoch

`H5CanvasRuntime` owns per-canvas backing-store metadata:

- `backingStoreEpoch`: incremented whenever a canvas backing store may have been reset.
- `backingStoreReason`: short reason for diagnostics.
- `width`, `height`, and `pixelRatio`: the current physical backing-store identity.

Epoch changes are O(1) metadata updates. No pixel reads, screenshots, `getImageData()`, or `toDataURL()` checks are used in production logic.

### Baked Layer Commit

`WorldMapRuntime` records the layer identity after a successful full world-map render:

- `bakedLayerState.epoch`
- `bakedLayerState.width`
- `bakedLayerState.height`
- `bakedLayerState.pixelRatio`

`hasBakedMapLayer` remains a logical flag, but it is no longer enough on its own to skip a map redraw.

### Single Validation Gate

Shell rendering uses one validation method before skipping world-map redraw:

`hasValidBakedWorldMapLayer()`

The baked layer is reusable only when:

- the runtime has a baked map layer,
- `mapBakeDirty` is false,
- the current world-map layer exists,
- current layer epoch/size/pixel ratio match the committed baked layer identity.

If validation fails, `shouldRenderRuntimeWorldMap()` returns true and the next read-only frame performs a full world-map render once. Normal frames still use the existing cached layer.

## Performance

The steady-state cost is a few numeric comparisons per frame. The expensive world-map render is only forced after an actual layer identity change or cache invalidation. This preserves the current layered rendering performance model.

## Ownership

- `H5CanvasRuntime` tracks canvas backing-store identity.
- `CanvasGameShellWorldMapLayerBridge` exposes current world-map layer cache identity and validates the runtime bake state.
- `WorldMapRuntime` records committed bake identity.
- `CanvasGameShellRenderingRuntime` keeps its current render orchestration and uses the validation gate through `shouldRenderRuntimeWorldMap()`.

## Test Plan

- `H5CanvasRuntime.test.js`: layer epoch increments when physical canvas size changes and stays stable when resize is a no-op.
- `CanvasGameShellWorldMapLayerBridge.test.js`: stale baked epoch invalidates the runtime bake and valid epoch allows reuse.
- `CanvasGameShell.test.js`: `renderReadOnly()` forces `renderRuntimeWorldMap()` when `hasBakedMapLayer` is true but the backing-store epoch is stale.
- `WorldMapRuntimeRenderPipeline.test.js`: full render commits baked layer identity.

## Non-Goals

- No tutorial-specific or era-advance-specific force render.
- No pixel inspection in production code.
- No change to backend state, task progression, or era progression behavior.
