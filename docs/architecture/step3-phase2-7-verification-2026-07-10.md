# Step3 Part 0 + Phases 2-7 Verification

Status: **COMPLETE (working-tree validation), 2026-07-10.** This record is updated only from executed commands.
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

These were historical stopped-scope blockers for Phase 3 only. Phase 6 retires them with
shared owner lookup, coordinate handoff, command splitting, and the real server/worker
evidence recorded below before the affected writes claim live shared-owner migration.

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

Status: **COMPLETE (working-tree implementation and validation).** Contracts:
`COP-SHARED-001`, `COP-OWNER-001`, `COP-OWNER-002`, `COP-LOCK-001`,
`COP-HANDLER-001`, `COP-ROUTE-001`.

### Shared Owner 与 worker 迁移

- `startConquest`、`claimConquest`、`renameCity` 使用
  `territory:{territoryId}` primary owner，并按 canonical order 同时锁 actor player、actor
  `territory-owner:{playerId}`、持久化旧 owner collection 和目标 territory。repository 在 scoped
  写入前再次校验旧、新 collection locks，缺锁时在任何 player/shared row 落库前失败。
- `startWorldCombat`、`resolveWorldCombat` 使用 `encounter:{encounterId}` 与 player 双 owner。
  `WorldCombatCommandHandler` 只 stage encounter mutation；player state 和 shared encounter 由
  `CommandCommitter.commitCommandState` 在同一 SQLite transaction 中提交。
- `startWorldMarch` 可在 owner lock 前通过只读坐标 lookup 解析 encounter handoff；命令 trace
  明确记录 owner resolution 先于 owner lock，且领域执行收到同一个 encounter id。
- world worker 拆为 `worldWorkerPlayerTick`、`worldWorkerPersonUpdate`、
  `worldWorkerDiplomacyTick` 三个 internal-idempotent 命令。player tick 锁 player 与全部可能 mutation
  的 encounters；social batch 锁 `world-social:global`、全部 player 与 person owners，并在锁内重读；
  diplomacy tick 使用 `diplomacy:{pairId}`。三类写入均通过同一
  `CommandExecutionPipeline`/`CommandCommitter`。
- `FactionDiplomacyService.planAdvanceEdge` 只计算双向 edge mutations；legacy `advanceEdge` 继续复用
  同一 plan。等价测试确认两条路径的最终持久化结果一致。

### Self-review 闭环

- `CommandCommitter` 在 repository 调用前统一校验 shared mutation owners：encounter、person、
  diplomacy edge 和 shared player state 缺少对应 owner 时抛
  `COMMAND_SHARED_MUTATION_OWNER_NOT_LOCKED`。`shared-only` 在 `state=null` 时有正式回归测试。
- encounter 普通读取与 respawn 均为 clone projection；`refreshRespawns:true` 明确拒绝。API 与 worker
  启动只初始化表，不再在 pipeline 建立前 materialize encounter seeds；规划结果只在真实命令 mutation
  提交时落库。
- `playerReset` 同时锁 `player:{id}` 与 `territory-owner:{id}`。reset state factory 延迟到
  `CommandCommitter -> GameStateRepository.resetPlayerState` 的 transaction 内执行，因此旧 spawn release、
  新 spawn reservation、companion city、player row、shared territory 和 visibility 失败时整体回滚。
- 只读自审确认 `WorldCombatCommandHandler` 与 `WorldWorkerService` 均无直接
  `save`/`upsert`/feature-owned lock，worker 对未预声明 encounter mutation fail closed。

### Blocking guards 与 synthetic FIRE

- `scripts/check-command-route-migration.js` live gate：29 个 Phase 6 migrated actions，0 deferred，
  0 violations。synthetic tests 8/8，通过内存 source mutation 分别证明 handler persistence、延期分支、
  world-combat persistence、side-effecting encounter read、startup encounter seed、reset pre-commit
  persistence 和 shared-owner validation 等违规会 FIRE。
- `scripts/check-command-owner-entry-coverage.js` live gate：17 个 server write entries、13 个 entry
  calls、0 violations。synthetic tests 5/5，覆盖 inventory drift、shared combat player fallback、worker
  direct persistence 和 social computation before lock。
- `scripts/check-command-pipeline-foundation.test.js` 4/4；新增 probe 证明 reset state factory 脱离
  committer 时 foundation gate 会 FIRE。
- `scripts/report-command-owner-step1.test.js` 7/7；live summary 为 17/17 contracts、17 个 server write
  entries、29 个 actions、33 个 frontend helpers、60 条 frontend command paths，inventory drift 0。

