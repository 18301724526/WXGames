# Command Owner Pipeline Implementation Spec

Status: Draft v0.2, requires Step2 admission before implementation
Date: 2026-07-09
Scope: formal command pipeline implementation after prerequisite admission
Tasks: `step3-command-owner-pipeline-implementation-tasks-2026-07-09.md`

## 1. Purpose

This document defines the formal implementation work for the Command Owner
Pipeline.

It is the formal implementation document in the command-owner document
sequence:

1. `command-owner-pipeline-contract-test-spec-2026-07-09.md` defines the
   testable server-authoritative command contracts.
2. Step1 makes current write paths visible, classified, and reportable.
3. Step2 admits or rejects Step1 evidence as the prerequisite gate.
4. Step3 implements the formal pipeline only after Step2 passes.

This document must not be used to skip Step1 or Step2. If Step2 has not admitted
the prerequisite stage, this spec is not actionable yet.

## 2. Entry Criteria

Step3 implementation may begin only when:

1. `command-owner-pipeline-contract-test-spec-2026-07-09.md` is accepted as the
   contract-test oracle.
2. `step1-command-owner-pipeline-prerequisite-staging-spec-2026-07-09.md` has produced
   the required inventory, classifications, report-only checks, and anti-evasion
   fixtures.
3. `step2-command-owner-pipeline-prerequisite-admission-spec-2026-07-09.md` has
   passed.
4. Every current write route and frontend write helper has an inventory entry.
5. Every frontend direct write submission path has an inventory entry and
   migration target.
6. Every current write command has a provisional owner declaration or an explicit
   owner-resolution blocker.
7. Shared owner lookup sources, lookup modules, and missing-target errors are
   explicit before domain validation.
8. Every current write has an idempotency classification:
   `client-idempotent`, `server-fallback-id`, or `non-idempotent`.
9. Route-owned load, validate, execute, save, project, and revision retry debt is
   still visible in reports.
10. Handler-owned lock/save debt is still visible in reports.
11. Shared target decisions for territory and encounter are documented.
12. No compliance path depends on renames, broad allowlists, helper wrappers,
    fake owner keys, or server fallback ids.

If any entry criterion is not true, return to Step1 or Step2.

## 3. Non-Negotiable Rules

`command-owner-pipeline-contract-test-spec-2026-07-09.md` remains the source of
truth.

Implementation must not:

- weaken server command ownership for frontend convenience
- classify domain eligibility as `PAYLOAD_SHAPE` or `UI_NOT_READY`
- treat server-generated fallback ids as real idempotency
- fall back from missing shared target ids to `player:{playerId}`
- hide route orchestration inside helpers named `service`, `adapter`, or
  `pipeline`
- keep lock or persistence ownership inside feature handlers after migration is
  claimed
- add feature-owned locks instead of owner-lock infrastructure
- leave territory or encounter writes on player-only serialization when the
  command contests a shared target

## 4. Implementation Sequence

Every phase must cite the `COP-*` contract ids it implements from
`command-owner-pipeline-contract-test-spec-2026-07-09.md`.

### Phase 1: Client Command Semantics Split

Contract ids: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-AUTHORITY-001`,
`COP-TIME-001`.

Goals:

- introduce `visualDisabled` versus `commandDisabled`
- keep local display hints for resources, tutorial, era, tech, cooldown, march,
  candidate, territory, reward, encounter, loot, and boss state
- stop using domain display state to suppress command submission
- allow only these local block reasons:
  - `IN_FLIGHT`
  - `DUPLICATE_COMMAND_ID`
  - `PAYLOAD_SHAPE`
  - `UI_NOT_READY`
- record local command blocks in `ClientOperationLog`

Target modules:

- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/platform/CanvasGameShell.js`
- `frontend/js/platform/CanvasGameApp.js`
- command-capable renderers and presenters that currently emit `disabled`

### Phase 2: Universal Client Command Sender

Contract ids: `COP-ENTRY-001`, `COP-ENVELOPE-001`, `COP-CLIENT-001`,
`COP-CLIENT-002`, `COP-IDEMP-001`.

Goals:

- introduce `ClientCommandSender.submit(type, payload, options)`
- route every frontend write command through one sender
- generate stable client `commandId` and `idempotencyKey` for every write
- enforce in-flight duplicate transport blocking per command key
- keep old `GameAPI` helper method names only as compatibility facades

Target modules:

- `frontend/js/api/GameAPI.js`
- `frontend/js/platform/GameCommandService.js`
- `frontend/js/platform/CanvasGameApp.js`
- panel and renderer action flows that can submit writes

### Phase 3: Server Envelope Normalization And Owner Resolver

Contract ids: `COP-ENVELOPE-001`, `COP-OWNER-001`, `COP-OWNER-002`,
`COP-IDEMP-001`, `COP-SHARED-001`.

Goals:

- add a universal command envelope normalizer for all write routes
- add table-driven `CommandOwnerResolver`
- reject missing required target ids during owner resolution
- keep owner resolver tests table-driven and exhaustive for current commands
- keep report-only owner logs until the route is actually migrated

Target modules:

- `backend/application/commands/CommandEnvelope.js`
- `backend/application/commands/CommandOwnerResolver.js`
- `backend/actions/GameActionRegistry.js`
- all write route entry points listed by Step1 inventory

### Phase 4: Idempotency Store And Pipeline Skeleton

Contract ids: `COP-IDEMP-001`, `COP-LOCK-001`, `COP-CONCURRENCY-001`,
`COP-TRACE-001`.

Goals:

- add `CommandIdempotencyStore`
- detect same key plus same payload as replay
- reject same key plus different payload as conflict
- classify legacy fallback ids as compatibility only
- add `CommandExecutionPipeline`
- move common stages into the pipeline:
  - trace
  - idempotency check
  - owner resolution
  - owner queue or lock
  - state load
  - domain validation
  - domain execution
  - commit
  - projection
  - response

