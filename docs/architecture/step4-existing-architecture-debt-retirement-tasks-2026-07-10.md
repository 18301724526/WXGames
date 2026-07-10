# Step4 现有架构债务退休任务清单

状态: STEP4-T00 ~ STEP4-T23 已执行；验证记录见 `step4-phase0-7-verification-2026-07-10.md`
日期: 2026-07-10
源 Spec: `step4-existing-architecture-debt-retirement-spec-2026-07-10.md`
契约准则: `command-owner-pipeline-contract-test-spec-2026-07-09.md`
准入门控: `step3-phase2-7-verification-2026-07-10.md`（最终自审计 COMPLETE）

---

## 1. 目的

此任务清单将 Step4 架构债务退休 spec 转化为可执行的工作项。每个任务必须引用具体的 `STEP4-DEBT-*` id（来自 Phase 0 目录）和 `COP-*` 契约 id（来自契约准则）。

Step4 仅在 Step3 验证完成后才能开始。如果 Step4 任务发现 Step3 强制执行存在缺口，停止并回到 Step3 再继续。

---

## 2. Step4 规则

- 禁止包装/脚手架/模板替代真正的债务退休。
- 禁止旧耦合隐藏在 helper/adapter/service/facade 中。
- 禁止扩大 allowlist。
- 禁止在无代码退休证据、阻塞门禁和 FIRE 探针的情况下删除仅报告发现项。
- 禁止存根/伪造证据。
- 禁止 route、handler、前端或 worker 重新拥有 pipeline 职责。
- 禁止前端展示资格影响命令提交。
- 禁止读/投影新鲜度影响写入正确性。
- 每个任务必须引用 `COP-*` 契约 id 和 `STEP4-DEBT-*` id。

---

## 3. Phase 0: 债务 Inventory 标准化与验收基线

### STEP4-T00: 冻结 Step3 基线并验证准入条件

**覆盖的契约/债务 id:** 所有 `COP-*`，所有 Phase7 剩余债务。

**输入证据:**
- `step3-phase2-7-verification-2026-07-10.md` 最终自审计。
- `npm test` 输出 (2369/2369)。
- `npm run test:architecture` 输出。
- `scripts/check-command-owner-blocking-map.js` 输出 (127 ids, 0 违规)。
- `scripts/report-command-owner-step1.js --summary` 输出 (17/17 契约, inventory 漂移 0)。

**目标模块:** 无（仅验证，无代码变更）。

**所需行为变更:** 无。

**所需测试/门禁:**
- 记录精确的当前测试数量、architecture smoke 状态、阻塞映射数量和 Step1 报告摘要。
- 记录当前 `git rev-parse HEAD`。
- 验证 spec 第 2 节的所有 Step3 准入条件为真。

**防范的假通过:**
- 在未验证的 Step3 基线下开始 Step4。
- 基于过期证据声称 Step3 完成。

**完成证据:**
- Step4 基线清单: commit hash、测试数量、门禁状态、阻塞映射数量。
- 准入条件检查清单（所有项标记为 true）。

---

### STEP4-T01: 从现有来源生成标准化债务目录

**覆盖的契约/债务 id:** 所有 `STEP4-DEBT-*`（待创建）。

**输入证据:**
- `scripts/command-owner-step1/inventories.js`:
  - `FRONTEND_COMMAND_PATHS` 中 `domain-blocker` 分类条目。
  - `CLIENT_LOCAL_BLOCKS` 中 `domain-blocker` 分类条目。
  - `ROUTE_ORCHESTRATION_DEBT` 条目。
- `step3-phase2-7-verification-2026-07-10.md` 最终自审计剩余非阻塞债务记录。
- `scripts/report-domain-business-candidates.js` 中与 command-owner 债务重叠的发现项。
- `scripts/report-frontend-ecs-renderer-authority.js` 中与写入所有权或展示/命令关注点重叠的发现项。
- `scripts/report-frontend-ecs-mode-ownership.js` 同上。
- `scripts/report-frontend-ecs-input-branch.js` 同上。
- `scripts/report-frontend-ecs-literal-duplicate.js` 同上。

> **注意:** `scripts/report-frontend-ecs-bridge-shrink.js` 已作为现有阻塞门禁运行，不属于仅报告来源。

**目标模块:**
- 新文件: `scripts/step4-debt-catalog/index.js`（目录模块）。
- 新文件: `scripts/step4-debt-catalog/debt-items.js`（债务条目定义）。

**所需行为变更:** 无（只读目录，无源码变更）。

**所需测试/门禁:**
- `scripts/step4-debt-catalog/index.js` 产生确定性的排序输出。
- 目录将每个债务条目映射到具体的源码行（不仅仅是文件名）。
- **目录去重规则:** 以 `inventoryId` 为唯一债务键。同一债务被多个来源报告时（如 `FRONTEND_COMMAND_PATHS` 与 `CLIENT_LOCAL_BLOCKS` 引用同一源码模式），合并为单一条目，`sourceRefs` 数组记录全部来源引用，禁止对同一 `inventoryId` 重复计数。
- `sourceRefs` 必须采用正式结构 `{ file, startLine, endLine, symbolOrPattern, inventoryId }`，不得仅写“数组”。
- `scripts/check-step4-debt-catalog.js` 必须验证: 文件存在；行范围有效；行范围或 `symbolOrPattern` 可匹配对应 `inventoryId` / source pattern；同一 `inventoryId` 只生成一个 debt item；多来源合并到 `sourceRefs`。
- 每个条目包含: `STEP4-DEBT-NNN` id、带行范围的源文件、`inventoryId`、正式 `sourceRefs`、分类、`COP-*` 契约、目标退休阶段 (1-5)、当前状态（`report-only` | `classified-non-gameplay` | `permanent-exception-pending`），以及适用时的 `classified-ui-local` / `retired-step4` 元数据。
- Phase 0 生成 catalog 前，必须先对照当前源码核对 `scripts/command-owner-step1/inventories.js` 相关条目的 `notes` / `status` 是否过时，并在 catalog 中记录漂移结果。
- 门禁: `scripts/check-step4-debt-catalog.js`（初始仅报告）验证目录条目与实际源码树匹配。

**防范的假通过:**
- 无源码行可验证证据的目录条目。
- 排除已知条目以报告 0 债务的目录。
- 将 domain-blockers 重新分类为 `display-only` 但未做代码退休的目录。

**完成证据:**
- `scripts/step4-debt-catalog/index.js` 已提交。
- Phase 0 门禁输出，显示目录条目数量和源码匹配。
- 债务目录摘要: 总条目数、按阶段分布、按来源分布。

---

### STEP4-T02: 调查待定决策并产出决策记录

**覆盖的契约/债务 id:** D1-D4 范围内的 `STEP4-DEBT-*` 条目。

**输入证据:**
- Phase 0 债务目录。
- Spec 第 8 节的待定决策 D1-D5。

**目标模块:** 仅决策记录（无代码变更）。

**所需行为变更:** 无（决策记录，无源码变更）。