### 真实本地 server/worker evidence

可复现命令：

```powershell
node scripts/verify-step3-phase6-real-server.js --output docs/architecture/evidence/step3-phase6-real-server-2026-07-10.json --quiet
```

同轮启动真实 `backend/server.js` 与真实 `backend/world-worker.js`，使用同一个临时 SQLite、真实登录、
真实 `GameAPI -> ClientCommandSender -> H5GameApiTransportAdapter -> fetch` HTTP 路径。fixture 只在请求前
通过 production repository/domain service 做确定性准备，没有替换 route、handler、pipeline、server、worker
或 transport。raw evidence 位于
`docs/architecture/evidence/step3-phase6-real-server-2026-07-10.json`（7,497,041 bytes）。

- 2026-07-10T06:21:46.043Z 复验：server PID `3416`、worker PID `10992`、端口 `11127`；
  同一 server 的 health before/after 均为 HTTP 200。server stderr 为空；server/worker 均由验证脚本
  以 `SIGTERM` 正常收尾。worker stderr 的
  263 bytes 是预期的 blocking `command-entry-report-v1`，`ownerStatus=resolved`、`error=''`。
- territory contest：test1 返回 HTTP 200，ownerKeys 为 player + actor territory collection + target；
  test2 返回 HTTP 409 `TERRITORY_ALREADY_OCCUPIED`，ownerKeys 同时包含 test1 旧 owner collection、
  test2 actor collection 与 target。shared row 最终只属于 test1，test2 canonical state 保持 contested。
- march handoff：真实 request 未携带 encounter id，只携带坐标；trace 在 lock 前解析为
  `encounter:phase6-real-march-handoff-encounter` + `player:test3`，领域 mission 使用同一 encounter id。
- encounter storm：首次真实 resolve 后再发 49 个相同 command/idempotency replay，共保存 50 条 raw
  HTTP；status 全部 200、raw response body 完全一致、player revision delta 1、recent report 1、shared
  encounter 最终 `resolved`。
- worker force-settle：真实 worker 以 active limit 1 处理 codexqa，trace ownerKeys 为
  `player:codexqa` + `encounter:phase6-real-worker-force-settle-encounter`，owner resolution 先于 lock；
  player revision delta 1、report 1、shared encounter `resolved`，停止后 owner lock rows 为 0。

### Phase 6 Gate

- P6 focused backend batch：159/159 通过；route synthetic 8/8、owner-entry synthetic 5/5、foundation
  synthetic 4/4、Step1 report tests 7/7。
- `npm test`：295 个测试文件，2369/2369 通过。
- `npm run lint`：通过。
- `npm run test:architecture`：退出 0，包含 route migration、owner entry、pipeline foundation、source
  encoding、Step1 drift 与 `git diff --check` gates。
- `node scripts/check-source-encoding.js`：violations 0；全部修改/新增文件 worktree EOL 为 LF；
  `git diff --check` 通过。
- frozen HEAD/working-tree blobs 均保持：
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`、
  `c6f92374db9189e5d48792365c48ad1d7669a36e`、
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`。
- P6 implementation、self-review gate 与真实流程 evidence 无剩余 blocker。Phase 7 仅新增 blocking
  gate/map 与验证文档，没有开始新的业务迁移。

## Phase 7

Status: **COMPLETE (working-tree implementation and validation).** Contracts:
`COP-ALLOWLIST-001`, `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-ENVELOPE-001`,
`COP-HANDLER-001`, `COP-IDEMP-001`, `COP-OWNER-001`, `COP-OWNER-002`,
`COP-ROUTE-001`, `COP-SHARED-001`.

### Migrated inventory blocking map

- 新增 `scripts/check-command-owner-blocking-map.js` 与
  `scripts/check-command-owner-blocking-map.test.js`，并接入
  `scripts/run-architecture-smoke.js` 的 `CHECK_FILES`、`TEST_FILES` 和 blocking guard 阶段。
- Gate 为已迁移范围生成 per-inventory blocking map：127 个 migrated ids，包含 9 个
  server/background write entries、29 个 game actions、33 个 frontend write helpers、56 个 frontend
  command paths。
- Gate 阻断：
  - migrated server/action id 缺少 `blocking-*` envelope/owner、`live` idempotency store 或 `live`
    command pipeline；
  - migrated frontend helper/path 绕过 `ClientCommandSender`，或仍允许 domain display state 抑制命令提交；
  - Step1 inventory drift 非 0 或 allowlist metadata 缺失；
  - map 中引用的 blocking gate 未接入 architecture smoke；
  - migrated id 未进入 map，或 map 中出现 stale/duplicate id。
