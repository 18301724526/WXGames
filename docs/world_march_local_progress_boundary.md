# World March Local Progress Boundary

Date: 2026-06-07

World march progress must not be driven by heartbeat full-state sync.

## Design Intent

- The server owns authoritative action results, route planning, terrain generation, and persisted mission state.
- The frontend owns visual projection from an already returned mission plan: actor position, reached route steps, planned tile visibility, HUD countdown, and local idle/ready display.
- Heartbeat is liveness only. It may carry `type`, `serverTime`, and a sequence value. It must not return `gameState`, `worldMap`, mission arrays, or any other full gameplay payload.
- Redirect, stop, return, and claim remain explicit action APIs.

## Operation Flow

1. The player selects a map target and formation.
2. The client sends `startWorldMarch` with formation and target coordinates.
3. The server calculates origin, target, route, planned terrain tiles, planned sites, and timestamps.
4. The action response returns the mission plan.
5. The frontend derives progress from `startedAt`, `stepDurationSeconds`, `route`, and `completesAt`.
6. Each reached route step reveals only its matching planned tile/site in the map presenter.
7. Expired manual marches display as `idle` at the target and can be selected for a new march.
8. Expired random explores display as `ready` and wait for the claim flow.

## Implementation Notes

- `WorldMarchSystem.deriveMissionForTime()` is the pure local projection boundary.
- `WorldTileMapPresenter` merges only time-revealed planned tiles/sites into the rendered world map.
- `WorldMapRuntime` includes derived reveal state in its map signature so fog cache invalidates only when a route step changes.
- `GameStateSync` never calls state sync from heartbeat data, even if a bad response includes `gameState`.
