# Command Owner Pipeline Step1 Prerequisite Staging Tasks

Status: Draft v0.1, derived task list
Date: 2026-07-09
Source spec: `step1-command-owner-pipeline-prerequisite-staging-spec-2026-07-09.md`
Contract oracle: `command-owner-pipeline-contract-test-spec-2026-07-09.md`

## 1. Purpose

This task list turns the Step1 prerequisite staging spec into executable work
items.

Step1 makes current write paths visible, classified, reportable, and protected
against fake compliance. It must not implement the formal command pipeline and
must not change gameplay behavior.

## 2. Step1 Rules

- No behavior change.
- No `ClientCommandSender`.
- No real idempotency store.
- No `CommandExecutionPipeline`.
- No route migration.
- No shared owner-lock migration.
- Every output must map to one or more `COP-*` contract ids.
- Every allowlist or exception must have owner, reason, retirement condition,
  and growth-prevention test.

## 3. Task Format

Each task has:

- Contract ids
- Inputs
- Action
- Output
- Verification
- Fake pass prevented

## 4. Tasks

### STEP1-T01: Establish Contract Coverage Index

Contract ids: all `COP-*`.

Inputs:

- `command-owner-pipeline-contract-test-spec-2026-07-09.md`
- Step1 prerequisite staging spec

Action:

- Create or update the Step1 evidence index.
- List every `COP-*` contract id.
- For each id, record the Step1 probe or explicit blocker that will cover it.

Output:

- Contract coverage index consumed by Step2 admission.

Verification:

- No `COP-*` id is unmapped.
- No Step1 report exists without a `COP-*` mapping.

Fake pass prevented:

- Completing reports that do not prove any contract coverage.

### STEP1-T02: Build Server Write Entry Inventory

Contract ids: `COP-ENTRY-001`, `COP-ROUTE-001`, `COP-TRACE-001`.

Inputs:

- `backend/routes/gameRoutes.js`
- `backend/routes/buildingRoutes.js`
- `backend/routes/playerRoutes.js`
- client event and operation log ingestion routes
- background worker or realtime write entries

Action:

- Inventory every route, worker, helper, and service entry that can persist state.
- Record route or entry name, method, normalized command or write type, current
  executor, current lock owner, current persistence owner, current projection
  owner, provisional owner key, idempotency classification, and migration phase.
- Preserve helper wrappers as visible write orchestration, not migration.

Output:

- Server write-entry inventory.

Verification:

- `/api/game/action`, `/api/game/tasks/claim`, `/api/game/heartbeat`,
  `/api/buildings/build`, `/api/player/login`, and `/api/player/reset` are
  explicitly present.
- Any helper used to hide load/save/project work has its own referenced entry.

Fake pass prevented:

- Route helper wrappers pretending route migration is complete.

### STEP1-T03: Build Game Action Inventory

Contract ids: `COP-ENTRY-001`, `COP-OWNER-001`, `COP-IDEMP-001`.

Inputs:

- `backend/actions/GameActionRegistry.js`
- current action handlers
- known non-registry world combat and encounter write paths

Action:

- List every existing action command.
- Record action type, handler, current route entry, provisional owner key, target
  id source, idempotency state, and migration blocker.
- Mark bypasses such as world combat actions that do not enter the registry.

Output:

- Game action inventory linked to server write-entry inventory.

Verification:

- Each current write action is represented once.
- Non-registry writes are not hidden under a generic false-positive category.

Fake pass prevented:

- Declaring registry coverage while bypass write paths still exist.

### STEP1-T04: Build Frontend Command Path Inventory

Contract ids: `COP-ENTRY-001`, `COP-CLIENT-001`, `COP-CLIENT-002`.

Inputs:

- `frontend/js/api/GameAPI.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/platform/CanvasGameShell.js`
- `frontend/js/platform/CanvasGameApp.js`
- command-capable controllers, panels, renderers, and presenters

Action:

- Classify every frontend path that can cause a server write as
  `command-submit`, `intent-only`, `display-only`, `transport-guard`,
  `domain-blocker`, `legacy-debt`, or `false-positive`.
