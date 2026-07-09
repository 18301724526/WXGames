# Command Owner Pipeline Contract Test Spec

Status: Draft v0.7, contract test oracle for Step1-Step3
Date: 2026-07-09
Scope: testable command-owner contracts for write-command concurrency, owner routing, idempotency, frontend/game adaptation

Changelog:
- v0.7 (2026-07-10): §4.4.1 decision RATIFIED (owner delegated the architecture call to
  the supervising reviewer with a zero-debt mandate): **option (a) cross-process owner
  locks**, implemented by GENERALIZING the already-proven SQLite lease-lock pattern —
  `player_state_locks(playerId)` becomes `owner_locks(ownerKey)` behind one
  `withOwnerLocks(ownerKeys[], ...)` entry (canonical lexicographic multi-lock order,
  all-or-nothing acquisition, TTL lease reclaim). `withPlayerStateLock` becomes a thin
  delegate; no parallel lock systems remain. Cross-process acceptance tests required.
  Full design contract in `step3-phase2-7-overnight-order-2026-07-10.md`.
- v0.6 (2026-07-09): added the second-writer / multi-process clause to §4.4 after a
  feasibility review found the §8 acceptance tests are single-process only while march
  settlement runs in a separate worker process. Records an owner-ratification-required
  decision between cross-process owner locks and a single-process deployment constraint.

## 0. Document Role

This document is not an implementation step. It is the contract-test oracle for
the Command Owner Pipeline.

Each invariant in this document must be traceable to checks in later documents:

- Step1 implements report-only probes, classifications, and anti-evasion
  fixtures for these contracts.
- Step2 admits or rejects whether those probes are strong enough to prevent fake
  compliance.
- Step3 implements the formal command owner pipeline and upgrades the relevant
  probes into blocking gates.

Formal pipeline implementation must not begin from this document alone. If Step1
or Step2 is incomplete, return to the prerequisite stage instead of weakening any
contract below.

## 1. Non-Negotiable Principle

The server command pipeline is the architectural source of truth.

The server must not compromise its command ownership, locking, idempotency, validation, persistence, or observability model to fit current frontend or game-body convenience. Frontend, canvas UI, panels, renderers, and game app code must adapt to the server contract.

If a current game feature cannot fit this contract, the feature code is the refactor target. The server contract is not weakened to preserve old client flow.

## 2. Problem Statement

The game is moving toward shared-world MMO-style behavior: today this includes territory and world encounters; later it may include treasure chests, bosses, shared rewards, faction actions, and other contested targets.

If concurrency is handled per feature, every new feature will copy a new version of locking and duplicate-submit handling:

- territory claim concurrency
- wild encounter concurrency
- chest claim concurrency
- boss concurrency
- reward claim concurrency

That path becomes maintenance hell. Concurrency must be command infrastructure, not gameplay logic.

The current backend already has strong pieces: player state locks, revision conflict handling, command traces, and command replay correlation. The problem is that they are not yet one uniform pipeline. Some routes still assemble load/validate/execute/save themselves, some actions bypass the command handler shape, and the frontend still sends many writes as thin API calls without a universal command envelope.

## 3. Core Invariants

1. `COP-OWNER-001`: Every write command has exactly one primary owner key before
   domain execution.
2. `COP-LOCK-001`: Same owner key is serialized; different owner keys may run
   concurrently under global capacity limits.
3. `COP-CONCURRENCY-001`: No route, feature handler, renderer, panel, or client
   method may invent its own concurrency policy.
4. `COP-HANDLER-001`: Domain handlers do not acquire locks. They execute inside
   a pipeline-owned owner context.
5. `COP-IDEMP-001`: Idempotency is required for every write command, not only
   selected commands.
6. `COP-CLIENT-001`: Frontend may block duplicate in-flight transport for the
   same command key, but it must not block server commands based on domain
   eligibility such as resources, tutorial step, cooldown, era, march arrival,
   or candidate availability.
7. `COP-TIME-001`: Client time is never authoritative. Server time and persisted
   revisions are authoritative.
8. `COP-AUTHORITY-001`: Server action validators remain the final authority even
   when the client performs in-flight locking.
