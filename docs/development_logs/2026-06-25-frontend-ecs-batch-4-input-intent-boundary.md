# Frontend ECS Batch 4 Input Intent Boundary - 2026-06-25

## Status

| Field                  | Value                                              |
| ---------------------- | -------------------------------------------------- |
| Batch                  | `4. Input Intent Boundary`                         |
| State                  | `Completed`                                        |
| Runtime behavior scope | Covered-mode input routing only                    |
| ECS resolver           | `frontend/js/ecs/input/InputIntentResolver.js`     |
| Intent vocabulary      | `frontend/js/ecs/input/InputIntent.js`             |
| Legacy bridge helper   | `CanvasModeOwnershipBridge.resolveInputIntent`     |
| Runtime bundle         | `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`  |
| Blocking guard         | `scripts/check-frontend-ecs-input-intent-spine.js` |
| Last updated           | `2026-06-26 01:24:26 +08:00`                       |

## Decision

Batch 4 introduces an explicit input-intent boundary so that physical input
(drag / gesture / tap) is turned into a normalized **physical intent**, and the
covered-mode routing decision is made by a pure **resolver** from the ECS mode
snapshot — not by scattered mode checks inside the input routers.

- `InputIntent.js` defines frozen, serializable physical-intent and routed-intent
  shapes plus the covered-mode route vocabulary (`entity-battle`, `tech-tree`,
  `world-map`, `city`).
- `InputIntentResolver.js` maps `(physicalIntent, modeSnapshot)` to a routed
  intent using only the `ModeResolver` routing booleans (`isEntityBattleActive`,
  `canRouteTechTree`, `canRouteWorldMap`). It is pure: no host, DOM, or renderer
  reads. Route precedence is kind-aware to match the existing routers exactly:
  entity-battle first; for a drag/tap tech-tree is preferred over world-map; for
  a gesture world-map is preferred over tech-tree; otherwise the implicit `city`
  base mode is the fallback route.
- Both modules ship inside the single approved generated bundle. `EcsModeRuntimeEntry.js`
  now spreads the resolver and nests the vocabulary onto the frozen `EcsModeRuntime`,
  and `EcsModeRuntimeBundle.js` was regenerated with exact `esbuild@0.23.1`
  (version marker `ecs-mode-runtime-batch-4`).
- `CanvasModeOwnershipBridge.resolveInputIntent(physicalIntent)` reads the mode
  snapshot and delegates to the bundled resolver, returning `null` when no
  snapshot/runtime is available so routers fall back to their legacy branches.
- The App and Shell input routers build a physical intent and route covered
  modes through `this.resolveInputIntent(...)`, keeping every legacy fallback so
  behavior is identical when the bridge is absent.

## Scope Control

Batch 4 does not migrate:

- physical-input-to-action construction for non-covered branches (action objects
  are still built by the routers from hit-test results)
- concrete modal payload ownership for naming/event/reward/confirm/target-picker
  panels (Batch 5)
- tutorial flow or tutorial input-gating ownership (tutorial domain batch)
- renderer snapshot contracts (Batch 6) or `getHitTarget` hit-testing
- gameplay domain state

Old mode and panel fields remain bridge ingress facts. Panel, tutorial, and
action input branches stay report-only; only input-router `mode` and
`runtime-route` branches are governed by the new blocking guard.

## New Runtime Surfaces

| Surface                                             | Role             | Notes                                                                       |
| --------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `frontend/js/ecs/input/InputIntent.js`              | Vocabulary       | Frozen physical-intent + routed-intent shapes and covered-mode route keys   |
| `frontend/js/ecs/input/InputIntentResolver.js`      | Pure resolver    | `(physicalIntent, modeSnapshot)` -> routed intent via ModeResolver booleans |
| `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`   | Runtime artifact | Regenerated IIFE bundle now exposing `resolveInputIntent` + `InputIntent`   |
| `frontend/js/platform/CanvasModeOwnershipBridge.js` | Temporary bridge | Adds `resolveInputIntent`; no new source-of-truth fields                    |

## Legacy Bridge Contract

`CanvasModeOwnershipBridge.resolveInputIntent(physicalIntent)` is a pure
pass-through: it calls the existing `getModeSnapshot(host)` and forwards to
`EcsModeRuntime.resolveInputIntent(physicalIntent, snapshot)`. It adds no new
source-of-truth fields, no business branches, and no mode decisions of its own
(bridge lifecycle policy). When the snapshot or bundled resolver is unavailable
it returns `null`, which makes the routers use their legacy mode branches.

