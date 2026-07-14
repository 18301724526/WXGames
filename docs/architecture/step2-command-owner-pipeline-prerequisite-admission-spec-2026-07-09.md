# Command Owner Pipeline Prerequisite Admission Gate

Status: Review Standard v1.3, Step2 admission gate
Date: 2026-07-09
Scope: Step2 admission criteria for `step1-command-owner-pipeline-prerequisite-staging-spec-2026-07-09.md` before `step3-command-owner-pipeline-implementation-spec-2026-07-09.md`
Tasks: `step2-command-owner-pipeline-prerequisite-admission-tasks-2026-07-09.md`

## 1. Purpose

This document defines the Step2 admission standard for accepting the Step1
prerequisite staging work before Step3 formal implementation begins.

`command-owner-pipeline-contract-test-spec-2026-07-09.md` is the contract-test
oracle for the target architecture. The prerequisite spec is the Step1 staging
implementation contract. This admission spec is the Step2 review gate for that
staging contract: it verifies that Step1 cannot be satisfied by temporary
compliance, naming changes, broad allowlists, fake metadata, helper wrappers, or
frontend compromises.

The goal is not to implement the pipeline. The goal is to prove that the
prerequisite spec is strong enough to make all write paths visible,
classifiable, testable, and ready to migrate into the server-authoritative
command pipeline. Passing this gate allows Step3 to begin; failing it sends the
work back to Step1.

## 2. Non-Negotiable Principles

1. `command-owner-pipeline-contract-test-spec-2026-07-09.md` remains the source
   of truth.
2. Server command ownership, idempotency, locking, validation, persistence, and
   observability are not weakened for frontend or game-body convenience.
3. The prerequisite spec must reduce ambiguity. It must not introduce a parallel
   mini-pipeline that later needs to be deleted.
4. Report-only checks are acceptable only when each finding requires an explicit
   inventory decision.
5. Compatibility shims are acceptable only when they make legacy writes visible
   to the future pipeline.
6. Fake owner keys, server fallback ids, route helper wrappers, and broad
   allowlists do not count as migration progress.
7. Client display hints must be separate from command submission blockers.
8. Territory and encounter shared-owner decisions must be explicit before
   migration begins.
9. Step3 formal implementation cannot begin until this Step2 gate passes.

## 3. Admission Questions

A review of the prerequisite spec must answer these questions:

1. Does it make every current server write route visible?
2. Does it make every current frontend write helper and command path visible?
3. Does it distinguish display-only state from command-submit state?
4. Does it classify local client blocks as allowed transport blocks or forbidden
   domain blockers?
5. Does it require owner-key declarations before command execution?
6. Does it reject missing owner target ids instead of falling back to player
   ownership?
7. Does it classify idempotency as real client idempotency, server fallback id,
   or absent?
8. Does it keep route-owned load, validate, execute, save, and project work
   visible until it is actually moved into the pipeline?
9. Does it prevent handlers from keeping lock or persistence ownership?
10. Does it require shared target owners for territory and encounter paths?
11. Does every exception include owner, reason, retirement condition, and a test
    that prevents growth?
12. Could the prerequisite spec be satisfied while the architecture is still not
    actually decoupled?

If any answer is unknown, the prerequisite spec is not admissible yet.

## 4. Required Coverage

The prerequisite spec is admissible only if it covers all of these categories.

### 4.1 Server Write Entry Inventory

The prerequisite spec must require an inventory for every server route or
service entry that can persist state.

The inventory must include at least:

- `/api/game/action`
- `/api/game/tasks/claim`
- `/api/game/heartbeat` when it writes march/report state
- `/api/buildings/build`
- `/api/player/login`
- `/api/player/reset`
- client events and client operation log ingestion
- admin/config/import routes that persist application state
- background worker writes that mutate player or shared world state
- helper/service entries that route or worker code uses to hide load/save/project
  orchestration

Each entry must classify:

- route and method
- normalized command or write type
- current executor
- current lock owner
- current persistence owner
- current projection owner
- provisional owner key or explicit owner-resolution blocker
- idempotency classification
- migration phase

### 4.2 Frontend Command Path Inventory

The prerequisite spec must require a classification for every frontend path that
can cause a server write.

The first pass must include:

- `GameAPI`
- `CanvasActionController`
- `CanvasActionDispatcher`
- `CanvasGameShell`
- `CanvasGameApp`
- `GameCommandService`
- `BuildingController`
- `TerritoryController`
- `WorldMarchActionHandler`
- panel action runners
- compatibility tap/click paths in the game app or shell
- civilization renderers and presenters
- tech renderers and presenters
- building renderers and presenters
- famous-person renderers and presenters
- territory renderers and presenters
- world march renderers and presenters
- army formation editor and renderer paths

Each path must be classified as one of:

- `command-submit`
- `intent-only`
- `display-only`
- `transport-guard`
- `domain-blocker`
- `legacy-debt`
- `false-positive`

The prerequisite spec must also require a direct frontend write-submission
bypass inventory. Every `GameAPI.*` write helper and every `api.*`,
`getGameApi().*`, controller, panel, or game-body call site that can submit a
server write must be represented and classified as one of:

- `through-client-command-sender`
- `legacy-direct-gameapi`
- `controller-direct-submit`
- `panel-direct-submit`
- `renderer-intent-only`
- `compatibility-direct-submit`
- `false-positive`

A future `ClientCommandSender` cannot satisfy admission while legacy direct
submit paths still exist outside its facade contract.

### 4.3 Client Local Block Policy

The prerequisite spec must require local block decisions to use only these
allowed reasons:

- `IN_FLIGHT`
- `DUPLICATE_COMMAND_ID`
- `PAYLOAD_SHAPE`
- `UI_NOT_READY`

The prerequisite spec must forbid command submission blocks based on:

- resources or costs
- era eligibility
- tech availability
- cooldowns
- formation business eligibility
- march passability or arrival
- territory mission readiness
- famous-person candidate availability
- reward already claimed
- encounter, chest, boss, or loot availability

These may remain as display hints. They may not decide whether a command is
sent.

### 4.4 Route Orchestration Visibility

The prerequisite spec must require route-owned orchestration to remain visible
until the route has genuinely migrated into the command pipeline.

The route inventory and reports must detect:

- state load
- domain validation
- registry or handler execution
- state mutation
- repository save
- shared repository upsert
- revision conflict retry
- response projection

Moving these calls into a helper does not count as migration.

### 4.5 Handler Lock And Persistence Visibility

The prerequisite spec must require command/domain handlers to be classified when
they acquire locks or persist state.

Handlers that currently own locks or saves may remain during staging only if
they are explicitly classified as `legacy-debt` with a migration target.

### 4.6 Owner Key Draft

The prerequisite spec must require a table-driven report-only owner resolver.

The resolver must cover every current write command and must fail owner
resolution when required target ids are missing.

Shared owner lookup decisions must be explicit before admission. For each shared
or potentially shared command, the evidence must declare required payload ids,
fallback lookup fields, lookup module or repository, owner key type,
missing-target error, and whether lookup happens before domain validation. A
command that needs domain handler execution to discover `territory:{id}` or
`encounter:{id}` is not admissible for Step3 migration.

Required initial owner decisions include:

| Command | Owner key |
| --- | --- |
| `build` | `player:{playerId}` |
| `upgrade` | `player:{playerId}` |
| `advanceEra` | `player:{playerId}` |
| `research` | `player:{playerId}` |
| `assign` | `player:{playerId}` |
| `claimTaskReward` | `player:{playerId}` |
| `claimEvent` | `player:{playerId}` unless event target becomes shared |
| `applyTalentPolicy` | `player:{playerId}` |
| `saveTalentPolicy` | `player:{playerId}` |
| `deleteTalentPolicy` | `player:{playerId}` |
| `seekFamousPerson` | `player:{playerId}` |
| `acceptFamousPerson` | `player:{playerId}` |
| `dismissFamousPersonCandidate` | `player:{playerId}` |
| `assignFamousAttributePoint` | `player:{playerId}` |
| `setArmyFormation` | `player:{playerId}` |
| `veteranCampWithdraw` | `player:{playerId}` |
| `veteranCampUpgrade` | `player:{playerId}` |
| `startWorldMarch` | `player:{playerId}` unless contesting a shared encounter |
| `returnWorldMarch` | `player:{playerId}` |
| `stopWorldMarch` | `player:{playerId}` |
| `startConquest` | `territory:{territoryId}` when territory is shared |
| `claimConquest` | `territory:{territoryId}` |
| `resolveCapture` | `player:{playerId}` unless capture decision is shared |
| `renameCity` | `player:{playerId}` unless city naming becomes shared |
| `renamePolity` | `player:{playerId}` |
| `switchCity` | `player:{playerId}` |
| `startWorldCombat` | `encounter:{encounterId}` |
| `resolveWorldCombat` | `encounter:{encounterId}` |