9. `COP-PROJECTION-001`: Read/view projection can be optimized independently,
   but write correctness never depends on frontend projection freshness.

### 3.1 Contract Test Matrix

Every Step1 task, Step2 admission finding, and Step3 implementation task must
cite one or more contract ids from this matrix.

| Contract id | Contract | Step1 report-only probe | Step2 admission rule | Step3 blocking gate |
| --- | --- | --- | --- | --- |
| `COP-ENTRY-001` | Every server and client write entry is inventoried before migration. | `write-command-inventory` | Missing write entries fail admission. | New writes cannot merge without inventory and command envelope coverage. |
| `COP-ENVELOPE-001` | Every write command carries `commandId` and `idempotencyKey`. | `idempotency-coverage` plus client command-path inventory | Missing or partial envelope support fails admission unless explicitly classified as debt. | Command gateway rejects writes without required envelope fields. |
| `COP-IDEMP-001` | Server fallback ids are compatibility metadata, not real idempotency. | `server-fallback-id-classification` | Fallback ids cannot satisfy idempotency coverage. | `CommandIdempotencyStore` accepts only stable client idempotency keys or approved migration records. |
| `COP-OWNER-001` | Every write command resolves exactly one owner key before domain execution. | `owner-key-coverage` | Missing owner declarations fail admission. | Pipeline rejects commands with no owner key. |
| `COP-OWNER-002` | Missing shared target ids cannot fall back to `player:{playerId}`. | `owner-key-coverage` plus `shared-owner-lookup-coverage` shared-target fixtures | Fake `player:{playerId}` fallback and owner lookup after domain execution fail admission. | Owner resolver rejects missing territory, encounter, loot, or boss target ids. |
| `COP-SHARED-001` | Shared targets use explicit owner abstractions, not player-only serialization. | `shared-owner-write-coverage` plus `shared-owner-lookup-coverage` | Territory and encounter decisions must be explicit; future loot and boss owners must be modeled. | Shared writes use owner-lock infrastructure for `territory`, `encounter`, `loot`, and `boss` owner types. |
| `COP-LOCK-001` | Same owner key is serialized by pipeline-owned owner locks. | route and handler lock visibility reports | Feature-owned lock growth fails admission. | Migrated writes execute inside `OwnerQueue` or `OwnerLock`; feature handlers cannot acquire substitute locks. |
| `COP-HANDLER-001` | Domain handlers do not own locks or persistence after migration is claimed. | `handler-lock-persistence` | Handler lock/save debt must remain visible until retired. | Architecture smoke fails migrated handlers that call lock/save helpers. |
| `COP-ROUTE-001` | Routes do not own load, validate, execute, save, retry, or project after migration is claimed. | `route-write-orchestration` | Helper wrappers named like `service`, `adapter`, or `pipeline` do not count as migration. | Migrated write routes enter `CommandExecutionPipeline`; route-local orchestration is blocked. |
| `COP-CLIENT-001` | Client display eligibility cannot suppress command submission. | `client-command-domain-blockers` and `client-disabled-command-path` | Domain blockers relabeled as `PAYLOAD_SHAPE` or `UI_NOT_READY` fail admission. | `ClientCommandSender` is the only write submission path, with only transport-shape local blocks. |
| `COP-CLIENT-002` | Panels, renderers, and game body emit intents; they do not own command execution. | frontend command-path classification plus `frontend-write-submission-path` | Hidden write helpers, direct submit bypasses, or compatibility click paths fail admission. | All frontend writes route through the universal client command sender. |
| `COP-TIME-001` | Client time is trace/display only. | client command-path and payload-shape reports | Client-time authority in command success logic fails admission. | Server validators ignore client timestamps for domain success. |
| `COP-TRACE-001` | Command trace includes owner, idempotency, queue, duration, and outcome evidence. | trace coverage report or inventory field | Missing trace fields must be explicit debt. | Migrated pipeline emits complete `CommandTrace` records. |
| `COP-ALLOWLIST-001` | Exceptions require owner, reason, retirement condition, and growth-prevention test. | `allowlist-debt-record` | Broad allowlists or exclusions fail admission. | Architecture smoke blocks exception growth without debt records. |

## 4. Target Pipeline