## Behavior Preservation Notes

Each covered-mode router gate is written as `routedRoute ? routedRoute === '<route>' : <legacy branch>`.
When the bridge/runtime is present the routed intent drives the decision; when it
is absent (e.g. focused unit tests that do not install the bridge) the original
legacy branch runs unchanged. The world-map runtime mechanics (coordinator drag,
snapshot-drag, pinch-pan), the per-gesture `dragAction` memo, tutorial gating,
panel checks, and `getHitTarget` hit-testing are all left exactly as they were.

## Guard Contract

`scripts/check-frontend-ecs-input-intent-spine.js` is a blocking gate. It runs
the report-only `report-frontend-ecs-input-branch` scanner, filters to
`surface === 'input-router'` AND `branchKind in {mode, runtime-route}`, and diffs
the result against the 0B input-branch baseline by `(file, branchKind)`. A
violation is emitted only when the current count exceeds the baseline count for a
key, so net-new covered-mode routing in legacy router files fails the gate, while
panel/tutorial/action branches stay report-only. Growth is allowed only in
`frontend/js/ecs/input/**`, the generated bundle, and the bridge. The guard, its
test, and the new source/test files are registered in `run-architecture-smoke.js`
(the guard runs as a blocking step right after the mode-ownership spine guard).

## Acceptance Answers

| Question                          | Answer                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Old owner being retired?          | Scattered covered-mode routing decisions inside the input routers; routed through the ECS resolver, with legacy branches kept only as fallback.     |
| New ECS owner?                    | `InputIntentResolver.js` (pure), exposed via the generated runtime bundle and consumed through `CanvasModeOwnershipBridge.resolveInputIntent`.      |
| Legacy fields/methods remaining?  | Raw mode/panel fields and the Batch-3 snapshot helpers remain as the bridge-absent fallback path; panel/tutorial branches remain router-owned.      |
| Guard preventing old-path growth? | `scripts/check-frontend-ecs-input-intent-spine.js` (blocking), scoped to input-router mode/runtime-route branches vs the 0B baseline.               |
| Behavior tests?                   | InputIntent + resolver unit tests, bridge `resolveInputIntent` test, guard test, plus the existing App/Shell router tests (run without the bridge). |
| Rollback?                         | Remove `resolveInputIntent` from the routers (restoring the pure legacy branches), drop the bridge helper, and rebuild the bundle from the entry.   |
| Next bridge to retire?            | `CanvasModeOwnershipBridge.js` continues to shrink in Batch 5 as concrete modal payload ownership moves out of legacy fields.                       |

## Verification

Local verification passed:

- `npm install` (esbuild `0.23.1` resolved) then `npm run build:ecs-runtime`
- `node --test frontend/js/ecs/input/InputIntent.test.js frontend/js/ecs/input/InputIntentResolver.test.js`
- `node --test frontend/js/platform/CanvasModeOwnershipBridge.test.js`
- `node --test frontend/js/platform/CanvasGameApp.test.js frontend/js/platform/CanvasGameShell.test.js`
- `node --test scripts/check-frontend-ecs-input-intent-spine.test.js`
- `node scripts/check-frontend-ecs-input-intent-spine.js` (0 violations; current 30 = baseline 30)
- `npm run lint`
- `npm run format:check`
- `npm run test:architecture` passed with `1173` tests and all architecture guards
- `git diff --check`

An adversarial review (scope adherence, behavior preservation, guard/architecture
correctness) reported the scope and behavior lenses clean; the only finding was a
low-severity note that the guard's approved-path allowlist is a forward-looking
safety net (the report scanner does not currently surface those paths), now
documented inline in the guard.

## Review Result

Batch 4 is `Completed` after migration owner review by `codex/external-review` at `2026-06-26 01:24:26 +08:00`. The review confirmed the input intent vocabulary/resolver (pure, kind-aware), the bridge `resolveInputIntent` pass-through (null fallback, no new source-of-truth fields), the regenerated runtime bundle (`esbuild@0.23.1`), the count-preserving router physical-adapter conversion (guard reports current 30 = baseline 30, 0 violations), and the scoped input-intent spine blocking guard. Scope was confirmed clean (no tutorial, panel/modal, renderer/`getHitTarget`, or gameplay ownership migrated). The judgment call to leave the gesture/tap tech-tree/world-map fall-through on the Batch-3 snapshot helpers was accepted as Batch 6 / domain-sealing territory (world-map runtime readiness, not a pure mode decision).

Batch 5 (Panel/Modal Ownership) may start after this completion commit reaches the server branch.
