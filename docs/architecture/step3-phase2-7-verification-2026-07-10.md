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

Status: **COMPLETE.** Contracts: `COP-IDEMP-001`, `COP-ENVELOPE-001`,
`COP-LOCK-001`, `COP-CONCURRENCY-001`, `COP-TRACE-001`, `COP-ROUTE-001`,
`COP-HANDLER-001`.

### One Cross-Process Owner Lock System

- Added the SQLite lease-backed `OwnerLockRepository` with the single public entry
  `withOwnerLocks(ownerKeys, scope, callback, options)`.
- Owner keys are validated, deduplicated, and sorted by one deterministic UTF-16 order. All keys
  are acquired before command execution; timeout releases partial acquisitions in reverse order,
  and normal/exception exit releases every lock in reverse order.
- Timeout is the structured `OWNER_LOCK_TIMEOUT` and names the contested owner key. Lease holder
  ids are `instanceId + uuid`; expired rows are reclaimed through the same SQLite upsert path.
- Schema migration `003-owner-locks-generalization` creates exactly
  `owner_locks(ownerKey, holderId, scope, lockedAt, expiresAt)` plus the expiry index, copies live
  legacy rows to `player:{playerId}`, and drops `player_state_locks` and its index.
- `PlayerStateLockRepository.js` is deleted. `GameStateRepository.withPlayerStateLock` is a thin
  compatibility delegate to `withOwnerLocks(['player:'+playerId], ...)`; API and world-worker use
  the same repository and the same DB file, with no dual-write period.
- Acceptance tests use real `better-sqlite3` files and real child processes for same-key
  serialization, different-key concurrency, expired-holder recovery, and opposite mention-order
  dual locks.

### Persistent Idempotency Store

- Schema migration `004-command-idempotency-store` creates the persistent
  `command_idempotency` table and status/command indexes in the game DB.
- `CommandIdempotencyStore.begin` atomically reserves a stable client key. Same key plus the same
  payload digest returns the exact stored status/body; same key plus a different digest returns
  HTTP 409 `IDEMPOTENCY_KEY_CONFLICT`; a live reservation returns `COMMAND_IN_FLIGHT`.
- Server fallback ids are rejected with `IDEMPOTENCY_CLIENT_KEY_REQUIRED` and never count as
  compliance.
- Terminal results cannot be overwritten with a different response. Uncommitted failures can
  explicitly abandon their reservation so a retry may execute again.

### Command Execution Pipeline Skeleton

- Added `CommandExecutionPipeline` with the ratified order:
  trace → idempotency → owner resolution → `withOwnerLocks` → load → validate → execute →
  commit → projection → response.
- `CommandOwnerContext` uses `AsyncLocalStorage`; domain execution outside the pipeline-owned
  context throws `OWNER_CONTEXT_REQUIRED`.
- `CommandCommitter` is the only pipeline component that calls repository persistence and writes
  terminal idempotency results. Projection failure after a successful commit returns and stores a
  replayable HTTP 202 `PROJECTION_FAILED_AFTER_COMMIT` while the owner lock is still held.
- `CommandTrace` now records owner key(s), idempotency status, owner wait, execution duration,
  validator result, commit result, revisions, response status, and ordered phases.
- The real server constructs the idempotency store and pipeline foundation at startup. No HTTP
  route is marked migrated in Phase 4; route/handler lock and persistence debt remains visible for
  Phase 5.

### Blocking Guard And FIRE Probe

Added `scripts/check-command-pipeline-foundation.js` to architecture smoke. It blocks a surviving
parallel player-lock system, malformed owner-lock schema, missing migration/drop, non-canonical
owner ordering, wrong acquisition/release shape, missing fallback-id refusal, reordered pipeline
stages, persistence outside `CommandCommitter`, incomplete trace fields, and a server that does not
construct the foundation.

Novel temporary violation injected into actual source:

```text
OwnerLockRepository canonical Array.from(new Set(normalized)).sort() changed to .reverse()
```

The guard exited 1 with exactly:

```text
owner keys are not deduplicated and sorted by one canonical order
```

The probe was removed immediately. The production guard then reported one public method
`withOwnerLocks`, 0 violations, and `passed`.