Target modules:

- `backend/application/commands/CommandExecutionPipeline.js`
- `backend/application/commands/CommandIdempotencyStore.js`
- `backend/application/commands/CommandTrace.js`
- `backend/repositories/GameStateRepository.js`

### Phase 5: Route And Handler Migration

Contract ids: `COP-ROUTE-001`, `COP-HANDLER-001`, `COP-ENTRY-001`,
`COP-TRACE-001`, `COP-PROJECTION-001`.

Goals:

- migrate `build` first, but remove lock/save ownership from
  `BuildBuildingCommandHandler`
- migrate `/api/game/action` registry actions into the pipeline
- migrate or retire `/api/buildings/build`
- migrate `/api/game/tasks/claim`
- classify and migrate `/api/game/heartbeat` writes that settle march/report
  state
- keep `/api/player/login` and `/api/player/reset` classified; migrate only
  according to the inventory decision for auth/player-state writes
- ensure handlers execute inside pipeline-owned owner context
- ensure committer owns persistence

Target modules:

- `backend/routes/gameRoutes.js`
- `backend/routes/buildingRoutes.js`
- `backend/routes/playerRoutes.js`
- `backend/application/commands/BuildBuildingCommandHandler.js`
- domain handlers registered through `GameActionRegistry`

### Phase 6: Shared Owner Infrastructure

Contract ids: `COP-SHARED-001`, `COP-OWNER-001`, `COP-OWNER-002`,
`COP-LOCK-001`.

Goals:

- add owner-lock support for non-player keys
- support at least:
  - `territory:{territoryId}`
  - `encounter:{encounterId}`
  - future `loot:{lootId}`
  - future `boss:{bossId}`
- migrate territory contest commands that operate on shared targets
- migrate world encounter and world combat writes that persist shared encounter
  state
- make world march handoff points explicit when a player-owned march begins to
  contest a shared encounter

Target modules:

- `backend/services/TerritoryService.js`
- `backend/actions/TerritoryAction.js`
- `backend/services/worldExplorer/WorldExplorerActions.js`
- `backend/services/worldCombat/WorldCombatEncounterService.js`
- `backend/services/worldCombat/WorldCombatSessionService.js`
- `backend/repositories/WorldEncounterRepository.js`

### Phase 7: Blocking Architecture Gates

Contract ids: `COP-ALLOWLIST-001`, `COP-CLIENT-001`, `COP-CLIENT-002`,
`COP-ENVELOPE-001`, `COP-HANDLER-001`, `COP-IDEMP-001`, `COP-OWNER-001`,
`COP-OWNER-002`, `COP-ROUTE-001`, `COP-SHARED-001`.

Goals:

- convert Step1 report-only checks into blocking checks when migration reaches
  enforcement
- flip blocking enforcement per migrated inventory id in the same slice that
  claims migration for that id
- block new write commands without inventory, owner declaration, envelope support,
  idempotency classification, and command-path tests
- block route-owned orchestration after route migration is claimed
- block handler-owned lock/save after handler migration is claimed
- block frontend domain eligibility blockers in command-submit paths
- block unrecorded allowlists and exclusions

Target module:

- `scripts/run-architecture-smoke.js`

## 5. Required Tests

Server unit tests:

- owner resolver maps every current write command to exactly one owner key
- owner resolver rejects missing target ids
- idempotency replay returns stored result
- idempotency key conflict rejects different payload digest
- domain handlers cannot execute outside owner context after migration

Server integration tests:

- duplicate private command storm mutates once
- duplicate reward claim mutates once
- different player private commands do not serialize globally
- territory contest serializes on one territory owner stream
- encounter combat serializes on one encounter owner stream
- network timeout plus retry with same idempotency key does not duplicate mutation
- revision conflict returns clean conflict or idempotent replay, not 500

Frontend tests:

- every write helper sends `commandId` and `idempotencyKey`
- in-flight lock releases on success, domain rejection, busy, rate-limit, queued,
  replay, and final timeout
- frontend command path does not block on local era, tech, resource, cooldown,
  march, candidate, territory, reward, encounter, loot, or boss eligibility
- renderers and panels emit intents instead of owning command execution

Architecture tests:

- every migrated write route enters `CommandExecutionPipeline`
- every migrated handler runs without acquiring locks or saving state
- every shared-target write has a shared owner declaration
- server fallback ids do not count as idempotency compliance
- helper wrappers do not hide route-owned orchestration
- allowlist entries require inventory id, owner, reason, retirement condition,
  and growth-prevention test
- each migrated inventory id has the corresponding blocking gate enabled before
  the migration task is considered complete

## 6. Exit Criteria

Step3 is complete only when:

1. Every write command enters the server command pipeline.
2. Every write command has real `commandId` and `idempotencyKey` support.
3. Every write command resolves exactly one owner key before domain execution.
4. Same owner key is serialized; different owner keys may run concurrently under
   capacity limits.
5. Domain handlers do not acquire locks or save state.
6. The committer owns persistence and idempotency result recording.
7. Frontend command submission is centralized through `ClientCommandSender`.
8. Frontend command-submit paths do not block on domain eligibility.
9. Territory and encounter contested writes use shared owner keys.
10. Each migrated inventory id has its corresponding report-only debt converted
    into a blocking architecture gate.
11. Architecture smoke blocks fake compliance patterns documented in Step1 and
    Step2.

## 7. Handoff Rule

If implementation discovers missing prerequisite coverage, stop Step3 migration
for that area and return to Step1 inventory/report work. Do not patch around the
gap with a narrow exception, rename, helper wrapper, fallback owner, or one-off
idempotency path.