**所需测试/门禁:**
- D1（玩家登录）: 分析登录流程深度，估算 pipeline 入口工作量，识别认证流程风险。产出决策: (a) pipeline 入口或 (b) 永久例外及增长预防测试设计。
- D2（前端领域阻塞项）: 分析 8 个 domain-blocker 条目中的每一个，确定结构性移除可行性 vs 隔离。产出按债务条目的决策。
- D3（领域业务候选）: 以 `--format json` 运行报告，按目标模块分组发现项，按机械标准识别与写入所有权/command-owner 范围重叠的子集:
  - 同一 `sourceRef.file` / `symbol` 命中 Phase 0 catalog 的 `sourceRefs`；
  - import-recursive / CodeGraph call graph 可到达 `repository.save`、`GameStateRepository.*`、`OwnerLockRepository.*`、`withPlayerStateLock`、或前端命令提交路径领域阻塞；
  - 位于 Step4 目标模块且命中已登记 inventory 的 source pattern。
  若无法满足该判定标准，则本任务对 D3 的完成证据降级为“分组与初步分析”，不得要求执行者产出未定义格式的子集提取 spec。
- D4（前端 ECS 报告）: 运行每个报告，记录当前发现项数量。确定: 零发现项 → 转换为阻塞；有发现项 → 确定是否与 Step4 范围重叠；无重叠 → 分类为仅报告并具有明确边界。`report-frontend-ecs-bridge-shrink.js` 不入此分析范围，因该脚本已作为现有阻塞 guard 运行。
- D5（永久例外模型）: 采用提议的格式，创建 `scripts/step4-debt-catalog/permanent-exceptions.js` 模板。

**防范的假通过:**
- 未解决 D1 决策就进入 Phase 1。
- 未解决 D2 决策就进入 Phase 4。
- 假设所有领域业务候选发现项都相关。
- 假设所有前端 ECS 报告都可以删除。

**完成证据:**
- D1 决策记录（pipeline 入口或永久例外及测试设计）。
- D2 按债务条目的决策记录。
- D3 子集提取 spec，或“分组与初步分析”降级记录（若机械子集标准无法成立）。
- D4 按门禁的分析，包含发现项数量和重叠分类。
- D5 具有提议格式的 `permanent-exceptions.js` 模板。

---

### STEP4-T03: 将 Phase 0 门禁添加到 Architecture Smoke

**覆盖的契约/债务 id:** `COP-ALLOWLIST-001`。

**输入证据:**
- Phase 0 债务目录模块。
- 当前 `scripts/run-architecture-smoke.js` 清单。

**目标模块:**
- `scripts/run-architecture-smoke.js`（添加 Phase 0 门禁）。
- `scripts/check-step4-debt-catalog.js`（门禁实现）。
- `scripts/check-step4-debt-catalog.test.js`（门禁测试）。

**所需行为变更:** 无（门禁初始为仅报告）。

**所需测试/门禁:**
- 门禁运行 `node scripts/check-step4-debt-catalog.js --report-only`。
- 带合成漂移的门禁测试: 更改一个债务条目的源码行引用，验证门禁报告它。
- 带合成缺失条目的门禁测试: 在目标文件中添加新的仅报告模式，验证门禁将其报告为未编目。
- 带合成已移除源码的门禁测试: 删除已编目的源码行，验证门禁报告过时目录条目。

**防范的假通过:**
- 门禁仅统计目录条目数量而不验证源码。
- 门禁因为没有实际的源码验证逻辑而总是通过。

**完成证据:**
- `scripts/run-architecture-smoke.js` 中的 Phase 0 门禁条目。
- 门禁测试输出（3 个合成漂移测试通过）。
- 完整的 `npm run test:architecture` 输出，显示 Phase 0 门禁通过。
- `npm test` 全量套件通过。

---

## 4. Phase 1: 后端 Route / Service / Helper 职责退休

### STEP4-T04: 审计已迁移条目的路由拥有持久化

**覆盖的契约/债务 id:** `COP-ROUTE-001`、`server:player-login` 及任何其他 `ROUTE_ORCHESTRATION_DEBT` 条目的 `STEP4-DEBT-*`。

**输入证据:**
- Step1 `ROUTE_ORCHESTRATION_DEBT`（inventories.js 中的 3 个条目）。
- `server:player-login` 的 Phase7 剩余债务。
- D1 决策记录（来自 STEP4-T02）。

**目标模块:**
- `backend/routes/playerRoutes.js`（登录流程，第 71-99 行）。
- `backend/routes/adminRoutes.js`（配置发布路径）。
- `backend/services/authService.js`。
- `backend/routes/` 或 `backend/services/` 下任何在 pipeline 之外调用 `repository.save` 或 `GameStateRepository.*` 的文件。

**所需行为变更:** 仅审计 — 产出扫描报告。此任务中无行为变更。

**所需测试/门禁:**
- `scripts/check-route-owned-persistence.js`（仅报告扫描），它:
  - 找到路由文件中所有 `repository.save`/`repository.upsert`/`GameStateRepository.save` 调用。
  - 对照 Step1 inventory 交叉引用，确定路由条目是否为 `pipeline-migrated-*`。
  - 报告违规: pipeline-migrated 条目的路由拥有 save。
  - 报告具有路由拥有 save 的已分类非玩法条目。
- 合成的 FIRE 探针通过门禁。

**防范的假通过:**
- 仅检查文件名模式的扫描。
- 遗漏回调或 `.then()` 内部 `repository.save` 的扫描。
- 将 pipeline-migrated 条目的 save 分类为"可接受"因为路由也调用了 `prepareCommandEntry`。

**完成证据:**
- 路由拥有持久化审计报告: pipeline-migrated 条目违规数为 0；N 个具有路由拥有 save 的已分类非玩法条目。
- 具有合成 FIRE 探针结果的扫描门禁输出。

---

### STEP4-T05: 退休玩家登录路由拥有编排

**覆盖的契约/债务 id:** `COP-ROUTE-001`、`COP-ENTRY-001`、`COP-PROJECTION-001`、`server:player-login` 的 `STEP4-DEBT-*`。

**输入证据:**
- D1 决策记录（pipeline 入口或永久例外）。
- STEP4-T04 审计报告。
- 当前 `backend/routes/playerRoutes.js` 第 71-149 行。

**目标模块:**
- `backend/routes/playerRoutes.js`。
- `backend/application/commands/GameCommandDefinitionFactory.js`（若 pipeline 入口）。
- `backend/application/commands/PlayerLoginCommandHandler.js`（新文件，若 pipeline 入口）。
- `backend/services/authService.js`。

**所需行为变更（选项 A — pipeline 入口）:**
- 创建 `PlayerLoginCommandHandler`，暂存玩家状态创建变更。Handler 不得调用 `repository.save` 或锁 API。
- 在 `GameCommandDefinitionFactory` 中创建 `playerLogin` 命令定义。
- 从 `playerRoutes.js` 登录回调中移除 `withPlayerStateLock`。
- 从登录回调中移除 `repository.save`。
- 路由 `POST /api/player/login` 通过 `CommandExecutionPipeline.execute` 执行。
- `CommandCommitter` 拥有持久化（save-if-changed 策略）。
- Pipeline 拥有的投影替换路由中的 `getClientGameStateFromNormalized` 组装。
- 通过 `CommandIdempotencyStore` 实现真正的幂等性。

