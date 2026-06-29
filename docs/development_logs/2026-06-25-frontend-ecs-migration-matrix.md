# Frontend ECS Migration Matrix And Module Design - 2026-06-25

## Purpose

This document defines the target frontend ECS migration boundary before implementation starts.
It is not an implementation plan. It does not prescribe file-by-file edits or migration order.

The goal is to prevent a half-ECS, half-legacy frontend. A module is not considered migrated because it calls ECS APIs. A module is considered migrated only when its legacy ownership is retired, its responsibility is assigned to one target role, and guards can prevent the old path from growing again.

## Non-Negotiable Rules

1. The project must not self-build an ECS core.
   Entity storage, component storage, queries, and system execution primitives must come from an external ECS library. The current target is `bitECS`, subject to a short ADR before code changes.

2. ECS state owns gameplay and UI mode facts.
   Renderers, input routers, shell/app facades, and tutorial controllers must not be source-of-truth owners for gameplay state, mode state, selection state, or panel/modal state after their module is migrated.

3. Renderers are adapters.
   A renderer consumes snapshots and emits visual output plus hit-target descriptions. It must not decide gameplay outcomes, mutate command authority, or own mode transitions.

4. Input mapping is explicit.
   Physical input is converted into an input intent, then resolved through active ECS modes and systems. Mode checks must not remain scattered across shell/app input routers after migration.

5. Facades are temporary compatibility shells.
   A retained facade may forward calls and preserve old public names, but it may not keep business branching, duplicated mode logic, or private state ownership.

6. Components are serializable data.
   Components must not store canvas contexts, DOM nodes, browser events, promises, class instances, or renderer objects.

7. One responsibility has one owner.
   Coordinate normalization, action dispatch, mode priority, tutorial focus, panel state, layer ordering, asset keys, API paths, and command evidence must each have a single declared owner.

## Target Frontend ECS Roles

| Role              | Meaning                           | Allowed To Own                                                                                 | Not Allowed To Own                                                   |
| ----------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| External ECS Core | Third-party ECS primitive layer   | world, entity ids, component storage, queries, system execution primitive                      | game-specific policy                                                 |
| Component Schema  | Serializable data model           | component definitions, default values, schema version names                                    | functions with side effects                                          |
| System            | Deterministic state transition    | input resolution, mode transition, snapshot composition, animation clocks, command preparation | canvas drawing, API transport details                                |
| Mode              | Explicit active interaction state | mode stack, mode priority, enabled systems, input capture rules                                | renderer-owned booleans                                              |
| Adapter           | Boundary to legacy/external world | API transport, canvas drawing, platform runtime, asset loading, debug output                   | gameplay source of truth                                             |
| Registry          | Stable key ownership              | action keys, asset keys, layer keys, component/system/mode keys                                | business branching                                                   |
| Bridge            | Temporary migration shell         | legacy public method compatibility during a declared migration window                          | new business logic, new state ownership, or open-ended compatibility |

## Global Component Families

| Component Family | Purpose                                                                                              | Current Legacy Sources To Retire                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Identity         | stable entity ids for player, city, building, world tile, world actor, task, tutorial target, panel  | ad hoc object ids passed through renderer/action payloads                                              |
| Position         | world coordinates, screen anchors, camera-independent tile facts                                     | renderer-specific `q/r/x/y/tileId` inference outside coordinate owner                                  |
| Mode             | active mode, mode stack, modal/tutorial shield, input capture                                        | `activeTab`, `militaryView`, `entityBattle.visible`, `techDetailOpen`, `show*` booleans as owners      |
| Selection        | selected city, building, tile, site, actor, mission, tech, famous person                             | duplicated UI state on app, shell, territory controller, renderer                                      |
| Camera           | world camera, tech tree camera, battle camera, drag/pinch state                                      | shell/app runtime fields as source of truth                                                            |
| Panel            | open/closed panels, active command panel, modal data, naming prompt                                  | scattered shell/app panel flags                                                                        |
| Modal            | naming, event detail, reward reveal, confirm dialog, target picker, blocking overlays                | `naming`, `activeEventId`, `rewardReveal`, `confirmDialog`, target-picker state on shell/app/renderers |
| Auth             | login/session/account/update prompt visibility and auth transition state                             | boot/auth fields spread across UI host, app shell, local storage callers                               |
| Network          | first sync, heartbeat status, reconnect/backoff, update polling state                                | service timers or API callers becoming implicit gameplay readiness owners                              |
| Transition       | tab/page transitions, reward animation timing, battle playback transition, tutorial intro transition | renderer or shell animation callbacks mutating mode/panel facts                                        |
| Formation        | formation editor open state, selected slot, member ids, soldier assignments, auto-fill result        | `armyFormationEditor` object mirrored on app/shell and action handlers                                 |
| Tutorial Focus   | current tutorial step, target, allowed action, dialogue state                                        | controller-side direct mutation of shell/app state                                                     |
| Command Intent   | normalized user intent before API dispatch                                                           | direct action payload assembly inside renderers/input routers                                          |
| Animation        | clocks, playback state, actor animation state, Spine visual state                                    | render frame callbacks mutating gameplay or mode facts                                                 |
| Snapshot         | render-ready readonly data                                                                           | renderer-side recomposition of gameplay state                                                          |