### Honest Real-Server Verification

Reproducible command:

```powershell
node scripts/verify-step3-phase4-real-server.js --output docs/architecture/evidence/step3-phase4-real-server-2026-07-10.json --quiet
```

The first invocation failed before server startup because a root-level script cannot resolve the
backend-private `better-sqlite3` package. The script was corrected to use the existing
`createRequire(backend/package.json)` production-loading pattern; no result from the failed run is
used as evidence.

The successful run starts the real `backend/server.js`, captures health, and uses the exact SQLite
file initialized by that process. It then runs production repository/store modules and real child
processes against that file, captures a second health response, and stops the server. The script
explicitly records `routeMigrationClaimed=false`; its callback-based pipeline tests remain unit
tests and are not represented as HTTP end-to-end evidence.

Captured same-run facts:

- PID `140832`, port `61629`; health before and after verification both returned HTTP 200.
- Initial health reported git commit `566a0d333e9516a7fd7bca26eef8afd0b8c8040c` and matched config runtime.
- `owner_locks` columns were exactly `ownerKey, holderId, scope, lockedAt, expiresAt`;
  `player_state_locks` was absent; migrations `003` and `004` were both `applied`.
- A real child held `player:phase4-same-owner`; the parent acquired only after `460ms`.
- While that child was still holding its key, the parent acquired a different key in `1ms`.
- An injected expired lease was reclaimed. Two real child processes requesting the same dual-lock
  set in opposite mention order both exited 0 without deadlock.
- The persistent store returned `replay` with the exact recorded response and rejected the same key
  with a different digest as `IDEMPOTENCY_KEY_CONFLICT` / HTTP 409.
- Server stderr was empty and the spawned server stopped with `SIGTERM`.
- Raw health bodies, schema rows, migration rows, child PIDs/stdout/stderr/exit state, timings,
  idempotency rows/digests, DB paths, server output, and termination state are stored in
  `docs/architecture/evidence/step3-phase4-real-server-2026-07-10.json`.

### Phase 4 Gate

- Focused lock/idempotency/pipeline/repository/migration/worker/route/inventory/guard tests:
  94/94 passed.
- Final-tree core rerun after the verification record update: 56/56 passed.
- `npm test`: 2340/2340 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0, including the Phase 3 owner-entry guard and
  new Phase 4 foundation guard.
- `node scripts/report-command-owner-step1.js --summary`: inventory drift findings 0.
- `node scripts/check-source-encoding.js`: violations 0.
- Before this record update, all 22 existing changed/untracked files were LF-only; the retired
  player lock file is an explicit deletion.
- `git diff --check`: passed.
- Frozen working-tree blob hashes remain exactly:
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`,
  `c6f92374db9189e5d48792365c48ad1d7669a36e`, and
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`.
- `resource-node` remains absent and untouched.
- Phase 4 commit `44edd39ee10bab6953711e009c462dee4c98e23c` was pushed to both
  `origin/main` and `private/main`. The private deployment finished with
  `succeeded / complete / exitCode=0`; its health endpoint returned HTTP 200 with
  `deployedCommit=44edd39e`.

## Phase 5

Status: **COMPLETE.** Contracts: `COP-ENTRY-001`, `COP-ENVELOPE-001`,
`COP-IDEMP-001`, `COP-LOCK-001`, `COP-OWNER-001`, `COP-ROUTE-001`,
`COP-HANDLER-001`, `COP-TRACE-001`.

### 路由与处理器迁移

- `build`、除四个共享 owner 延期动作外的全部 registry actions、
  `/api/game/tasks/claim`、POST `/api/game/heartbeat`、`/api/buildings/build` 和
  `/api/player/reset` 已进入同一条 `CommandExecutionPipeline`。
- 明确延期到 Phase 6 的动作仅有 `startConquest`、`claimConquest`、
  `startWorldCombat`、`resolveWorldCombat`。`login` 继续按清单归类为认证写入，未伪装成
  已迁移玩法命令。
- `GameAPI.heartbeat` 在无报告时使用只读 GET；有行军报告时通过
  `ClientCommandSender` 发送 POST。GET 不创建幂等记录，也不保存玩家状态。
