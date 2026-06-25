# Frontend ECS Batch 3 Mode Ownership Spine - 2026-06-25

## Status

| Field                  | Value                                                |
| ---------------------- | ---------------------------------------------------- |
| Batch                  | `3. Mode Ownership Spine`                            |
| State                  | `Ready for Migration Owner Review`                   |
| Runtime behavior scope | Mode ownership bridge only                           |
| ECS owner              | `frontend/js/ecs/mode/ModeWorld.js`                  |
| Legacy bridge          | `frontend/js/platform/CanvasModeOwnershipBridge.js`  |
| Runtime bundle         | `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`    |
| Blocking guard         | `scripts/check-frontend-ecs-mode-ownership-spine.js` |
| Last updated           | `2026-06-25 21:01:23 +08:00`                         |

## Decision

Batch 3 creates the first real runtime ECS owner for mode decisions without taking over the later input, panel/modal, or renderer migration batches.

The ECS mode world owns a singleton mode entity with serializable facts:

- base mode id
- modal mask
- tutorial/debug flags
- generic blocking overlay flag
- tech-tree-specific blocking overlay flag
- entity battle flag
- world map home flag
- tech tree flag
- formation editor flag
- top capture mode id

The H5 and minigame runtime do not load raw ECS source files. `scripts/build-frontend-ecs-runtime.js` uses exact `esbuild@0.23.1` to generate `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`, which is the only approved browser/minigame ECS runtime surface in Batch 3.

## Scope Control

Batch 3 does not migrate:

- physical input mapping into a full intent boundary
- concrete modal payload ownership for naming/event/reward/confirm/target picker panels
- renderer snapshot contracts
- gameplay domain state
- tutorial flow ownership

Those remain Batch 4, Batch 5, Batch 6, and later domain sealing work.

## New Runtime Surfaces

| Surface                                             | Role              | Notes                                                                        |
| --------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `frontend/js/ecs/mode/ModeKeys.js`                  | Vocabulary        | Defines reviewed mode keys and modal bit assignments                         |
| `frontend/js/ecs/mode/ModeComponents.js`            | Component schema  | Defines `ModeState` through `EcsCoreBoundary` only                           |
| `frontend/js/ecs/mode/ModeResolver.js`              | Snapshot/resolver | Converts facts into frozen mode snapshots and routing booleans               |
| `frontend/js/ecs/mode/ModeWorld.js`                 | ECS owner         | Creates one mode entity and stores current mode state                        |
| `frontend/js/ecs/mode/EcsModeRuntimeEntry.js`       | Bundle entry      | Exposes the approved mode runtime API                                        |
| `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`   | Runtime artifact  | Generated IIFE bundle loaded by H5 and minigame                              |
| `frontend/js/platform/CanvasModeOwnershipBridge.js` | Legacy bridge     | Reads old app/shell fields, updates ECS mode world, exposes snapshot helpers |

## Legacy Bridge Contract

`CanvasModeOwnershipBridge` is a temporary bridge. It may:

- read old `activeTab`, `militaryView`, `show*`, `entityBattle`, `techDetailOpen`, `armyFormationEditor`, `naming`, `rewardReveal`, `confirmDialog`, and `activeEventId` fields
- derive serializable facts from old app/shell surfaces
- write those facts into the ECS mode world
- expose `getModeSnapshot()`, `refreshModeSnapshot()`, `isModeBlockingOverlayOpen()`, `isModeEntityBattleActive()`, `canRouteModeWorldMap()`, and `canRouteModeTechTree()`

It may not:

- create new source-of-truth mode fields
- add new business branches
- own concrete modal payloads
- change renderer state
- replace the Batch 4 input intent boundary

## Behavior Preservation Notes

Generic blocking overlay behavior still treats `activeCommandPanel === 'tech'` as blocking. Tech-tree routing keeps the existing exception by using a separate `techTreeBlockingOverlayActive` fact, equivalent to the legacy `hasBlockingOverlayExceptTechTree()` behavior.

If the generated ECS mode runtime is unavailable, bridge helpers fall back to the same legacy fact derivation instead of returning unsafe default "not blocked" values.

## Loading Policy

`frontend/js/ecs/registry/EcsBoundaryManifest.js` now distinguishes:

- `core`: Node/CommonJS architecture boundary only
- `registry`: Node/CommonJS architecture boundary only
- approved runtime surface: `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`
- forbidden runtime surfaces: raw `frontend/js/ecs/core/**`, `frontend/js/ecs/registry/**`, and `frontend/js/ecs/mode/**`

`frontend/index.html` loads the generated bundle before `CanvasModeOwnershipBridge.js`, and loads the bridge before `CanvasGameApp.js` / `CanvasGameShell.js`.

`frontend/minigame/game.js` requires the generated bundle before platform modules that need the mode bridge, and requires `CanvasModeOwnershipBridge` before `CanvasGameApp`.

## Guard Contract

Batch 3 adds `scripts/check-frontend-ecs-mode-ownership-spine.js` as a blocking guard.

The guard compares current `report-frontend-ecs-mode-ownership` findings against the 0A baseline by file and symbol. Growth is allowed only in:

- `frontend/js/ecs/mode/**`
- `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`
- `frontend/js/platform/CanvasModeOwnershipBridge.js`
- vocabulary-only declarations in `frontend/js/ecs/registry/EcsBoundaryManifest.js`

Any new mode/panel/tutorial decision growth in legacy app/shell/renderer/input paths fails the gate.

`scripts/check-frontend-ecs-boundary-skeleton.js` was also updated for Batch 3 so H5/minigame entrypoints may load only the approved generated mode runtime bundle, while still blocking raw ECS source loading and direct `bitecs` imports outside `EcsCoreBoundary.js`.

## Acceptance Answers

| Question                          | Answer                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old owner being retired?          | Not fully retired in Batch 3; old app/shell fields remain as bridge ingress. New growth outside owner paths is blocked.                                                               |
| New ECS owner?                    | `frontend/js/ecs/mode/ModeWorld.js`, exposed through the generated mode runtime bundle.                                                                                               |
| Legacy fields/methods remaining?  | Old mode/panel booleans remain read as ingress facts by `CanvasModeOwnershipBridge.js`.                                                                                               |
| Guard preventing old-path growth? | `scripts/check-frontend-ecs-mode-ownership-spine.js`.                                                                                                                                 |
| Behavior tests?                   | Mode world tests, bridge tests, App/Shell focused tests, script manifest guard, boundary/core guards, architecture smoke.                                                             |
| Rollback?                         | Remove runtime bundle loading, remove bridge installation from App/Shell, restore input router checks to legacy helpers, and rerun guards to ensure no mixed unguarded owner remains. |
| Next bridge to retire?            | `CanvasModeOwnershipBridge.js` must shrink in Batches 4 and 5 as input intent and concrete modal owners move out of legacy fields.                                                    |

## Review Blockers

Batch 3 is not `Completed` yet. It requires migration owner review of:

- whether the singleton mode entity is the correct first runtime ECS owner
- whether `CanvasModeOwnershipBridge` is narrow enough for a temporary bridge
- whether the Batch 3 guard correctly allows owner/bridge/vocabulary growth while blocking legacy growth
- whether loading the generated IIFE bundle is acceptable for H5 and minigame until a broader frontend build pipeline exists