**所需行为变更（选项 B — 永久例外）:**
- 在 `scripts/step4-debt-catalog/permanent-exceptions.js` 中将 `server:player-login` 记录为永久例外。
- 添加增长预防测试: 当登录开始变更超出创建范围的玩法状态时失败。
- 添加增长预防测试: 当另一路由复制登录编排模式时失败。
- 保持路由拥有编排在结构上可见（无包装器隐藏）。
- 为登录添加 `prepareCommandEntry` 仅报告审计。

**所需测试/门禁（选项 A）:**
- Pipeline 集成: 登录经过 owner 解析 (`player:{normalizedPlayerId}` / `player:{playerId}`)、幂等存储、锁、提交、投影。
- 使用相同幂等键的重复登录返回重放。
- 相同键上不同负载摘要的登录返回 409。
- 空用户名/密码的登录返回 400。
- 现有登录测试仍然通过。
- 路由拥有持久化扫描: `server:player-login` 违规数为 0。

**所需测试/门禁（选项 B）:**
- 永久例外格式已验证。
- 玩法状态变更的增长预防测试。
- 模式传播的增长预防测试。
- 路由拥有持久化扫描: `server:player-login` 为 1 个已分类条目，具有有效的永久例外记录。
- 架构门禁: `scripts/check-permanent-exceptions.js` 验证例外记录格式和增长预防测试的存在。

**防范的假通过:**
- 将 `repository.save` 从路由移到 `authService.helper()` 并声称退休。
- 添加 `pipeline.execute()` facade 但仍然调用路由拥有 save。
- 记录永久例外但无增长预防测试。
- 增长预防测试仅检查常量而不检查源码。

**完成证据:**
- 附带决策记录（选项 A 或 B）。
- 代码 diff 显示已退休的路由拥有编排 或 永久例外记录。
- 测试输出。
- 路由拥有持久化扫描: pipeline-migrated 条目违规数 0。
- 真实服务器证据（若选项 A）: `verify-step4-phase1-real-server.js` JSON。

---

### STEP4-T06: 退休或记录 Admin 配置发布路由拥有持久化

**覆盖的契约/债务 id:** `COP-ROUTE-001`、`COP-ENTRY-001`、`admin:config-release-publish` 和 `admin:config-release-rollback` 的 `STEP4-DEBT-*`。

**输入证据:**
- Step1 `ROUTE_ORCHESTRATION_DEBT` 条目。
- `backend/routes/adminRoutes.js`。

**目标模块:**
- `backend/routes/adminRoutes.js`。
- `backend/services/config/ConfigReleaseService.js`。
- `scripts/step4-debt-catalog/permanent-exceptions.js`。

**所需行为变更:**
- 配置发布路由被分类为 `config-write-classified` — 它们不是玩法命令。Step4 不要求 pipeline 迁移。
- 将两个条目记录为永久例外。
- 验证这些路由中不调用 `repository.save` 或 `GameStateRepository.*`（它们委托给 `ConfigReleaseService`，后者拥有自己的持久化）。
- 确保永久例外记录包含增长预防测试，当配置发布开始变更玩法状态时失败。

**所需测试/门禁:**
- 验证 `adminRoutes.js` 不调用 `GameStateRepository.save` 或 `OwnerLockRepository.*`。
- `permanent-exceptions.js` 中的永久例外记录。
- 玩法状态变更的增长预防测试。
- 模式传播的增长预防测试。

**防范的假通过:**
- 记录永久例外但未验证路由不触碰玩法状态。
- 通过重命名持久化调用来声称退休。

**完成证据:**
- 两个永久例外记录。
- 路由审计: 配置发布路由不触碰玩法持久化。
- 增长预防测试输出。

---

## 5. Phase 2: 领域 Handler 和 Committer 边界加固

### STEP4-T07: 审计 Handler 的锁/持久化所有权

**覆盖的契约/债务 id:** `COP-HANDLER-001`、`COP-LOCK-001`、所有 `pipeline-migrated-*` handler 条目。

**输入证据:**
- Step3 Phase7 `HANDLER_LOCK_PERSISTENCE_DEBT = []`。
- `backend/application/commands/` 下的所有文件。
- `backend/actions/` 下的所有文件。

**目标模块:**
- `backend/application/commands/*.js`（16 个文件）。
- `backend/actions/` 目录。
- 任何包含类似 handler 执行方法的 service 文件。

**所需行为变更:** 此任务中仅审计。

**所需测试/门禁:**
- 审计扫描: 找到任何直接调用 `repository.save`、`repository.upsert`、`OwnerLockRepository.*`、`withPlayerStateLock` 或 `withOwnerLocks` 的 handler（非通过 pipeline）。
- 对照 Step1 inventory 交叉引用每个 handler，确认它是 `pipeline-migrated-*`。

**防范的假通过:**
- 仅检查文件名的 "Handler" 后缀的扫描。
- 遗漏通过导入的 service 模块的间接调用的扫描。
- 遗漏 `.then()` 或异步回调内部的 save 调用的扫描。

**完成证据:**
- Handler 所有权审计报告: pipeline-migrated handler 中违规数 0。
- 任何具有 lock/save 所有权的非迁移 handler 若为已分类非玩法 handler，则记录文档。

---

### STEP4-T08: 添加 Handler 边界阻塞门禁

**覆盖的契约/债务 id:** `COP-HANDLER-001`、`COP-LOCK-001`、`COP-CONCURRENCY-001`。

**输入证据:**
- STEP4-T07 审计报告。
- 现有 Step3 阻塞门禁。
- `backend/application/commands/*.js` 文件列表。

**目标模块:**
- 新文件: `scripts/check-handler-boundary.js`。
- 新文件: `scripts/check-handler-boundary.test.js`。
- `scripts/run-architecture-smoke.js`（添加门禁）。

**所需行为变更:** 无（仅门禁 — 无源码行为变更）。

**所需测试/门禁:**
- 门禁阻止 `backend/application/commands/` 或 `backend/actions/` 下任何调用 `repository.save` 或 `GameStateRepository.save` 的文件（非通过 `CommandCommitter`）。
- 门禁阻止任何直接调用 `withOwnerLocks` 或 `withPlayerStateLock` 的 handler。
- 门禁阻止任何导入并调用 `OwnerLockRepository` 方法的 handler。
- 门禁必须采用 import-recursive 扫描或 CodeGraph/call graph，覆盖 `handler -> service/helper/facade -> repository.save / OwnerLockRepository.* / withPlayerStateLock` 的间接调用。
- 合成 FIRE 探针:
  - 临时将 `repository.save(gameState)` 注入已迁移 handler → 门禁 exit 1。
  - 临时将 `withOwnerLocks(['player:p'], ...)` 注入已迁移 handler → 门禁 exit 1。
  - 临时将 `OwnerLockRepository.acquire()` 注入已迁移 handler → 门禁 exit 1。
  - 临时将 `repository.save(gameState)` 注入被 handler 导入的 service/helper 内部 → 门禁 exit 1。