- 新增 `GameAPI.resetPlayer`；`frontend/auth.js` 不再直接 POST；退役
  `CanvasGameApp.apiPost` 和 `AuthService.resetPlayer`。
- `BuildBuildingCommandHandler` 只保留领域校验与变更，不再持有锁、保存、投影或自有 trace。
- `CommandCommitter` 统一拥有 `save`、`save-if-changed`、`reset-player-state`、`none`
  四种保存策略；revision 冲突的一次重试由管线统一执行。
- 首次提交响应会从 SQLite 幂等记录中回读规范化结果，保证含可省略字段的复杂响应与回放
  响应逐字一致。

### 阻断守卫与 FIRE 探针

新增 `scripts/check-command-route-migration.js` 并接入架构烟测。它阻断迁移路由缺少严格信封、
owner 或幂等要求，阻断路由继续持有编排，阻断 handler 自持锁/保存，阻断已迁移动作退回
Phase 6 延期分支，并核对 Step1 清单状态。

本相独立临时探针把真实源码中 heartbeat POST 的：

```text
mode: 'blocking'
```

改为：

```text
mode: 'report-only'
```

守卫按预期退出 1，并精确报告：

```text
heartbeat POST route is missing mode: 'blocking'
```

反向补丁已立即恢复该行；生产守卫随后报告 25 个 Phase 5 已迁移动作、4 个 Phase 6 延期
动作、0 violation、`passed`。

### 真实本地服务器验证

可复现命令：

```powershell
node scripts/verify-step3-phase5-real-server.js --output docs/architecture/evidence/step3-phase5-real-server-2026-07-10.json --quiet
```

脚本同轮启动真实 `backend/server.js`，使用临时真实 SQLite 和匹配的配置发布，通过真实登录
取得 token，并让所有玩法写入经过实际
`GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> global fetch`。fetch 包装器只对
真实请求和 `Response.clone()` 做原样记录，不替换服务、路由、处理器或响应。

同轮捕获事实：

- PID `136584`，端口 `61042`；前后 `/api/health` 都返回 HTTP 200，配置运行时为
  `matched`，进程最终以 `SIGTERM` 结束，stderr 为空。
- build 同键发出两次真实 HTTP 请求：房屋等级 `0 -> 1 -> 1`，revision
  `3 -> 4 -> 4`；两次原始响应 body 逐字一致，幂等行在回放后不变。
- heartbeat GET 前后 revision 为 `4 -> 4`，`updatedAt` 不变。
- heartbeat POST 报告同键发出两次真实 HTTP 请求：revision `4 -> 5 -> 5`，真实保存
  `phase5-real-march-1`；两次原始响应 body 逐字一致，幂等行在回放后不变。
- reset 同键发出两次真实 HTTP 请求：revision `5 -> 1 -> 1`，房屋等级恢复为 0；两次
  原始响应 body 逐字一致，玩家状态与幂等行在回放后均不变。
- 原始 health、登录元数据、请求 headers/body、响应 headers/body、revision 快照、幂等行、
  PID、端口、数据库路径、stdout/stderr 和终止状态全部保存在
  `docs/architecture/evidence/step3-phase5-real-server-2026-07-10.json`。

### Phase 5 Gate

- 焦点路由、管线、投影、API、认证和守卫测试：69/69 通过。
- `npm test`：294 个测试文件，2346/2346 通过。
- `npm run lint`：通过。
- `node scripts/run-architecture-smoke.js`：退出 0，包含新 Phase 5 路由迁移阻断门禁。
- `node scripts/report-command-owner-step1.js --summary`：17 个服务端写入口、33 个前端写
  helper、60 条前端命令路径，inventory drift findings 0。
- `node scripts/check-source-encoding.js`：violations 0。
- 34 个变更/新增文件均为 LF；`git diff --check` 通过。
- 冻结工作树与 `HEAD` blob 均保持：
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`、
  `c6f92374db9189e5d48792365c48ad1d7669a36e`、
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`。
- `resource-node` 仍不存在且未触碰。

## Phase 6

Status: not started.

## Phase 7

Status: not started.

## Final Self-Audit

Status: not started. No completion claim is made while any phase above remains incomplete.
