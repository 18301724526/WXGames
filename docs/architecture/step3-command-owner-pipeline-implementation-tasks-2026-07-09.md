# Command Owner Pipeline Step3 Implementation Tasks

Status: Draft v0.1, derived task list
Date: 2026-07-09
Source spec: `step3-command-owner-pipeline-implementation-spec-2026-07-09.md`
Contract oracle: `command-owner-pipeline-contract-test-spec-2026-07-09.md`
Entry gate: `step2-command-owner-pipeline-prerequisite-admission-spec-2026-07-09.md`

## 1. Purpose

This task list turns the Step3 formal implementation spec into executable work
items.

Step3 may begin only after Step2 admission passes. If implementation discovers
missing Step1 coverage, stop the relevant migration and return to Step1 instead
of patching around the missing prerequisite.

## 2. Step3 Rules

- Server command pipeline remains authoritative.
- Frontend and game body adapt to the server command contract.
- No domain eligibility is reclassified as `PAYLOAD_SHAPE` or `UI_NOT_READY`.
- No server fallback id counts as real idempotency.
- No fake owner-key fallback from shared target to `player:{playerId}`.
- No route helper wrapper counts as migration.
- No migrated feature handler may keep lock or persistence ownership.
- Every task must cite `COP-*` contract ids.

## 3. Phase 0: Entry And Baseline

### STEP3-T00: Freeze Step2 Admission Baseline

Contract ids: all `COP-*`.

Inputs:

- Step2 admission decision record
- Step1 evidence package
- current architecture smoke output

Action:

- Record the exact admitted evidence set.
- List remaining debts allowed into Step3.
- Record the first migration target order.

Output:

- Step3 baseline manifest.

Verification:

- Step3 tasks can cite the Step2 admission record.

Rollback trigger:

- Any missing evidence required by a task returns that area to Step1.

## 4. Phase 1: Client Command Semantics Split

### STEP3-T01: Introduce Display Versus Command State Vocabulary

Contract ids: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-AUTHORITY-001`.

Target modules:

- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/platform/CanvasGameShell.js`
- `frontend/js/platform/CanvasGameApp.js`
- command-capable renderers and presenters

Action:

- Introduce the local model distinction between display state and command-submit
  state.
- Preserve visual disabled hints.
- Stop treating domain display eligibility as command-submit authority.

Output:

- Frontend command paths can represent `visualDisabled` separately from
  command-submit blocks.

Verification:

- Tests prove domain disabled state can remain visible without suppressing the
  server command path.

### STEP3-T02: Restrict Local Command Block Reasons

Contract ids: `COP-CLIENT-001`, `COP-TIME-001`.

Target modules:

- frontend command dispatch path
- `ClientOperationLog` producers

Action:

- Permit only `IN_FLIGHT`, `DUPLICATE_COMMAND_ID`, `PAYLOAD_SHAPE`, and
  `UI_NOT_READY` as local command-submit block reasons.
- Record local blocks with command type, command key, and reason.

Output:

- Local block logging compatible with the contract oracle.

Verification:

- Tests fail if resources, era, cooldown, march, candidate, territory,
  reward, encounter, loot, or boss state appears as a command-submit block.

## 5. Phase 2: Universal Client Command Sender

### STEP3-T03: Add Universal Client Command Sender

Contract ids: `COP-ENTRY-001`, `COP-ENVELOPE-001`, `COP-CLIENT-001`,
`COP-CLIENT-002`, `COP-IDEMP-001`.

Target modules:

- `frontend/js/api/GameAPI.js`
- new or existing client command sender module
- command-capable controllers and panels

Action:

- Introduce the single frontend write submission entry.
- Generate stable client command ids and idempotency keys for every write.
- Keep legacy helper names only as thin facades into the sender.

Output:

- All frontend writes have a single command sender path.

Verification:

- No command-capable panel, renderer, controller, shell, or app method submits a
  write outside the sender.

### STEP3-T04: Migrate GameAPI Write Helpers To The Sender

Contract ids: `COP-ENVELOPE-001`, `COP-IDEMP-001`, `COP-CLIENT-002`.

Target modules:

- `frontend/js/api/GameAPI.js`
- write helper callers from Step1 inventory

Action:

- Move every write helper to the universal command sender envelope path.
- Remove one-off support where only `build` receives command metadata.

Output:

- Consistent client envelope support for all writes.