## Migration Matrix

| Current Area                                    | Target Role                                     | Final Owner                                              | Adapter/Bridge Allowed                  | Completion Standard                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/js/ecs`                            | Component-adjacent pure models and pure systems | ECS component schema helpers and pure ECS systems     | none for renderer/platform              | No dependency on `platform`, `renderers`, `state`, DOM, canvas, or API transport. Existing pure coordinate, geometry, input-intent, visibility, and performance modules either become systems/schema helpers or stay pure external utilities used by systems. |
| `frontend/js/state`                             | Snapshot composition systems                    | ECS snapshot systems and presenter adapters              | presenter facade only                   | Presenters no longer infer authoritative state from scattered shell/app flags. They consume ECS world snapshots or server DTO snapshots and produce readonly view snapshots.                                                                                  |
| `frontend/js/platform/CanvasGameApp*`           | Bridge                                          | ECS app bridge                                           | temporary public-method facade          | App fields stop being source-of-truth owners for mode, selection, panels, camera, tutorial, or world runtime facts. Public methods may forward to ECS systems/adapters only.                                                                                  |
| `frontend/js/platform/CanvasGameShell*`         | Bridge and platform adapter                     | ECS shell bridge plus platform runtime adapter           | temporary public-method facade          | Shell input, panel, render scheduling, and world-map runtime fields stop owning gameplay/mode facts. Shell keeps platform mounting and canvas orchestration only.                                                                                             |
| `frontend/js/platform/*InputRouter.js`          | Input adapter                                   | ECS input system and mode resolver                       | thin physical-input bridge              | Input routers convert tap/drag/gesture to input intents and call ECS input resolution. They do not branch on mode-specific business rules.                                                                                                                    |
| `frontend/js/platform/CanvasAction*`            | Command adapter and action registry             | ECS command intent system plus action registry           | compatibility dispatcher                | Action dispatch no longer decides mode transitions or stores UI state. It prepares command intents and forwards to command/API adapters.                                                                                                                      |
| `frontend/js/platform/Canvas*ActionHandlers.js` | System candidates                               | Feature-specific ECS systems                              | temporary method bridge                 | City, territory, famous, shell, and military actions move to systems or command adapters. Handler files may remain only as facade installers during migration.                                                                                                |
| `frontend/js/platform/WorldMapRuntime*`         | World-map systems and adapter boundary          | ECS world-map systems                                    | runtime bridge for old renderer context | Camera, picking, hit-target, render policy, bake policy, and drag state become ECS systems/components. Runtime keeps only canvas-layer integration and compatibility snapshots.                                                                               |
| `frontend/js/platform/CanvasLayerRegistry.js`   | Registry                                        | Layer registry remains single owner                      | no duplicate registry                   | Physical layer, render queue, hit priority, animation category, and input surface remain registry-owned. ECS may reference layer keys but cannot redefine layer ordering elsewhere.                                                                           |
| `frontend/js/platform/*Registry.js`             | Registry                                        | Stable key registries                                    | no behavior bridge                      | Registries own keys and dependency declarations only. They do not carry business branching or mode policy.                                                                                                                                                    |
| `frontend/js/platform/renderers`                | Renderer adapters                               | Renderer adapters consuming ECS snapshots                | renderer facade allowed                 | Renderers draw snapshots and register hit-target descriptions. They do not own gameplay state, mode state, command authority, or persistent panel state. Layout models may stay pure helpers.                                                                 |
| World-map renderer family                       | Renderer adapter plus pure layout helpers       | ECS world-map snapshot system + renderer adapters        | world-map facade allowed                | Tile, water, fog, actor, HUD, site overlay, march HUD, cache, and layer renderers consume one world-map render snapshot. No renderer recomputes authority facts or owns fallback gameplay paths.                                                              |
| HUD/menu renderer family                        | Renderer adapter                                | ECS UI snapshot system + renderer adapters               | facade allowed                          | HUD renderers consume panel/mode/tutorial snapshots. They do not decide which panel is open or which command is legal.                                                                                                                                        |
| Battle renderer family                          | Renderer adapter                                | ECS battle snapshot system + renderer adapters           | facade allowed                          | Battle renderers consume battle simulation/playback snapshots. Battle camera and playback state are ECS components/systems, not renderer fields.                                                                                                              |
| Tutorial renderer family                        | Renderer adapter                                | ECS tutorial focus/dialogue snapshot system              | facade allowed                          | Tutorial renderers draw focus, dialogue, Spine, and intro visuals from snapshots. They do not mutate tutorial progression or app/shell mode fields.                                                                                                           |
| `frontend/js/tutorial`                          | Tutorial systems and registries                 | ECS tutorial systems plus tutorial flow/event registries | controller facade only                  | Tutorial flow registry owns flow definitions. Tutorial systems own focus, gating, allowed action, and progression triggers. Controller cannot directly mutate shell/app state after migration.                                                                |
| `frontend/js/controllers`                       | External command/UI adapters                    | ECS command adapter or API-facing controller adapter     | temporary controller bridge             | Controllers no longer duplicate client-side business state. They submit intents and consume server/ECS snapshots.                                                                                                                                             |
| `frontend/js/api`                               | External adapter                                | API transport boundary                                   | none                                    | API layer owns HTTP details only: paths, request id, retry policy, structured errors. It does not own mode, ECS state, or renderer state.                                                                                                                     |
| `frontend/js/services`                          | External services                               | ECS external-service adapters                            | none                                    | Heartbeat, update check, and sync services may feed ECS snapshots/events but must not become gameplay authority.                                                                                                                                              |
| `frontend/js/config`                            | Registry/config source                          | Config and manifest registries                           | none                                    | Asset keys, locale keys, feature flags, tile/unit manifests, and tuning registries remain key owners. Production logic must not hardcode duplicated config values outside these registries.                                                                   |
| `frontend/js/debug`                             | Debug adapter                                   | ECS debug snapshot adapter                               | none                                    | Debug modules consume compact ECS/input/API evidence. They do not alter gameplay or mode state.                                                                                                                                                               |
| `frontend/js/shared`                            | Shared pure adapters                            | Cross-runtime pure helpers                               | none                                    | Shared helpers remain pure and serializable. No platform, renderer, or ECS-world singleton ownership.                                                                                                                                                         |
| `frontend/js/ui`                                | Host/platform adapter                           | Boot/auth/update host adapter                            | none                                    | UI host wires platform boot, auth, update, and canvas shell. It does not own gameplay/mode state.                                                                                                                                                             |
| `frontend/minigame`                             | Platform adapter                                | Minigame platform bridge                                 | compatibility bridge                    | Minigame path consumes the same ECS systems and snapshots as H5. It may adapt platform APIs only. No copied mode/input/gameplay implementation.                                                                                                               |
| `frontend/js/vendor`                            | External dependency                             | Vendor/external library boundary                         | none                                    | Vendor code is not modified for ECS policy. Wrappers/adapters live outside vendor.                                                                                                                                                                            |

## Mode Design

Modes are explicit ECS state, not inferred from scattered booleans.

| Mode                  | Owns                                                                                                  | Captures Input                   | May Coexist With                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `boot`                | startup/loading/first sync                                                                            | yes, loading-only                | update/auth overlays                                   |
| `city`                | city management, building, people, resource work                                                      | page and panel input             | tutorial overlay                                       |
| `worldMap`            | world map camera, selection, actor/site interaction, march command flow                               | world map input                  | tutorial overlay, command HUD                          |
| `techTree`            | tech camera, tech selection, detail panel                                                             | tech tree drag/zoom/tap          | tutorial overlay                                       |
| `formationEditor`     | formation selection, soldier assignment, save intent                                                  | formation editor input           | tutorial overlay                                       |
| `battle`              | battle playback or interactive battle                                                                 | battle input                     | battle overlays only                                   |
| `modal:naming`        | naming prompt, input value, submit/cancel state                                                       | modal input first                | base mode underneath                                   |
| `modal:event`         | event detail/choice panel, event claim intent                                                         | modal input first                | base mode underneath                                   |
| `modal:rewardReveal`  | reward reveal animation and close intent                                                              | modal input first while blocking | base mode underneath                                   |
| `modal:confirmDialog` | destructive/confirm action prompt                                                                     | modal input first                | base mode underneath                                   |
| `modal:targetPicker`  | multi-target world selection picker                                                                   | modal input first                | `worldMap` underneath                                  |
| `modal:blockingPanel` | settings, logs, guidebook, task center, famous persons, city switcher, subcity list, resource details | panel input first                | base mode underneath only through declared fallthrough |
| `tutorial`            | focus shield, allowed action, dialogue, Spine visual state                                            | only where allowed               | any base mode                                          |
| `debug`               | diagnostics overlays                                                                                  | only when explicitly enabled     | any mode                                               |

Mode priority is data-driven. Physical input asks the active mode stack first, then falls through only through declared fallthrough rules.

## Snapshot Design

Render snapshots are the only renderer input after migration.

| Snapshot            | Consumer                                    | Source                                    |
| ------------------- | ------------------------------------------- | ----------------------------------------- |
| `ShellSnapshot`     | HUD, top bar, tab/page renderers            | ECS UI snapshot systems                   |
| `WorldMapSnapshot`  | world-map, fog, water, actor, HUD renderers | ECS world-map systems plus server DTO     |
| `CitySnapshot`      | city/building/people renderers              | ECS city systems plus server DTO          |
| `TechSnapshot`      | tech renderers                              | ECS tech systems plus server DTO          |
| `FormationSnapshot` | formation editor renderer                   | ECS formation systems                     |
| `BattleSnapshot`    | battle renderers                            | ECS battle systems plus server battle DTO |
| `TutorialSnapshot`  | tutorial renderers and shields              | ECS tutorial systems                      |
| `DebugSnapshot`     | debug overlays                              | ECS/debug adapters                        |

Snapshots must be readonly, serializable where practical, and free of canvas/DOM/runtime objects.

## Migration Completion Gate

A module is complete only when all of these are true:

1. Its target role is documented in this matrix or the official architecture docs that replace this matrix.
2. Old source-of-truth fields are removed or downgraded to read-only bridge mirrors.
3. Any retained facade is a thin forwarding shell.
4. Mode/input decisions pass through ECS mode systems.
5. Renderer code consumes snapshots and emits visual/hit-target output only.
6. Components remain serializable and do not store runtime objects.
7. Duplicate logic has one declared owner.
8. Quality gates can block new violations for that module.

## Bridge Lifecycle

Every bridge must have a lifecycle record before it is introduced or expanded.

| Field                 | Required Meaning                                                                  |
| --------------------- | --------------------------------------------------------------------------------- |
| Bridge owner          | Person or module owner responsible for retirement                                 |
| Covered legacy fields | Exact old fields mirrored or forwarded by the bridge                              |
| Allowed methods       | Public methods kept only for compatibility                                        |
| Forbidden branches    | Business or mode branches the bridge may not contain                              |
| Retirement target     | ECS system/adapter/registry that will replace the bridge                          |
| Max lifetime          | Two migration batches or 14 calendar days, whichever is shorter                   |
| Extension rule        | Requires a written exception with reason, new retirement date, and blocking guard |

If a bridge exceeds its max lifetime, new features may not add calls to that bridge. Bug fixes may touch it only to remove ownership, close old paths, or preserve production behavior while the replacement lands.

## Guard Requirements

The ECS migration must add gates before or alongside module migration.

| Guard                     | Blocks                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| External ECS core guard   | self-built entity/component/query/system core                                                |
| Component purity guard    | canvas, DOM, browser event, promise, class instance, or renderer object stored in components |
| Mode ownership guard      | new mode checks outside ECS mode systems and thin adapters                                   |
| Renderer authority guard  | renderer mutating gameplay/mode/command authority state                                      |
| Duplicate owner guard     | same action/mode/coordinate/layer/tutorial logic implemented in multiple production files    |
| Hardcoded literal guard   | unowned numeric/string literals outside config/registry/layout owners                        |
| Boundary dependency guard | ECS/system depending on renderer/platform/API transport                                   |
| Bridge shrink guard       | migrated bridge files regaining business branches                                            |

## Current Risk Statement

The current frontend already contains useful extracted pieces, but they are not enough to call the frontend ECS-based. The main risk is partial adoption: adding ECS APIs while leaving old source-of-truth booleans, input routing branches, renderer fallback behavior, and facade business logic alive.

The migration should therefore be judged by retirement of old ownership, not by the presence of ECS terminology.