- Step1 report package 仍保持 report-only 审计语义；Phase 7 通过新增 blocking map gate 将已迁移 id 的
  report-only debt 转成 architecture smoke 的 blocking enforcement。

### Synthetic FIRE 与 focused checks

已执行：

```powershell
node --test scripts/check-command-route-migration.test.js scripts/check-command-owner-entry-coverage.test.js scripts/check-command-pipeline-foundation.test.js scripts/check-command-owner-blocking-map.test.js scripts/report-command-owner-step1.test.js scripts/run-architecture-smoke.test.js
node scripts/check-command-route-migration.js
node scripts/check-command-owner-entry-coverage.js
node scripts/check-command-pipeline-foundation.js
node scripts/check-command-owner-blocking-map.js
node scripts/report-command-owner-step1.js --summary
```

结果：

- Focused script tests：33/33 通过。新增 blocking map synthetic 5/5，分别覆盖 missing map entry、
  migrated id 退回 report-only、gate 从 architecture smoke 消失、frontend helper 恢复 domain block。
- `scripts/check-command-route-migration.js`：29 个 Phase 6 migrated actions，0 deferred，0 violations。
- `scripts/check-command-owner-entry-coverage.js`：17 个 server write entries、13 个 entry calls，
  0 violations。
- `scripts/check-command-pipeline-foundation.js`：`OwnerLockRepository` public methods 仅
  `withOwnerLocks`，0 violations。
- `scripts/check-command-owner-blocking-map.js`：127/127 migrated ids mapped，0 violations；分布为
  server writes 9、game actions 29、frontend write helpers 33、frontend command paths 56。
- `scripts/report-command-owner-step1.js --summary`：17/17 contracts、12 checks、17 server write
  entries、29 game actions、33 frontend helpers、60 frontend command paths，inventory drift 0。

### Phase 7 full gate

已执行：

```powershell
npm test
npm run lint
npm run test:architecture
node scripts/check-source-encoding.js
git diff --check
node scripts/verify-step3-phase6-real-server.js --output docs/architecture/evidence/step3-phase6-real-server-2026-07-10.json --quiet
```

结果：

- `npm test`：295 个 all-test files，2369/2369 通过。
- `npm run lint`：通过。
- `npm run test:architecture`：通过；包含新增 `command owner migrated blocking map guard`、新 test
  文件的 `node --check` 和 focused node tests、source encoding 与 `git diff --check`。
- `node scripts/check-source-encoding.js`：violations 0。
- `git diff --check`：通过。
- 真实 server/worker evidence 复验：`assertion.passed=true`，stub-free、territory contest、
  march encounter handoff、encounter resolve storm、world worker force-settle、same-server health
  before/after 全部为 true。server PID `3416`、worker PID `10992`、端口 `11127`；health before/after
  均 HTTP 200；server stderr 为空，worker stderr 263 bytes 为预期 command-entry report。
- Frozen frontend blobs 与 HEAD 一致：
  `CanvasPanelActionRunner.js` =
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`，
  `CanvasPanelActionRunner.test.js` =
  `c6f92374db9189e5d48792365c48ad1d7669a36e`，
  `CanvasPanelCompatibilityRetirement.test.js` =
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`。

## Final Self-Audit

Status: **COMPLETE (working-tree validation).** No `EXECUTION-BLOCKER-REPORT` was required.
Per user instruction, no commit, push, reset, checkout, or branch switch was performed.

### Completion criteria audit

- Criteria 1-9 are covered by Phases 2-6 implementation and revalidated by `npm test`,
  route/owner/pipeline guards, shared-owner tests, and the real server/worker evidence.
- Criteria 10-11 are covered by Phase 7 `check-command-owner-blocking-map.js`:
  127 migrated ids have blocking gate mappings, and architecture smoke blocks fake compliance patterns.
- Criterion 12 is covered by focused checks, `npm test`, `npm run lint`, `npm run test:architecture`,
  source encoding, and `git diff --check`.
- Criterion 13 is covered by the handoff table below.

### Final implementation handoff

