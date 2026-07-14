# Command Owner Pipeline Prerequisite Staging Spec

Status: Draft v0.4, Step1 prerequisite staging implementation
Date: 2026-07-09
Scope: architecture inventory, command-path classification, report-only checks, anti-temporary-fix gates
Tasks: `step1-command-owner-pipeline-prerequisite-staging-tasks-2026-07-09.md`

## 1. Purpose

This spec defines the Step1 prerequisite staging work that must be completed
after `command-owner-pipeline-contract-test-spec-2026-07-09.md` is accepted and
before Step2 admission can pass.

The contract test spec is the test oracle for the target architecture. This
prerequisite spec is not the formal pipeline implementation. It is the staging
implementation contract: it implements report-only probes, classifications, and
anti-evasion fixtures for those contract ids, so the project cannot "pass"
future command-owner checks by renaming files, adding narrow exceptions, or
hiding command writes behind another UI/controller path.

The prerequisite goal is not to make gameplay more permissive. The goal is to
make every write path visible, classifiable, testable, and ready to migrate into
the server-authoritative command pipeline.

After this spec is implemented, Step2 admission decides whether the project may
proceed to `step3-command-owner-pipeline-implementation-spec-2026-07-09.md`.

## 2. Non-Negotiable Principles

1. `command-owner-pipeline-contract-test-spec-2026-07-09.md` remains the source
   of truth.
2. No route, frontend panel, renderer, controller, or service may be renamed or
   moved only to evade a guard.
3. Report-only findings are not failures, but they must produce an explicit
   inventory decision: `command-path`, `display-only`, `transport-only`,
   `legacy-debt`, or `false-positive`.
4. Any local client block on a write command must be explainable as transport or
   payload readiness. Domain eligibility is not an acceptable local block.
5. Pipeline preparation must reduce architectural ambiguity. It must not create a
   parallel mini-pipeline that will later need to be deleted.
6. Existing server validators remain authoritative during the transition.
7. Compatibility shims are allowed only when they make legacy writes visible to
   the future pipeline. They are not allowed when they hide missing owner,
   envelope, idempotency, or trace data.

## 3. Relationship To The Main Spec

The main spec requires:

- every write command has `commandId` and `idempotencyKey`
- every write command resolves exactly one owner key before domain execution
- same owner key is serialized
- domain handlers do not acquire locks
- committer owns persistence
- frontend does not block writes on domain eligibility

This prerequisite spec does not require full migration yet. It requires the
project to reach a clean staging point where the migration can be done without
guesswork.

The output of this spec is:

- a complete write-command inventory
- a command-path classification map
- a frontend direct write-submission bypass map
- a client local-block policy map
- route write-entry classification
- owner-key declaration draft
- shared owner lookup decision table
- report-only architecture checks that identify real command-path debt
- tests that prove no temporary bypass was introduced

## 4. Required Inventory

### 4.1 Server Write Entry Inventory

Every server write entry must be listed in a command inventory document or module.

Required fields:

```js
{
  route: '/api/game/action',
  method: 'POST',
  writeEntryKind: 'player-write',
  action: 'advanceEra',
  commandType: 'advanceEra',
  provisionalOwnerKey: 'player:{playerId}',
  targetIdFields: [],
  currentExecutor: 'GameActionRegistry',
  currentLockOwner: 'route:withPlayerStateLock',
  currentPersistenceOwner: 'route:repository.save',
  currentProjectionOwner: 'route:getClientGameStateFromNormalized',
  idempotencyClassification: 'non-idempotent',
  migrationPhase: 'pipeline-pending',
  notes: ''
}
```

The inventory must include at least:

- `/api/game/action`
- `/api/game/tasks/claim`
- `/api/game/heartbeat` when it writes march/report state
- `/api/buildings/build`
- `/api/player/login`
- `/api/player/reset`
- admin/config writes if they persist application state
- client operation log ingestion if it writes diagnostic state
- client event ingestion if it writes diagnostic state
- background worker writes that mutate player state or shared world state
- any helper/service entry that is called by a route or worker and persists
  state on behalf of a write request

