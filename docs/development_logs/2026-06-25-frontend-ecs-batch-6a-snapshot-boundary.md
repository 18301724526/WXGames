# Frontend ECS Batch 6A (Snapshot Boundary Scaffold) - 2026-06-25

## Status

| Field             | Value                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------- |
| Batch             | `6. Snapshot Boundary`                                                                |
| Slice             | `6A (renderer snapshot scaffold)`                                                     |
| State             | `Completed`                                                                           |
| Snapshot boundary | `frontend/js/ecs/snapshot/RendererSnapshotBoundary.js`                                |
| Bridge surface    | `buildRendererSnapshot(host, options = {})` / `getRendererSnapshot(host)`             |
| Guard             | `scripts/check-frontend-ecs-renderer-snapshot-boundary.js`                            |
| Runtime exposure  | `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` (single approved generated runtime) |
| Last updated      | `2026-06-26 16:05:54 +08:00`                                                          |

## Decision

Batch 6A establishes the renderer snapshot contract without migrating broad renderer
read paths. The new boundary builds a frozen, serializable
`renderer-snapshot-v1` object from Batch 5 sealed modal/panel facts plus the
existing mode snapshot reference data needed by render routing.

The snapshot shape is:

- `schema`: fixed string `renderer-snapshot-v1`
- `modal`: sealed owner status and payload for `modal:naming`, `modal:event`,
  `modal:rewardReveal`, `modal:confirmDialog`, `modal:targetPicker`, and
  `modal:blockingPanel`
- `panel`: renderer-facing mirrors for Batch 5 covered panel fields
- `mode`: whitelisted mode-routing facts from the existing mode snapshot

## Scope Control

Batch 6A does not:

- migrate renderer readers to consume the new snapshot yet
- migrate gameplay/serializable gameplay state such as task tabs, selected tech, famous-person
  paging/detail, or world-march target contents
- migrate `getHitTarget`, renderer caches, or hit-target authority
- add a second raw ECS runtime script; H5/minigame continue to load only
  `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`

Existing renderer direct reads remain grandfathered by the guard baseline below.
Later Batch 6 sub-slices should reduce this table one group at a time.

## Acceptance Answers

| Question                          | Answer                                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old owner being retired?          | None in 6A; this is a scaffold slice. Existing renderer reads are inventoried and grandfathered, not migrated.                                                                           |
| New ECS owner?                    | `RendererSnapshotBoundary.js` owns the serializable renderer snapshot contract for sealed Batch 5 modal/panel facts.                                                                     |
| Legacy fields/methods remaining?  | `show*`, `activeCommandPanel`, `techDetailOpen`, modal mirrors, and serializable gameplay state remain legacy renderer-facing fields until later Batch 6 reader sub-slices migrate them. |
| Guard preventing old-path growth? | `scripts/check-frontend-ecs-renderer-snapshot-boundary.js` blocks new direct renderer reads of covered sealed modal/panel facts outside the approved snapshot paths.                     |
| Behavior tests?                   | Snapshot boundary tests, bridge snapshot helper tests, guard tests, manifest test, and architecture smoke integration.                                                                   |
| Rollback?                         | Remove the snapshot boundary module, bridge helpers, guard wiring, runtime export, generated bundle change, and this batch doc; no renderer reader migration is involved.                |
| Batch 6 status?                   | 6A is `Completed` after migration owner sign-off; Batch 6 scaffold is complete.                                                                                                          |

## Guard Baseline

This baseline grandfathers current direct renderer reads of sealed modal/panel
facts. The guard compares by `file + symbol` count and blocks growth.

