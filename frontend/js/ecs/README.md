# Frontend ECS Boundary Skeleton

Batch 2 creates a Node/CommonJS architecture boundary only. These files are not part of the H5 script manifest and must not be loaded from `frontend/index.html` or `frontend/minigame/game.js`.

Runtime code may not import `bitecs` directly. Production access to the external ECS core goes through `core/EcsCoreBoundary.js`, which forwards the approved `bitecs@0.4.0` primitives without adding project-owned ECS storage, query, or scheduler logic.

The registry manifest declares reviewed owner roles, component families, mode keys, snapshot keys, and bridge lifecycle policy. It does not create a world, read legacy app or shell state, or migrate gameplay behavior.