All write commands flow through one server-side pipeline:

```text
HTTP/WebSocket route
  -> CommandGateway
  -> CommandEnvelopeNormalizer
  -> CommandOwnerResolver
  -> CommandIdempotencyStore
  -> OwnerQueue/OwnerLock
  -> StateLoader
  -> DomainValidator
  -> DomainHandler
  -> Committer
  -> ProjectionBuilder
  -> Response
```

### 4.1 CommandGateway

Responsibilities:

- authenticate player
- reject malformed transport payloads
- normalize the raw request into a command envelope
- apply cheap global and per-player rate limits
- never run gameplay rules
- never write game state

### 4.2 CommandEnvelopeNormalizer

Every write command becomes:

```js
{
  schema: 'game-command-v1',
  commandId: 'client-or-server-generated-stable-id',
  idempotencyKey: 'stable-key-for-retry-dedup',
  playerId: 'player-id',
  type: 'advanceEra',
  payload: {},
  client: {
    requestId: 'api-123',
    clientSequence: 123,
    clientInputIntent: null
  }
}
```

Rules:

- `commandId` is required for all writes.
- `idempotencyKey` is required for all writes.
- The client can generate these ids, but the server validates and records them.
- Server-generated fallback ids are compatibility metadata only. They must be
  classified as `server-fallback-id` during staging and must not count as real
  idempotency compliance.
- Client input intent is trace evidence, not authority.
- Client timestamps are trace-only. They must not decide domain success.

### 4.3 CommandOwnerResolver

This layer maps command type and payload to the primary owner key.

Examples:

| Command | Owner key | Notes |
| --- | --- | --- |
| `advanceEra` | `player:{playerId}` | private player state |
| `build` | `player:{playerId}` | private player/city state unless city becomes shared-world owned |
| `research` | `player:{playerId}` | private player tech state |
| `seekFamousPerson` | `player:{playerId}` | private roster/candidate state |
| `acceptFamousPerson:{candidateId}` | `player:{playerId}` | current design: private candidate list |
| `startWorldMarch` | `player:{playerId}` | mission belongs to player until it contests a shared encounter |
| `claimConquest:{territoryId}` | `territory:{territoryId}` | shared target owner |
| `resolveCapture:{territoryId}` | `territory:{territoryId}` | shared target owner |
| `startWorldCombat:{encounterId}` | `encounter:{encounterId}` | shared encounter owner when encounter is shared |
| `openChest:{chestId}` | `loot:{chestId}` | future shared loot owner |
| `attackBoss:{bossId}` | `boss:{bossId}` | future boss owner |

Owner resolution is declarative data plus small pure resolver functions. It must be unit-tested as a table. Gameplay handlers must not decide owner keys.

### 4.4 OwnerQueue / OwnerLock

Behavior:

- Same owner key: serialized.
- Different owner keys: may run concurrently.
- Queue depth has a threshold. Past the threshold, return `409 OWNER_BUSY`, `429 RATE_LIMITED`, or `202 QUEUED` depending on command policy.
- Lock wait time, execution time, queue length, owner key, and command id are traced.

Implementation may initially reuse the existing player state lock for `player:{playerId}`. Shared owners require a separate owner-lock abstraction; feature code must not copy `withPlayerStateLock`.

#### 4.4.1 Second-writer / multi-process serialization (DECISION REQUIRED — owner ratification)

The §8 acceptance tests are written for a single process. This system has a **second
writer**: march settlement runs in a separate worker process (heartbeat/worker leg,
separate from the API request process). An in-memory `OwnerLock` living in the API
process does **not** serialize against a concurrent write from the worker process, so
`COP-LOCK-001`/`COP-CONCURRENCY-001` are not actually guaranteed for any owner key that
both processes can write (notably `player:{playerId}` march state, and any shared
`encounter:{encounterId}` the worker settles).

Two acceptable resolutions; the owner must ratify one before Step3 Phase 4/6 relies on
owner locks:

- **(a) Cross-process owner locks (recommended default).** Back the owner lock/queue
  with a shared store both processes see (e.g. a `better-sqlite3` owner-lock table with
  the existing DB, matching current persistence). §8 must then add a cross-process
  acceptance test: an API write and a worker write on the same owner key serialize, not
  interleave. This keeps the pipeline correct under the existing two-process deployment.