- 移除探针后，门禁通过且违规数 0。

**防范的假通过:**
- 门禁仅检查源码文本的正则模式而不理解调用上下文。
- 门禁遗漏通过注入 service/helper/facade 的间接调用。
- 门禁通过是因为仅检查 `BuildBuildingCommandHandler` 而跳过其他 handler。

**完成证据:**
- Architecture smoke 中的门禁（阻塞模式）。
- 4 个合成 FIRE 探针全部触发门禁。
- 生产门禁: 违规数 0。
- `npm run test:architecture` 通过。

---

## 6. Phase 3: Worker / 后台 / 共享状态所有权清理

### STEP4-T09: 审计 Worker 写入所有权

**覆盖的契约/债务 id:** `COP-LOCK-001`、`COP-SHARED-001`、`COP-HANDLER-001`、worker 相关条目的 `STEP4-DEBT-*`。

**输入证据:**
- Step3 Phase6 worker 命令拆分证据。
- `backend/world-worker.js`。
- `backend/services/realtime/WorldWorkerService.js`。
- 任何其他变更游戏状态的后台进程文件。

**目标模块:**
- `backend/world-worker.js`。
- `backend/services/realtime/WorldWorkerService.js`。
- `backend/services/realtime/index.js`。

**所需行为变更:** 此任务中仅审计。

**所需测试/门禁:**
- 审计扫描: 找到 worker/service 代码中任何不在 `CommandExecutionPipeline.execute` 或 `CommandCommitter.commitCommandState` 内部的 `repository.save`、`repository.upsert`、`GameStateRepository.*` 或 `OwnerLockRepository.*` 调用。
- 验证 `worldWorkerPlayerTick`、`worldWorkerPersonUpdate`、`worldWorkerDiplomacyTick` 全部通过 pipeline 的 `execute` 执行。
- 验证 worker 通过 pipeline 获取 owner 锁（而非直接）。

**防范的假通过:**
- 仅检查 `world-worker.js` 而遗漏 `WorldWorkerService.js` 的扫描。
- 遗漏 worker 导入的 service 模块内部 save 调用的扫描。
- 声称"完全干净"但未检查实际拆分命令实现的审计。

**完成证据:**
- Worker 写入所有权审计报告: 违规数 0（或有记录文档的永久例外）。
- 所有三个拆分命令的 pipeline 路径确认。

---

### STEP4-T10: 添加 Worker 写入所有权阻塞门禁

**覆盖的契约/债务 id:** `COP-LOCK-001`、`COP-SHARED-001`、`COP-CONCURRENCY-001`。

**输入证据:**
- STEP4-T09 审计报告。
- 现有 Step3 阻塞门禁。

**目标模块:**
- 新文件: `scripts/check-worker-write-ownership.js`。
- 新文件: `scripts/check-worker-write-ownership.test.js`。
- `scripts/run-architecture-smoke.js`（添加门禁）。

**所需行为变更:** 无（仅门禁）。

**所需测试/门禁:**
- 门禁阻止 `WorldWorkerService.js` 或 worker 导入的任何 service 中的 `repository.save` 或 `GameStateRepository.save`。
- 门禁阻止 worker 代码中直接的 `OwnerLockRepository.*` 调用。
- 门禁验证三个拆分命令在 worker 代码中存在且被 `CommandExecutionPipeline.execute` 引用。
- 门禁必须采用 import-recursive 扫描或 CodeGraph/call graph，覆盖 `worker -> service/helper/facade -> repository.save / OwnerLockRepository.* / withPlayerStateLock` 的间接调用。
- 合成 FIRE 探针:
  - 临时将 `repository.save(state)` 注入 worker tick 代码 → 门禁 exit 1。
  - 临时注释掉 pipeline 调用并直接调用 handler 执行 save → 门禁 exit 1。
  - 临时将 `repository.save(state)` 注入 worker 导入的 service/helper 内部 → 门禁 exit 1。
- 真实 worker 证据: `verify-step4-phase3-real-server.js` 启动真实服务器 + worker，验证 worker 变更通过 pipeline，产出 JSON 证据。

**防范的假通过:**
- 门禁通过但无实际的 pipeline 路径验证。
- 门禁仅检查文件存在，不检查调用结构。
- 真实 worker 证据脚本使用 mock 或 stub。

**完成证据:**
- Architecture smoke 中的门禁（阻塞模式）。
- 3 个合成 FIRE 探针触发门禁。
- 生产门禁: 违规数 0。
- 真实 worker 证据 JSON。
- `npm run test:architecture` 通过。

---

## 7. Phase 4: 前端展示 / 领域命令语义债务退休

### STEP4-T11: 验证 CanvasActionDispatcher 命令语义已中和并补齐防回归门禁

**覆盖的契约/债务 id:** `COP-CLIENT-001`、`COP-CLIENT-002`、`frontend:canvas-action-dispatcher-disabled-drop` 的 `STEP4-DEBT-*`。

**输入证据:**
- Step1 `FRONTEND_COMMAND_PATHS` 条目 `frontend:canvas-action-dispatcher-disabled-drop`。
- `frontend/js/platform/CanvasActionDispatcher.js`。
- 此债务条目的 D2 决策记录。

**目标模块:**
- `frontend/js/platform/CanvasActionDispatcher.js`。
- `frontend/js/platform/CanvasActionDispatcher.test.js`（现有测试）。
- 任何为派发器消费的 action 设置 `action.disabled` 的文件。

**所需行为变更:**
- **验证当前代码状态而非重复删除旧代码:** `CanvasActionDispatcher.handle()` 已先调用 `ClientCommandSemantics.normalizeAction()`；对命令 action，`normalizeAction()` 会将 `disabled` 转为 `visualDisabled` 并删除 `disabled`。本任务不得再把目标写成“简单删除 dispatcher disabled 检查”。
- 验证所有命令提交 action 在进入 dispatcher 的 `if (normalizedAction.disabled) return true;` 之前，都经过 `normalizeAction()` 中和。
- 对于路由到命令提交路径的 action: `visualDisabled` 仅作为纯展示字段。派发器不得检查它来做命令决策。
- 对于不产生命令提交的 action（纯面板刷新、UI-local 状态切换等）: `action.disabled` 可能是合法的 UI-local 状态，**不得**强制将这些 action 路由到 `ClientCommandSender`。此类 action 必须在 inventory 中明确分类为 `classified-ui-local`。
- 为此条债务添加防回归门禁: 禁止移除 `normalizeAction()` 调用；禁止命令 action 再次以 `disabled` 进入 dispatcher 决策；保留 non-command / UI-local 的合法 `disabled` 行为并记录分类依据。

**所需测试/门禁:**
- 测试: `CanvasActionDispatcher` 将路由到 `ClientCommandSender` 的 `action.visualDisabled=true` 转发到 sender 路径（不丢弃）。
- 测试: `CanvasActionDispatcher` 将路由到 `ClientCommandSender` 的 `action.visualDisabled=false` 转发到 sender 路径。
- 测试: `CanvasActionDispatcher.handle()` 对命令 action 先调用 `ClientCommandSemantics.normalizeAction()`。
- 测试: 非命令 action（不进入 `ClientCommandSender`）的 `action.disabled` 行为不受影响。
- 门禁: `scripts/check-client-command-block-reasons.js` 仍然通过。
- 门禁: `scripts/check-client-command-sender-coverage.js` 仍然通过。
- Step1 inventory 执行阶段更新: `frontend:canvas-action-dispatcher-disabled-drop` 状态从过时的 `domain-blocker/report-only` 描述修正为 `retired-step4`（命令提交路径已退休），并补充 non-command/UI-local 分类依据。

