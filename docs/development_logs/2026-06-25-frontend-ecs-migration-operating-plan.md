# Frontend ECS Migration Operating Plan - 2026-06-25

## Purpose

The migration matrix defines the destination. This document defines how the project can move toward that destination without freezing all bug fixes and feature work for months.

This is still not a file-by-file implementation guide. It is an operating plan: ownership rules, sequencing rules, dual-track policy, acceptance gates, rollback policy, and stop-loss criteria.

## Reality Check

The current frontend cannot be treated as a clean ECS candidate. The migration must assume:

- No ECS core dependency exists yet.
- Many state facts are mirrored across app, shell, canvas shell, last game, and state snapshots.
- Prototype/mixin installation makes static dependency analysis incomplete.
- Renderers often participate in hit-target generation and sometimes influence input behavior.
- Mode checks are scattered across production files.
- Temporary compatibility code can become permanent unless explicitly time-boxed.

The operating plan therefore treats old-owner retirement as the main deliverable.

## Migration Objective

The target is not to make every file "use ECS". The target is to make every frontend responsibility have one declared owner and to make legacy owners unable to grow.

Each migration batch must end in one of three states:

| State       | Meaning                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| Sealed      | Old owner retired or read-only mirrored, new ECS owner active, guards block old-path growth |
| Report-only | Old owner still active, but inventory and guard report exist                                |
| Rolled back | New path disabled/removed, old behavior restored, no mixed ownership remains                |

A batch is not allowed to end in "mixed but unguarded".

## Sequencing Rule

Do not sequence by perceived bug priority. Sequence by dependency topology and ability to seal ownership.

The order below is the required operating sequence:

| Batch                                              | Goal                                                                              | Why It Comes Here                                                             | Expected Window   | Exit Criteria                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| 0A. Mode and Bridge Inventory                      | Produce mode boolean and bridge/prototype inventory                               | These are the main infection sources and must be known first                  | 1 week            | Mode and bridge reports exist; old owners and mirrors are named           |
| 0B. Authority, Input, Literal, Duplicate Inventory | Produce renderer authority, input branch, literal, and duplicate inventories      | Completes the baseline needed for guard rollout                               | 1-2 weeks         | Reports exist; new violations can be distinguished from historical debt   |
| 1. ECS Core ADR and Gate                           | Confirm external ECS library and block self-built core                            | Prevent a second homegrown architecture                                       | 1 week            | ADR accepted; dependency added only after gate design exists              |
| 2. ECS Boundary Skeleton                           | Establish component/system/mode naming and read-only bridge policy                | Gives all later batches a target vocabulary                                   | 1-2 weeks         | No gameplay migration yet; guards can recognize ECS owner paths           |
| 3. Mode Ownership Spine                            | Create the single mode stack and modal subtype ownership                          | Mode booleans are the main spread vector                                      | 2-3 weeks         | New mode decisions cannot be added outside mode owner paths               |
| 4. Input Intent Boundary                           | Route physical input through explicit intent and mode resolver                    | Input is where old mode logic keeps re-entering                               | 2 weeks           | Input routers become physical adapters for covered modes                  |
| 5. Panel/Modal Ownership                           | Seal naming, event, reward reveal, confirm dialog, target picker, blocking panels | These are concrete old booleans and high-risk blockers                        | 2 weeks           | Covered modal subtypes no longer have app/shell as source of truth        |
| 6. Snapshot Boundary                               | Make renderers consume explicit snapshots for covered modes                       | Renderer authority cannot be removed until snapshot contract exists           | 2 weeks           | Covered renderers cannot read authoritative mode/panel state directly     |
| 7. Domain Area Sealing                             | Migrate one domain area at a time                                                 | Domain-specific work must happen after global mode/input/snapshot paths exist | 10-20 weeks total | Each domain area ends sealed or rolled back                               |
| 8. Bridge Retirement                               | Remove or shrink temporary facades and mirrors                                    | Prevent permanent compatibility mud                                           | 2-4 weeks         | Expired bridges fail guard; allowed bridges have active lifecycle records |

The batches are ordered, but batches 5-7 can repeat per domain area after the global spine is in place.

## Domain Sealing Order

Batch 7 must not pick domain order by frustration level. Use dependency and blast radius.

| Order | Domain    | Reason                                                                                                                                                                 |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Battle    | Most isolated compared with city/world/tutorial and useful for validating ECS state, animation, and snapshot patterns with lower blast radius                          |
| 2     | City      | Moderate dependency surface; validates panels, building/city state, and server DTO snapshot consumption before the world-map work                                      |
| 3     | World Map | Largest and most coupled surface; should start only after mode, input, modal, and snapshot boundaries are proven                                                       |
| 4     | Formation | Depends on city/military state and participates in world-march flow; should reuse city/world-map ownership patterns                                                    |
| 5     | Tutorial  | Depends on every other domain for focus targets, allowed actions, and guided transitions; should migrate last so it can point at ECS-owned state instead of old owners |

If evidence shows a domain has a smaller sealed slice that can be completed without mixed ownership, it may be split, but the split must preserve the same dependency logic.

## Expected Timeline

The complete frontend ECS migration is a multi-month program, not a short bugfix.

| Scope                                                        | Expected Window |
| ------------------------------------------------------------ | --------------- |
| Inventory and baseline                                       | 2-3 weeks       |
| Core ADR, boundary skeleton, mode/input/modal/snapshot spine | 8-12 weeks      |
| Domain area sealing                                          | 10-20 weeks     |
| Bridge retirement and stabilization                          | 2-4 weeks       |
| Total migration program                                      | 24-36 weeks     |

This timeline does not require feature work to stop for 24-36 weeks. It does require feature work to obey the dual-track policy and sealed-area rules during the migration window.

## Dual-Track Policy

During migration, the project may run old and new paths only under strict ownership rules.

| Work Type                      | Allowed Path During Migration                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Critical production bug        | May touch old path if it preserves behavior, but must add inventory evidence and must not add new unowned state |
| Bug in a migrated/sealed area  | Must fix through ECS owner or sealed adapter; old path may only be deleted or read-only mirrored                |
| New feature in unmigrated area | Allowed only if it registers ownership debt and does not create new duplicate owner patterns                    |
| New feature in migrated area   | Must use ECS owner path only                                                                                    |
| Refactor-only cleanup          | Must reduce violation count or retire a bridge                                                                  |

Feature flags may select old or new behavior during a batch, but feature flags are not a substitute for retirement. A feature flag that keeps both source-of-truth paths alive after a batch is a failed batch.

## Bridge Policy

Every bridge must be time-boxed and tracked.

| Rule           | Requirement                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------- |
| Max lifetime   | Two migration batches or 14 calendar days                                                     |
| Allowed work   | Forward old public calls, mirror old fields read-only, preserve boot compatibility            |
| Forbidden work | New business branches, new source-of-truth fields, new mode decisions, new renderer authority |
| Extension      | Requires written exception, owner, new date, and a guard that blocks further growth           |
| Expiration     | New feature work cannot call an expired bridge                                                |

Bridge lifecycle records may live in the operating log or in a machine-readable manifest once gates are added.

## Rollback Policy

Rollback must restore one source of truth, not leave both paths alive.

| Scenario                                     | Rollback Action                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| New ECS owner fails before old owner retired | Disable/remove new owner and keep old path unchanged                                                  |
| New ECS owner fails after old owner retired  | Re-enable old owner only from the last sealed backup/commit, then record the failed seal reason       |
| Bridge creates behavior drift                | Freeze bridge expansion, route all fixes to owner decision, retire or roll back within the same batch |
| Performance regression                       | Revert the batch or disable the new system behind a flag while keeping ownership single-source        |

Rollback is successful only when tests pass and the ownership report shows no additional mixed-source state compared with the batch start.

## Guard Rollout

Guards must start as report-only where historical debt is large, then become blocking for new violations.

| Guard                     | Phase 1                                                   | Phase 2                             | Phase 3                            |
| ------------------------- | --------------------------------------------------------- | ----------------------------------- | ---------------------------------- |
| ECS core guard            | Blocking immediately                                      | Blocking                            | Blocking                           |
| Component purity guard    | Report all, block new ECS components with runtime objects | Block new violations                | Blocking                           |
| Mode ownership guard      | Report scattered mode checks                              | Block new mode checks outside owner | Blocking for sealed areas          |
| Renderer authority guard  | Report renderer state writes                              | Block new writes in sealed areas    | Blocking for all renderer adapters |
| Duplicate owner guard     | Baseline duplicate logic                                  | Block new duplicate owner patterns  | Reduce baseline per batch          |
| Hardcoded literal guard   | Baseline literals                                         | Block new unowned literals          | Reduce baseline per domain         |
| Boundary dependency guard | Report dependency cycles/reverse deps                     | Block new reverse deps              | Blocking                           |
| Bridge shrink guard       | Report bridge size/branches                               | Block expired bridge expansion      | Blocking                           |

The first useful gate is not "zero historical violations". The first useful gate is "no new unowned mess".

## Acceptance Template

Every migration batch must answer these questions before it is accepted:

1. What is the old owner being retired?
2. What is the new ECS owner?
3. What legacy fields/methods remain as read-only bridge surface?
4. Which guard prevents this old path from growing again?
5. What tests prove behavior stayed intact?
6. What rollback restores a single source of truth?
7. Which bridge expires next?

If any answer is missing, the batch is not sealed.

## Stop-Loss Criteria

The migration must pause for reassessment if any of these happen:

- A batch ends with more mixed ownership than it started with.
- A bridge passes its max lifetime without an exception and guard.
- A migrated area requires a new bug fix through the old source-of-truth path.
- Performance smoke shows a material regression that cannot be isolated behind a single system.
- New feature work adds mode/panel/camera state outside declared owners.

Pause does not mean abandon ECS. It means stop expanding scope until ownership is single-source again.

## Team Operating Rules

- One migration owner must review every frontend change that touches mode, input, renderer state, tutorial, panel/modal, or world-map runtime during migration.
- Every bug fix must state whether it touches a sealed, report-only, or unmigrated area.
- Every new state field must declare its owner role before merge.
- Every new renderer access to state must be justified as snapshot input, not authority.
- Every exception must have a retirement date.

## Practical First Deliverable

Before migrating gameplay behavior, produce the following report-only inventories:

0A first-week deliverables:

- Mode boolean inventory: all `activeTab`, `militaryView`, `show*`, `entityBattle`, `techDetailOpen`, `armyFormationEditor`, `naming`, `rewardReveal`, `confirmDialog`, `activeEventId` owners and mirrors.
- Bridge inventory: facade/mixin installers and prototype augmentation surfaces.

0A record format:

Mode inventory rows must use this schema:

| Symbol      | File              | Line | Role                                                              | Access                          | Evidence           | Note   |
| ----------- | ----------------- | ---- | ----------------------------------------------------------------- | ------------------------------- | ------------------ | ------ |
| `activeTab` | `path/to/file.js` | `1`  | `source-of-truth` / `mirror` / `consumer` / `adapter` / `unknown` | `read` / `write` / `read-write` | short code context | reason |

Bridge inventory rows must use this schema:

| Bridge                    | File              | Line | Installer/Surface         | Fields     | Methods     | Branch Count       | Role                 | Retirement Target | Note   |
| ------------------------- | ----------------- | ---- | ------------------------- | ---------- | ----------- | ------------------ | -------------------- | ----------------- | ------ |
| `CanvasGameApp.prototype` | `path/to/file.js` | `1`  | installer or surface type | field list | method list | branch token count | `bridge` / `adapter` | target owner      | reason |

0A execution checklist:

| Step                                   | Status    | Artifact / Gate                                                               | Acceptance Standard                                                                                                                 |
| -------------------------------------- | --------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0A-1. Mode boolean inventory           | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md` | Every finding has file, line, role, access, evidence, and note                                                                      |
| 0A-2. Bridge inventory                 | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0a-bridge-shrink-baseline.md`  | Every bridge candidate has owner surface, fields, methods, branch count, and retirement target placeholder                          |
| 0A-3. Mode ownership report-only guard | Completed | `scripts/report-frontend-ecs-mode-ownership.js`                               | Guard scans current code and exits 0 with historical findings                                                                       |
| 0A-4. Bridge shrink report-only guard  | Completed | `scripts/report-frontend-ecs-bridge-shrink.js`                                | Guard scans current code and exits 0 with historical findings                                                                       |
| 0A-5. Migration owner review           | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md`         | `codex/external-review` passed review at `2026-06-25 14:01:38 +08:00`                                                               |
| 0A-6. Progress document update         | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md`         | Status records 0A as completed after owner review                                                                                   |
| 0A-7. Operating plan update            | Completed | this document                                                                 | 0A status and artifacts are recorded as completed without starting 0B early                                                         |
| 0A-8. Commit and server branch push    | Completed | git history and server remote                                                 | Completion and deploy-gate formatting commits were pushed; refactor test server deployed `87876c1a6e37ace396759201c503a9aeb3f21a2f` |

0A acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- 0A moved from `Ready for migration owner review` to `Completed` after `codex/external-review` reviewed the inventory documents and recorded sign-off in the progress document.
- 0B can start after the server branch has deployed `87876c1a6e37ace396759201c503a9aeb3f21a2f`.

0B second-window deliverables:

- Renderer authority inventory: renderer writes to app/shell/state/controller fields.
- Input branch inventory: mode/panel/tutorial checks inside input routers and action dispatch paths.
- Literal/duplicate inventory: magic numbers, action strings, API paths, asset paths, repeated helper logic.

0B record formats:

Renderer authority inventory rows must use this schema:

| File              | Line | Surface                                  | Target                                                   | Access                 | Role                                          | Evidence           | Note   |
| ----------------- | ---- | ---------------------------------------- | -------------------------------------------------------- | ---------------------- | --------------------------------------------- | ------------------ | ------ |
| `path/to/file.js` | `1`  | `renderer` / `render-runtime` / pipeline | `host` / `shell` / `state` / `controller` / `self-cache` | `write` / `read-write` | `authority-write` / `cache` / `write-through` | short code context | reason |

Input branch inventory rows must use this schema:

| File              | Line | Surface                                        | Branch Kind                                      | Symbols     | Action Type   | Evidence          | Note   |
| ----------------- | ---- | ---------------------------------------------- | ------------------------------------------------ | ----------- | ------------- | ----------------- | ------ |
| `path/to/file.js` | `1`  | `input-router` / `action-dispatch` / `command` | `mode` / `panel` / `tutorial` / `action` / route | symbol list | action string | condition context | reason |

Literal / duplicate inventory rows must use this schema:

| Kind                        | Key        | File              | Line | Role                                                           | Evidence           | Owner Candidate | Note   |
| --------------------------- | ---------- | ----------------- | ---- | -------------------------------------------------------------- | ------------------ | --------------- | ------ |
| literal or duplicate family | normalized | `path/to/file.js` | `1`  | `registry-owned` / `runtime-candidate` / `duplicate-candidate` | short code context | owner candidate | reason |

0B execution checklist:

| Step                                 | Status    | Artifact / Gate                                                                   | Acceptance Standard                                                                                  |
| ------------------------------------ | --------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 0B-1. Renderer authority report      | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0b-renderer-authority-baseline.md` | Every finding has file, line, surface, target, access, role, evidence, and note                      |
| 0B-2. Input branch report            | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0b-input-branch-baseline.md`       | Mode, panel, tutorial, action, and runtime-route branches are classified                             |
| 0B-3. Literal / duplicate report     | Completed | `docs/development_logs/2026-06-25-frontend-ecs-0b-literal-duplicate-baseline.md`  | Literal and duplicate candidates are grouped by kind, role, and owner candidate                      |
| 0B-4. Guard tests                    | Completed | `scripts/report-frontend-ecs-*-authority/input/literal*.test.js`                  | New report-only guards have scan scope, classification, format, and unknown-argument coverage        |
| 0B-5. Architecture smoke integration | Completed | `scripts/run-architecture-smoke.js`                                               | Architecture smoke runs all 0A and 0B report-only guards with `--summary`                            |
| 0B-6. Progress document update       | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md`             | Progress records 0B artifacts, commands, status, and review blocker                                  |
| 0B-7. Operating plan update          | Completed | this document                                                                     | 0B checklist and completion gate are recorded                                                        |
| 0B-8. Commit and server branch push  | Completed | git history and server remote                                                     | 0B implementation commit is pushed; deploy evidence and GitHub HTTPS result are recorded in progress |

0B acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- 0B moved from `Ready for Migration Owner Review` to `Completed` after `codex/external-review` reviewed the inventory documents and recorded sign-off at `2026-06-25 16:43:55 +08:00` in the progress document.
- Batch 1 may start after the 0B completed commit reaches the server branch.

0B is completed. Batch 1 may start after the completion commit reaches the server branch.

Batch 1 first-window deliverables:

- ECS core ADR: confirm the external ECS core choice and explain why the project must not build its own core.
- ECS core blocking guard: prevent local entity/component/query/system core implementation before any runtime migration starts.
- Architecture smoke integration: the guard must run as blocking, not report-only.

Batch 1 record format:

ECS core guard violation rows must use this schema:

| File              | Line | Kind             | Symbol             | Evidence           | Note             |
| ----------------- | ---- | ---------------- | ------------------ | ------------------ | ---------------- |
| `path/to/file.js` | `1`  | violation family | matched core token | short code context | ownership reason |

Batch 1 allowed ECS core surfaces:

| Surface                | Status   | Notes                                                                  |
| ---------------------- | -------- | ---------------------------------------------------------------------- |
| `bitecs`               | Approved | Dependency may be added in Batch 2 when the boundary skeleton starts   |
| `bitecs/serialization` | Approved | Serialization surface may be used only through the Batch 2 boundary    |
| Local ECS core files   | Blocked  | Files such as `ECSCore.js`, `EntityStore.js`, or `QueryEngine.js` fail |
| Other ECS packages     | Blocked  | Any ECS core package other than `bitecs` requires a new ADR            |

Batch 1 execution checklist:

| Step                                | Status    | Artifact / Gate                                                       | Acceptance Standard                                                                                           |
| ----------------------------------- | --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1-1. ECS core ADR                   | Completed | `docs/development_logs/2026-06-25-frontend-ecs-batch-1-core-adr.md`   | ADR selects `bitecs`, names approved import surfaces, and states Batch 1 non-goals                            |
| 1-2. ECS core blocking guard        | Completed | `scripts/check-frontend-ecs-core-guard.js`                            | Guard blocks local ECS core primitives and non-`bitecs` ECS core dependencies while allowing approved imports |
| 1-3. Guard tests                    | Completed | `scripts/check-frontend-ecs-core-guard.test.js`                       | Tests cover scan scope, allow/block behavior, dependency drift, and unknown CLI arguments                     |
| 1-4. Architecture smoke integration | Completed | `scripts/run-architecture-smoke.js`                                   | Architecture smoke runs the ECS core guard as a blocking gate                                                 |
| 1-5. Progress document update       | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md` | Progress records Batch 1 commands, artifacts, status, and review blocker                                      |
| 1-6. Commit and server branch push  | Completed | git history and server remote                                         | Implementation commit is pushed and deploy/health evidence is recorded                                        |
| 1-7. Migration owner review         | Completed | `docs/development_logs/2026-06-25-frontend-ecs-migration-progress.md` | `codex/external-review` signed off at `2026-06-25 18:33:08 +08:00`                                            |

