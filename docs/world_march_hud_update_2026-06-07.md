# World March HUD Update 2026-06-07

## Design Intent

- World march is a map-first action. A player should be able to click explored tiles or fogged map space and then decide whether to dispatch a formation.
- The HUD should read as game UI, not debug output: no raw coordinates, no overlapping button/text blocks, and no controls outside the 9:16 game frame.
- The renderer remains canvas-only. No DOM UI is introduced.

## Flow

1. Player taps any visible area of the world map.
2. If the tap lands on a rendered tile hit target, the target keeps its known terrain metadata.
3. If the tap lands on map background/fog, `WorldMapRuntime` converts the screen point to the nearest axial tile coordinate through `WorldMarchSystem.screenPointToAxialTile`.
4. `CanvasActionController` stores the selected target in `territoryUiState.worldMarchTarget`.
5. `WorldMarchHudCanvasRenderer` shows a compact target info chip and a separate march command.
6. Tapping march opens the formation picker inside the 9:16 safe map frame.

## HUD Rules

- Known tiles show their terrain label.
- Fog targets show `未知区域` and `派遣队伍揭开迷雾`.
- Coordinates are not shown in the HUD.
- The march button is a separate hit target from the info chip and must not overlap it.
- The formation picker is clamped inside the visible game frame and is biased toward the middle-upper safe area instead of the bottom edge.

## Responsibility Boundary

- `WorldMarchSystem`: coordinate math and world-march pure helpers.
- `WorldMapRuntime`: input interpretation for map taps and background fog targeting.
- `WorldMapCanvasRenderer`: stores the current tile-map viewport context and emits tile target metadata.
- `WorldMarchHudCanvasRenderer`: draws target info, command button, formation picker, and related hit targets only.
- `CanvasActionController`: stores UI state and forwards business actions to the game/API layer.

## Runtime Context Note

The live map layer is rendered through `CanvasGameRenderer -> WorldMapLayerCanvasRenderer -> WorldMapCanvasRenderer`.
Fog/background targeting depends on the latest tile-map viewport context, so `WorldMapCanvasRenderer` must publish
`lastWorldTileMapContext` to its host, and `WorldMapRuntime` must read the context from the outer renderer or the split
`worldMapRenderer`/`worldMapLayerRenderer` instances. This keeps background fog clicks working in the real layered canvas
runtime, not only in isolated renderer tests.