**防范的假通过:**
- 保留 `disabled` 检查但重命名为 `commandEligibility`。
- 将检查移到 helper 并声称派发器干净。
- 门禁通过是因为 `ClientCommandSender` 已经阻止，但派发器仍有死代码路径。

**完成证据:**
- 显示当前代码已通过 `normalizeAction()` 中和命令 action `disabled` 的源码证据；non-command / UI-local action 的 `disabled` 行为保持不变，并在 inventory 中具有 `classified-ui-local` 分类依据。
- 测试输出: command-submit 转发测试通过 + UI-local 保持原行为测试通过。
- 更新后的 Step1 inventory。
- 现有门禁仍然通过。

---

### STEP4-T12: 退休 CanvasPanelActionRunner Disabled Drop 路径

**覆盖的契约/债务 id:** `COP-CLIENT-001`、`COP-CLIENT-002`、`frontend:canvas-panel-action-runner-disabled-drop` 的 `STEP4-DEBT-*`。

**输入证据:**
- Step1 `FRONTEND_COMMAND_PATHS` 条目 `frontend:canvas-panel-action-runner-disabled-drop`。
- `frontend/js/platform/CanvasPanelActionRunner.js`。
- Step3 Phase0 冻结 blob 基线 `c45d1ab4eb245337b22b1555a027a147ae8b5a80`（执行者必须先验证当前 blob hash 是否仍匹配；不匹配时先记录差异原因，再决定退休范围）。

**目标模块:**
- `frontend/js/platform/CanvasPanelActionRunner.js`。
- `frontend/js/platform/CanvasPanelActionRunner.test.js`。

**所需行为变更:**
- **分类而非强制移除:** `CanvasPanelActionRunner.run()` 中的 `action.disabled` 不得简单要求全部移除。须逐条分析 runner 处理的 action，按以下规则分类:
  - 若 action 最终通过 `ClientCommandSender` 提交命令 → 属于命令提交路径，`action.disabled` 提前返回必须移除。
  - 若 action 仅操作 UI 面板（显示/隐藏/切换 tab）且不产生命令 → `action.disabled` 归类为 `classified-ui-local`，保留现有行为，在 inventory 中标注分类依据。
- 对命令提交路径的 action: 纯展示 `visualDisabled` 保留用于面板渲染提示。
- 对 `classified-ui-local` 的 action: 不得强制将这些 action 路由到 `ClientCommandSender`。

**所需测试/门禁:**
- 测试: Runner 对命令提交路径的 action 转发 `action.visualDisabled=true`。
- 测试: Runner 对命令提交路径的 action 转发 `action.visualDisabled=false`。
- 测试: Runner 对 `classified-ui-local` action 保持现有 `action.disabled` 行为。
- 先验证当前 `CanvasPanelActionRunner.js` blob hash 是否匹配冻结基线；若不匹配，必须记录差异原因，再判断哪些变更属于 Step4 退休范围。
- 仅在完成上述校验后，才可比较“被退休的 disabled-check 行（命令提交路径）”上的预期变化。
- 现有门禁仍然通过。

**防范的假通过:**
- 将 `classified-ui-local` 的 panel-only action 强制路由到 `ClientCommandSender`（范围扩大）。
- 将 runner 检查移到面板 helper 并声称退休。
- 未逐条分类 action 就声称 runner 已清理。

**完成证据:**
- 显示 command-submit action 的 `action.disabled` early-return 已退休的 diff。
- 显示 `classified-ui-local` action 保留现有 `action.disabled` 行为的 diff（无变更）。
- Inventory 中记录 `classified-ui-local` 分类依据（action 名称、分类原因、不进入 `ClientCommandSender` 的证据）。
- 测试输出: command-submit action 转发测试通过 + UI-local action 保持原行为测试通过。
- 冻结 blob hash 校验/更新记录已提供；若更新，说明仅退休行变更。
- 现有门禁通过。

---

### STEP4-T13: 验证 CanvasGameApp AdvanceEra 债务已退休并补齐防回归门禁

**覆盖的契约/债务 id:** `COP-CLIENT-001`、`COP-AUTHORITY-001`、`COP-TIME-001`、`frontend:canvas-game-app-advance-era-local-block` 的 `STEP4-DEBT-*`。

**输入证据:**
- Step1 `FRONTEND_COMMAND_PATHS` 条目 `frontend:canvas-game-app-advance-era-local-block`。
- `frontend/js/platform/CanvasGameApp.js`。
- 此债务条目的 D2 决策记录。

**目标模块:**
- `frontend/js/platform/CanvasGameApp.js`（advanceEra 方法）。
- `frontend/js/platform/CanvasGameApp.test.js`。

**所需行为变更:**
- **验证当前代码状态:** `CanvasGameApp.advanceEra()` 已直接调用 `GameAPI.advanceEra()`；本任务不得再写成“从 advanceEra 中移除 `canAdvanceEraNow()`”。
- 添加/要求防回归门禁，禁止重新引入 `if (!this.canAdvanceEraNow()) return false;`。
- `canAdvanceEraNow()` 如继续保留，只能用于视觉提示；不得进入命令提交决策。
- Step1 inventory 执行阶段更新: `frontend:canvas-game-app-advance-era-local-block` 改写为 `retired-step4` 元数据，而非继续记录成“源码仍存在提交前守卫”。

**所需测试/门禁:**
- 测试: `CanvasGameApp.advanceEra()` 即使在 `canAdvanceEraNow()` 返回 false 时也调用 `GameAPI.advanceEra()`。
- 测试: `CanvasGameApp.advanceEra()` 在 `canAdvanceEraNow()` 返回 true 时调用 `GameAPI.advanceEra()`。
- 测试: 当时代不能推进时，视觉提示仍然渲染。
- 门禁: `scripts/check-client-command-block-reasons.js` 仍然通过。
- FIRE 探针: 重新引入 `if (!this.canAdvanceEraNow()) return false;` 时，前端命令语义门禁必须 exit 1。

**防范的假通过:**
- 将 `canAdvanceEraNow` 移到从同一位置调用的 helper。
- 将 `canAdvanceEraNow` 返回值包装在名为 `visualEraEligibility` 的变量中并仍然基于此 `return`。
- 门禁通过是因为 sender 阻止，但 advanceEra 方法仍存在死代码。

**完成证据:**
- 显示当前 `advanceEra()` 已直接调用 `GameAPI.advanceEra()` 的源码证据，以及防回归门禁证据。
- 测试输出: advanceEra 始终到达 GameAPI。
- 视觉提示回归测试通过。
- 更新后的 Step1 inventory。

---

### STEP4-T14: 退休剩余前端领域阻塞信号路径

