# World Map HUD Transparency Contract

Date: 2026-06-19

## Decision

The map-home world viewport is a transparent area of `mainHud`, not a HUD panel that is painted and then cleared.

The physical `worldMap` layer owns terrain/static/site pixels. The physical `worldActor` layer owns world-coordinate actor pixels. The physical `mainHud` layer owns screen-space controls, tutorial, modal, feedback, and input capture.

`mainHud` may clear its whole frame to remove stale HUD pixels. It must not use `clearRect(mapX, mapY, mapW, mapH)` or any equivalent map-viewport wipe as a business mechanism to reveal the world map underneath.

## Rules

- The world viewport must stay transparent by construction: do not paint an opaque or translucent HUD panel over the map area when the intent is to show the underlying `worldMap` layer.
- Draw map-home chrome as explicit screen-space UI: top bar, tabs, border accents, reset controls, command HUD, overlays, tutorial, and feedback.
- `skipWorldMapLayer` only means the current HUD pass should not repaint map pixels on `mainHud`; it must not trigger viewport clearing.
- Hit-target collection is separate from visual drawing. A hit-target-only pass may collect map/site targets, but it must not mutate visible HUD pixels.
- Snapshot/cache misses are performance failures in a reuse path. They must not be repaired by HUD clear-cutting.
- Empty/loading world states may draw an explicit placeholder surface because there is no map to expose.

## Non-Goals

- This does not ban canvas `clearRect` for normal frame cleanup, offscreen cache reuse, texture work buffers, or full-layer resets.
- This does not change the `worldMap` layer cache, bake, fog, actor, or snapshot ownership.

## Regression Guard

`frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.test.js` asserts that skipped world-map layer composition does not clear the map viewport.

`frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js` guards the ownership rule so map-home HUD code cannot reintroduce clear-cut viewport behavior.
