# Frontend ECS Boundary

This folder is not allowed to use "ECS" as a rename-only label.

The accepted runtime ECS core is `bitecs@0.4.0`. Production code may access BitECS
only through `core/EcsCoreBoundary.js` or through a generated runtime bundle that
includes that boundary. Direct package imports outside the boundary are blocked.

## What Counts As ECS

A module counts as real ECS only when its authoritative state follows this shape:

- Entity identity is a BitECS entity id from `addEntity(world)`.
- Authoritative data lives in `defineComponent(...)` component storage.
- Reads use `defineQuery(...)` over a BitECS world.
- Mutations happen in named systems that receive the world/scope and update
  components.
- Renderer/platform code receives projections or snapshots after systems run.

## What Does Not Count

These are not ECS completion criteria:

- Moving a file under `frontend/js/ecs`.
- Renaming a model to owner/snapshot/projection.
- Storing authoritative state in classes, object graphs, host mirrors, shell
  mirrors, `globalThis`, or renderer cache objects.
- Wrapping old state with an adapter and calling it an ECS owner.

Existing owner/snapshot/projection modules are compatibility or migration debt
unless they satisfy the BitECS criteria above.

## Current Real BitECS Example

`foundation/WorldClock.js` is the first small accepted example:

- `Clock` is a BitECS component.
- `createClockWorld()` creates a BitECS world and a clock entity.
- `runClockSyncSystem()` writes server sync facts into component storage.
- `runClockAdvanceSystem()` advances derived epoch time from component storage.
- `getClockSnapshot()` projects component state for compatibility consumers.
- There is no `WorldClock` wrapper class. Old imports call BitECS system and
  projection functions directly and store the real BitECS world handle.

H5 and minigame do not load raw BitECS modules directly. They load
`runtime/EcsModeRuntimeBundle.js`, which bundles the approved boundary and exposes
the runtime surfaces such as `globalThis.WorldClock`.