Verification:

- Tests prove every write helper sends `commandId` and `idempotencyKey`.

### STEP3-T05: Migrate Canvas And Panel Write Paths

Contract ids: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-ENTRY-001`.

Target modules:

- `CanvasActionDispatcher`
- `CanvasActionController`
- `CanvasPanelActionRunner`
- `CanvasGameShell`
- `CanvasGameApp`
- panel action runners

Action:

- Route command-capable UI actions through the universal sender.
- Keep renderers and panels intent-only.
- Remove compatibility tap/click write paths that bypass the sender.

Output:

- Canvas and panel write paths converge on the sender.

Verification:

- Architecture smoke reports no frontend write submission path outside the
  sender.

## 6. Phase 3: Server Envelope Normalization And Owner Resolver

### STEP3-T06: Normalize Server Command Envelopes

Contract ids: `COP-ENVELOPE-001`, `COP-IDEMP-001`, `COP-TRACE-001`.

Target modules:

- `backend/application/commands/CommandEnvelope.js`
- server write routes

Action:

- Normalize every incoming write into the command envelope shape.
- Preserve server fallback ids only as compatibility metadata.
- Record idempotency classification in trace or report output while migrating.

Output:

- Server-side envelope normalization for all migrated writes.

Verification:

- Writes without required command envelope fields are rejected once migrated.

### STEP3-T07: Implement Table-Driven Owner Resolver

Contract ids: `COP-OWNER-001`, `COP-OWNER-002`, `COP-SHARED-001`.

Target modules:

- `backend/application/commands/CommandOwnerResolver.js`
- `backend/actions/GameActionRegistry.js`
- owner declaration tables

Action:

- Implement declarative owner-key rules.
- Reject missing target ids.
- Keep gameplay handlers out of owner-key decisions.

Output:

- Owner resolver used before domain execution.

Verification:

- Table tests cover every current command from Step1 inventory.

### STEP3-T08: Integrate Owner Resolution Into Write Entry Points

Contract ids: `COP-OWNER-001`, `COP-OWNER-002`, `COP-ENTRY-001`.

Target modules:

- all write routes listed by Step1 inventory
- command gateway or route adapter layer

Action:

- Resolve owner keys before validation, mutation, lock acquisition, save, or
  projection.
- Preserve report-only owner logs until each route is fully migrated.

Output:

- Migrated entries cannot execute domain logic without owner resolution.

Verification:

- Tests fail missing owner declarations and missing shared target ids.

## 7. Phase 4: Idempotency Store And Pipeline Skeleton

### STEP3-T09: Add Command Idempotency Store

Contract ids: `COP-IDEMP-001`, `COP-ENVELOPE-001`.

Target modules:

- `backend/application/commands/CommandIdempotencyStore.js`
- persistence adapter or repository boundary selected by implementation

Action:

- Store accepted command results by stable idempotency key and payload digest.
- Replay same key plus same payload.
- Reject same key plus different payload.
- Never treat server fallback ids as compliance.

Output:

- Real idempotency behavior for migrated commands.

Verification:

- Duplicate storm tests produce at most one mutation.

### STEP3-T10: Add Command Execution Pipeline Skeleton

Contract ids: `COP-LOCK-001`, `COP-CONCURRENCY-001`, `COP-TRACE-001`,
`COP-ROUTE-001`, `COP-HANDLER-001`.

Target modules:

- `backend/application/commands/CommandExecutionPipeline.js`
- command gateway or route adapter layer

Action:

- Add pipeline stages for trace, envelope normalization, owner resolution,
  idempotency check, owner lock, state load, validation, handler execution,
  commit, idempotency result recording, and projection.
- Keep the skeleton generic and free of feature-specific shortcuts.

Output:

- Reusable pipeline that can host route migrations.

Verification:

- A migrated command executes through all expected phases and emits trace phases.

### STEP3-T11: Add Pipeline-Owned Owner Lock Boundary

Contract ids: `COP-LOCK-001`, `COP-CONCURRENCY-001`, `COP-HANDLER-001`.

Target modules:

- owner lock or queue infrastructure
- `GameStateRepository.withPlayerStateLock`

Action:

- Reuse existing player state lock for `player:{playerId}` when appropriate.
- Ensure handlers run inside a pipeline-owned owner context.
- Prevent feature handlers from acquiring their own replacement locks.

Output:

- Pipeline-owned lock boundary for migrated player-owned commands.

Verification:

- Domain handler cannot run outside an owner context.

## 8. Phase 5: Route And Handler Migration

### STEP3-T12: Migrate Build Command First

Contract ids: `COP-ROUTE-001`, `COP-HANDLER-001`, `COP-IDEMP-001`,
`COP-TRACE-001`.

Target modules:

- `backend/routes/buildingRoutes.js`
- `backend/application/commands/BuildBuildingCommandHandler.js`
- `CommandExecutionPipeline`

Action:

- Route build through the pipeline.
- Remove lock and persistence ownership from `BuildBuildingCommandHandler` after
  migration is claimed.
- Keep domain validation and mutation inside handler boundaries only.

Output:

- First migrated command proves the pipeline contract.

Verification:

- Build tests cover duplicate idempotency, owner serialization, trace, and route
  no longer owning save/project orchestration.

### STEP3-T13: Migrate Game Action Route

Contract ids: `COP-ROUTE-001`, `COP-OWNER-001`, `COP-IDEMP-001`,
`COP-TRACE-001`.

Target modules:

- `backend/routes/gameRoutes.js`
- `backend/actions/GameActionRegistry.js`
- action handlers

Action:

- Route `/api/game/action` registry actions through the pipeline.
- Ensure owner resolver runs before handler execution.
- Remove route-owned load/save/project for migrated actions.

Output:

- Registry-backed game actions run through the command pipeline.

Verification:

- Architecture smoke blocks route-owned orchestration for migrated actions.

### STEP3-T14: Migrate Task, Heartbeat, Player, And Legacy Routes

Contract ids: `COP-ENTRY-001`, `COP-ROUTE-001`, `COP-IDEMP-001`,
`COP-TRACE-001`.

Target modules:

- `/api/game/tasks/claim`
- `/api/game/heartbeat`
- `/api/player/login`
- `/api/player/reset`
- legacy building write routes
- client event and operation log ingestion where they persist state

Action:

- Migrate each remaining write entry according to owner and idempotency
  classification.
- Keep diagnostic writes classified separately from gameplay commands.

Output:

- All server write entries either enter the pipeline or have explicit remaining
  blocker records.

Verification:

- No route-owned load/save/project remains for routes marked migrated.

### STEP3-T15: Expand Command Trace

Contract ids: `COP-TRACE-001`, `COP-IDEMP-001`, `COP-OWNER-001`,
`COP-LOCK-001`.

Target modules:

- `backend/application/commands/CommandTrace.js`
- `CommandReplayCorrelation`
- `CommandAuthorityContract`

Action:

- Add owner key, idempotency status, owner queue wait, execution duration, and
  outcome evidence to command trace.
- Preserve request/client-input/authority correlation.

Output:

- Complete migrated command trace.

Verification:

- Tests assert trace fields for success, domain rejection, busy, conflict, and
  replay outcomes.

## 9. Phase 6: Shared Owner Infrastructure

### STEP3-T16: Add Shared Owner Lock Infrastructure

Contract ids: `COP-SHARED-001`, `COP-LOCK-001`, `COP-OWNER-001`.

Target modules:

- owner lock or queue infrastructure
- world repositories and services

Action:

- Support non-player owner keys: `territory`, `encounter`, `loot`, and `boss`.
- Ensure shared owner serialization is not copied per feature.

Output:

- Generic shared owner lock support.

Verification:

- Same shared owner serializes; different shared owners can run concurrently
  under capacity limits.

### STEP3-T17: Migrate Territory And Encounter Contested Writes

Contract ids: `COP-SHARED-001`, `COP-OWNER-002`, `COP-LOCK-001`,
`COP-ROUTE-001`.

Target modules:

- territory route/service paths
- world encounter repository and services
- world combat session and encounter services
- world march handoff paths

Action:

- Migrate contested territory and encounter writes to shared owner keys.
- Prevent player-only serialization from guarding shared target mutations.

Output:

- Territory and encounter contested writes use shared owner locks.

Verification:

- Contested territory and encounter duplicate/concurrency tests do not double
  grant ownership, rewards, or encounter resolution.

## 10. Phase 7: Blocking Architecture Gates

### STEP3-T18: Convert Step1 Reports Into Blocking Gates

Contract ids: `COP-ALLOWLIST-001`, `COP-CLIENT-001`, `COP-CLIENT-002`,
`COP-ENVELOPE-001`, `COP-HANDLER-001`, `COP-IDEMP-001`, `COP-OWNER-001`,
`COP-OWNER-002`, `COP-ROUTE-001`, `COP-SHARED-001`.

Target modules:

- `scripts/run-architecture-smoke.js`
- Step1 report scripts
- architecture smoke fixtures

Action:

- Convert report-only checks into blocking checks as each migration area is
  claimed complete.
- Block new write commands without inventory, owner declaration, envelope
  support, idempotency classification, and command-path tests.

Output:

- Architecture smoke enforces migrated contracts.

Verification:

- Fake compliance fixtures fail in blocking mode.

### STEP3-T18A: Flip Gates Per Migrated Inventory Id

Contract ids: `COP-ROUTE-001`, `COP-HANDLER-001`, `COP-CLIENT-001`,
`COP-CLIENT-002`, `COP-ENVELOPE-001`, `COP-IDEMP-001`, `COP-OWNER-001`,
`COP-SHARED-001`, `COP-ALLOWLIST-001`.

Inputs:

- Step1 inventory ids
- Step2 admission baseline
- migration task output
- Step1 report scripts
- architecture smoke

Action:

- For each migrated route, handler, shared target path, or frontend submission
  path, mark its inventory id as `migration-claimed`.
- In the same change slice, convert the relevant report finding for that
  inventory id from report-only debt to blocking failure.
- Require the migration task to name the exact reports that changed enforcement
  mode for that inventory id.
- Do not allow a migration task to complete if its corresponding gate remains
  report-only.

Output:

- Per-inventory blocking gate map.

Verification:

- A migrated `/api/game/action` path fails smoke if it still owns load, validate,
  execute, save, retry, or project work.
- A migrated handler fails smoke if it calls lock or save helpers.
- A migrated frontend path fails smoke if it bypasses `ClientCommandSender`.
- A migrated shared target path fails smoke if it lacks shared owner lookup and
  owner-lock evidence.

Fake pass prevented:

- Deferring all blocking enforcement to the end while helper-wrapped
  pseudo-migrations accumulate.

### STEP3-T19: Add Required Unit, Integration, Frontend, And Load Tests

Contract ids: all implemented `COP-*`.

Target modules:

- server command tests
- route integration tests
- frontend command sender tests
- architecture smoke
- load or concurrency tests

Action:

- Add tests required by the implementation spec:
  - owner resolver table tests
  - idempotency replay and conflict tests
  - same-owner serialization tests
  - shared-owner contest tests
  - private duplicate storm tests
  - reward-claim duplicate storm tests
  - territory contest storm tests
  - encounter contest storm tests
  - mixed private plus shared workload tests
  - frontend sender and local block tests
  - route and handler architecture smoke gates

Output:

- Test suite covering migrated command pipeline behavior.

Verification:

- Tests fail if migrated code regresses to route-owned orchestration,
  handler-owned lock/save, fake idempotency, fake owner fallback, or frontend
  domain command blockers.

### STEP3-T20: Produce Final Implementation Handoff

Contract ids: all `COP-*`.

Inputs:

- implementation diff
- test output
- architecture smoke output
- remaining debt records

Action:

- Produce final handoff mapping each `COP-*` to implementation evidence and
  tests.
- List remaining non-blocking debt with owner and retirement condition.

Output:

- Step3 implementation handoff record.

Verification:

- Every contract id is either enforced or has an explicit accepted remaining
  debt record.

## 11. Step3 Completion Criteria

Step3 is complete only when:

1. Every write command enters the server command pipeline.
2. Every write command has real `commandId` and `idempotencyKey` support.
3. Every write command resolves exactly one owner key before domain execution.
4. Same owner key is serialized and different owner keys can run concurrently.
5. Domain handlers do not acquire locks or save state.
6. The committer owns persistence and idempotency result recording.
7. Frontend command submission is centralized through the universal sender.
8. Frontend command-submit paths do not block on domain eligibility.
9. Territory and encounter contested writes use shared owner keys.
10. Architecture smoke blocks fake compliance patterns.
11. Every migrated inventory id has its corresponding blocking gate enabled.
12. Required unit, integration, frontend, architecture, and load tests pass.
13. Final handoff maps every `COP-*` contract id to enforcement evidence.