- Record producer, consumer, dispatch path, and endpoint.

Output:

- Frontend command-path inventory.

Verification:

- Canvas click, panel action, compatibility tap, controller, and `GameAPI` paths
  are all represented.

Fake pass prevented:

- Moving a write from one frontend layer to another and claiming it disappeared.

### STEP1-T04B: Build Frontend Write Submission Bypass Inventory

Contract ids: `COP-ENTRY-001`, `COP-CLIENT-002`, `COP-ENVELOPE-001`,
`COP-IDEMP-001`.

Inputs:

- frontend command-path inventory
- `frontend/js/api/GameAPI.js`
- `frontend/js/platform/CanvasGameApp.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/controllers/BuildingController.js`
- `frontend/js/controllers/TerritoryController.js`
- `frontend/js/platform/WorldMarchActionHandler.js`
- `frontend/js/platform/ArmyFormationEditorController.js`
- all panel, renderer, controller, app, and compatibility paths that call
  `api.*`, `getGameApi().*`, or route write requests

Action:

- Add a report-only `frontend-write-submission-path` check.
- Inventory every frontend call site that can submit a server write directly.
- Classify each submit path as `through-client-command-sender`,
  `legacy-direct-gameapi`, `controller-direct-submit`, `panel-direct-submit`,
  `renderer-intent-only`, `compatibility-direct-submit`, or `false-positive`.
- Record endpoint, command type, payload source, command id and idempotency
  support, producer action, dispatch consumer, and whether domain display state
  can suppress the call.

Output:

- Frontend write-submission bypass report linked to the command-path inventory.

Verification:

- Every `GameAPI.*` write helper and every `api.*` or `getGameApi().*` write
  call is represented.
- No direct submit path can disappear by moving from app to controller, panel,
  renderer, or compatibility code.
- Direct write submissions that do not go through the future universal sender
  remain visible as `legacy-direct-gameapi` or equivalent debt.

Fake pass prevented:

- Introducing `ClientCommandSender` while old controllers, panels, or game-body
  helpers continue submitting writes directly.

### STEP1-T05: Classify Client Local Blocks

Contract ids: `COP-CLIENT-001`, `COP-AUTHORITY-001`, `COP-TIME-001`.

Inputs:

- frontend command-path inventory
- disabled, ready, busy, eligible, can*, cooldown, claimable, passability, and
  saving state producers

Action:

- Classify each local block as allowed transport block or forbidden domain
  blocker.
- Allowed reasons are only `IN_FLIGHT`, `DUPLICATE_COMMAND_ID`,
  `PAYLOAD_SHAPE`, and `UI_NOT_READY`.
- Record every domain blocker as debt, not as a payload-shape issue.

Output:

- Client local-block classification table.

Verification:

- Era, tutorial, resource, cooldown, march, famous-person, territory, reward,
  encounter, loot, and boss readiness do not appear as allowed command-submit
  blockers.

Fake pass prevented:

- Re-labeling domain blockers as `PAYLOAD_SHAPE` or `UI_NOT_READY`.

### STEP1-T06: Add Command-Path-Specific Client Reports

