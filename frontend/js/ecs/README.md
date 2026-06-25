# Frontend ECS Boundary

Batch 2 created a Node/CommonJS architecture boundary only. Batch 3 adds one approved runtime surface for mode ownership: `runtime/EcsModeRuntimeBundle.js`.

Runtime code may not import `bitecs` directly. Production access to the external ECS core goes through `core/EcsCoreBoundary.js`, which forwards the approved `bitecs@0.4.0` primitives without adding project-owned ECS storage, query, or scheduler logic.

H5 and minigame entrypoints may load only the generated `runtime/EcsModeRuntimeBundle.js`. They must not load raw files from `core/`, `registry/`, or `mode/`.

The registry manifest declares reviewed owner roles, component families, mode keys, snapshot keys, bridge lifecycle policy, and runtime loading policy. It does not create a world, read legacy app or shell state, or migrate gameplay behavior.