Batch 1 acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- Batch 1 moved from `Ready for Migration Owner Review` to `Completed` after `codex/external-review` reviewed the ADR, guard behavior, architecture smoke integration, and progress records at `2026-06-25 18:33:08 +08:00`.
- Batch 1 review follow-ups for Batch 2: add why other ECS libraries were not selected, add a bitECS maintenance/exit strategy, and pin an exact `bitecs` version when installing the dependency.
- Batch 2 may start after the Batch 1 completed commit reaches the server branch.

Batch 2 first-window deliverables:

- Exact ECS dependency pin: `bitecs@0.4.0` in `package.json` and `package-lock.json`.
- ECS core boundary: only `frontend/js/ecs/core/EcsCoreBoundary.js` may import external ECS package surfaces.
- ECS boundary manifest: owner roles, component families, mode keys, snapshot keys, and bridge lifecycle policy.
- Boundary blocking guard: prevent direct ECS package imports outside the boundary, reverse dependencies from ECS skeleton to platform/runtime layers, runtime entrypoint loading, and runtime objects in ECS skeleton files.

Batch 2 allowed ECS external surfaces:

| Surface                | Status   | Notes                                                                                                                  |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bitecs`               | Approved | Core world/entity/system composition primitives; only `frontend/js/ecs/core/EcsCoreBoundary.js` may import it          |
| `bitecs/legacy`        | Approved | `bitecs@0.4.0` provides `defineComponent`, `Types`, `defineQuery`, `enterQuery`, and `exitQuery` here; boundary only   |
| `bitecs/serialization` | Approved | ADR-approved future serialization surface; no Batch 2 runtime import yet and any future use must go through a boundary |
| Other `bitecs/*`       | Blocked  | Any additional subpath requires ADR update and guard update                                                            |

Batch 2 execution checklist:

| Step                                | Status    | Artifact / Gate                                                                        | Acceptance Standard                                                                                                             |
| ----------------------------------- | --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2-1. Exact ECS dependency pin       | Completed | `package.json`, `package-lock.json`                                                    | `npm ls bitecs` resolves exact `bitecs@0.4.0`; dependency version is not ranged                                                 |
| 2-2. ECS core boundary skeleton     | Completed | `frontend/js/ecs/core/EcsCoreBoundary.js`                                              | Only boundary imports `bitecs`; it forwards approved primitives without project-owned entity/component/query/system storage     |
| 2-3. ECS manifest skeleton          | Completed | `frontend/js/ecs/registry/EcsBoundaryManifest.js`                                      | Manifest declares reviewed owner roles, component families, mode keys, snapshot keys, and bridge lifecycle policy               |
| 2-4. Boundary documentation         | Completed | `frontend/js/ecs/README.md`                                                            | Document states ECS skeleton is Node/CommonJS architecture boundary and not part of H5/minigame loading chain                   |
| 2-5. Boundary blocking guard        | Completed | `scripts/check-frontend-ecs-boundary-skeleton.js`                                      | Guard blocks direct ECS package imports outside boundary, ECS reverse dependencies, runtime loading, and runtime object storage |
| 2-6. Guard and skeleton tests       | Completed | `frontend/js/ecs/**/*.test.js`, `scripts/check-frontend-ecs-boundary-skeleton.test.js` | Tests cover boundary exports, manifest validation, scan scope, allow/block behavior, package pinning, formats, and unknown args |
| 2-7. Architecture smoke integration | Completed | `scripts/run-architecture-smoke.js`                                                    | Architecture smoke checks ECS skeleton files/tests and runs the boundary skeleton guard as blocking                             |
| 2-8. Commit and server branch push  | Completed | git history and server remote                                                          | Batch 2 first implementation commit is pushed; deploy/health and GitHub HTTPS results are recorded in progress                  |

Batch 2 acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- Batch 2 moved from `Ready for Migration Owner Review` to `Completed` after `codex/external-review` reviewed the dependency pin, boundary skeleton, guard behavior, no-runtime-loading scope, H5/minigame entrypoint safety, and progress records at `2026-06-25 20:16:29 +08:00`.
- Batch 3 may start after the Batch 2 completed commit reaches the server branch.

Batch 3 first-window deliverables:

- Runtime mode owner: a singleton ECS mode entity owns base mode, modal mask, tutorial/debug flags, blocking overlay flags, entity battle, world-map home, tech-tree, formation editor, and top capture mode facts.
- Generated runtime bundle: H5/minigame load only `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`, generated by exact `esbuild@0.23.1`.
- Legacy mode bridge: old app/shell fields remain as ingress facts through `CanvasModeOwnershipBridge.js`; they are not allowed to grow as new source-of-truth owners.
- Centralized mode routing: App/Shell input routers use mode snapshot helpers for blocking overlay, entity battle, world-map, and tech-tree route decisions while preserving legacy fallback behavior.
- Mode ownership blocking guard: after Batch 3, mode/panel/tutorial decision growth outside approved owner/bridge/vocabulary paths fails the architecture gate.

Batch 3 approved runtime ECS surfaces:

| Surface                                             | Status                       | Notes                                                                 |
| --------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`   | Approved runtime artifact    | Generated IIFE bundle; may be loaded by H5 and minigame               |
| `frontend/js/ecs/mode/**`                           | Owner source only            | May be bundled; must not be directly loaded by H5/minigame            |
| `frontend/js/ecs/core/**`                           | Architecture boundary only   | May import `bitecs`; must not be loaded by H5/minigame                |
| `frontend/js/ecs/registry/**`                       | Architecture vocabulary only | May declare reviewed keys/policies; must not be loaded by H5/minigame |
| `frontend/js/platform/CanvasModeOwnershipBridge.js` | Temporary bridge             | May derive facts from legacy fields and update the ECS mode owner     |

Batch 3 execution checklist:

| Step                                    | Status    | Artifact / Gate                                                                            | Acceptance Standard                                                                                                                                                                       |
| --------------------------------------- | --------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-1. Mode ECS owner modules             | Completed | `frontend/js/ecs/mode/**`                                                                  | Mode state is stored in a singleton ECS entity through `EcsCoreBoundary` only                                                                                                             |
| 3-2. Runtime bundle build               | Completed | `scripts/build-frontend-ecs-runtime.js`, `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` | Bundle is generated by exact `esbuild@0.23.1`; no raw `node_modules` script loading                                                                                                       |
| 3-3. Legacy mode bridge                 | Completed | `frontend/js/platform/CanvasModeOwnershipBridge.js`                                        | Bridge reads old fields as ingress facts and exposes snapshot/resolver helpers                                                                                                            |
| 3-4. App/Shell route integration        | Completed | `CanvasGameAppInputRouter.js`, `CanvasGameShellInputRouter.js`                             | Centralized decisions prefer mode snapshot helpers and preserve legacy fallback behavior                                                                                                  |
| 3-5. H5/minigame loading                | Completed | `frontend/index.html`, `frontend/minigame/game.js`                                         | Entrypoints load only the approved runtime bundle and bridge, in the required order                                                                                                       |
| 3-6. Mode spine blocking guard          | Completed | `scripts/check-frontend-ecs-mode-ownership-spine.js`                                       | Guard compares current mode findings to 0A baseline by file/symbol and blocks legacy growth                                                                                               |
| 3-7. Boundary guard update              | Completed | `scripts/check-frontend-ecs-boundary-skeleton.js`                                          | Guard allows only the approved mode runtime bundle and still blocks raw ECS runtime loading                                                                                               |
| 3-8. Tests and smoke integration        | Completed | `scripts/run-architecture-smoke.js`                                                        | Architecture smoke includes mode owner files, bridge tests, new guards, and manifest checks                                                                                               |
| 3-9. Progress and batch document update | Completed | `docs/development_logs/2026-06-25-frontend-ecs-batch-3-mode-ownership-spine.md`            | Batch 3 is documented as Completed                                                                                                                                                        |
| 3-10. Commit and server branch push     | Completed | git history and server remote                                                              | Batch 3 implementation commit reached `origin/codex/refactor-tutorial-guide-architecture`; refactor test server deploy health confirmed commit `51d3b2657a35dfac2b206b3bfbe9761c03f4bf2d` |
| 3-11. Migration owner review            | Completed | progress document                                                                          | `codex/external-review` signed off at `2026-06-25 23:02:25 +08:00`; Batch 3 is marked Completed by this separate completion commit                                                        |

Batch 3 acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- Batch 3 moved from `Ready for Migration Owner Review` to `Completed` after `codex/external-review` confirmed the ECS mode owner, legacy bridge contract, runtime bundle loading policy, and mode spine blocking guard at `2026-06-25 23:02:25 +08:00`.
- Batch 4 may start after this Batch 3 completion commit reaches the server branch.

Batch 4 first-window deliverables:

- Input intent vocabulary: a normalized, serializable physical-intent shape (kind, phase, pointer, gesture) and a routed-intent shape (route plus optional action descriptor), declared in `frontend/js/ecs/input/InputIntent.js`.
- Pure input intent resolver: `frontend/js/ecs/input/InputIntentResolver.js` maps `(physicalIntent, modeSnapshot)` to a routed intent for covered modes (entity battle, tech tree, world map, city) using `ModeResolver` routing booleans only, with no host or DOM reads.
- Runtime exposure: extend `frontend/js/ecs/mode/EcsModeRuntimeEntry.js` and regenerate `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` with exact `esbuild@0.23.1` so the input intent API ships inside the single approved runtime bundle.
- Input intent bridge helper: `frontend/js/platform/CanvasModeOwnershipBridge.js` exposes `resolveInputIntent(physicalIntent)` that reads the ECS mode snapshot and calls the resolver; routers stop reading raw mode fields for covered routes.
- Router physical adapters: `CanvasGameAppInputRouter.js` and `CanvasGameShellInputRouter.js` produce physical intents and execute resolver decisions for covered modes while preserving legacy fallback behavior.
- Input intent blocking guard: after Batch 4, new mode and runtime-route decision growth in input-router surfaces outside approved intent/bridge paths fails the architecture gate.

Batch 4 scope control:

Batch 4 does not migrate:

- concrete modal payload ownership for naming/event/reward/confirm/target-picker panels (Batch 5)
- tutorial flow or tutorial input-gating ownership (tutorial domain batch)
- renderer snapshot contracts (Batch 6) or `getHitTarget` hit-testing
- gameplay domain state

Old mode and panel fields remain bridge ingress facts. Panel and tutorial input branches stay report-only in this batch.

Batch 4 approved runtime ECS surfaces:

| Surface                                                        | Status                    | Notes                                                                                                  |
| -------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `frontend/js/ecs/input/**`                                     | Owner source only         | Intent vocabulary and resolver; may be bundled; must not be directly loaded by H5/minigame             |
| `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`              | Approved runtime artifact | Regenerated to expose the mode plus input intent API                                                   |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`            | Temporary bridge          | May expose `resolveInputIntent`; no new source-of-truth fields or business branches                    |
| `CanvasGameAppInputRouter.js`, `CanvasGameShellInputRouter.js` | Physical adapters         | Produce physical intents and execute resolver routes; no inline mode/route decisions for covered modes |

Batch 4 execution checklist:

| Step                                     | Status           | Artifact / Gate                                                             | Acceptance Standard                                                                                                                                        |
| ---------------------------------------- | ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4-1. Input intent vocabulary             | Ready for Review | `frontend/js/ecs/input/InputIntent.js`                                      | Physical and routed intent shapes are frozen, serializable, and declared once                                                                              |
| 4-2. Input intent resolver               | Ready for Review | `frontend/js/ecs/input/InputIntentResolver.js`                              | Resolver is pure, reads only the mode snapshot, and covers entity-battle/tech-tree/world-map/city routes                                                   |
| 4-3. Resolver unit tests                 | Ready for Review | `frontend/js/ecs/input/**/*.test.js`                                        | Tests cover the intent x snapshot decision matrix and fallbacks                                                                                            |
| 4-4. Runtime bundle regeneration         | Ready for Review | `scripts/build-frontend-ecs-runtime.js`, `EcsModeRuntimeBundle.js`          | Bundle is regenerated by exact `esbuild@0.23.1` and exposes the input intent API                                                                           |
| 4-5. Bridge resolve helper               | Ready for Review | `frontend/js/platform/CanvasModeOwnershipBridge.js`                         | `resolveInputIntent` reads the snapshot and calls the resolver without new source-of-truth fields                                                          |
| 4-6. App input router adapter            | Ready for Review | `frontend/js/platform/CanvasGameAppInputRouter.js`                          | Covered-mode drag/gesture/tap routing goes through the resolver; legacy fallback preserved                                                                 |
| 4-7. Shell input router adapter          | Ready for Review | `frontend/js/platform/CanvasGameShellInputRouter.js`                        | Covered-mode routing goes through the resolver without migrating tutorial or panel ownership                                                               |
| 4-8. Input intent blocking guard         | Ready for Review | `scripts/check-frontend-ecs-input-intent-spine.js`                          | Guard diffs input-router mode and runtime-route branches against the 0B baseline and blocks new growth outside approved paths                              |
| 4-9. Guard and behavior tests            | Ready for Review | guard test plus router adapter tests                                        | Guard scope, allow/block behavior, and router-to-resolver wiring are covered                                                                               |
| 4-10. Manifest and boundary guard update | Ready for Review | `EcsBoundaryManifest.js`, `scripts/check-frontend-ecs-boundary-skeleton.js` | `frontend/js/ecs/input/**` is owner-source-only and not directly loaded by H5/minigame                                                                     |
| 4-11. Architecture smoke integration     | Ready for Review | `scripts/run-architecture-smoke.js`                                         | Smoke runs the input intent guard and new tests as blocking                                                                                                |
| 4-12. Progress and batch document update | Ready for Review | progress doc and Batch 4 batch doc                                          | Batch 4 is documented as Ready for Review, not Completed                                                                                                   |
| 4-13. Commit and server branch push      | Completed        | git history and server remote                                               | Implementation commit `eab8452e` reached the server branch; refactor test server deploy health confirmed commit `eab8452e1a8acd94c5bc54529811c1f0b8cd4f5d` |
| 4-14. Migration owner review             | Completed        | progress document                                                           | `codex/external-review` signed off at `2026-06-26 01:24:26 +08:00` (Batch 4 Passed)                                                                        |

Batch 4 acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- Batch 4 plan was approved on `2026-06-25`; the design is grounded in the post-Batch-3 input routers and the 0B input-branch baseline, not designed in the abstract. The guard scope is matched to migrate input-router mode and runtime-route branches while leaving panel and tutorial branches report-only.
- Implementation, unit/behavior tests, the scoped blocking guard, the manifest/smoke wiring, and the regenerated runtime bundle are complete and verified locally (`npm run test:architecture`, `npm run lint`, and `npm run format:check` all pass; the input-intent spine guard reports 0 violations against the 0B baseline). The batch is now `Ready for Migration Owner Review`.
- Batch 4 moved from `Ready for Migration Owner Review` to `Completed` after `codex/external-review` signed off at `2026-06-26 01:24:26 +08:00` (Batch 4 Passed).
- Batch 5 (Panel/Modal Ownership) may start after this Batch 4 completion commit reaches the server branch.

Batch 5 first-window deliverables:

Batch 5 seals the covered modal subtypes (`naming`, `event`, `rewardReveal`, `confirmDialog`, `targetPicker`, `blockingPanel`) so the ECS modal owner — not app/shell fields — is their source of truth. It is delivered in slices; each slice ends sealed (old field read-only mirrored, owner authoritative, guard blocks legacy growth). This plan records all slices; only slice 5a is implemented in the first round.

- ECS modal owner: extend the mode entity with modal subtype open/close authority plus a serializable payload per subtype (ids, text, resource lists), declared under `frontend/js/ecs/` and shipped through the existing generated runtime bundle.
- Modal command API: `openModal(subtype, payload)` / `closeModal(subtype)` on the ECS owner, exposed through `CanvasModeOwnershipBridge`; legacy modal writes route through it and the legacy field becomes a read-only mirror updated from the owner.
- Modal callback registry: non-serializable callbacks (e.g. `confirmDialog.onConfirm`) are not stored in the ECS owner. The owner holds a serializable modal token; an app-side registry resolves the token to the callback, keeping `frontend/js/ecs/**` pure and boundary-guard-clean.
- Panel/modal blocking guard: a guard scoped to the `panel` branch kind in command-handler and input-router surfaces, diffing against the 0B input-branch baseline, blocks net-new legacy modal source-of-truth writes outside the approved modal owner/bridge for sealed subtypes.

Batch 5 slicing:

| Slice | Modal subtypes            | Legacy source-of-truth fields                                            | Notes                                                                                                    |
| ----- | ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 5a    | `naming`, `confirmDialog` | `naming.visible` + payload; `confirmDialog.visible` + config/callback    | First round. Simplest single-flag modals; proves the owner + token-callback pattern at low blast radius. |
| 5b    | `event`, `rewardReveal`   | `activeEventId`; `rewardReveal` payload                                  | Game-flow modals; gated separately.                                                                      |
| 5c    | `targetPicker`            | `territoryUiState.worldTargetPicker` / `worldMarchTarget.pickerOpen`     | World-march coupled; gated separately.                                                                   |
| 5d    | `blockingPanel`           | aggregate of ~14 `show*` / `activeCommandPanel` / `techDetailOpen` flags | Largest; may fold into per-domain sealing. Gated separately.                                             |

Batch 5 callback ownership:

The ECS modal owner stores only serializable modal state: presence, subtype, and a frozen payload of ids/text/resource lists, plus a `token` string. Imperative continuations (confirm/cancel callbacks, focus refs) live in an app-side registry keyed by `token`. `openModal` mints a token and registers the callback; `closeModal`/resolve looks it up and clears it. This keeps `frontend/js/ecs/**` free of closures/DOM (boundary guard) while making the owner authoritative for open/close plus payload.

Batch 5 approved runtime ECS surfaces:

| Surface                                             | Status                    | Notes                                                                                             |
| --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| ECS modal owner module(s) under `frontend/js/ecs/`  | Owner source only         | Pure modal state + token; bundled, not directly H5/minigame-loaded                                |
| `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`   | Approved runtime artifact | Regenerated to expose the modal owner API                                                         |
| `frontend/js/platform/CanvasModeOwnershipBridge.js` | Temporary bridge          | Exposes `openModal`/`closeModal`; the app-side token-callback registry lives in platform, not ECS |

Batch 5 scope control:

Batch 5 does not:

- migrate renderer reads of modal state to snapshots (Batch 6); renderers keep reading the legacy read-only mirror this batch
- migrate tutorial flow, input intent (Batch 4, done), or world-map/gameplay domain state
- store non-serializable callbacks or DOM refs inside `frontend/js/ecs/**`

Slices 5b-5d remain report-only until their own sealed slice runs. Only the subtypes sealed in a completed slice are blocked from legacy source-of-truth growth.

Batch 5 slice 5a execution checklist:

| Step                                                    | Status             | Artifact / Gate                                                        | Acceptance Standard                                                                                                                                  |
| ------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5a-1. Modal owner state + token                         | Ready for Review   | ECS modal owner module                                                 | naming/confirmDialog open/close + serializable payload + token are owned in the ECS entity, pure/frozen                                              |
| 5a-2. Modal callback registry                           | Ready for Review   | app-side registry in platform                                          | token -> callback registry resolves confirmDialog continuations without storing closures in ECS                                                      |
| 5a-3. Runtime bundle regeneration                       | Ready for Review   | `scripts/build-frontend-ecs-runtime.js`, runtime bundle                | bundle regenerated by exact `esbuild@0.23.1` and exposes the modal owner API                                                                         |
| 5a-4. Bridge open/close helpers                         | Ready for Review   | `CanvasModeOwnershipBridge.js`                                         | `openModal`/`closeModal` route writes to the owner; legacy `naming`/`confirmDialog` become read mirrors                                              |
| 5a-5. Route naming write sites (naming-first sub-split) | Ready for Review   | naming write sites in `CanvasGameAppGuideUi`/`CanvasGameShellSystemUi` | the source of truth for naming is the ECS modal owner; `this.naming` is the read-only mirror; confirmDialog is the next sub-step                     |
| 5a-6. Modal seal guard                                  | Done (no new file) | existing `scripts/check-frontend-ecs-mode-ownership-spine.js`          | naming legacy references may not grow beyond the 0A baseline (guard green, 0 violations); a dedicated modal guard is deferred                        |
| 5a-7. Guard and behavior tests                          | Ready for Review   | guard test plus owner/registry/bridge tests                            | open/close, token-callback resolution, and mirror sync are covered; existing modal tests stay green                                                  |
| 5a-8. Manifest and architecture smoke                   | Ready for Review   | `EcsBoundaryManifest.js`, `scripts/run-architecture-smoke.js`          | modal owner surfaces declared; smoke runs the new guard + tests as blocking                                                                          |
| 5a-9. Progress and batch document update                | Ready for Review   | progress doc and Batch 5 batch doc                                     | slice 5a documented as Ready for Review, not Completed                                                                                               |
| 5a-10. Commit and server branch push                    | Completed          | git history and server remote                                          | Slice 5a commit `dd01f381` reached the server branch; refactor test server deploy health confirmed commit `dd01f381b387ca6a8ba76b8858f400e950492372` |
| 5a-11. Migration owner review                           | Completed          | progress document                                                      | `codex/external-review` signed off slice 5a-naming at `2026-06-26 02:59:52 +08:00` (Passed)                                                          |

Batch 5 acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- Batch 5 is delivered in slices 5a-5d; the migration owner approved planning all slices and executing slice 5a (`naming` + `confirmDialog`) first, with the owner-holds-token callback strategy.
- Each slice may move to `Ready for Migration Owner Review` only after its owner/registry/bridge wiring, scoped guard, and tests are complete and verified, and to `Completed` only after `codex/external-review` signs off on that slice.
- Slice 5a-naming is implemented and verified locally (`npm run test:architecture` 1185 tests, lint, format, `git diff --check`, mode-ownership-spine guard 0 violations) and was signed off by `codex/external-review` at `2026-06-26 02:59:52 +08:00` (slice 5a-naming `Completed`); the modal-owner foundation (`ModalWorld` + `ModalCallbackRegistry` + bridge modal API) is reusable for the remaining subtypes, and the confirmDialog sub-step was signed off by `codex/external-review` at `2026-06-26 04:01:40 +08:00` (Passed). With both naming and confirmDialog signed off, **slice 5a (naming + confirmDialog) is `Completed`**; the next sub-steps are slices 5b (`event`/`rewardReveal`), 5c (`targetPicker`), and 5d (`blockingPanel`), which reuse the modal-owner foundation. The planned dedicated modal guard was dropped in favor of the existing mode-ownership-spine guard, which already scans the modal write sites.
- Slice 5b (event + rewardReveal) was split into rewardReveal first, then event, and is `Completed` after migration owner sign-off at `2026-06-26 13:59:23 +08:00`. The rewardReveal sub-step is owner-sourced (`this.rewardReveal` mirror, two pure-presentation bridge wrappers, eight single-line owner-routed write sites across six files; readers stay on the mirror). The event sub-step uses the approved lighter design: `openEventModal` / `closeEventOwner` own canonical open/close plus central closePanels, bridge syncs host/game/canvasShell mirrors, scattered legacy mirror clears remain untouched, and `EventController.activeEventId` stays an isolated claim cursor. Verified locally with `npm run test:architecture` 1189 tests, mode-ownership-spine guard 0 violations, lint, format, and `git diff --check`. Slice 5c (`targetPicker`) is next.
- Slice 5c (`targetPicker`) is `Completed` after migration owner sign-off at `2026-06-26 14:47:06 +08:00`: canonical `worldTargetPicker` and `worldMarchTarget.pickerOpen` modal opens route through `CanvasModeOwnershipBridge` wrappers into `modal:targetPicker`, while non-picker world-march target state and scattered null clears stay legacy/domain behavior. A dedicated `scripts/check-frontend-ecs-target-picker-ownership.js` blocking guard prevents non-owner picker opens outside the approved bridge path and is wired into architecture smoke. Verified locally with `npm run test:architecture` 1195 tests, targetPicker ownership guard 0 violations, mode-ownership-spine guard 0 violations, lint, format, and `git diff --check`. Slice 5d (`blockingPanel`) may start and remains gated behind its own sealed slice.
- Slice 5d (`blockingPanel`) is `Completed` after migration owner sign-off at `2026-06-26 15:34:13 +08:00`: the lighter umbrella owner routes canonical shell/city/famous blocking-panel opens through `CanvasModeOwnershipBridge` wrappers into `modal:blockingPanel`, while business state such as tabs, selected tech, and famous-person paging remains domain-owned. Central closePanels paths close the owner before legacy mirror clearing. A dedicated `scripts/check-frontend-ecs-blocking-panel-ownership.js` blocking guard prevents non-owner canonical opens outside the bridge, grandfathers existing 0A baseline opens and tutorial coordinator scattered opens, and is wired into architecture smoke. Verified with targeted owner/action/guard tests, blockingPanel ownership guard 0 violations, mode-ownership-spine guard 0 violations, `npm run lint`, `npm run format:check`, `npm run test:architecture` 1209 tests, and `git diff --check`.
- Batch 5 is fully `Completed`; Batch 6 (`Snapshot Boundary`) may start after the Batch 5 completion commit reaches the server branch.

Batch 6A first-window deliverables:

Batch 6A establishes the renderer snapshot boundary scaffold without migrating broad renderer read paths. The snapshot contract covers only Batch 5 sealed modal/panel read facts plus whitelisted mode-routing facts. Existing direct renderer reads are inventoried and grandfathered; later Batch 6 sub-slices should migrate one reader group at a time and reduce that baseline.

Batch 6A approved runtime ECS surfaces:

| Surface                                                    | Status                    | Notes                                                                                              |
| ---------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `frontend/js/ecs/snapshot/RendererSnapshotBoundary.js`     | Owner source only         | Pure frozen snapshot builder for sealed Batch 5 modal/panel facts and whitelisted mode facts       |
| `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`          | Approved runtime artifact | Regenerated to expose `RendererSnapshotBoundary` inside the single H5/minigame ECS runtime bundle  |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`        | Temporary bridge          | Adds null-safe `buildRendererSnapshot` / `getRendererSnapshot` read-only helpers                   |
| `scripts/check-frontend-ecs-renderer-snapshot-boundary.js` | Blocking guard            | Blocks new direct renderer reads of covered sealed fields beyond the Batch 6A grandfather baseline |

Batch 6A scope control:

Batch 6A does not:

- migrate existing renderer readers to consume the snapshot
- migrate task tabs, selected tech, famous-person paging/detail, world-march target contents, or other gameplay/domain state
- migrate `getHitTarget`, renderer caches, hit-target authority, or world-map picking authority
- add any raw ECS runtime script outside `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js`

Batch 6A execution checklist:

| Step                                              | Status    | Artifact / Gate                                            | Acceptance Standard                                                                                   |
| ------------------------------------------------- | --------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 6A-1. Snapshot boundary module                    | Completed | `frontend/js/ecs/snapshot/RendererSnapshotBoundary.js`     | Frozen serializable `renderer-snapshot-v1`; sealed modal/panel facts only; no domain-state payloads   |
| 6A-2. Runtime bundle regeneration                 | Completed | `EcsModeRuntimeEntry.js`, `EcsModeRuntimeBundle.js`        | Boundary exposed through the existing generated runtime bundle                                        |
| 6A-3. Bridge read-only helper                     | Completed | `CanvasModeOwnershipBridge.js`                             | `buildRendererSnapshot` / `getRendererSnapshot` are null-safe and do not create source-of-truth state |
| 6A-4. Renderer snapshot boundary guard            | Completed | `scripts/check-frontend-ecs-renderer-snapshot-boundary.js` | Current direct reads are grandfathered; new direct covered reads outside approved paths are blocked   |
| 6A-5. Guard, bridge, boundary, and manifest tests | Completed | targeted `node --test` suite                               | Snapshot contract, guard baseline, manifest, and bridge helper behavior are covered                   |
| 6A-6. Architecture smoke integration              | Completed | `scripts/run-architecture-smoke.js`                        | Smoke runs the new guard and tests as blocking                                                        |
| 6A-7. Progress and batch document update          | Completed | progress doc and Batch 6A batch doc                        | 6A documented as Completed after migration owner sign-off                                             |

Batch 6A acceptance owner:

- Migration owner: project main engineer or explicitly assigned architecture owner.
- 6A moved to `Completed` after migration owner sign-off at `2026-06-26 16:05:54 +08:00` (Batch 6A Passed).

Batch 6A review result:

- Batch 6A (`Snapshot Boundary Scaffold`) is `Completed` after migration owner sign-off at `2026-06-26 16:05:54 +08:00`.
- Accepted: `renderer-snapshot-v1` contract, owner-direct modal reads, bridge read-only API, dedicated guard with 139 baseline / 139 current / 0 violations, mode-spine guard 0 violations, and 1219-test architecture smoke.
- Follow-up condition: 6B/6C renderer-reader sub-slices must include mirror retire targets. The first 6B sub-slice must delete at least one mirror and migrate its renderer readers to the snapshot.
- Batch 7 (`Domain Area Sealing`) may start after the 6A completion commit reaches the server branch.

## Batch 7A First-Window Deliverables

Batch 7A establishes the Battle domain owner without migrating gameplay. The
owner covers only battle overlay/session facts: replay `battleScene` and
interactive/replay `entityBattle`.

Batch 7A approved runtime ECS surfaces:

| Surface                                                | Status                   | Notes                                                                                        |
| ------------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------- |
| `frontend/js/ecs/domain/BattleDomainOwner.js`          | Owner source only        | Pure frozen `battle-domain-v1` owner for battle overlay/session facts                        |
| `frontend/js/ecs/snapshot/RendererSnapshotBoundary.js` | Snapshot boundary        | Emits `snapshot.battle` alongside existing modal/panel/mode facts                            |
| `frontend/js/platform/CanvasGameAppBattleScene.js`     | Canonical adapter        | Routes battleScene/entityBattle open/update/close through the owner while preserving mirrors |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`    | Read-only snapshot facts | No Battle open/close wrappers; only existing `buildRendererSnapshot` / `getRendererSnapshot` |
| `scripts/check-frontend-ecs-battle-domain-owner.js`    | Blocking guard           | Blocks new canonical battle writes outside approved owner/snapshot/canonical adapter paths   |

Batch 7A execution checklist:

| Step                                        | Status    | Artifact / Gate                                 | Acceptance Standard                                                                  |
| ------------------------------------------- | --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| 7A-1. Battle domain owner                   | Completed | `BattleDomainOwner.js`                          | Frozen serializable `battle-domain-v1`; battleScene/entityBattle facts only          |
| 7A-2. Snapshot path                         | Completed | `RendererSnapshotBoundary.js`, generated bundle | `snapshot.battle` available through the existing renderer snapshot path              |
| 7A-3. Canonical battle adapter routing      | Completed | `CanvasGameAppBattleScene.js`                   | Canonical battle open/update/close write owner and preserve legacy mirrors           |
| 7A-4. No new bridge wrappers                | Completed | `CanvasModeOwnershipBridge.js`                  | No `openBattle*Owner` / `closeBattle*Owner`; only read-only snapshot fact collection |
| 7A-5. Battle ownership guard and tests      | Completed | `check-frontend-ecs-battle-domain-owner.js`     | Guard blocks new non-owner canonical writes and is wired into architecture smoke     |
| 7A-6. 7B cleanup plan                       | Completed | 7A batch doc                                    | 7B target is App-side `this.battleScene`; deletion order and expected files recorded |
| 7A-7. Progress / operating plan / batch doc | Completed | progress doc, operating plan, 7A batch doc      | 7A signed off and pushed at commit `2818aab8`                                        |

Batch 7A scope control:

- Do not migrate BattleSimCore, AI stepping, camera math, renderer drawing, timers, or server resolve.
- Do not add Battle open/close wrappers to `CanvasModeOwnershipBridge.js`.
- Do not defer the 7B mirror deletion target to Batch 8.

Batch 7B cleanup target:

- Delete App-side `this.battleScene` mirror.
- Migration order: render options read only `getRendererSnapshot().battle.battleScene`, replay runtime reads move to an owner snapshot helper, App-to-Shell `battleScene` mirror sync is removed or snapshot-derived, constructor initialization is deleted, then the guard forbids App-side `this.battleScene` reads/writes.
- Estimated surface: 5-7 files. `this.entityBattle` remains a later Battle sub-slice because it carries live mutable sim/session state.

## Batch 7B Mirror Removal Deliverables

Batch 7B is the first mirror deletion slice. It removes the App/Shell
`this.battleScene` replay overlay mirror and keeps `BattleDomainOwner` as the
single replay overlay source of truth.

Batch 7B approved runtime surfaces:

| Surface                                                   | Status    | Notes                                                                                        |
| --------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `frontend/js/platform/CanvasGameAppBattleScene.js`        | Completed | Replay flow reads `getBattleSceneSession()` and writes only the owner                        |
| `frontend/js/platform/CanvasGameAppRenderingRuntime.js`   | Completed | App render options pass `battleScene` only from `snapshot.battle.battleScene`                |
| `frontend/js/platform/CanvasGameShellRenderingRuntime.js` | Completed | Shell render options pass `battleScene` only from `snapshot.battle.battleScene`              |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`       | Completed | Battle snapshot facts read `lastGame.__ecsBattleDomainOwner`; no mirror fallback or wrappers |
| `scripts/check-frontend-ecs-battle-domain-owner.js`       | Completed | Forbids App/Shell `battleScene` mirror reads and writes; guard reports 0 violations          |

Batch 7B execution checklist:

| Step                                             | Status    | Artifact / Gate                                | Acceptance Standard                                                              |
| ------------------------------------------------ | --------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| 7B-1. Delete constructor mirrors                 | Completed | `CanvasGameApp.js`, `CanvasGameShell.js`       | No `this.battleScene = null` remains                                             |
| 7B-2. Remove App-to-Shell battleScene sync       | Completed | `CanvasGameAppBattleScene.js`, Shell system UI | No `syncBattleSceneToShell`; Shell forwards start/close instead of storing state |
| 7B-3. Migrate replay reads to snapshot           | Completed | `getBattleSceneSession()`                      | Advance, skip, animation, timer duration, and close paths read owner snapshot    |
| 7B-4. Remove renderer fallback                   | Completed | App/Shell rendering runtimes                   | `battleScene` option is emitted only from snapshot                               |
| 7B-5. Upgrade battle owner guard                 | Completed | `check-frontend-ecs-battle-domain-owner.js`    | App/Shell `battleScene` reads/writes are forbidden; 0 current violations         |
| 7B-6. Behavior and guard tests                   | Completed | targeted Node tests                            | 120 targeted tests passed; guard test covers removed mirror reads/writes         |
| 7B-7. Progress / operating plan / batch document | Completed | progress doc, operating plan, 7B batch doc     | 7B completed after sign-off and push at commit `3db83d51`                        |

Batch 7B scope control:

- Do not migrate `entityBattle` live mutable mirror in this slice.
- Do not add Battle open/close wrappers to `CanvasModeOwnershipBridge.js`.
- Do not keep `this.battleScene` as compatibility fallback.
- 7B is completed after migration owner sign-off at commit `3db83d51`.

## Batch 8A Naming Mirror Removal Deliverables

Batch 8A starts Bridge Retirement by deleting the earliest sealed modal mirror:
App/Shell `this.naming`. The source of truth remains the ECS modal owner entry
for `modal:naming`; renderer-facing state is derived through the renderer
snapshot boundary.

Batch 8A approved runtime surfaces:

| Surface                                                   | Status                           | Notes                                                                                                            |
| --------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `frontend/js/platform/CanvasModalSnapshotAdapter.js`      | Ready for Migration Owner Review | Small adapter that reads `snapshot.modal['modal:naming']` and routes open/update/close through generic modal API |
| `frontend/js/platform/CanvasGameAppGuideUi.js`            | Ready for Migration Owner Review | App naming open/input/submit/close uses snapshot adapter helpers; no `this.naming` mirror writes remain          |
| `frontend/js/platform/CanvasGameShellSystemUi.js`         | Ready for Migration Owner Review | Shell naming input/update/close routes to whichever host owns the open modal                                     |
| `frontend/js/platform/CanvasGameAppRenderingRuntime.js`   | Ready for Migration Owner Review | App render options pass `naming` only from snapshot-derived payload                                              |
| `frontend/js/platform/CanvasGameShellRenderingRuntime.js` | Ready for Migration Owner Review | Shell render options pass `naming` only from snapshot-derived payload                                            |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`       | Ready for Migration Owner Review | Naming-specific wrappers removed; mode facts detect `modal:naming` from modal owner entries                      |
| `scripts/check-frontend-ecs-naming-mirror-retirement.js`  | Ready for Migration Owner Review | Blocks App/Shell/tutorial/input naming mirror reads/writes and retired wrapper names                             |

Batch 8A execution checklist:

| Step                                        | Status                           | Artifact / Gate                             | Acceptance Standard                                                                  |
| ------------------------------------------- | -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| 8A-1. Delete naming mirror fields           | Ready for Migration Owner Review | `CanvasGameApp.js`, `CanvasGameShell.js`    | No constructor `this.naming` fields remain                                           |
| 8A-2. Delete naming mirror sync/write sites | Ready for Migration Owner Review | App/Shell naming UI modules                 | No App/Shell `this.naming` or `canvasShell.naming` production accesses remain        |
| 8A-3. Delete naming bridge wrappers         | Ready for Migration Owner Review | `CanvasModeOwnershipBridge.js`              | `openNamingModal`, `closeNamingOwner`, and `updateNamingPayload` are removed         |
| 8A-4. Snapshot-renderer migration           | Ready for Migration Owner Review | App/Shell rendering runtimes                | `naming` render option is emitted only from `snapshot.modal['modal:naming']` payload |
| 8A-5. Tutorial/input migration              | Ready for Migration Owner Review | input routers, `TutorialGuideController.js` | Blocking overlay and tutorial naming input reads use snapshot adapter helpers        |
| 8A-6. Guard and smoke integration           | Ready for Migration Owner Review | naming retirement guard, architecture smoke | Guard reports 0 violations and is wired into `npm run test:architecture`             |
| 8A-7. Progress / operating plan / batch doc | Ready for Migration Owner Review | progress doc, operating plan, 8A batch doc  | 8A documented as Ready for Review, not Completed                                     |

Batch 8A scope control:

- Do not delete confirmDialog, rewardReveal, event, targetPicker, or blockingPanel mirrors in this slice.
- Do not add new naming-specific bridge wrappers.
- Do not keep `this.naming` as compatibility fallback.
- Do not mark 8A Completed before migration owner sign-off.

## Batch 8B ConfirmDialog Mirror Removal Deliverables

Batch 8B deletes the next sealed modal mirror: App/Shell
`this.confirmDialog`. The source of truth remains the ECS modal owner entry for
`modal:confirmDialog`; renderer-facing state is derived through the renderer
snapshot boundary.

Batch 8B approved runtime surfaces:

| Surface                                                          | Status                           | Notes                                                                                                                              |
| ---------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/js/platform/CanvasModalSnapshotAdapter.js`             | Ready for Migration Owner Review | Adds confirmDialog helpers that read `snapshot.modal['modal:confirmDialog']` and route open/update/close through generic modal API |
| `frontend/js/platform/CanvasGameShellSystemUi.js`                | Ready for Migration Owner Review | Shell confirm open/update/close uses snapshot adapter helpers; no `this.confirmDialog` mirror writes remain                        |
| `frontend/js/platform/CanvasShellActionHandlers.js`              | Ready for Migration Owner Review | Reset confirm reads snapshot and resolves callbacks through snapshot adapter/generic modal callback API                            |
| `frontend/js/platform/CanvasGameAppRenderingRuntime.js`          | Ready for Migration Owner Review | App render options pass `confirmDialog` only from snapshot-derived payload                                                         |
| `frontend/js/platform/CanvasGameShellRenderingRuntime.js`        | Ready for Migration Owner Review | Shell render options pass `confirmDialog` only from snapshot-derived payload                                                       |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`              | Ready for Migration Owner Review | ConfirmDialog-specific wrappers removed; mode facts detect `modal:confirmDialog` from modal owner entries                          |
| `scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js` | Ready for Migration Owner Review | Blocks App/Shell/tutorial/input confirmDialog mirror reads/writes and retired wrapper names                                        |

Batch 8B execution checklist:

| Step                                          | Status                           | Artifact / Gate                                    | Acceptance Standard                                                                                                               |
| --------------------------------------------- | -------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 8B-1. Delete confirmDialog mirror fields      | Ready for Migration Owner Review | `CanvasGameShell.js`                               | No constructor `this.confirmDialog` field remains                                                                                 |
| 8B-2. Delete confirmDialog mirror write sites | Ready for Migration Owner Review | Shell system UI module                             | No App/Shell `this.confirmDialog` or `canvasShell.confirmDialog` production accesses remain                                       |
| 8B-3. Delete confirmDialog bridge wrappers    | Ready for Migration Owner Review | `CanvasModeOwnershipBridge.js`                     | `openConfirmDialogModal`, `closeConfirmDialogOwner`, `updateConfirmDialogPayload`, and `resolveConfirmDialogCallback` are removed |
| 8B-4. Snapshot-renderer migration             | Ready for Migration Owner Review | App/Shell rendering runtimes                       | `confirmDialog` render option is emitted only from `snapshot.modal['modal:confirmDialog']` payload                                |
| 8B-5. Action/input migration                  | Ready for Migration Owner Review | input routers, `CanvasShellActionHandlers.js`      | Blocking overlay and reset confirm logic use snapshot adapter helpers; callback resolve uses generic modal callback API           |
| 8B-6. Guard and smoke integration             | Ready for Migration Owner Review | confirmDialog retirement guard, architecture smoke | Guard reports 0 violations and is wired into `npm run test:architecture`                                                          |
| 8B-7. Progress / operating plan / batch doc   | Ready for Migration Owner Review | progress doc, operating plan, 8B batch doc         | 8B documented as Ready for Review, not Completed                                                                                  |

Batch 8B scope control:

- Do not delete rewardReveal, event, targetPicker, or blockingPanel mirrors in
  this slice.
- Do not add new confirmDialog-specific bridge wrappers.
- Do not keep `this.confirmDialog` as compatibility fallback.
- Do not remove generic `ModalCallbackRegistry` or generic modal callback API.
- Do not mark 8B Completed before migration owner sign-off.

## Batch 8C RewardReveal Mirror Removal Deliverables

Batch 8C deletes the next sealed modal mirror: App/Shell `this.rewardReveal`.
The source of truth remains the ECS modal owner entry for `modal:rewardReveal`;
renderer-facing state is derived through the renderer snapshot boundary.
`rewardReveal` is pure presentation, so it needs no callback registry wiring.

Batch 8C approved runtime surfaces:

| Surface                                                        | Status                           | Notes                                                                                                                               |
| -------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/js/platform/CanvasModalSnapshotAdapter.js`           | Ready for Migration Owner Review | Adds rewardReveal helpers that read `snapshot.modal['modal:rewardReveal']` and route open/close through the generic modal API       |
| `frontend/js/platform/CanvasGameShellSystemUi.js`              | Ready for Migration Owner Review | Shell reward reveal open/close and float-timer keep-alive use snapshot adapter helpers; no `this.rewardReveal` mirror writes remain |
| `frontend/js/platform/CanvasGameAppCommands.js`                | Ready for Migration Owner Review | App task-reward grant opens the reveal through `openRewardRevealSnapshot`                                                           |
| `frontend/js/platform/CanvasCityActionHandlers.js`             | Ready for Migration Owner Review | Event/task reward grants open or close the reveal through the snapshot adapter                                                      |
| `frontend/js/platform/CanvasGameAppRenderingRuntime.js`        | Ready for Migration Owner Review | App render options pass `rewardReveal` only from the snapshot-derived payload                                                       |
| `frontend/js/platform/CanvasGameShellRenderingRuntime.js`      | Ready for Migration Owner Review | Shell render options pass `rewardReveal` only from the snapshot-derived payload                                                     |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`            | Ready for Migration Owner Review | rewardReveal-specific wrappers removed; mode facts detect `modal:rewardReveal` from modal owner entries                             |
| `scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js` | Ready for Migration Owner Review | Blocks App/Shell/tutorial/input rewardReveal mirror reads/writes and retired wrapper names                                          |

Batch 8C execution checklist:

| Step                                              | Status                           | Artifact / Gate                                   | Acceptance Standard                                                                              |
| ------------------------------------------------- | -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 8C-1. Delete rewardReveal mirror fields           | Ready for Migration Owner Review | `CanvasGameApp.js`, `CanvasGameShell.js`          | No constructor `this.rewardReveal` field remains                                                 |
| 8C-2. Delete rewardReveal mirror write/read sites | Ready for Migration Owner Review | Shell/App UI, city/shell handlers, input routers  | No App/Shell `this.rewardReveal` mirror accesses remain                                          |
| 8C-3. Delete rewardReveal bridge wrappers         | Ready for Migration Owner Review | `CanvasModeOwnershipBridge.js`                    | `openRewardRevealModal` and `closeRewardRevealOwner` are removed                                 |
| 8C-4. Snapshot-renderer migration                 | Ready for Migration Owner Review | App/Shell rendering runtimes                      | `rewardReveal` render option is emitted only from `snapshot.modal['modal:rewardReveal']` payload |
| 8C-5. Action/input migration                      | Ready for Migration Owner Review | input routers, `TutorialGuideController.js`       | Blocking overlay and tutorial gate use `isRewardRevealSnapshotOpen()`                            |
| 8C-6. Guard and smoke integration                 | Ready for Migration Owner Review | rewardReveal retirement guard, architecture smoke | Guard reports 0 violations and is wired into `npm run test:architecture`                         |
| 8C-7. Progress / operating plan / batch doc       | Ready for Migration Owner Review | progress doc, operating plan, 8C batch doc        | 8C documented as Ready for Review, not Completed                                                 |

Batch 8C scope control:

- Do not delete event, targetPicker, or blockingPanel mirrors in this slice.
- Do not add new rewardReveal-specific bridge wrappers.
- Do not keep `this.rewardReveal` as a compatibility fallback.
- Do not mark 8C Completed before migration owner sign-off.

## Batch 8D Event Mirror Removal Deliverables

Batch 8D deletes the next sealed modal mirror: App/Shell `this.activeEventId`
(the 3-way host/game/canvasShell mirror). The source of truth remains the ECS
modal owner entry for `modal:event` (payload `{ eventId }`); renderer-facing
state is derived through the renderer snapshot boundary. `EventController`'s own
`activeEventId` claim cursor is a separate concern and stays untouched.

Batch 8D approved runtime surfaces:

| Surface                                                                                        | Status                           | Notes                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/js/platform/CanvasModalSnapshotAdapter.js`                                           | Ready for Migration Owner Review | Adds event helpers (openEventSnapshot/closeEventSnapshot/getEventSnapshot/isEventSnapshotOpen) reading `snapshot.modal['modal:event']`                                                       |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`                                            | Ready for Migration Owner Review | openEventModal/closeEventOwner wrappers + syncEventMirrors removed; mode facts detect `modal:event` via `isAnyModalOpen`; the snapshot merge fans a single open/close across host+game+shell |
| `frontend/js/platform/CanvasCityActionHandlers.js`                                             | Ready for Migration Owner Review | Event open/close + the 3-way afterEventClaimed close route through the snapshot adapter                                                                                                      |
| `frontend/js/platform/CanvasActionController.js`                                               | Ready for Migration Owner Review | closePanels/closePanelsOn use `closeEventSnapshot()`; the `'activeEventId'` keep-set string token is preserved as a control-flow key                                                         |
| `frontend/js/tutorial/TutorialGuideController.js` / `TutorialGuideUiStateCoordinator.js`       | Ready for Migration Owner Review | setIfChanged + patch-key mirror writes migrated to `closeEventSnapshot()`; reads use `getEventSnapshot()`/`isEventSnapshotOpen()` keeping the EventController cursor fallback                |
| `frontend/js/platform/CanvasGameAppRenderingRuntime.js` / `CanvasGameShellRenderingRuntime.js` | Ready for Migration Owner Review | Render options emit `activeEventId` only from `getEventSnapshot()?.eventId`                                                                                                                  |
| `scripts/check-frontend-ecs-event-mirror-retirement.js`                                        | Ready for Migration Owner Review | Blocks host-prefixed `activeEventId` mirror access + retired wrappers + the `setIfChanged(...,'activeEventId',...)` and `activeEventId: null` patch-key idioms; excludes EventController.js  |

Batch 8D execution checklist:

| Step                                               | Status                           | Artifact / Gate                                                       | Acceptance Standard                                                                                                   |
| -------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 8D-1. Delete activeEventId mirror fields           | Ready for Migration Owner Review | `CanvasGameApp.js`, `CanvasGameShell.js`                              | No constructor `this.activeEventId` field remains                                                                     |
| 8D-2. Delete activeEventId mirror write/read sites | Ready for Migration Owner Review | action handlers, commands, reset paths, input routers, tutorial layer | No App/Shell `activeEventId` mirror accesses remain; 2-way/3-way closes collapse to one `closeEventSnapshot()`        |
| 8D-3. Delete event bridge wrappers                 | Ready for Migration Owner Review | `CanvasModeOwnershipBridge.js`                                        | `openEventModal` / `closeEventOwner` (and sync helpers) removed                                                       |
| 8D-4. Snapshot-renderer migration                  | Ready for Migration Owner Review | App/Shell rendering runtimes                                          | `activeEventId` render option emitted only from `snapshot.modal['modal:event']` payload                               |
| 8D-5. Guard upgrade                                | Ready for Migration Owner Review | event retirement guard, architecture smoke                            | Extended guard (mirror + setIfChanged + patch-key) reports 0 violations and is wired into `npm run test:architecture` |
| 8D-6. Behavior and guard tests                     | Ready for Migration Owner Review | bridge/city/action-controller/command/tutorial tests                  | Snapshot open/close fan-out, EventController cursor untouched, retired-wrapper absence; full `npm test` green         |
| 8D-7. Progress / operating plan / batch doc        | Ready for Migration Owner Review | progress doc, operating plan, 8D batch doc                            | 8D documented as Ready for Review, not Completed                                                                      |

Batch 8D scope control:

- Do not delete targetPicker or blockingPanel mirrors in this slice.
- Do not route `EventController.activeEventId` (the claim cursor) through the modal owner.
- Do not keep `this.activeEventId` as a compatibility fallback.
- Do not mark 8D Completed before migration owner sign-off.

## Batch 8E Target Picker Mirror Removal Deliverables

Batch 8E deletes the next sealed modal mirror: the targetPicker state nested in
`territoryUiState` (`worldTargetPicker` + the `pickerOpen` flag on
`worldMarchTarget`). The source of truth becomes the ECS modal owner entry for
`modal:targetPicker` (structured payload `{ pickerKind, picker|target }`). The
migration owner chose **Option B (snapshot-direct)**: `territoryUiState` carries
zero picker fields and consumers read the owner. World-march DOMAIN data on
`worldMarchTarget` (coords/route/mission/combat) is untouched.

Batch 8E approved runtime surfaces:

| Surface                                                                                                          | Status                           | Notes                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/js/platform/CanvasModalSnapshotAdapter.js`                                                             | Ready for Migration Owner Review | Adds targetPicker helpers (structured payload discriminated by pickerKind)                                                                     |
| `frontend/js/platform/CanvasModeOwnershipBridge.js`                                                              | Ready for Migration Owner Review | The 3 picker wrappers + dead territory-mirror helpers removed; collectModalKeys uses `isAnyModalOpen('modal:targetPicker')`                    |
| `frontend/js/platform/CanvasTerritoryActionHandlers.js`                                                          | Ready for Migration Owner Review | Open/close via the snapshot adapter; chooseWorldTarget re-sources candidates from the owner; domain teardowns kept                             |
| `frontend/js/controllers/TerritoryController.js`                                                                 | Ready for Migration Owner Review | worldTargetPicker seed + vestigial clears removed; worldMarchTarget domain kept; guard-excluded                                                |
| render runtimes + `renderers/*` (`CanvasFrameRenderer`/`HudOverlayCanvasRenderer`/`WorldMarchHudCanvasRenderer`) | Ready for Migration Owner Review | Picker threaded as a dedicated `options.targetPicker`; HUD reads the option, dispatch keys on pickerKind                                       |
| `frontend/js/domain/WorldMarchGeometry.js` / `WorldMapRenderSnapshot.js`                                         | Ready for Migration Owner Review | Stopped copying `pickerOpen` off the domain target                                                                                             |
| `frontend/js/tutorial/TutorialGuideController.js`                                                                | Ready for Migration Owner Review | `isWorldMarchFormationPickerOpen` reads the owner snapshot                                                                                     |
| `scripts/check-frontend-ecs-target-picker-mirror-retirement.js`                                                  | Ready for Migration Owner Review | Blocks the 3 wrappers + worldTargetPicker/pickerOpen mirror writes; allows domain/labels/options.targetPicker; excludes TerritoryController.js |

Batch 8E execution checklist:

| Step                                         | Status                           | Artifact / Gate                                     | Acceptance Standard                                                                  |
| -------------------------------------------- | -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 8E-1. Delete picker mirror fields            | Ready for Migration Owner Review | `TerritoryController.js`                            | No `worldTargetPicker` field/seed remains; `worldMarchTarget` keeps no `pickerOpen`  |
| 8E-2. Delete picker mirror write/read sites  | Ready for Migration Owner Review | territory action handlers, renderers, tutorial      | territoryUiState carries no picker fields; candidates re-sourced from the owner      |
| 8E-3. Delete picker bridge wrappers          | Ready for Migration Owner Review | `CanvasModeOwnershipBridge.js`                      | The 3 wrappers + dead territory-mirror helpers removed                               |
| 8E-4. Snapshot-renderer migration (Option B) | Ready for Migration Owner Review | render runtimes, HUD renderer chain                 | Picker delivered via `options.targetPicker`, never via territoryUiState              |
| 8E-5. Guard upgrade + reconcile              | Ready for Migration Owner Review | new retirement guard + existing ownership guard     | New guard reports 0; ownership guard reconciled (no contradiction); wired into smoke |
| 8E-6. Behavior and guard tests               | Ready for Migration Owner Review | bridge/territory/renderer/tutorial/normalizer tests | Snapshot open/close + render threading + tutorial gate; full `npm test` green        |
| 8E-7. Progress / operating plan / batch doc  | Ready for Migration Owner Review | progress doc, operating plan, 8E batch doc          | 8E documented as Ready for Review, not Completed                                     |

Batch 8E scope control:

- Do not delete or alter world-march DOMAIN worldMarchTarget data (coords/route/combat).
- Do not delete the blockingPanel mirror in this slice (8F).
- Do not keep any targetPicker field on territoryUiState as a compatibility fallback.
- Do not mark 8E Completed before migration owner sign-off.