Moving load/save/project work into a helper does not remove the route from the
inventory. The inventory must preserve the original write entry and the helper
that now owns the hidden operation.

Diagnostic writes must be inventoried even when they do not mutate gameplay
state. They require an explicit write-entry kind and owner model instead of
being hidden as non-gameplay noise. Example:

```js
{
  inventoryId: 'diagnostic:client-operation-log-ingest',
  writeEntryKind: 'diagnostic-write',
  commandType: 'clientOperationLogIngest',
  ownerModel: 'diagnostic:{playerId}',
  idempotencyRequirement: 'explicitly-classified',
  gameplayMutation: false,
  persistenceOwner: 'logService',
  migrationPhase: 'diagnostic-classified',
  notes: 'Does not mutate gameplay state, but remains visible as a write.'
}
```

### 4.2 Game Action Inventory

Every existing write command reachable through `/api/game/action` (whether it is a
registered `GameActionRegistry` action or a route-level bypass) must be declared. The
list below is the full write-command set, not the registry set alone; three entries are
explicitly NOT `GameActionRegistry` actions and must stay visible as such:

- `claimTaskReward` is a `/api/game/tasks/claim` route write, not a registry action.
- `startWorldCombat` and `resolveWorldCombat` are route-level bypasses that skip
  `GameActionRegistry` (see `server:game-action-world-combat-bypass` inventory entry).

Do not shrink this list to the 26 true registry actions; the non-registry writes must
remain inventoried so they cannot hide.

- `build`
- `upgrade`
- `advanceEra`
- `claimEvent`
- `assign`
- `claimTaskReward` (route write, NOT a registry action)
- `applyTalentPolicy`
- `saveTalentPolicy`
- `deleteTalentPolicy`
- `setArmyFormation`
- `veteranCampWithdraw`
- `veteranCampUpgrade`
- `research`
- `seekFamousPerson`
- `acceptFamousPerson`
- `dismissFamousPersonCandidate`
- `assignFamousAttributePoint`
- `startConquest`
- `claimConquest`
- `resolveCapture`
- `renameCity`
- `renamePolity`
- `switchCity`
- `startWorldMarch`
- `returnWorldMarch`
- `stopWorldMarch`
- `startWorldCombat` (route-level registry bypass, NOT a registry action)
- `resolveWorldCombat` (route-level registry bypass, NOT a registry action)
- any territory, world march, or world combat action that currently bypasses
  the registry

Missing inventory entry is a prerequisite failure.

## 5. Client Command Path Classification

Every frontend path that can cause a server write must be classified.

Required classifications:

- `command-submit`: sends or can send a server write
- `intent-only`: emits an action/intention but does not submit
- `display-only`: renders server or presenter state
- `transport-guard`: blocks duplicate/in-flight/payload-shape/UI-ready only
- `domain-blocker`: blocks based on resources, era, cooldown, tech,
  march, candidate, territory, encounter, reward, boss, or loot
- `legacy-debt`: known old path awaiting migration

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
- civilization, tech, building, famous, territory, world march renderers
- panel action runners and panel presenters that attach `disabled` to write
  actions
- army formation editor and renderer paths
- compatibility tap/click paths that can consume `disabled` before dispatch

For every `disabled`, `can*`, `available`, `eligible`, `ready`, `busy`,
`cooldown`, `locked`, or `claimable` value on a command-capable action, the
classification must record both the producer and every dispatch consumer. A
display-only producer becomes a `domain-blocker` if any command path consumes it
to suppress submission.

Every direct frontend write submission must also be classified. This includes
all `GameAPI.*` write helpers and every call site that invokes `api.*`,
`getGameApi().*`, or a controller method that sends a write. Required
classifications:

- `through-client-command-sender`
- `legacy-direct-gameapi`
- `controller-direct-submit`
- `panel-direct-submit`
- `renderer-intent-only`
- `compatibility-direct-submit`
- `false-positive`

The classification must record endpoint, command type, payload source,
command id and idempotency support, producer action, dispatch consumer, and
whether domain display state can suppress the call. Introducing a future
`ClientCommandSender` does not retire this debt until the direct submit path is
proven to be a thin facade into the sender.

## 6. Client Local Block Policy

### 6.1 Allowed Local Blocks

Allowed local block reasons are exactly:

- `IN_FLIGHT`
- `DUPLICATE_COMMAND_ID`
- `PAYLOAD_SHAPE`
- `UI_NOT_READY`

Examples:

- missing `techId`
- missing `territoryId`
- missing `targetQ` or `targetR`
- command key already in-flight
- runtime not initialized enough to build an envelope

### 6.2 Forbidden Local Blocks

Forbidden local block reasons include:

- resources/cost insufficient
- era cannot advance
- tech unavailable
- cooldown not ready
- formation busy, except when the payload cannot identify a formation
- march route blocked
- march target too far
- territory mission not ready
- famous candidate unavailable
- reward already claimed
- encounter already gone

These may be displayed as hints. They may not prevent submission once the user
chooses to issue the command.

### 6.3 Required Split

UI display state and command submit state must be split.

Bad:

```js
{ type: 'research', techId, disabled: !canResearch }
```

Required staging shape:

```js
{
  type: 'research',
  techId,
  commandDisabled: false,
  visualDisabled: !canResearch,
  displayReason: disabledReason
}
```

Only `commandDisabled` may be consumed by command dispatch, and only for allowed
local block reasons.

If a current path only has one `disabled` flag, it must be treated as unsafe
until classified. A `disabled` flag may not be considered command-safe merely
because it is rendered by a button, panel, hit target, or canvas shell.

Forbidden domain reasons must not be re-labeled as `PAYLOAD_SHAPE` or
`UI_NOT_READY`. Missing `territoryId` is payload shape; local belief that a
territory mission is not ready is domain eligibility. Missing `formationSlot` is
payload shape; local belief that a formation is busy or marching is domain
eligibility.

## 7. Server Route Staging Rules

Before the full pipeline exists, routes may keep legacy execution, but they must
be made structurally visible.

Each write route must expose:

- normalized command type
- provisional command envelope
- provisional owner key
- whether the route currently owns locking
- whether the route currently owns persistence
- whether the route currently owns projection
- whether idempotency is absent, synthetic, or real

This data may initially be logged or returned under a debug-only/report-only
structure, but it must not be fabricated as if the route were already migrated.

The route staging report must follow helper wrappers. A route still owns
orchestration if a route-local helper, service facade, retry wrapper, or action
adapter performs any of these on its behalf:

- state load or projection load
- registry/handler dispatch
- domain validation
- state mutation
- revision conflict retry
- repository save or shared repository upsert
- response projection

Forbidden staging shortcuts:

- adding fake `ownerKey: player:{playerId}` to all commands without table review
- treating server-generated fallback command ids as proof of client idempotency
- moving `repository.save()` into a helper and claiming committer migration is done
- wrapping old route code in a function named `pipeline`
- making `BuildBuildingCommandHandler` the model for all commands while it still
  owns locks and persistence

## 8. Owner Key Draft Rules

A report-only owner resolver must be introduced before write migration.

It must be table-driven and tested. The first version may only report/validate,
but it must not run domain execution.

Required initial owner declarations:

| Command | Owner key |
| --- | --- |
| `build` | `player:{playerId}` |
| `upgrade` | `player:{playerId}` |
| `advanceEra` | `player:{playerId}` |
| `research` | `player:{playerId}` |
| `assign` | `player:{playerId}` |
| `claimEvent` | `player:{playerId}` unless event target becomes shared |
| `claimTaskReward` | `player:{playerId}` |
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
| `startWorldMarch` | `player:{playerId}` unless contesting shared encounter |
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