| Symbol                | File                                                             | Count |
| --------------------- | ---------------------------------------------------------------- | ----: |
| `activeCommandPanel`  | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `activeEventId`       | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `confirmDialog`       | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     2 |
| `naming`              | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     3 |
| `rewardReveal`        | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `showCityManagement`  | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `showCitySwitcher`    | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `showFamousPersons`   | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `showResourceDetails` | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `showSubcityList`     | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `showTaskCenter`      | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     1 |
| `techDetailOpen`      | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     2 |
| `territoryUiState`    | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          |     8 |
| `territoryUiState`    | `frontend/js/platform/CanvasGameAppWorldMapRuntimeBridge.js`     |     4 |
| `activeCommandPanel`  | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `activeEventId`       | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `confirmDialog`       | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `naming`              | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `rewardReveal`        | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showCityManagement`  | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showCitySwitcher`    | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showFamousPersons`   | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showLogs`            | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showResourceDetails` | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showSettings`        | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showSubcityList`     | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `showTaskCenter`      | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `techDetailOpen`      | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |     1 |
| `territoryUiState`    | `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        |    18 |
| `territoryUiState`    | `frontend/js/platform/CanvasGameShellWorldMapLayerBridge.js`     |     3 |
| `territoryUiState`    | `frontend/js/platform/CanvasGameShellWorldMapRuntime.js`         |     3 |
| `activeCommandPanel`  | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `activeEventId`       | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     4 |
| `confirmDialog`       | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `naming`              | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     4 |
| `rewardReveal`        | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `showCityManagement`  | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `showCitySwitcher`    | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     2 |
| `showFamousPersons`   | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     2 |
| `showResourceDetails` | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     2 |
| `showSettings`        | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `showSubcityList`     | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `showTaskCenter`      | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     2 |
| `techDetailOpen`      | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     1 |
| `territoryUiState`    | `frontend/js/platform/renderers/CanvasFrameRenderer.js`          |     2 |
| `activeEventId`       | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     2 |
| `confirmDialog`       | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     2 |
| `naming`              | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     2 |
| `rewardReveal`        | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     2 |
| `showCitySwitcher`    | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `showFamousPersons`   | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `showLogs`            | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `showResourceDetails` | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `showSettings`        | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `showTaskCenter`      | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `techDetailOpen`      | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     1 |
| `territoryUiState`    | `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`     |     2 |
| `activeCommandPanel`  | `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`     |     3 |
| `showFamousPersons`   | `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`     |     1 |
| `showSettings`        | `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`     |     1 |
| `showSubcityList`     | `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`     |     1 |
| `showTaskCenter`      | `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`     |     1 |
| `naming`              | `frontend/js/platform/renderers/OverlayCanvasRenderer.js`        |     3 |
| `showFamousPersons`   | `frontend/js/platform/renderers/TabBarCanvasRenderer.js`         |     1 |
| `territoryUiState`    | `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js`  |     3 |
| `territoryUiState`    | `frontend/js/platform/renderers/WorldMapCacheCoordinator.js`     |     1 |
| `territoryUiState`    | `frontend/js/platform/renderers/WorldMapHitTargetCollector.js`   |     1 |
| `territoryUiState`    | `frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js` |     1 |
| `territoryUiState`    | `frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.js`  |     3 |
| `territoryUiState`    | `frontend/js/platform/WorldMapRuntimeCoordinator.js`             |     2 |

## Verification

Local verification before the Ready-for-Review commit:

- `node --test frontend/js/ecs/snapshot/RendererSnapshotBoundary.test.js frontend/js/platform/CanvasModeOwnershipBridge.test.js scripts/check-frontend-ecs-renderer-snapshot-boundary.test.js frontend/js/ecs/registry/EcsBoundaryManifest.test.js scripts/check-frontend-ecs-mode-ownership-spine.test.js` (33 tests)
- `node scripts/check-frontend-ecs-renderer-snapshot-boundary.js` (0 violations; baseline findings 139, current findings 139)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `node scripts/check-frontend-ecs-blocking-panel-ownership.js` (0 violations)
- `node scripts/check-frontend-ecs-target-picker-ownership.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` (1219 tests)
- `git diff --check`

## Review Packet Notes

- 6A adds the snapshot boundary and guard only; renderer migration is intentionally
  deferred.
- The snapshot module is pure and bundled through the existing ECS runtime bundle.
- The bridge helper caches the last built snapshot on `__ecsRendererSnapshot` and
  returns `null` when the runtime/boundary is unavailable.
- The guard baseline shows 139 existing direct renderer reads across 78 file+symbol
  rows; those reads are grandfathered until later Batch 6 sub-slices migrate them.

## Review Result

Batch 6A is `Completed` after migration owner sign-off on
`2026-06-26 16:05:54 +08:00`. The review accepted the v1 snapshot
contract, owner-direct modal reads, bridge read-only API, dedicated guard, and
1219-test validation.

Follow-up condition for the next renderer-reader work: each 6B/6C sub-slice must
include a mirror retire target, and the first 6B sub-slice must delete at least
one mirror while migrating its renderer readers to the snapshot.
