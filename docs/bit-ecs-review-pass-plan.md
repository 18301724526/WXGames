# BitECS Review Pass Plan

## Position

The project uses `bitecs@0.4.0` as the only approved ECS core. A folder name,
owner object, snapshot object, facade, bridge, adapter, or wrapper object is not
an ECS implementation.

The previous `domain` retirement commit removed the old layer, but it did not
make every migrated module a real BitECS system. That distinction must remain
explicit in reviews and documents.

## Passing Standard

A module is accepted as ECS only when all of these are true:

- Entity identity comes from BitECS `addEntity(world)`.
- Authoritative state is stored in `defineComponent(...)` component arrays.
- Runtime reads use `defineQuery(...)` over the BitECS world.
- State changes happen inside named systems that receive the world/scope and
  mutate components.
- Renderer, platform, input, and sync layers receive snapshots or projections,
  not writable component ownership.
- Tests assert component storage and query/system behavior, not only public
  wrapper behavior.

## Rejected Patterns

The following patterns are rejected even when they pass tests:

- A class or POJO owns authoritative game state and is placed under `ecs/`.
- `Owner`, `Snapshot`, `Model`, or `Resolver` objects replace component storage.
- `globalThis` is used as source of truth.
- App, Shell, CanvasShell, Runtime, Renderer, and StateManager all write the same
  fact.
- Renderer code writes authoritative gameplay state.
- A bridge forwards writes in both directions.
- A generated bundle hides self-written ECS storage instead of bundling BitECS.

A wrapper is never accepted as the ECS implementation. Existing public entry
points may survive only when they call BitECS system/query/projection functions
directly and store the real BitECS world handle instead of a wrapper object.

## Current Demonstration Slice

`frontend/js/ecs/foundation/WorldClock.js` is the small demonstration slice for
the accepted pattern.

It contains:

- `Clock`: a BitECS component with server sync time, client monotonic sync time,
  elapsed time, current epoch time, last sync time, and synced flag.
- `createClockWorld(options)`: creates a BitECS world and one clock entity.
- `runClockSyncSystem(clockWorld, payload)`: syncs server time into the component.
- `runClockAdvanceSystem(clockWorld)`: derives current epoch time from component
  state and runtime monotonic time.
- `getClockSnapshot(clockWorld)`: returns a read-only projection for callers.
- `getShared(options)`: returns the real BitECS clock world handle; it is not a
  class instance and does not attach update/read methods to the handle.

The tests in `frontend/js/ecs/foundation/WorldClock.test.js` assert:

- a BitECS component exists and stores values by entity id;
- systems mutate component arrays;
- shared entry points return the real BitECS world handle rather than a wrapper
  object.

H5 and minigame use the generated runtime bundle path:

- `frontend/js/ecs/mode/EcsModeRuntimeEntry.js` imports the BitECS clock module;
- `npm run build:ecs-runtime` bundles BitECS and the approved boundary into
  `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`;
- entrypoints load the bundle before modules that consume `globalThis.WorldClock`.

## Migration Method

Each future module must migrate in this order:

1. Name the old source of truth and every writer.
2. Define the BitECS components that will own that state.
3. Write failing tests that inspect component arrays and query results directly.
4. Implement systems that mutate only component storage.
5. Add a projection function for renderer/platform compatibility.
6. Rewire old public APIs to call BitECS system/query/projection functions
   directly.
7. Delete or demote the old owner to read-only projection.
8. Add a guard that prevents new owner/mirror writes for the migrated fact.

No batch is accepted if it ends with two writable sources of truth.

## Slice Order

The next ECS slices should be chosen by isolation and review clarity:

- `WorldClock`: completed demonstration slice.
- Fog visibility facts: tiles, visibility sources, reveal strength, render
  projection.
- Battle overlay facts: battle scene entity, replay state, active overlay.
- Mode/modal facts: base mode, modal mask, capture priority.
- Input routing facts: physical intent entity, routed intent component, action
  projection.

World map renderer authority and tutorial flow should not be converted first;
they currently cross too many boundaries and will hide ECS mistakes.

## Review Checklist

For every ECS pull request, reviewers should answer:

- Which BitECS world does this module use?
- Which components own the authoritative facts?
- Which systems write those components?
- Which queries read those components?
- Which old public entry points remain, and do they call BitECS functions
  directly without creating wrapper ownership?
- Which old writer is deleted or blocked?
- Which tests fail if the implementation is replaced with a POJO owner?
- Does H5/minigame load the same generated runtime path?

If any answer is missing, the module is not accepted as ECS.

## Documentation Rules

Documents must not claim a module is migrated to ECS unless it satisfies the
passing standard. A module may be called:

- `domain retired` when the old path is gone;
- `ECS compatibility` when the old API wraps a new path;
- `real BitECS` only when component/query/system tests prove it.

Historical plans that recommend "ECS-lite" or self-owned ECS state are obsolete.