Commands with missing target ids must be owner-resolution failures, not fallback
to `player:{playerId}`.

Owner resolution for shared targets must declare the source field used to derive
the owner key. If the current payload only has coordinates, mission ids, battle
ids, or route-local state, the inventory must record the lookup needed to
resolve `territory:{territoryId}` or `encounter:{encounterId}` before domain
execution.

Shared owner lookup decisions must be explicit in a table before migration. For
each shared or potentially shared command, record:

- required payload id fields
- fallback lookup fields, if any
- lookup module or repository
- owner key type
- missing-target error
- whether lookup happens before domain validation
- whether coordinate-only, mission-id-only, battle-id-only, encounter-id,
  territory-id, or route-local-state input is accepted

Any command that needs domain handler execution to discover its shared owner is
not ready for pipeline migration. That gap is an owner-resolution blocker, not a
domain blocker.

## 9. Idempotency Staging Rules

Before real idempotency store migration, every write helper and route must be
classified:

- `client-idempotent`: client sends stable `commandId` and `idempotencyKey`
- `server-fallback-id`: server invents ids for legacy compatibility
- `non-idempotent`: no stable id available

Only `client-idempotent` may count as satisfying the main spec.

`server-fallback-id` is a compatibility mode, not a pass.

Any server-side fallback generated from a request id, timestamp, sequence, or
random value must be reported as `server-fallback-id`, even if it is placed in a
field named `commandId` or `idempotencyKey`.

Idempotency staging must also record whether a stable payload digest exists.
Same key with different payload must be classifiable before the route can be
considered ready for pipeline migration.

The staging work must add tests that fail if a new write helper is introduced
without envelope support.

## 10. Report-Only Checks Required Before Migration

The following checks must exist and run in architecture smoke as report-only:

Each check must declare the `COP-*` contract ids it covers from
`command-owner-pipeline-contract-test-spec-2026-07-09.md`.

1. `write-command-inventory` - every server/client write helper has inventory.
2. `client-command-domain-blockers` - finds write actions blocked by domain
   eligibility.
3. `client-disabled-command-path` - follows `disabled`/`can*`/`ready` values
   from renderers, presenters, shells, controllers, and panel runners into
   command dispatch.
4. `frontend-write-submission-path` - finds frontend write submissions that
   bypass the future universal command sender or retain inconsistent envelope
   and idempotency behavior.
5. `route-write-orchestration` - finds route-owned or helper-wrapped
   load/validate/execute/save/project/revision-retry work.
6. `handler-lock-persistence` - finds command/domain handlers acquiring locks or
   saving state.
7. `owner-key-coverage` - finds commands without provisional owner declaration.
8. `shared-owner-lookup-coverage` - finds shared or potentially shared commands
   whose owner cannot be resolved before domain execution.
9. `idempotency-coverage` - finds writes without command id/idempotency key.
10. `shared-owner-write-coverage` - finds territory, encounter, future loot, and
   future boss writes that lack a shared-owner declaration.
11. `allowlist-debt-record` - finds scanner allowlists or exclusions without an
   inventory entry, owner, reason, retirement condition, and growth-prevention
   test.
12. `server-fallback-id-classification` - finds fallback ids and ensures they do
   not satisfy client-idempotency requirements.

Existing `report-domain-business-candidates.js` remains useful, but it is too
broad to be the only guard. It must be supplemented by command-path-specific
checks.

Each check must include at least one anti-evasion fixture or assertion for the
fake-compliance pattern it is meant to prevent. A checker that only counts file
names or broad domain words is not sufficient.

## 11. Anti-Temporary-Fix Rules

The following are explicit violations:

- rename a method or file to avoid scanner patterns
- move code from renderer to presenter without changing command behavior
- mark a domain-blocked action as `payload-shape`
- treat a disabled UI button as proof that a command path is safe
- add allowlist entries without an inventory entry and migration note
- rename action strings, helpers, or adapter methods only to escape report
  patterns