**覆盖的契约/债务 id:** `COP-CLIENT-001`、`COP-CLIENT-002`、所有剩余 `CLIENT_LOCAL_BLOCKS` domain-blocker 条目的 `STEP4-DEBT-*`:
- `frontend:tech-research-local-canresearch`
- `frontend:building-local-cost-disabled`
- `frontend:famous-candidate-availability`
- `frontend:territory-mission-ready`
- `frontend:world-march-passability`

**输入证据:**
- 上述 Step1 `CLIENT_LOCAL_BLOCKS` 条目。
- 目标前端源码文件（点击目标代码、renderer、presenter）。
- 来自 STEP4-T02 的 D2 按债务条目决策。

**目标模块:**
- 科技研究 action 点击目标代码。
- 建筑 action 派发路径。
- 名人接受/驳回派发。
- 领土 claimConquest 派发。
- 世界行军 startWorldMarch 派发/可通过性检查。
- 为这些 action 产生 `disabled`/`can*`/`ready` 值的 renderer 和 presenter。

**所需行为变更:**
- 对于每个条目，要么 (a) 从命令提交代码路径中结构性移除领域资格检查，要么 (b) 结构性隔离为 `visualDisabled`，位于可证明与命令派发分离的代码路径上。
- 任何领域形态的值（resources、tutorial、era、cooldown、march、candidate、territory、reward、encounter、loot、boss）不得被命令提交代码作为阻塞原因消费。

**所需测试/门禁:**
- 按条目测试: 命令提交路径不基于领域信号阻塞。
- 按条目测试: 视觉提示仍然渲染（如适用）。
- 门禁: `scripts/check-client-command-block-reasons.js` 仍然通过。
- 门禁: `scripts/check-client-command-sender-coverage.js` 仍然通过。
- Step1 inventory 更新: 所有已退休的 CLIENT_LOCAL_BLOCKS 条目标记为 `retired-step4`。

**防范的假通过:**
- 将领域阻塞项重新分类为 `PAYLOAD_SHAPE` 或 `UI_NOT_READY`。
- 将检查移到 presenter 并声称是"纯展示"但派发仍然消费它。
- 重命名信号变量但不改变控制流。

**完成证据:**
- 按条目 diff 显示已移除领域阻塞代码路径。
- 按条目测试输出。
- 更新后的 Step1 inventory: CLIENT_LOCAL_BLOCKS 中剩余 `domain-blocker` 条目为 0。
- 现有门禁通过。

---

### STEP4-T15: 添加前端命令语义阻塞门禁

**覆盖的契约/债务 id:** `COP-CLIENT-001`、`COP-CLIENT-002`、`COP-AUTHORITY-001`。

**输入证据:**
- STEP4-T11 到 STEP4-T14 的所有退休证据。
- 具有更新状态的 Step1 inventory。

**目标模块:**
- 新文件: `scripts/check-frontend-command-semantics.js`。
- 新文件: `scripts/check-frontend-command-semantics.test.js`。
- `scripts/run-architecture-smoke.js`（添加门禁）。

**所需行为变更:** 无（仅门禁）。

**所需测试/门禁:**

> **门禁检查范围限定:** 此门禁仅检查 **命令提交路径**。不检查 `CanvasPanelActionRunner` 或其他非命令 action 路径中合法的 UI-local `disabled`。

- 门禁检查 `CanvasActionDispatcher.handle()` 持续调用 `ClientCommandSemantics.normalizeAction()`，且对路由到 `ClientCommandSender` 的命令 action 不基于 `action.disabled` 或任何重命名变体提前返回。
- 门禁检查 `ClientCommandSemantics.COMMAND_ACTION_TYPES` 覆盖所有命令提交 action。
- 门禁检查 `CanvasGameApp.advanceEra()` 不基于领域资格在 `GameAPI.advanceEra()` 之前返回。
- 门禁检查 `CanvasGameShell.handleTap()` 不抑制命令提交路径上的领域禁用 action。
- 门禁检查 tech、building、famous、territory、march 的命令点击目标代码在命令派发路径上不包含领域阻塞条件。
- 门禁**不**检查 `CanvasPanelActionRunner.run()` 的 `action.disabled`（该路径需要先完成 STEP4-T12 的分类后，再决定是否纳入门禁范围）。
- 合成 FIRE 探针:
  - 重新在派发器的命令提交路径中引入 `if (action.disabled) return;` → 门禁 exit 1。
  - 移除 `CanvasActionDispatcher.handle()` 中的 `normalizeAction()` 调用 → 门禁 exit 1。
  - 从 `ClientCommandSemantics.COMMAND_ACTION_TYPES` 删除一个命令 action → 门禁 exit 1。
  - 重新在 advanceEra 中引入 `if (!this.canAdvanceEraNow()) return false;` → 门禁 exit 1。
  - 在命令点击目标中添加 `if (!canResearch) disabled = true;` → 门禁 exit 1。
- 生产门禁: 命令提交路径的所有检查模式违规数 0。

**防范的假通过:**
- 门禁仅检查 `disabled` 字段名称而遗漏重命名变体。
- 门禁通过是因为仅检查 `CanvasActionDispatcher.js` 而不检查 `CanvasGameApp.js` 或命令点击目标代码。
- 门禁仅检查 `return` 语句而遗漏 `return false`、`return null` 或抛出异常。

**完成证据:**
- Architecture smoke 中的门禁（阻塞模式）。
- 5 个合成 FIRE 探针触发门禁。
- 生产门禁: 违规数 0。
- `npm run test:architecture` 通过。
- 前端测试范围通过。

---

## 8. Phase 5: 投影 / 读 / 调试追踪边界清理

### STEP4-T16: 审计 CommandTrace 完整性

**覆盖的契约/债务 id:** `COP-TRACE-001`。

**输入证据:**
- `backend/application/commands/CommandTrace.js`。
- `backend/application/commands/CommandExecutionPipeline.js`（trace 调用）。
- Step3 Phase4 trace 记录定义。

**目标模块:**
- `backend/application/commands/CommandTrace.js`。
- `backend/application/commands/CommandExecutionPipeline.js`。

**所需行为变更:** 此任务中仅审计。

**所需测试/门禁:**
- 验证 `CommandTrace` 记录所有 pipeline 阶段: trace start、idempotency check、owner resolution、owner lock wait、state load、validation、execution、commit、projection、response。
- 验证每个阶段包括: phase name、start time、duration、status。
- 验证整体 trace 包括: commandId、playerId、command type、ownerKey(s)、idempotency status、owner wait time、execution duration、validator result、commit result、response status、ordered phases。
- 如有任何字段缺失: 记录为本阶段的 `STEP4-DEBT` 发现项。

**防范的假通过:**
- 检查对象上的字段名称但不验证运行时填充。
- 仅检查 trace 类定义，不检查实际的 pipeline 调用。

**完成证据:**
- Trace 完整性审计报告: 所有必需字段存在，或明确空缺记录为债务。

---

### STEP4-T17: 验证投影 / 写入边界独立性

**覆盖的契约/债务 id:** `COP-PROJECTION-001`。