- **(b) Single-process deployment constraint.** Declare and enforce that all writers for
  a given owner key run in one process (e.g. move march settlement into the API process,
  or route all owner-locked writes through one writer). Then the in-memory lock is
  sufficient, but the constraint must be an explicit, tested invariant — not an unstated
  assumption.

Until ratified, any Step3 lock work must cite which option it implements. An in-memory
lock that silently assumes single-process is a `COP-LOCK-001` compliance gap, not
compliance.

### 4.5 Idempotency

The idempotency store records:

```js
{
  playerId,
  commandId,
  idempotencyKey,
  ownerKey,
  status: 'in_progress' | 'committed' | 'rejected' | 'failed',
  responseDigest,
  responsePayload,
  createdAt,
  updatedAt
}
```

Behavior:

- Same `idempotencyKey` while in progress: return `202 IN_PROGRESS` or `409 COMMAND_IN_FLIGHT`.
- Same `idempotencyKey` after commit: return the recorded response, not execute again.
- Same key with different payload digest: reject as `409 IDEMPOTENCY_KEY_CONFLICT`.
- Retry after network timeout must not duplicate resource spend, reward grant, tutorial progress, or ownership transfer.

### 4.6 DomainValidator and DomainHandler

Validators answer whether the command is legal against authoritative current state.

Handlers apply the state transition.

They must not:

- acquire locks
- know route details
- inspect frontend UI state
- use client time as authority
- return partial state mutations for routes to manually patch

They should return structured results:

```js
{
  success: true,
  events: [],
  mutations: [],
  response: {}
}
```

The first implementation may mutate existing in-memory state objects for compatibility, but the contract moves toward explicit mutation/result objects.

### 4.7 Committer

The committer owns persistence:

- save authoritative state
- update revisions
- persist idempotency result
- publish events after commit
- handle revision conflicts uniformly

Routes and feature handlers must not call `repository.save()` directly for write commands once migrated.

### 4.8 ProjectionBuilder

Projection is response construction, not validation.

The projection may include updated game state, panel state, task center, world map state, or command trace. It must not decide if the command should have been allowed.

## 5. Frontend and Game-Body Contract

Frontend and game code adapt to the server pipeline.

### 5.1 Allowed Client-Side Blocking

The client may block only non-domain transport or UI conditions:

- same command key is already in-flight
- same command id was already sent from this runtime
- payload shape is incomplete, such as missing `targetId`
- UI is not initialized enough to form a command envelope
- local debounce for text input or drag streams

The intended policy is in-flight locking:

```text
click
  -> build command envelope
  -> mark commandKey in-flight
  -> send request
  -> response/error/timeout/final retry state
  -> release commandKey
```

This lock is not a business rule. It only prevents duplicate transport for the same command before the server responds.

### 5.2 Forbidden Client-Side Blocking

The client must not block writes based on domain eligibility:

- resources are insufficient
- tutorial step is not reached
- era cannot advance
- tech cannot research
- cooldown has not ended
- march has not arrived
- famous person cannot be accepted
- territory cannot be claimed
- boss/chest/encounter has already been claimed

The client may display stale local hints, but when the player submits a command, the command goes to the server unless a non-domain transport/UI blocker applies.

### 5.3 Required Client Envelope Support

All write helpers in `GameAPI` must send command envelope fields consistently. Current one-off support for only `build` is not enough.

Client command sending should become a single path:

```text
Canvas action / game method
  -> ClientCommandSender.submit(type, payload, options)
  -> GameAPI.request(command envelope)
```

Panel and renderer code must emit intents only. They must not own command execution or command eligibility.

### 5.4 Client Response Handling

The game must accept these server outcomes as normal:

- success
- domain rejection (`400/403`)
- busy (`409 OWNER_BUSY` / `PLAYER_STATE_BUSY`)
- rate limited (`429`)
- queued (`202`)
- idempotent replay (`200` or `202` with previous command result)

The client renders the response and releases in-flight state according to command status. It must not assume every click returns immediate success.

## 6. Time Authority

Server time is authoritative.