### 4.7 Idempotency Staging

The prerequisite spec must require every write helper and route to be classified
as one of:

- `client-idempotent`
- `server-fallback-id`
- `non-idempotent`

Only `client-idempotent` counts as satisfying the main spec.

`server-fallback-id` is a compatibility label. It must not be treated as real
idempotency.

### 4.8 Shared Target Coverage

The prerequisite spec must require explicit staging debt for shared targets:

- territory owner
- encounter owner
- future loot owner
- future boss owner

The first migration only needs territory and encounter decisions, but the owner
abstraction must not be player-only.

## 5. Required Report-Only Checks

The prerequisite spec is admissible only if it requires these report-only checks
before migration:

1. `write-command-inventory`
2. `client-command-domain-blockers`
3. `client-disabled-command-path`
4. `frontend-write-submission-path`
5. `route-write-orchestration`
6. `handler-lock-persistence`
7. `owner-key-coverage`
8. `shared-owner-lookup-coverage`
9. `idempotency-coverage`
10. `shared-owner-write-coverage`
11. `allowlist-debt-record`
12. `server-fallback-id-classification`

`report-domain-business-candidates.js` remains useful as a broad structural
signal detector, but it is not command-path-specific and cannot be the only
guard.

Each required check must define the command path it follows and the fake pass it
prevents:

- `client-disabled-command-path` must trace `disabled`, `can*`, `ready`, `busy`,
  `cooldown`, `eligible`, and `claimable` values from producers to dispatch
  consumers.
- `frontend-write-submission-path` must trace every direct write submit call and
  prove whether it is a facade into the future universal sender or visible
  legacy debt.
- `route-write-orchestration` must continue to flag load/save/project work after
  it is moved behind route-local helpers, service facades, retry wrappers, or
  functions named like `pipeline`.
- `handler-lock-persistence` must flag both direct repository calls and helper
  calls that acquire player/shared locks or persist state.
- `owner-key-coverage` must fail missing shared target ids instead of accepting
  `player:{playerId}` fallback.
- `shared-owner-lookup-coverage` must reject owner lookup that happens only
  inside domain handlers after validation or mutation has started.
- `idempotency-coverage` must distinguish stable client keys from request id,
  timestamp, sequence, random, or server-generated fallback ids.
- `shared-owner-write-coverage` must include territory, world encounter, world
  combat, world march handoff points, and future loot/boss owner abstractions.
- `allowlist-debt-record` must fail any allowlist/exclusion without inventory
  id, owner, reason, retirement condition, and growth-prevention test.
- `server-fallback-id-classification` must prevent a field named `commandId` or
  `idempotencyKey` from counting as compliance when the value is generated only
  for legacy compatibility.

A report that only scans broad domain vocabulary is not sufficient for
admission, even if it finds many candidates.

## 6. Explicit Fake-Compliance Violations

The prerequisite spec must treat the following as violations:

- renaming a method, file, action, or route to avoid scanner patterns
- moving code from renderer to presenter without changing command behavior
- adding allowlist entries without inventory entries and migration notes
- marking a domain blocker as `PAYLOAD_SHAPE`
- treating a disabled UI button as proof that command dispatch is safe
- returning client-side success without contacting the server
- introducing `ClientCommandSender` while old controllers, panels, renderers, or
  game-body helpers continue to submit writes directly
- adding `ownerKey: player:{playerId}` to all commands without table review
- accepting missing shared target ids by falling back to `player:{playerId}`
- treating domain-handler discovery of a shared target as owner resolution
- treating server-generated command ids as proof of idempotency
- adding one-off idempotency support for a single new command
- wrapping legacy route orchestration in a helper named `pipeline`
- moving `repository.save()` into a helper and claiming committer migration
- keeping locks or persistence inside feature handlers after migration is
  claimed
- adding a second feature-owned lock instead of using owner-lock infrastructure
- renaming actions, methods, files, or helper wrappers to move violations out of
  scanner scope
- classifying formation busy, march blocked, territory not ready, candidate
  unavailable, reward claimed, or cooldown not ready as `PAYLOAD_SHAPE` or
  `UI_NOT_READY`

