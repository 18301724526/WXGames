# Frontend ECS Batch 5 Slice 5c (Panel/Modal Ownership: targetPicker) - 2026-06-25

## Status

| Field            | Value                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Batch            | `5. Panel/Modal Ownership`                                                                                        |
| Slice            | `5c (targetPicker)`                                                                                               |
| State            | `Completed`                                                                                                       |
| ECS modal owner  | `frontend/js/ecs/mode/ModalWorld.js` (reused)                                                                     |
| Bridge surface   | `openWorldTargetPickerOwner` / `openWorldMarchFormationPickerOwner` / `closeTargetPickerOwner`                    |
| Seal enforced by | `scripts/check-frontend-ecs-target-picker-ownership.js` plus existing architecture smoke and mode ownership guard |
| Last updated     | `2026-06-26 14:47:06 +08:00`                                                                                      |

## Decision

Slice 5c seals the `targetPicker` modal subtype without migrating the whole world-march
domain. The legacy UI has two picker-shaped modal surfaces:

- `territoryUiState.worldTargetPicker`: the multi-candidate picker when an actor and
  site overlap on the map.
- `territoryUiState.worldMarchTarget.pickerOpen`: the formation picker over an
  already selected march target.

Both canonical open paths now route through `CanvasModeOwnershipBridge` wrappers.
The bridge owns the `modal:targetPicker` payload with `pickerKind` set to either
`worldTargetPicker` or `worldMarchFormation`, then mirrors the old `territoryUiState`
shape for renderers/tutorials.

## Scope Control

Slice 5c does not:

- migrate non-picker `worldMarchTarget` selection state into modal ownership;
  normal selected-target state remains owned by world-march/domain flow
- chase scattered `worldTargetPicker = null` or `worldMarchTarget = null` clears;
  these stay legacy mirror clearing for navigation, drag, reset, and command cleanup
- migrate renderer/tutorial reads off `territoryUiState`; that is Batch 6 snapshot work
- start slice 5d `blockingPanel` before migration owner review signs off

## Acceptance Answers

| Question                          | Answer                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old owner being retired?          | Canonical targetPicker open state: `worldTargetPicker` non-null opens and `worldMarchTarget.pickerOpen = true` formation-picker opens.                             |
| New ECS owner?                    | `frontend/js/ecs/mode/ModalWorld.js`, through `CanvasModeOwnershipBridge` targetPicker wrappers.                                                                   |
| Legacy fields/methods remaining?  | `territoryUiState.worldTargetPicker` and `territoryUiState.worldMarchTarget.pickerOpen` remain renderer/tutorial-facing mirrors. Null clears remain legacy clears. |
| Guard preventing old-path growth? | `scripts/check-frontend-ecs-target-picker-ownership.js` blocks non-owner picker opens outside the approved bridge path while allowing legacy null mirror clears.   |
| Behavior tests?                   | Bridge targetPicker wrapper tests, CanvasTerritoryActionHandlers owner-call tests, and the new targetPicker guard tests.                                           |
| Rollback?                         | Restore direct canonical handler writes for `worldTargetPicker` and `pickerOpen: true`, remove the targetPicker bridge wrappers, and drop the dedicated guard.     |
| Next subtype to seal?             | `blockingPanel` (5d), after migration owner review signed off this 5c implementation.                                                                              |

## Verification

Local verification passed:

- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js frontend/js/platform/CanvasTerritoryActionHandlers.test.js scripts/check-frontend-ecs-target-picker-ownership.test.js`
- `node scripts/check-frontend-ecs-target-picker-ownership.js` (0 violations)
- `node scripts/check-frontend-ecs-mode-ownership-spine.js` (0 violations)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` passed with `1195` tests and all architecture guards
- `git diff --check`

## Review Result

`targetPicker` sealing is `Completed` after migration owner sign-off on
`2026-06-26 14:47:06 +08:00`. The review accepted the bridge wrappers, two picker
payload shapes, canonical handler routing, dedicated guard scope, preserved legacy
mirror clear behavior, and deferred renderer/tutorial read migration. Slice 5d may
start and remains gated behind its own sealed slice.