- return success from client command sender without contacting server
- make the server accept missing owner target ids by silently using player owner
- add one-off idempotency only to a single new command
- create a second lock inside a feature handler
- hide legacy route writes behind a helper named `service` without pipeline
  ownership of lock and commit

Every exception must include:

- why it is temporary
- owner
- retirement condition
- test that prevents growth

## 12. Acceptance Criteria

This prerequisite spec is complete only when:

1. A command inventory covers every current write route and frontend write helper.
2. Report-only owner resolver covers every current write command.
3. Report-only idempotency coverage distinguishes real client keys from server
   fallback ids.
4. All client write paths have a `command-submit` or `intent-only`
   classification.
5. Known frontend domain blockers are listed with target refactor modules.
6. Route-owned orchestration debt is listed with migration order.
7. Handler-owned lock/save debt is listed with migration order.
8. Shared target owner decisions for territory and encounter are documented.
9. Architecture smoke runs the report-only checks.
10. No new allowlist or naming workaround is introduced without an explicit debt
    record.
11. Frontend direct write-submission bypasses are listed with target migration
    modules.
12. Shared owner lookup decisions declare source fields, lookup modules, and
    missing-target errors before domain validation.
13. The report-only checks are command-path-specific and include anti-evasion
    fixtures for disabled-path, direct-submit, allowlist, fallback-id,
    shared-owner-lookup, and helper-wrapper cases.
14. `scripts/report-domain-business-candidates.js` is not the only architecture
    smoke signal for command-owner readiness.

## 13. Initial Debt List From Current Review

Known prerequisite debt:

- `GameAPI.attachClientCommand()` only attaches command metadata for `build`.
- `CommandEnvelope` can create server fallback command ids, which are
  compatibility metadata and not real idempotency.
- `CanvasActionController.handle()` treats all `action.disabled` as a local block.
- `CanvasActionDispatcher.handle()` drops disabled actions before command
  dispatch.
- `CanvasPanelActionRunner.run()` drops disabled actions before command
  dispatch.
- `CanvasGameShell.handleTap()` swallows disabled actions before dispatch.
- `CanvasGameApp` compatibility tap paths can return before command submission
  when a target is disabled.
- direct frontend write submissions through `api.*`, `getGameApi().*`,
  controllers, panel runners, or game-body helpers need a bypass inventory until
  they are proven to be thin facades into a universal command sender.
- civilization advance uses local `canAdvanceEraNow()` as a hard command blocker.
- tech research hit targets use local `canResearch` as command `disabled`.
- building hit targets use local button/cost state as command `disabled`.
- world march HUD suppresses command targets when local passability says blocked.
- world march formation picker marks busy/blocked formations as command disabled.
- world site presenter only emits `claimConquest` when local mission state is
  ready.
- famous-person presenter and panel flows can rely on local candidate
  availability before submit.
- `/api/game/action` still owns load/validate/execute/save/project.
- `/api/game/tasks/claim` still owns claim/save/project.
- `/api/game/heartbeat` writes march settlement/report state in route code.
- `/api/buildings/build` is a legacy route-owned write path.
- `/api/player/login` and `/api/player/reset` own lock, persistence, and
  projection through route callbacks.
- client events and client operation log ingestion write diagnostic state and
  need inventory classification.
- realtime/world worker writes that mutate player or shared world state need
  inventory classification.
- `BuildBuildingCommandHandler` owns lock and persistence.
- `CommandTrace` does not yet include owner key, idempotency status, queue wait,
  execution duration, and response status for all command paths.
- `CommandReplayCorrelation` and `CommandAuthorityContract` exist but are not
  universal command pipeline stages yet.
- world combat bypasses registry and owner resolution.
- shared encounter updates use `worldEncounterRepo.upsertEncounter()` without
  `encounter:{id}` owner serialization.
- world combat session/encounter services can persist shared encounter state
  without an owner-lock abstraction.