Contract ids: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-ALLOWLIST-001`.

Inputs:

- frontend command-path inventory
- client local-block classification
- `scripts/report-domain-business-candidates.js`
- `scripts/run-architecture-smoke.js`

Action:

- Add or update report-only checks for `client-command-domain-blockers` and
  `client-disabled-command-path`.
- Make each report follow producer-to-consumer command paths.
- Keep broad domain vocabulary detection as a signal only, not the final guard.

Output:

- Report-only client command-path checks wired into architecture smoke.

Verification:

- Reports detect disabled/eligible/can*/ready/busy/cooldown values when they
  reach command-submit consumers.

Fake pass prevented:

- Passing broad scanner output while the actual command path remains blocked.

### STEP1-T07: Add Route Orchestration Report

Contract ids: `COP-ROUTE-001`, `COP-ENTRY-001`, `COP-ALLOWLIST-001`.

Inputs:

- server write-entry inventory
- route files and route-local helper modules

Action:

- Add `route-write-orchestration` report-only detection.
- Detect route-owned state load, tutorial sync, validation, registry execution,
  mutation, save, shared upsert, revision retry, and projection.
- Follow helper wrappers, service facades, retry wrappers, and functions named
  like `pipeline`.

Output:

- Route orchestration report.

Verification:

- Moving load/save/project calls behind helpers keeps the entry visible.

Fake pass prevented:

- Helper-wrapped route orchestration being counted as migration.

### STEP1-T08: Add Handler Lock And Persistence Report

Contract ids: `COP-HANDLER-001`, `COP-LOCK-001`, `COP-ALLOWLIST-001`.

Inputs:

- command/domain handlers
- repository calls and helper calls
- `BuildBuildingCommandHandler`

Action:

- Add `handler-lock-persistence` report-only detection.
- Flag direct and helper-mediated lock acquisition or persistence by feature
  handlers.

Output:

- Handler lock/persistence debt report.

Verification:

- `BuildBuildingCommandHandler` lock/save ownership is visible as legacy debt.

Fake pass prevented:

- Moving lock/save into a handler helper and claiming the handler is clean.

### STEP1-T09: Add Report-Only Owner Key Coverage

Contract ids: `COP-OWNER-001`, `COP-OWNER-002`, `COP-SHARED-001`.

Inputs:

- server write-entry inventory
- game action inventory
- command payload shapes

Action:

- Add a table-driven report-only owner resolver or owner coverage report.
- For every write command, declare provisional owner key or explicit
  owner-resolution blocker.
- Reject missing required target ids in the report; do not fall back to
  `player:{playerId}`.

Output:

- Owner-key coverage report and owner decision table.

Verification:

- Territory and encounter commands identify `territory:{territoryId}` or
  `encounter:{encounterId}` when shared.

Fake pass prevented:

- Fake `ownerKey: player:{playerId}` fallback on shared commands.

### STEP1-T09B: Build Shared Owner Lookup Decision Table

Contract ids: `COP-OWNER-001`, `COP-OWNER-002`, `COP-SHARED-001`.

Inputs:

- owner-key coverage report
- server write-entry inventory
- game action inventory
- `startConquest`, `claimConquest`, `resolveCapture`
- `startWorldMarch`, `returnWorldMarch`, `stopWorldMarch`
- `startWorldCombat`, `resolveWorldCombat`
- current payload shapes, mission state, battle/session ids, coordinate fields,
  territory services, world encounter repositories, and route planning context

Action:

- For every shared or potentially shared command, declare required payload id
  fields, fallback lookup fields if any, lookup module, owner key type, missing
  target error, and whether the lookup happens before domain validation.
- Explicitly classify coordinate-only, mission-id-only, battle-id-only,
  encounter-id, territory-id, and route-local-state paths.
- Record any command that cannot derive a shared owner before domain execution
  as an owner-resolution blocker, not as a domain blocker.

Output:

- Shared owner lookup table consumed by Step2 admission and Step3 owner resolver
  implementation.

Verification:

- `startWorldCombat` and `resolveWorldCombat` cannot pass owner staging without
  an `encounter:{encounterId}` derivation or explicit blocker.
- `startConquest` and `claimConquest` cannot pass with `player:{playerId}`
  fallback when `territoryId` is missing.
- Mission, battle, coordinate, and route-local lookup failures are classified
  before domain handler execution.

Fake pass prevented:

- Treating a domain validation failure as owner-resolution success.

### STEP1-T10: Add Idempotency Coverage Report

Contract ids: `COP-IDEMP-001`, `COP-ENVELOPE-001`.

Inputs:

- frontend command-path inventory
- server write-entry inventory
- `CommandEnvelope`
- current request id and fallback id generation

Action:

- Classify each write as `client-idempotent`, `server-fallback-id`, or
  `non-idempotent`.
- Record whether stable payload digest or same-key different-payload detection
  is available.

Output:

- Idempotency coverage report.

Verification:

- Server-generated ids, request ids, timestamps, sequences, or random values are
  classified as `server-fallback-id`, not compliance.

Fake pass prevented:

- Treating a field named `commandId` or `idempotencyKey` as real idempotency when
  the server generated it for compatibility.

### STEP1-T11: Add Shared Owner Write Coverage

Contract ids: `COP-SHARED-001`, `COP-OWNER-001`, `COP-LOCK-001`.

Inputs:

- territory write paths
- world encounter write paths
- world combat write paths
- world march handoff paths

Action:

- Add `shared-owner-write-coverage` report-only detection.
- Record current owner model and required shared owner abstraction for territory,
  encounter, future loot, and future boss paths.

Output:

- Shared owner write coverage report.

Verification:

- Territory, encounter, world combat, world march, future loot, and future boss
  categories are all represented.

Fake pass prevented:

- Leaving shared target writes on player-only serialization.

### STEP1-T12: Add Allowlist Debt Record Check

Contract ids: `COP-ALLOWLIST-001`.

Inputs:

- all architecture reports
- existing report exclusions, false positives, and allowlists

Action:

- Add `allowlist-debt-record` report-only detection.
- Require inventory id, owner, reason, retirement condition, and
  growth-prevention test for every exclusion.

Output:

- Allowlist debt report.

Verification:

- A new allowlist entry without complete debt metadata is reported.

Fake pass prevented:

- Broad allowlists hiding unfinished migration work.

### STEP1-T13: Add Anti-Evasion Fixtures

Contract ids: `COP-ALLOWLIST-001`, `COP-CLIENT-001`, `COP-OWNER-002`,
`COP-IDEMP-001`, `COP-ROUTE-001`, `COP-HANDLER-001`.

Inputs:

- reports from STEP1-T06 through STEP1-T12
- frontend write-submission bypass report
- shared owner lookup decision table

Action:

- Add fixtures or assertions for scanner rename, allowlist growth, fallback id,
  frontend direct-submit bypass, payload-shape reclassification, helper-wrapper
  fake pipeline, missing-shared-target fallback, owner-lookup-after-domain
  execution, and handler helper lock/save.

Output:

- Anti-evasion fixture set.

Verification:

- Each fake pass listed in the Step1 spec has at least one fixture or assertion.

Fake pass prevented:

- Passing by renaming, hiding, or reclassifying violations.

### STEP1-T14: Wire Reports Into Architecture Smoke

Contract ids: all `COP-*` covered by Step1 reports.

Inputs:

- `scripts/run-architecture-smoke.js`
- new and existing report-only checks

Action:

- Wire all Step1 report-only checks into architecture smoke.
- Keep Step1 as report-only unless a check is specifically an anti-evasion
  fixture assertion.

Output:

- Architecture smoke output includes all Step1 reports.

Verification:

- A single architecture smoke run produces the evidence package needed for Step2.

Fake pass prevented:

- Reports existing but not running in the shared smoke entry.

### STEP1-T15: Produce Step2 Admission Evidence Package

Contract ids: all `COP-*`.

Inputs:

- all Step1 inventories, reports, classifications, and fixtures

Action:

- Produce a reviewable evidence package for Step2.
- Include coverage by contract id, report names, current debt, allowlists,
  blockers, and recommended admission decision.

Output:

- Step2 admission package.

Verification:

- Step2 can answer every admission question without re-discovering current code
  paths from scratch.

Fake pass prevented:

- Entering admission with incomplete, non-repeatable, or manually inferred
  evidence.

## 5. Step1 Completion Criteria

Step1 is complete only when:

1. Every current server write entry is inventoried.
2. Every current frontend write path is classified.
3. Every frontend direct write submission path is inventoried and classified.
4. Every local command block is classified.
5. Every current write command has owner coverage or explicit blocker.
6. Shared owner lookup sources and missing-target errors are explicit.
7. Every current write path has idempotency classification.
8. Route-owned orchestration and handler-owned lock/save debt remain visible.
9. Shared territory and encounter decisions are explicit.
10. Future loot and boss owner abstractions are represented.
11. Every report maps to `COP-*`.
12. Architecture smoke runs all Step1 report-only checks.
13. Anti-evasion fixtures cover fake pass patterns.
14. The Step2 admission package is reviewable without ad hoc code spelunking.