**输入证据:**
- `backend/services/GameStateService.js`。
- `backend/services/ClientGameStateAssembler.js`。
- `backend/routes/playerRoutes.js`（登录投影）。
- Phase7 `COP-PROJECTION-001` 剩余债务记录。

**目标模块:**
- `backend/services/GameStateService.js`。
- `backend/services/ClientGameStateAssembler.js`。
- `backend/application/commands/CommandCommitter.js`。
- `backend/application/commands/CommandExecutionPipeline.js`。

**所需行为变更:** 验证 — 若已正确可为零变更。

**所需测试/门禁:**
- 测试: 读路径优雅返回过期数据（写入结果不受影响）。
- 测试: 提交后投影失败 → HTTP 202，已提交状态完整，未回滚。
- 测试: 投影代码不调用 `repository.save` 或修改已提交状态。
- 审计: `getClientGameState`、`getClientGameStateFromNormalized`、`calculateEraProgress`、`calculateOfflineIncome` 不具有门控写入成功的代码路径。

**防范的假通过:**
- 测试通过是因为投影在测试环境中总是成功。
- 测试实际上没有模拟投影失败场景。
- 审计通过是因为仅检查函数名称，不检查代码路径。

**完成证据:**
- 投影独立性测试输出。
- 提交后投影失败测试输出。
- 审计报告: 对投影的写入正确性依赖为 0。

---

### STEP4-T18: 添加投影 / 写入边界门禁

**覆盖的契约/债务 id:** `COP-PROJECTION-001`。

**输入证据:**
- STEP4-T16 和 STEP4-T17 审计报告。

**目标模块:**
- 新文件: `scripts/check-projection-write-boundary.js`。
- 新文件: `scripts/check-projection-write-boundary.test.js`。
- `scripts/run-architecture-smoke.js`（添加门禁，初始仅报告；Phase 6 转为阻塞）。

**所需行为变更:** 无（仅门禁）。

**所需测试/门禁:**
- 门禁验证 `CommandTrace` 包含所有必需字段。
- 门禁验证投影代码文件不调用 `repository.save` 或 `GameStateRepository.save`。
- 门禁验证 `CommandCommitter` 是为 pipeline 执行的命令调用仓库持久化的唯一组件。
- 合成 FIRE 探针:
  - 移除一个 trace 字段 → 门禁报告它。
  - 向投影函数添加 `repository.save()` → 门禁 exit 1。
- 生产门禁: 通过（仅报告）且违规数 0 或有记录文档的空缺。

**防范的假通过:**
- 检查文件名但不检查实际代码的门禁。
- 检查 trace 字段存在但不检查 pipeline 调用点的门禁。

**完成证据:**
- Architecture smoke 中的门禁（仅报告 → Phase 6 转为阻塞）。
- 2 个合成 FIRE 探针触发门禁。
- 生产门禁: pipeline 执行路径中违规数 0。
- `npm run test:architecture` 通过。

---

## 9. Phase 6: 将已退休的仅报告债务转换为阻塞门禁

### STEP4-T19: 将 Phase 0 门禁从仅报告转换为阻塞

**覆盖的契约/债务 id:** `COP-ALLOWLIST-001`、所有 `STEP4-DEBT-*`。

**输入证据:**
- Phase 0 债务目录 (STEP4-T01)。
- Phase 0 门禁 `scripts/check-step4-debt-catalog.js`（仅报告）。

**目标模块:**
- `scripts/check-step4-debt-catalog.js`（模式变更为阻塞）。
- `scripts/run-architecture-smoke.js`（更新门禁模式）。

**所需行为变更:**
- 将 `scripts/check-step4-debt-catalog.js` 从 `--report-only` 改为 `--blocking`（违规时 exit 1）。
- 门禁现在在以下情况时失败:
  - 债务条目从目录移除但无源码退休证据。
  - 出现新的仅报告模式但无目录条目。
  - 目录条目的源码行引用过时。

**所需测试/门禁:**
- 现有 Phase 0 合成漂移测试在阻塞模式下仍然通过（门禁在漂移时 exit 1）。
- 阻塞门禁通过生产树（违规数 0，exit 0）。
- Architecture smoke 包含阻塞门禁。

**防范的假通过:**
- 在所有 Phase 0 目录条目被验证之前转换为阻塞。
- 即使在目录不同步时门禁仍 exit 0。

**完成证据:**
- Phase 0 门禁以阻塞模式运行。
- 阻塞门禁输出: 违规数 0。
- `npm run test:architecture` 通过。

---

### STEP4-T20: 将 Phase 1-5 门禁转换为阻塞模式

**覆盖的契约/债务 id:** `COP-ROUTE-001`、`COP-HANDLER-001`、`COP-LOCK-001`、`COP-SHARED-001`、`COP-CLIENT-001`、`COP-CLIENT-002`、`COP-PROJECTION-001`。

**输入证据:**
- 所有 Phase 1-5 退休证据 (STEP4-T04 到 STEP4-T18)。
- 当前处于仅报告模式的新门禁:
  - `scripts/check-step4-debt-catalog.js`
  - `scripts/check-route-owned-persistence.js`（若为仅报告）
  - `scripts/check-projection-write-boundary.js`

**目标模块:**
- 每个之前为仅报告的门禁: 改为阻塞。
- `scripts/run-architecture-smoke.js`（更新门禁模式）。

**所需行为变更:**
- 每个仅报告门禁变为阻塞（违规时 exit 1）。
- 对于每个已退休的 `STEP4-DEBT-*` id: 在 Step4 阻塞映射中创建按 id 的阻塞门禁条目（类似于 Step3 `inspectGateMap`）。
- Step4 阻塞映射模块: `scripts/check-step4-blocking-map.js`。

**所需测试/门禁:**
- 每个转换后的阻塞门禁: 验证生产树通过（违规数 0）。
- 每个转换后的阻塞门禁: 验证合成回归触发阻塞。
- Step4 阻塞映射: 覆盖所有已退休债务 id。
- 所有现有 Step3 阻塞门禁仍然通过。
- Architecture smoke: 所有阻塞门禁通过。

**防范的假通过:**
- 在验证底层代码确实干净之前转换为阻塞。
- 添加阻塞门禁，其检查范围与原仅报告发现项不同。
- 将所有转换推迟到最终的"全部翻转"而不按 id 粒度。

**完成证据:**
- 按门禁转换记录: 门禁名称、之前模式、新模式、生产树违规数、合成 FIRE 探针结果。
- Step4 阻塞映射输出。
- `npm run test:architecture` 通过（所有门禁为阻塞）。
- `npm test` 通过。

---

### STEP4-T21: 更新 Step1 Inventory 以反映 Step4 退休

**覆盖的契约/债务 id:** 所有已退休债务的 `COP-*`。

**输入证据:**
- 所有 Phase 1-5 退休 diffs。
- Step4 阻塞映射。
- 当前 `scripts/command-owner-step1/inventories.js`。

**目标模块:**
- `scripts/command-owner-step1/inventories.js`。