- territory actions still run through player-state route/registry flow instead
  of a reusable `territory:{territoryId}` owner abstraction for shared targets.
- `scripts/report-domain-business-candidates.js` is broad report-only detection
  and does not prove command-path migration readiness by itself.

## 14. Required Execution Slices

Every slice must produce evidence mapped to `COP-*` contract ids from
`command-owner-pipeline-contract-test-spec-2026-07-09.md`.

### Slice A: Inventory And Classifications

- Add command inventory.
- Add server write-entry classification.
- Add frontend command-path classification.
- Add frontend write-submission bypass classification.
- Add client local-block policy classification.
- Add owner-key declaration draft.
- Add shared owner lookup decision table.
- Add idempotency classification.
- Add shared-target owner decision records.

No behavior change.

### Slice B: Command-Path-Specific Reports

- Add `write-command-inventory`.
- Add `client-command-domain-blockers`.
- Add `client-disabled-command-path`.
- Add `frontend-write-submission-path`.
- Add `route-write-orchestration`.
- Add `handler-lock-persistence`.
- Add `owner-key-coverage`.
- Add `shared-owner-lookup-coverage`.
- Add `idempotency-coverage`.
- Add `shared-owner-write-coverage`.
- Add `allowlist-debt-record`.
- Add `server-fallback-id-classification`.

No behavior change.

### Slice C: Anti-Evasion Fixtures

- Add scanner-rename fixture or assertion.
- Add allowlist-growth fixture or assertion.
- Add fallback-id fake-compliance fixture or assertion.
- Add frontend direct-submit bypass fixture or assertion.
- Add payload-shape reclassification fixture or assertion.
- Add helper-wrapper fake-pipeline fixture or assertion.
- Add shared-owner lookup-after-domain fixture or assertion.
- Add missing-shared-target-id fallback fixture or assertion.
- Add handler lock/save helper-call fixture or assertion.

No behavior change.

### Slice D: Step2 Admission Package

- Produce a reviewable evidence package showing:
  - every write route and frontend write helper is inventoried
  - every frontend direct submit path is inventoried
  - every current action has owner-key coverage or an explicit blocker
  - every shared owner lookup source and missing-target error is explicit
  - every id/idempotency gap is classified
  - route-owned orchestration remains visible
  - handler-owned lock/save debt remains visible
  - shared territory and encounter decisions are explicit
  - every exception has owner, reason, retirement condition, and growth test
  - `scripts/run-architecture-smoke.js` runs the report-only checks

No behavior change.

## 15. Explicit Non-Goals For Step1

Step1 must not implement the formal command pipeline.

The following work belongs to
`step3-command-owner-pipeline-implementation-spec-2026-07-09.md`, after Step2
admission passes:

- introducing `ClientCommandSender`
- changing frontend command behavior so invalid clicks reach the server
- adding the real idempotency store
- adding `CommandExecutionPipeline`
- migrating `BuildBuildingCommandHandler` out of lock/save ownership
- migrating `/api/game/action`, `/api/game/tasks/claim`, `/api/game/heartbeat`,
  `/api/buildings/build`, `/api/player/login`, or `/api/player/reset`
- adding non-player owner-lock infrastructure
- migrating territory or encounter writes to shared owner locks

## 16. New Window Review Checklist

A new review must answer:

1. Does the prerequisite spec cover every current write path?
2. Can it be implemented without weakening the 2026-07-09 main spec?
3. Are any proposed scanner changes merely renames or allowlist escapes?
4. Are domain eligibility blockers separated from transport blockers?
5. Are server fallback ids clearly marked as non-compliant compatibility?
6. Are route-owned saves still visible after any refactor?
7. Are shared target owner keys explicit and testable?
8. Does every debt item have a retirement path?
9. Does architecture smoke include all command-path-specific report-only checks?
10. Could the current prerequisite pass while command submission, owner
    resolution, idempotency, or shared-owner locking is still only cosmetically
    represented?