| Contract | Implementation evidence | Blocking gate / test evidence | Remaining debt |
| --- | --- | --- | --- |
| `COP-ENTRY-001` | `prepareCommandEntry`, Step1 inventories, command owner blocking map | owner-entry gate, blocking-map gate, Step1 drift 0 | Classified non-gameplay/admin/diagnostic/config entries remain inventoried but not claimed migrated. |
| `COP-ENVELOPE-001` | `ClientCommandSender`, `normalizeCommandEnvelope`, migrated route `requireClientIds` | client sender coverage, route migration, blocking-map gate | None for migrated ids. |
| `COP-IDEMP-001` | `CommandIdempotencyStore`, pipeline replay/conflict, duplicate storm tests | pipeline tests, route migration, blocking-map gate | Ops/config/diagnostic classified writes remain report-only inventory, not migrated claims. |
| `COP-OWNER-001` | `CommandOwnerResolver`, repository owner resolver, worker split commands | owner resolver tests, owner-entry gate, blocking-map gate | None for migrated ids. |
| `COP-OWNER-002` | Shared owner missing-target rejection, march coordinate handoff lookup | owner resolver tests, P6 real march handoff, owner-entry gate | `resolveCapture` remains private player-owned unless future scope makes capture decisions shared. |
| `COP-SHARED-001` | Territory, encounter, worker, person, diplomacy shared owners | P6 real evidence, route/owner gates, blocking-map gate | Future loot/boss owners are represented only as future abstractions until routes exist. |
| `COP-LOCK-001` | `OwnerLockRepository.withOwnerLocks`, player delegate, shared mutation owner checks | foundation gate, lock tests, P6 worker evidence | None for migrated ids. |
| `COP-CONCURRENCY-001` | SQLite owner locks shared by server and worker | `OwnerLockRepository` tests, foundation gate | None for migrated ids. |
| `COP-HANDLER-001` | handlers run inside owner context and stage mutations only | route migration guard, handler tests, blocking-map gate | None for migrated handlers. |
| `COP-ROUTE-001` | migrated routes enter `CommandExecutionPipeline` | route migration guard, route integration tests | `playerLogin`, ops, config routes remain classified non-gameplay/non-migrated. |
| `COP-CLIENT-001` | `ClientCommandSender` local blocks limited to transport/payload/UI readiness | client block reason guard, client sender tests, blocking-map gate | Step1 still reports display-domain signals as visible future frontend debt; command-submit gates pass. |
| `COP-CLIENT-002` | GameAPI helpers and inventoried direct call sites route through sender facades | client sender coverage, Step1 direct-submit scanner, blocking-map gate | Renderer/panel architectural report-only findings remain outside migrated command-submit enforcement. |
| `COP-TIME-001` | server time/revision authority in heartbeat/march pipeline | heartbeat tests, route migration, real evidence | Frontend display timing reports remain report-only. |
| `COP-AUTHORITY-001` | server validators remain final authority; client local blockers do not suppress submit paths | client block reason guard, route integration tests | Display eligibility calculations remain documented as report-only frontend debt. |
| `COP-PROJECTION-001` | read projections are separated from command commit; GET heartbeat/read routes stay read-only | projection architecture tests, route migration guard | Domain business candidate reports remain report-only architecture backlog. |
| `COP-TRACE-001` | command entry reports, command trace phases, real evidence trace assertions | command envelope/trace tests, owner-entry gate, real evidence | None for migrated ids. |
| `COP-ALLOWLIST-001` | Step1 inventory drift and allowlist metadata checked by blocking-map gate | blocking-map gate, Step1 tests | Three no-write POST exclusions remain documented with owner, reason, retirement condition, and growth-prevention test. |

### Remaining non-blocking debt records

- `server:player-login` stays classified as auth/player write, not a migrated gameplay command. Owner:
  auth/platform. Retirement condition: if login becomes a gameplay command or shared-state mutation, add it to the
  command pipeline and blocking map in the same change.
- `admin:ops-login-audit`, `admin:ops-maintenance-state`, `admin:ops-restart-audit` stay classified ops writes.
  Owner: ops/platform. Retirement condition: if they mutate gameplay state or claim command migration, add owner,
  idempotency, pipeline, tests, and blocking-map entries.
- `admin:config-release-publish` and `admin:config-release-rollback` stay classified config writes. Owner:
  admin/config. Retirement condition: if config release operations become gameplay command traffic, migrate them
  through the command pipeline and blocking map.
- `diagnostic:client-events-ingest` and `diagnostic:client-operation-log-ingest` stay classified diagnostic writes.
  Owner: observability. Retirement condition: if diagnostic ingestion affects gameplay state, add command ownership
  and blocking migration.
- Existing report-only frontend/domain architecture findings remain visible in their report guards. They are not
  migrated command-submit blockers because `client-command-block-reasons`, `client-command-sender-coverage`, and
  the new blocking-map gate all pass.
