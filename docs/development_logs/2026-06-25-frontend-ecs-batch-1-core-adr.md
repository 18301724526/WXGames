# Frontend ECS Batch 1 Core ADR - 2026-06-25

## Status

Ready for Migration Owner Review.

Batch 1 does not migrate runtime behavior, does not install an ECS dependency, and does not create component, system, or mode skeleton code.

## Decision

The frontend ECS migration will use the external npm package `bitecs` as the ECS core.

Approved import surfaces for future batches:

- `bitecs`
- `bitecs/serialization`

The project must not implement a local ECS core. Entity IDs, component storage, query primitives, system scheduling, world lifecycle, and serialization primitives must come from the approved external core or from thin project adapters around that external core.

## Source Review

Reviewed sources:

- bitECS documentation: https://bitecs.dev/docs/introduction
- bitECS GitHub package metadata: https://github.com/NateTheGreatt/bitECS/blob/main/package.json

Relevant facts from source review:

- bitECS is a JavaScript/TypeScript ECS library focused on data-oriented game development.
- The documented model uses numeric entities, flexible component storage, and query-driven systems.
- The package name is `bitecs`.
- The package exports the main core surface and a `serialization` subpath.

Batch 2 must pin the exact dependency version in `package.json` and `package-lock.json` when the ECS boundary skeleton begins. If the npm-published package differs materially from the reviewed upstream package metadata, Batch 2 must update this ADR before installing the dependency.

## Rationale

The project is migrating because ownership is already too scattered to safely extend. Building an in-house ECS core would add another ownership surface before the old owners are retired. That would repeat the same failure pattern under a new name.

`bitecs` is a better fit for this project than a homegrown core because:

- It keeps the core ECS primitives outside the application codebase.
- It is small and focused enough for a canvas game runtime.
- It leaves component storage policy to the project, which matters for H5 and minigame constraints.
- It supports serialization as a package-level concern instead of forcing the project to invent that layer early.
- It allows the migration to focus on ownership boundaries rather than core data-structure design.

## Non-Goals

Batch 1 explicitly does not:

- Add `bitecs` to `package.json`.
- Add `bitECS`, `bitecs`, or ECS runtime wrappers to production code.
- Create component families, systems, mode stack, or snapshots.
- Change tutorial, input, renderer, city, battle, formation, or world-map behavior.
- Convert any 0A or 0B report-only guard into a blocking guard.

## Blocking Guard

Batch 1 adds `scripts/check-frontend-ecs-core-guard.js`.

The guard is blocking and scans production source under:

- `frontend/js`
- `frontend/minigame`
- `shared`

It excludes tests, vendor code, docs, baselines, and dependencies.

The guard allows future imports from `bitecs` and `bitecs/serialization`.

The guard blocks:

- Local files that look like ECS core implementations, such as `ECSCore.js`, `EntityStore.js`, `ComponentStore.js`, `QueryEngine.js`, or `SystemScheduler.js`.
- Local declarations of ECS core primitives such as `createWorld`, `createEntity`, `defineComponent`, `defineQuery`, `addComponent`, `removeComponent`, or system registration/runtime helpers.
- Local ECS core storage such as `entityStore`, `componentStore`, or `queryStore`.
- Imports from local core-like modules.
- ECS package dependencies other than `bitecs`.
- Unsupported `bitecs/*` subpaths outside the approved surfaces.

The guard intentionally avoids matching ordinary game code such as `system` fields or `createWorldTiles`.

## Acceptance

Batch 1 first implementation is acceptable for migration owner review when:

- This ADR exists and states `bitecs` as the target ECS core.
- The blocking guard passes on current production source.
- The guard has tests for scan scope, allowed imports, blocked local core patterns, dependency drift, and unknown CLI arguments.
- `npm run test:architecture` runs the guard as a blocking gate.
- Progress and operating plan documents mark Batch 1 as `Ready for Migration Owner Review`, not `Completed`.

Batch 1 can be marked `Completed` only in a separate commit after migration owner review passes.

## Rollback

If the guard produces an unacceptable false positive during review, roll back only the guard and tests or narrow the matching rule. Runtime code has not changed, so rollback does not require gameplay recovery.

If the `bitecs` package choice is rejected during review, this ADR must be superseded before Batch 2 starts. No runtime migration may begin while the ECS core choice is unresolved.