Client time may be used for animation, local countdown display, and latency display only. It must not decide command success.

For countdown UI, the client may estimate:

```text
estimatedServerNow = serverNowAtReceipt + monotonicElapsedSinceReceipt
```

This estimate is display-only. If the estimate is missing or stale, the client still sends the command and lets the server reject or accept.

## 7. Observability

Every command trace must include:

- commandId
- idempotencyKey
- playerId
- command type
- ownerKey
- requestId
- state revision before and after
- idempotency status
- owner queue wait time
- execution duration
- validator result
- commit result
- response status

Client local in-flight blocking must be logged to `ClientOperationLog` with:

- command type
- command key
- reason: `IN_FLIGHT`, `DUPLICATE_COMMAND_ID`, `PAYLOAD_SHAPE`, or `UI_NOT_READY`
- no domain reason

If a local block reason contains domain words like `resources`, `tutorial`, `era`, `cooldown`, `research`, `march`, `candidate`, or `territory`, it is a violation.

## 8. Acceptance Tests

### 8.1 Server Unit Tests

- owner resolver maps every write command to exactly one owner key
- owner resolver rejects missing required target ids
- idempotency same key + same payload returns stored result
- idempotency same key + different payload rejects conflict
- same player private writes execute serially
- different player private writes can execute concurrently under capacity limits
- same shared owner writes execute serially
- shared owner queue overflow returns expected busy/rate-limit response
- domain handler cannot be called outside owner context

### 8.2 Server Integration Tests

- one player sends 100 duplicate `advanceEra` commands: at most one state transition
- one player sends 100 duplicate reward claims: reward granted at most once
- 100 players send private commands: no global single queue behavior
- 100 players contest one territory: one ordered owner stream, no double ownership
- network timeout + retry with same idempotency key: no duplicate mutation
- stale revision retry: clean `409` or idempotent replay, no 500

### 8.3 Frontend Tests

- write command creates commandId and idempotencyKey
- same command key is blocked only while in-flight
- in-flight lock releases on success, domain rejection, busy, rate-limit, timeout finalization
- frontend does not block `advanceEra` on `canAdvanceEraNow`
- frontend does not block `research` on local `canResearch`
- frontend does not block famous-person accept on local candidate availability
- renderer/panel files emit intents and do not submit commands directly

### 8.4 Load Tests

- single-player duplicate storm
- multi-player private-command storm
- shared-target contest storm
- mixed private + shared workload
- queue-depth threshold behavior
- p50/p95/p99 latency, owner wait time, DB write time, event loop delay, and error ratios

## 9. Contract Enforcement Sequence

This document does not own code tasks. It defines the contract ids that later
documents must probe, admit, implement, and eventually enforce.

### Step1: Prerequisite Staging Implementation

`step1-command-owner-pipeline-prerequisite-staging-spec-2026-07-09.md` and
`step1-command-owner-pipeline-prerequisite-staging-tasks-2026-07-09.md` must
make current write paths visible, classified, reportable, and protected against
fake compliance.

Step1 owns report-only probes for:

- command inventory
- client command-path classification
- frontend write-submission bypass classification
- local block policy classification
- route orchestration visibility
- handler lock/save visibility
- owner-key draft coverage
- shared owner lookup coverage
- idempotency classification
- shared-owner write coverage
- allowlist debt records
- server fallback-id classification
- anti-evasion fixtures

### Step2: Prerequisite Admission Gate

`step2-command-owner-pipeline-prerequisite-admission-spec-2026-07-09.md` and
`step2-command-owner-pipeline-prerequisite-admission-tasks-2026-07-09.md` must
admit or reject the Step1 prerequisite stage against the contract ids in this
document.

If Step2 fails, the project must revise Step1 evidence or checks before any
formal pipeline implementation begins.

### Step3: Formal Pipeline Implementation

`step3-command-owner-pipeline-implementation-spec-2026-07-09.md` and
`step3-command-owner-pipeline-implementation-tasks-2026-07-09.md` own the formal
implementation sequence after Step2 passes and must cite the contract ids they
turn from report-only probes into blocking gates:

