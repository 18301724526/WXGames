# Frontend ECS Boundary

Batch 2 created a Node/CommonJS architecture boundary only. Batch 3 added the generated mode runtime surface: `runtime/EcsModeRuntimeBundle.js`. Gameplay/runtime logic that used to live under the retired frontend layer now belongs to focused ECS folders: `foundation/`, `system/`, `projection/`, `input/`, `resource/`, and `debug/`.

Runtime code may not import `bitecs` directly. Production access to the external ECS core goes through `core/EcsCoreBoundary.js`, which forwards the approved `bitecs@0.4.0` primitives without adding project-owned ECS storage, query, or scheduler logic.

H5 and minigame entrypoints may load ECS gameplay surfaces from `foundation/`, `system/`, `projection/`, `input/`, `resource/`, and `debug/`. They must not load raw files from `core/`, `registry/`, `mode/`, `owner/`, or `snapshot/`.

The registry manifest declares reviewed owner roles, component families, mode keys, snapshot keys, and runtime loading policy. Bridge is retired as an ECS owner role.