**所需行为变更:**
- 更新每个已退休的 `FRONTEND_COMMAND_PATHS` 条目: `classification` 从 `domain-blocker` 改为 `retired-step4`，`domainDisplayCanSuppressCall` 保持 `false`，并补齐 `retired-step4` 元数据。
- 更新每个已退休的 `CLIENT_LOCAL_BLOCKS` 条目: `classification` 从 `domain-blocker` 改为 `retired-step4`，并补齐 `retired-step4` 元数据。
- 显式修正当前已知过时条目:
  - `frontend:canvas-action-dispatcher-disabled-drop`
  - `frontend:canvas-game-app-advance-era-local-block`
  - 与 `CanvasPanelActionRunner` 相关的分类说明
- 对保留 UI-local `disabled` 的 action，在 inventory 中增加 `classified-ui-local` 元数据（`actionType`、`reason`、`evidenceRefs`、`proofNotClientCommandSender`、`owner`、`growthPreventionTest`）。
- 更新 `ROUTE_ORCHESTRATION_DEBT`: 移除已退休条目（若已结构性消除）。
- `HANDLER_LOCK_PERSISTENCE_DEBT`: 确认保持 `[]`。
- 更新后 inventory 漂移必须保持 0。

**所需测试/门禁:**
- `scripts/report-command-owner-step1.js --summary`: inventory 漂移 0。
- `scripts/check-command-owner-blocking-map.js`: 对 127 个 id 仍然通过。

**防范的假通过:**
- 将条目标记为已退休但无代码级退休证据。
- 将分类更改为 `display-only` 但无结构性代码变更。
- 更新本身引入 inventory 漂移。

**完成证据:**
- 具有退休状态的更新后 inventories.js。
- Step1 报告: inventory 漂移 0，更新的计数。
- 阻塞映射门禁仍然通过。

---

## 10. Phase 7: 最终自审计和剩余显式例外

### STEP4-T22: 产出 Step4 最终自审计

**覆盖的契约/债务 id:** 所有 `COP-*`，所有 `STEP4-DEBT-*`。

**输入证据:**
- 所有 Phase 0-6 任务完成证据。
- Step4 债务目录基线。
- Step4 阻塞映射。

**目标模块:** 仅审计 — 产出最终验证记录。

**所需行为变更:** 无（仅审计）。

**所需测试/门禁:**
- 对于 Phase 0 目录中的每个 `STEP4-DEBT-*` id:
  - 若已退休: 验证代码证据（diff）、阻塞门禁、FIRE 探针。
  - 若未退休: 验证具有 owner、原因、退休条件、增长预防测试。
  - 若为永久例外: 验证格式、增长预防测试、最后审查日期。
- 验证剩余债务数量 < Phase 0 基线数量。
- 运行完整端到端验证:
  - `npm test`（全量套件）。
  - `npm run lint`。
  - `npm run test:architecture`。
  - `node scripts/check-source-encoding.js`。
  - `git diff --check`。
  - 真实服务器证据: `verify-step4-phase1-real-server.js`（如适用）。
  - 真实 worker 证据: `verify-step4-phase3-real-server.js`（如适用）。
- 验证无 `COP-*` 强制执行从 Step3 状态被削弱。
- 验证已迁移的 inventory id 未退回到仅报告。

**防范的假通过:**
- 审计声称退休但未检查源码。
- 通过重新分类条目而不做结构性变更来减少数量。
- 跳过全量测试套件运行的验证。

**完成证据:**
- Step4 最终验证记录（本文档的更新版本，或新的 `step4-phase0-7-verification-2026-07-XX.md`）。
- Step4 最终移交表（映射 `COP-*` 到 Step4 退休证据）。
- 具有按条目记录的剩余债务目录。
- 完整端到端验证输出。

---

### STEP4-T23: 添加 Step4 最终审计阻塞门禁

**覆盖的契约/债务 id:** 所有 `COP-*`，所有 `STEP4-DEBT-*`。

**输入证据:**
- STEP4-T22 最终自审计。
- Phase 0 债务目录。
- Step4 阻塞映射。

**目标模块:**
- 新文件: `scripts/check-step4-final-audit.js`。
- 新文件: `scripts/check-step4-final-audit.test.js`。
- `scripts/run-architecture-smoke.js`（添加门禁）。

**所需行为变更:** 无（仅门禁）。

**所需测试/门禁:**
- 门禁将 Phase 0 目录剩余债务与 Step4 退休证据进行对账。
- 门禁在剩余 `STEP4-DEBT-*` 条目数量未严格小于 Phase 0 基线数量时失败。
- 门禁在任何已退休条目缺少阻塞门禁或 FIRE 探针证据时失败。
- 门禁在任何剩余条目缺少 owner、原因、退休条件、增长预防测试时失败。
- 门禁在任何 `pipeline-migrated-*` 条目具有路由拥有持久化调用时失败。
- 门禁在任何 handler 具有直接 lock/save 时失败。
- 门禁在任何前端命令提交路径评估领域资格时失败。
- 合成 FIRE 探针: 重新引入退休回归 → 门禁 exit 1。

**防范的假通过:**
- 门禁通过仅统计目录条目而不验证源码。
- 门禁接受"通过文档退休"作为有效退休证据。
- 门禁不将 handler lock/save、路由持久化或前端领域阻塞检查为结构性条件。

**完成证据:**
- Architecture smoke 中的门禁（阻塞模式）。
- 合成 FIRE 探针触发门禁。
- 生产门禁: 违规数 0，剩余债务数量 < 基线。
- `npm run test:architecture` 通过。
- `npm test` 全量套件通过。

---

## 11. Step4 完成条件

Step4 仅在 STEP4-T00 到 STEP4-T23 的所有任务完成且以下全部为真时算完成:

1. Step4 债务目录（`scripts/step4-debt-catalog/`）已提交。
2. 每个 Phase 0-7 任务具有可验证的完成证据。
3. Phase 0 门禁（`check-step4-debt-catalog`）以阻塞模式运行，违规数 0。
4. Phase 1 路由拥有持久化已退休或具有带增长预防测试的永久例外记录。
5. Phase 2 handler 边界门禁（`check-handler-boundary`）以阻塞模式运行，违规数 0。
6. Phase 3 worker 写入所有权门禁（`check-worker-write-ownership`）以阻塞模式运行，违规数 0。
7. Phase 4 前端命令语义门禁（`check-frontend-command-semantics`）以阻塞模式运行，违规数 0。
8. Phase 5 投影/写入边界门禁（`check-projection-write-boundary`）以阻塞模式运行，违规数 0。
9. Phase 6 阻塞映射覆盖所有已退休债务 id。
10. Phase 7 最终审计门禁（`check-step4-final-audit`）以阻塞模式运行，违规数 0，剩余债务数量 < Phase 0 基线。
11. `npm test`（全量套件）通过。
12. `npm run lint` 通过。
13. `npm run test:architecture` 通过（所有门禁阻塞 + 仅报告）。
14. `node scripts/check-source-encoding.js`: 违规数 0。
15. `git diff --check` 通过。
16. 无 `COP-*` 契约强制执行从 Step3 状态被削弱。
17. 适用阶段的真实服务器/worker 证据 JSON 文件存在。
18. Step4 最终验证记录已提交。
