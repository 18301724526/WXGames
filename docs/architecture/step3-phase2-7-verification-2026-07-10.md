# Step3 Part 0 + Phases 2-7 Verification

Status: **IN PROGRESS, 2026-07-10.** This record is updated only from executed commands.
End-to-end claims require a real local server process and same-run health evidence.

## Baseline

- Branch: `main`.
- Baseline commit: `4711ef009f0d6bce53134a96b327f11eb16362ab`.
- `origin/main`, `private/main`, and local `HEAD` matched before work began.
- `git pull --ff-only origin main`: already up to date.
- Baseline `npm test`: 2282/2282 passed.
- Baseline `npm run lint`: passed.
- Baseline `node scripts/run-architecture-smoke.js`: exit 0.
- Baseline Step1 inventory drift: 0.
- `resource-node`: path is absent from this workspace; no file under that path was created or touched.

Frozen blob baseline:

- `frontend/js/platform/CanvasPanelActionRunner.js`:
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`
- `frontend/js/platform/CanvasPanelActionRunner.test.js`:
  `c6f92374db9189e5d48792365c48ad1d7669a36e`
- `frontend/js/platform/CanvasPanelCompatibilityRetirement.test.js`:
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`

## Part 0

Contracts: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-AUTHORITY-001`.

### P0-1 Server Formation Validation

- `startWorldMarch` now uses `shared/formationDeploymentEligibility.js` for every
  non-combat march after tutorial formation lookup.
- Empty formation returns structured HTTP 400 result:
  `FORMATION_EMPTY` / `编队为空，无法出征`.
- Primary general with zero soldiers returns:
  `FORMATION_PRIMARY_NO_SOLDIERS` / `主将未配置士兵，无法出征`.
- Existing world-combat-specific deployment errors remain unchanged.
- Route tests cover empty formation HTTP 400 and a soldiered primary HTTP 200.

### P0-2 Honest Real-Server Re-verification

Reproducible command:

```powershell
node scripts/verify-step3-part0-real-server.js --output docs/architecture/evidence/step3-part0-real-server-2026-07-10.json
```

The script starts the real `backend/server.js`, publishes a temporary matched config release
through production modules, uses temporary SQLite files, logs in through the real route, prepares
state through the real `GameStateRepository`, sends the real HTTP command, and stops the process.
No mock/stub server or route is used.

Captured same-run facts:

- PID `144888`, port `51766`, entry `backend/server.js`.
- `/api/health`: HTTP 200, git commit `4711ef009f0d6bce53134a96b327f11eb16362ab`,
  config runtime `matched`, gate mode `required`.
- `POST /api/game/action` raw body:
  `{"action":"startWorldMarch","targetQ":1,"targetR":0,"cityId":"capital","formationSlot":1}`.
- Actual command result: HTTP 400, `FORMATION_EMPTY`, `编队为空，无法出征`.
- Raw request headers/body and raw response headers/body are stored verbatim in
  `docs/architecture/evidence/step3-part0-real-server-2026-07-10.json`.
- Spawned PID was absent after capture; recorded termination signal: `SIGTERM`.
- The invalid Phase 1 D1 record was explicitly corrected and replaced in
  `step3-phase1-client-command-semantics-verification-2026-07-10.md`.

### P0-3 Guard Coverage

- `CanvasGameShell.startWorldMarch`, `returnWorldMarch`, and `stopWorldMarch` are included in
  `DISPATCH_METHODS` structural inspection.
- A domain-conditioned ternary now fires when either branch replaces a command action with any
  different action type; detection is no longer limited to `blockCanvasModal`.
- `GuideTaskCanvasRenderer` no longer derives claim/navigation action type from `claimable`; it
  consumes the presenter-owned action and keeps only a non-command navigation fallback.

Novel temporary FIRE probes injected into actual source:

```text
frontend/js/platform/CanvasActionDispatcher.js:51 command action startWorldMarch conditionally replaced by openSettings
frontend/js/platform/CanvasGameShell.js:1502 domain-conditioned early return in returnWorldMarch
```

Both probes produced exit code 1, were removed immediately, and the guard then printed
`client command block reason guard passed`. `git diff --check` remained clean.

### P0-4 Deputy Warning Confirm Reachability

- The Shell `startWorldMarch` forwarder now re-enters `CanvasActionController`, so the existing
  `WorldMarchActionHandler` deployment warning is on the live tap path.
- Live-path test proves a deputy with zero soldiers opens
  `worldMarchDeploymentWarning`, performs no submit before confirmation, and submits exactly once
  after `confirmWorldMarchDeployment`.

### Part 0 Gate

Focused tests:

- World route/service, Shell live path, renderer action ownership, and guard tests: 142/142 passed.
- Shared formation error mapping plus world-explorer architecture budget: 42/42 passed.

Iteration note: the first full test attempt passed all behavior tests but failed the existing
`WorldExplorerActions.js < 500 lines` architecture budget. The error mapping was moved into the
shared eligibility module; `WorldExplorerActions.js` ended at 498 lines. The final gate below is
the result after that correction.

Final gate:

- `npm test`: 2286/2286 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0.
- `node scripts/report-command-owner-step1.js`: inventory drift findings 0.
- `node scripts/check-source-encoding.js`: violations 0.
- Changed and untracked files checked after writing this record: 15, all LF-only.
- `git diff --check`: passed.
- Frozen working-tree blob hashes equal the baseline hashes above.
- Real-server verification command: exit 0.
- Temporary FIRE probes removed; production guard passes.

## Phase 2

Status: **COMPLETE.** Contracts: `COP-ENTRY-001`, `COP-ENVELOPE-001`,
`COP-CLIENT-001`, `COP-CLIENT-002`, `COP-IDEMP-001`.

### Universal Client Command Sender

- Added `ClientCommandSender.submit(type, payload, options)` as the only frontend write sender.
- Every submission receives a client-generated `game-command-v1` envelope with stable
  `commandId`, `idempotencyKey`, command type, payload, client sequence, request id, and compact
  client input evidence.
- Command keys use canonical payload hashing and ignore trace-only `clientInputIntent`, so two
  equivalent writes cannot evade in-flight transport dedup by carrying different tap evidence.
- The sender blocks only `IN_FLIGHT`, `DUPLICATE_COMMAND_ID`, `PAYLOAD_SHAPE`, or `UI_NOT_READY`,
  records the block in `ClientOperationLog`, and releases both command-key and command-id state in
  `finally` for success, domain rejection, busy, rate-limit, queued, replay, and final timeout.
- A final-timeout retry can explicitly reuse the same `commandId` and `idempotencyKey`.

### GameAPI Facades And Inventory

- All 32 Step1-inventoried write helpers are thin facades into `ClientCommandSender`.
- The 29 game writes, heartbeat report POST, client-event ingest, and operation-log ingest all
  carry the same client envelope. A heartbeat without a report remains a read-only GET.
- Diagnostic writes preserve their existing non-throwing failure contract.
- `GameAPI.request` rejects non-read requests without the sender's private transport token.
- `ClientCommandSender.js` loads before `GameAPI.js` in the browser manifest.
- Step1 inventory now classifies all helpers and their 54 callers as
  `through-client-command-sender` / `client-idempotent`; scanner reconciliation remains drift-free.

### Blocking Guard And FIRE Probe

Added `scripts/check-client-command-sender-coverage.js` to architecture smoke. It requires every
inventoried helper to enter the sender, permits one sender-owned POST bridge only, checks the
private bridge token and request bypass rejection, and checks browser load order.

Novel temporary violation injected into the actual source:

```text
GameAPI.upgrade changed from submitCommand(...) to this.request('POST', ...)
```

The guard exited 1 with exactly these violations:

```text
GameAPI.upgrade does not enter ClientCommandSender
GameAPI.upgrade performs a direct POST
GameAPI.upgrade owns a POST outside the sender transport bridge
```

The probe was removed immediately; the production guard then reported 32 helpers, 0 violations,
and `passed`.

### Honest Real-Server Verification

Reproducible command:

```powershell
node scripts/verify-step3-phase2-real-server.js --output docs/architecture/evidence/step3-phase2-real-server-2026-07-10.json --quiet
```

The script starts the real repository `backend/server.js`, publishes a temporary matched config
release through production modules, logs in through the real route, prepares state through the
real `GameStateRepository`, and sends through the actual
`GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch` path. The fetch
wrapper only records the real request and a `Response.clone()` of the real response; it does not
replace the server, route, or transport result.

Captured same-run facts:

- PID `113880`, port `60769`, entry `backend/server.js`; spawned process was absent after capture
  and the recorded termination signal is `SIGTERM`.
- `/api/health`: HTTP 200, git commit `5e568fe1309bc22768f0e1c50d8d707f15858868`,
  config runtime `matched`, active release source `step3-phase2-real-server`, gate mode `required`.
- Raw request is an actual HTTP POST to `/api/game/action` and includes
  `cmd-phase2-real-server-1`, `idem-phase2-real-server-1`, type `startWorldMarch`, request id
  `api-1`, and the complete `game-command-v1` client envelope.
- Raw real response: HTTP 400, `FORMATION_EMPTY`, `编队为空，无法出征`.
- Raw health, login metadata, request headers/body, response headers/body, server stdout/stderr,
  PID, port, DB paths, and termination state are stored verbatim in
  `docs/architecture/evidence/step3-phase2-real-server-2026-07-10.json`.

### Phase 2 Gate

- Focused sender/API/inventory/manifest/guard tests: 47/47 passed.
- Frontend full test scope: 1595/1595 passed.
- `npm test`: 2301/2301 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0, including the new sender coverage gate.
- `node scripts/report-command-owner-step1.js`: inventory drift findings 0.
- `node scripts/check-source-encoding.js`: violations 0.
- Changed and untracked files checked before this record update: 15, all LF-only.
- `git diff --check`: passed.
- Frozen working-tree blob hashes remain exactly:
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`,
  `c6f92374db9189e5d48792365c48ad1d7669a36e`, and
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`.
- `resource-node` remains absent and untouched.

## Phase 3

Status: **COMPLETE WITH RECORDED BLOCKERS.** Contracts: `COP-ENVELOPE-001`,
`COP-IDEMP-001`, `COP-TRACE-001`, `COP-OWNER-001`, `COP-OWNER-002`,
`COP-SHARED-001`, `COP-ENTRY-001`.

### Universal Server Envelope Normalizer

- `normalizeCommandEnvelope` now normalizes every inventoried server write into
  `game-command-v1`, including command/request/idempotency ids, canonical payload and digest,
  player id, client evidence, route/method/inventory source, and compatibility metadata.
- Explicit client envelopes reject unsupported schema, type mismatch, identifier mismatch, and
  transport/client payload mismatch with structured HTTP 400 errors.
- Missing client ids remain accepted only in report mode and are visibly classified as
  `server-fallback-id`; strict mode rejects them with `COMMAND_ENVELOPE_REQUIRED`.
- The existing `createBuildBuildingCommand` is now a compatibility adapter over the universal
  envelope rather than a separate envelope implementation.

### Table-Driven Owner Resolver And Entry Reports

- `CommandOwnerResolver` declares all 29 current game actions plus all route-only writes.
- Private state uses `player:{playerId}`. Territory contest uses
  `territory:{territoryId}` and encounter combat uses `encounter:{encounterId}` as the primary
  owner while also declaring the player key. Multi-owner keys are deduplicated and sorted.
- Missing shared ids throw structured owner errors and never fall back to player ownership.
- Every one of the 17 Step1 server write entries reaches `prepareCommandEntry` after auth and
  before validation, lock, load, mutation, persistence, or projection. The 14 structural entry
  calls cover shared route handlers without duplicating reports.
- `ObservabilityService`, API log metadata, health summary, and `/api/metrics` expose compact
  report-only command entry records.
- `WorldWorkerService` records its mixed-owner blocker before reading or writing runtime state;
  the standalone worker logs the compact blocker once per unchanged signature.

### Honest Blockers

The following areas are stopped and are not claimed as migrated:

- `startWorldCombat`: current client request omits stable `encounterId` and reports
  `OWNER_TARGET_ENCOUNTER_ID_MISSING`.
- `resolveWorldCombat`: `battleId -> encounterId` currently lives inside loaded player session
  state and reports `OWNER_TARGET_BATTLE_ENCOUNTER_UNRESOLVED` before load.
- `worldWorkerRuntimeTick`: one batch mutates shared state and multiple players, so it reports
  `OWNER_WORKER_COMMAND_SPLIT_REQUIRED` instead of inventing one owner.

Full source evidence, stopped scope, and retirement conditions are recorded in
`EXECUTION-BLOCKER-REPORT-step3-phase3-owner-resolution-2026-07-10.md`. These blockers must be
resolved in Phase 6 before the affected writes can claim live shared-owner migration.

### Blocking Guard And FIRE Probe

Added `scripts/check-command-owner-entry-coverage.js` to architecture smoke. It reconciles all
current actions and all 17 server write inventory ids against owner declarations and real entry
calls, checks report-only classification and ordering, rejects missing shared-target fallback,
and keeps the worker split blocker explicit.

Novel temporary violation injected into actual source:

```text
backend/routes/playerRoutes.js inventory id server:player-reset changed to server:player-reset-shadow
```

The guard exited 1 with exactly two violations:

```text
server:player-reset does not enter prepareCommandEntry
backend/routes/playerRoutes.js reports undeclared inventory server:player-reset-shadow
```

The probe was removed immediately. The production guard then reported 17 server write entries,
14 entry calls, 0 violations, and `passed`.

### Honest Real-Server Verification

Reproducible command:

```powershell
node scripts/verify-step3-phase3-real-server.js --output docs/architecture/evidence/step3-phase3-real-server-2026-07-10.json --quiet
```

The script starts the real repository `backend/server.js`, uses a temporary matched config and
SQLite files, logs in through the real route, sends through the actual
`GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch` path, reads the
actual authenticated `/api/metrics`, captures a second health response, and stops the process.
No mock/stub server, route, owner resolver, metrics service, or transport result is used.

Captured same-run facts:

- PID `56176`, port `51595`, entry `backend/server.js`; initial `/api/health` HTTP 200 reported
  git commit `a7399c0cdb82857a8e05587985394281e07d6007` and matched required config runtime.
- Raw real command was `startConquest` with `cmd-phase3-real-server-1`,
  `idem-phase3-real-server-1`, and target `phase3-real-territory`.
- The real domain result was HTTP 400 `TERRITORY_NOT_FOUND` / `地点不存在`; this was preserved
  verbatim rather than replaced with a desired response.
- Real `/api/metrics` reported `ownerStatus=resolved`, primary owner
  `territory:phase3-real-territory`, canonical owner keys
  `player:codexqa, territory:phase3-real-territory`, and
  `idempotencyClassification=client-idempotent` for that exact command id.
- Same-process post-command health remained HTTP 200 and reported two recent command entries.
- Spawned process stopped with `SIGTERM`; stderr was empty.
- Raw health, login metadata, request/response headers and bodies, metrics, PID, port, DB paths,
  server stdout/stderr, and termination state are stored verbatim in
  `docs/architecture/evidence/step3-phase3-real-server-2026-07-10.json`.

### Phase 3 Gate

- Focused envelope/owner/worker/observability/route/inventory/guard tests: 102/102 passed.
- `npm test`: 2320/2320 passed across 290 test files.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0, including the new owner-entry gate.
- `node scripts/report-command-owner-step1.js --summary`: inventory drift findings 0.
- `node scripts/check-source-encoding.js`: violations 0.
- Before this record update, 25 changed/untracked files were checked and all were LF-only.
- `git diff --check`: passed.
- Frozen working-tree and `HEAD` blob hashes both remain exactly:
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`,
  `c6f92374db9189e5d48792365c48ad1d7669a36e`, and
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`.
- `resource-node` remains absent and untouched.

## Phase 4

Status: not started.

## Phase 5

Status: not started.

## Phase 6

Status: not started.

## Phase 7

Status: not started.

## Final Self-Audit

Status: not started. No completion claim is made while any phase above remains incomplete.