- client command semantics split
- universal `ClientCommandSender`
- universal command envelope
- `CommandOwnerResolver`
- `CommandIdempotencyStore`
- `CommandExecutionPipeline`
- route and handler migration
- shared owner locks for territory, encounter, future loot, and future boss
- conversion of report-only checks into blocking architecture gates

## 10. Current Code Audit Against This Spec

### 10.1 Already Useful Server Pieces

- `GameStateRepository.withPlayerStateLock()` exists and is tested through repository tests.
- Routes already return `PLAYER_STATE_BUSY` for player lock timeouts in several places.
- `BuildBuildingCommandHandler` already looks like the intended command-handler direction: trace phases, lock, load, validate, execute, persist, project.
- `CommandTrace` already captures phases and revisions.
- `CommandReplayCorrelation` and `CommandAuthorityContract` already support request/client-input/authority correlation.
- `GameAPI.request()` already generates request ids and records API request/response/error entries.

These are kept. The target is to make them universal.

### 10.2 Server Gaps

1. `/api/game/action` still performs command orchestration directly in `backend/routes/gameRoutes.js`.
   - It loads state, syncs tutorial, validates tutorial, executes registry action, writes tutorial, saves state, and builds response in the route.
   - This should move into `CommandExecutionPipeline`.

2. `backend/routes/buildingRoutes.js` still has a legacy write route.
   - It calls `BuildingActionService.build`, writes `gameState.tutorial`, saves, and builds response locally.
   - This duplicates the command-handler path and should be retired or routed into the same pipeline.

3. `GameActionRegistry` maps action strings to handlers but does not declare owner keys.
   - It currently knows actions but not concurrency ownership.
   - Owner resolution must be a separate required layer before execution.

4. `WORLD_COMBAT_ACTIONS` bypass the normal registry path in `gameRoutes.js`.
   - This may be reasonable temporarily, but under this spec it still needs owner keys and pipeline execution.

5. Idempotency is not universal.
   - The frontend only attaches `clientCommand` for `build`.
   - The backend command idempotency store is not yet the mandatory entry point for all writes.

6. Shared owner locks are not generalized.
   - Player locks exist.
   - Shared target owners such as `territory:{id}`, `encounter:{id}`, future `loot:{id}`, and `boss:{id}` are not yet a common infrastructure layer.

### 10.3 Frontend/Game Gaps

1. `GameAPI` write helpers are thin direct request wrappers.
   - They do not consistently build command envelopes.
   - They do not centralize in-flight command policy.

2. `CanvasGameApp.advanceEra()` blocks the command using local domain eligibility.
   - The command path calls `canAdvanceEraNow()` and returns before contacting the server.
   - Under this spec, that is not allowed. The client may display a disabled hint, but command submission must not be blocked by era/tutorial/resource eligibility.

3. Write command execution is spread across `CanvasGameApp`, `CanvasActionController`, panel flows, and `GameAPI`.
   - There is no single `ClientCommandSender`.
   - This makes it hard to guarantee command ids, in-flight locks, and log coverage.

4. Some presenter/renderer code still computes business-shaped display decisions.
   - Some of this is acceptable as display projection, but it must not feed command blocking.
   - Any display-derived verdict used to prevent command submission is a violation.

5. Panel and renderer architecture is improving, but command submission is still mixed with UI flow.
   - Renderers should emit intent.
   - Panels should handle panel-local state.
   - Command submission should go through one client command sender.

### 10.4 Current Risk Summary

Highest priority risks:

- frontend domain eligibility blocking can make server logs silent for rejected client decisions
- route-owned write orchestration duplicates command infrastructure
- no universal owner key before command execution
- no universal idempotency for writes
- shared target concurrency is not yet a reusable primitive

Medium priority risks:

- UI and panel code can hide command sequencing inside presentation flow
- renderer/presenter business-shaped calculations may be mistaken for authority
- operation traces exist but are not yet complete across all command phases

## 11. Decision Summary

This project should optimize pressure by server-side command infrastructure, not by duplicating domain eligibility in frontend code.

Frontend pressure reduction is limited to in-flight duplicate blocking, command idempotency, payload shape checks, and UI readiness. Domain legality belongs to server validators running inside the owner pipeline.

The game body must adapt to this server model. The server must not adapt its correctness model to current game-body shortcuts.