## 7. Current-Code Debt That Must Be Accounted For

The prerequisite spec must explicitly account for known current-code debt. This
does not mean fixing it immediately, but the debt must be visible, classified,
and assigned a migration target.

Required debt entries:

- `GameAPI.attachClientCommand()` only attaches command metadata for `build`
- `CanvasActionController.handle()` treats `action.disabled` as a local command
  block
- `CanvasActionDispatcher.handle()` and `CanvasPanelActionRunner.run()` can drop
  disabled actions before command dispatch
- `CanvasGameShell.handleTap()` swallows disabled actions before dispatch
- `CanvasGameApp` compatibility tap paths can suppress disabled command targets
  before server submission
- `CanvasGameApp.advanceEra()` uses `canAdvanceEraNow()` as a hard command block
- civilization advance uses display eligibility as command eligibility
- tech research uses local `canResearch` as command disabled state
- building actions use local cost/max/unlock state as command disabled state
- famous-person flow can rely on local candidate presentation state
- territory site presenter only exposes claim/conquest actions from local
  mission status
- world march HUD suppresses or disables march commands from local passability,
  busy formation, empty formation, and deployment eligibility
- army formation save uses local `saving` as a coarse command block
- `/api/game/action` owns load, validate, execute, save, and project
- `/api/game/tasks/claim` owns claim, save, and project
- `/api/game/heartbeat` writes march settlement and report state in route code
- `/api/buildings/build` remains a legacy route-owned write path
- `/api/player/login` and `/api/player/reset` own lock and persistence through
  route callbacks
- client event routes and client operation log routes persist diagnostic state
  and require write-entry classification
- realtime/world worker writes can mutate player or shared world state outside
  normal HTTP route classification
- `BuildBuildingCommandHandler` owns player lock and persistence
- `GameActionRegistry` has handlers but no owner declarations
- `CommandEnvelope` can create server fallback command ids that must be
  classified as compatibility, not real idempotency
- `CommandReplayCorrelation` and `CommandAuthorityContract` exist but do not yet
  cover every command path as pipeline stages
- world combat actions bypass registry and owner resolution
- `WorldEncounterRepository.upsertEncounter()` updates shared encounters without
  `encounter:{id}` owner serialization
- `WorldCombatSessionService` and `WorldCombatEncounterService` can persist
  shared encounter state without shared-owner serialization
- territory actions still need a reusable `territory:{territoryId}` owner
  abstraction instead of relying on player-state route serialization
- current `CommandTrace` lacks owner key, idempotency status, owner queue wait,
  and execution duration
- current architecture smoke relies on broad `report-domain-business-candidates`
  detection unless command-path-specific reports are added

## 8. Required Output Of A Review

A review of the prerequisite spec against this admission spec must produce:

- pass/fail admission judgment
- P0/P1/P2 findings
- missing coverage list
- fake-compliance risks
- command-path-specific check gaps
- current-code debt mapping
- execution plan without implementation

Each finding must include:

- violated section of this admission spec or the main/prerequisite spec
- consequence for future development
- how debugging becomes harder
- target module or file for the eventual correction

## 9. Admission Criteria

The prerequisite spec is admitted only when:

Every Step1 evidence item must map to one or more `COP-*` contract ids from
`command-owner-pipeline-contract-test-spec-2026-07-09.md`.

1. Every required coverage category in section 4 is present.
2. Every required report-only check in section 5 is required.
3. Every required report-only check has a command-path-specific scope and
   anti-evasion fixture.
4. Every fake-compliance violation in section 6 is explicitly rejected.
5. Every current-code debt item in section 7 is represented or intentionally
   classified with a reason.
6. No compliance path depends on broad allowlists, renames, helper wrappers, or
   server fallback ids.
7. Client display hints are explicitly separated from command-submit blockers.
8. Direct frontend write submit paths are inventoried until they are proven to be
   facades into the universal sender.
9. Owner-key staging rejects missing shared target ids instead of falling back.
10. Shared owner lookup happens before domain validation or is recorded as an
    explicit blocker.
11. Idempotency staging distinguishes real client keys from compatibility ids.
12. Route-owned and handler-owned lock/save debt remains visible until genuinely
    migrated.
13. The prerequisite spec preserves the main server-authoritative command
    pipeline as the final contract.

If any criterion fails, the Step1 prerequisite work must be revised before
Step3 formal implementation begins.
