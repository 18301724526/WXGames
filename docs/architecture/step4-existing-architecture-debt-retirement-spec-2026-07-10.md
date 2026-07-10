# Step4 现有架构债务退休 / 结构清理 Spec

状态: 已按 Phase 0-7 执行；验证记录见 `step4-phase0-7-verification-2026-07-10.md`
日期: 2026-07-10
范围: 退休 Step1-3 暴露的架构债务、结构耦合、仅报告发现项
契约准则: `command-owner-pipeline-contract-test-spec-2026-07-09.md`
源 Spec: `step1-command-owner-pipeline-prerequisite-staging-spec-2026-07-09.md`, `step2-command-owner-pipeline-prerequisite-admission-spec-2026-07-09.md`, `step3-command-owner-pipeline-implementation-spec-2026-07-09.md`
源任务: `step3-command-owner-pipeline-implementation-tasks-2026-07-09.md`
证据基线: `step3-phase2-7-verification-2026-07-10.md`

---

## 1. 目标

Step4 **不是** 新能力阶段，不是开发者套件，不是脚手架，不是最佳路径教程，不是套在现有债务外面的包装层。

Step4 是 **现有架构债务退休和结构清理**。

目标是退休 Step1-3 暴露但未消除的遗留耦合、隐藏职责、仅报告发现项和结构性妥协。Step3 交付了可运行的 Command Owner Pipeline，所有 17 个 `COP-*` 契约以阻塞模式对 127 个已迁移的 inventory id 强制执行。但 Step3 也明确记录了剩余债务：已编目但从未解决的仅报告发现项、被呈现出来但未移除的 route/handler/service 耦合、被包装但未被结构性消除的前端领域阻塞路径、以及仍然与写入正确性假设纠缠在一起的 projection/read 路径。

Step4 让架构从意图到结果全程可追溯，而无需猜测某个旧的 `disabled=false` 或路由局部的 `save()` 调用是否绕过了 pipeline。每一个已退休的债务项必须具备：代码级退休证据、已转换的阻塞门禁、以及增长预防测试。Step4 中不存在"用文档宣布清理完毕"。

**Step4 不是什么:**

- 不是开发者套件、脚手架、模板或最佳路径演示。
- 不是新的 pipeline 能力或 owner 类型。
- 不是添加新命令、新路由、新处理器或新功能的阶段。
- 不是把老问题包装在新的 helper/service/facade 名称后面。
- 不是在没有代码级退休的前提下删除仅报告发现项。
- 不是仅仅用文档声明某物已"退休"。

---

## 2. 准入条件

Step4 只能在 Step3 验证完成且以下所有条件均为真时开始:

1. `step3-phase2-7-verification-2026-07-10.md` 记录了 Phases 0-7 的 COMPLETE 状态，包括最终自审计。

2. `npm test` 全量套件通过 (2369/2369+)，`npm run lint` 通过，`npm run test:architecture` 通过。

3. 阻塞门禁映射 (`scripts/check-command-owner-blocking-map.js`) 覆盖 127 个已迁移的 inventory id，违规数 0。

4. `command-owner-pipeline-contract-test-spec-2026-07-09.md` 中的所有 17 个 `COP-*` 契约对已迁移 id 以阻塞模式强制执行。最终自审计章节中的剩余非阻塞债务记录标识了明确的条目，具有 owner、原因、退休条件和增长预防测试。

5. `scripts/report-command-owner-step1.js --summary` 报告 17/17 契约，inventory 漂移 0。

6. Step4 **不得** 削弱或绕过任何 Step3 已经以阻塞模式强制执行的 `COP-*` 契约。已迁移的 inventory id 不得从 `blocking-*` 退回到 `report-only-*` 状态。

如果任一准入条件不满足，先完成 Step3 再开始 Step4。

---

## 3. 不可协商的规则

以下规则附加于 Step1-3 所有不可协商规则之上。之前的规则不会被削弱或移除。

### 3.1 禁止包装/脚手架/模板逃避债务

- **R3.1.1**: 不得通过将旧耦合包装在名为 `*Service*`、`*Helper*`、`*Adapter*`、`*Facade*`、`*Manager*` 或 `*Pipeline*` 且未改变所有权边界的函数中来宣称退休。
- **R3.1.2**: 不得通过重命名模块、文件、方法、action 字符串、路由路径或变量来逃避门禁检测模式。
- **R3.1.3**: 不得通过引入新的抽象层（如 "DeveloperKit"、"CommandBuilder"、"GoldenPathRunner"）坐在现有债务之上但未实际消除底层债务来宣称退休。

### 3.2 禁止隐藏耦合

- **R3.2.1**: Route 代码（`backend/routes/` 下的文件）不得拥有 load/validate/execute/save/project/revision-retry 工作，对应已在 Step1 inventory 中分类为 `pipeline-migrated-*` 的任何写入条目。
- **R3.2.2**: 领域 handler（`backend/application/commands/` 和 `backend/actions/` 下）不得直接调用 `repository.save()`、`repository.upsert()`、`repository.set()`、`repository.delete()`、`GameStateRepository.*` 或任何锁获取 API。
- **R3.2.3**: Worker（`backend/world-worker.js` 和 `backend/services/realtime/WorldWorkerService.js` 下）不得绕过 `CommandExecutionPipeline` 执行任何改变玩家状态或共享世界状态的写入。
- **R3.2.4**: `frontend/js/platform/` 下的前端文件不得包含在派发前评估领域资格（`canAdvanceEraNow`、`canResearch`、`disabled`、`can*`、`eligible`、`ready`、`busy`、`cooldown`、`claimable`）的命令提交逻辑。此禁令适用于代码路径，不适用于纯展示或视觉提示路径。

### 3.3 禁止 Allowlist 扩大

- **R3.3.1**: 仅报告/已分类非玩法的条目 allowlist（server:player-login、admin:ops-*、admin:config-release-*、diagnostic:*）不得增长。新条目只能作为完全迁移且具有阻塞强制执行的 pipeline 条目添加。
- **R3.3.2**: 现有 server 写入排除项（三个无写入 POST 路由排除项）未经显式 Step4 门禁审查不得增长。每个新排除项必须具备相同的结构化元数据：owner、原因、退休条件、增长预防测试。

### 3.4 禁止无退休的仅报告发现项删除

- **R3.4.1**: 仅报告发现项（来自 Step1 报告、Phase7 剩余债务、领域业务候选报告、前端 ECS 报告）只有在以下全部为真时才能从报告中移除:
  (a) 代码级退休已提交（有问题的耦合在源码中被消除，而不仅仅是重新分类）。
  (b) architecture smoke 中存在阻止该耦合回归的阻塞门禁。
  (c) 增长预防测试验证阻塞门禁在回归时触发。
- **R3.4.2**: "通过文档退休"在 Step4 中不是有效的退休形式。在没有代码证据和阻塞门禁的情况下移除发现项是 Step4 合规缺口。

### 3.5 禁止存根/伪造证据

- **R3.5.1**: 退休证据必须可从源码验证。因为只在窄 mock 范围内断言"无回归"而通过的测试不是有效证据。
- **R3.5.2**: 任何涉及写入所有权、pipeline 入口、幂等性、owner 序列化或共享状态变更的退休都需要真实服务器证据（`verify-step4-*-real-server.js`）。使用与 Step3 Phase 证据脚本相同的生产加载模式（真实 `backend/server.js`、真实 SQLite、真实 `GameAPI -> ClientCommandSender -> fetch` 路径）。

### 3.6 禁止 Route/Handler/前端/Worker 重新拥有 Pipeline 职责

- **R3.6.1**: 任何 route、handler、前端 controller、renderer、面板 action runner 或 canvas shell 方法不得重新拥有 Step3 已移交给 `CommandExecutionPipeline`、`CommandCommitter` 或 `OwnerLockRepository` 的 pipeline 职责（load/save/project/retry/lock）。
- **R3.6.2**: 不得引入获取自身锁或直接调用 save 的新功能 handler。所有新写入必须进入 pipeline。

### 3.7 前端展示资格与命令提交分离

- **R3.7.1**: 计算 `visualDisabled`、`displayHint`、`canResearch`、`canAdvanceEraNow` 或类似领域形态展示状态的前端代码不得被命令提交路径作为阻塞理由消费。
- **R3.7.2**: Step1 inventory 中的所有 `through-client-command-sender` 分类条目的 `domainDisplayCanSuppressCall` 字段必须保持 `false`。任何退休任务不得将其改回 `true`。

### 3.8 读/投影新鲜度与写入正确性分离

- **R3.8.1**: 写入正确性（owner 解析、加锁、幂等、验证、提交）不得依赖于读/投影新鲜度、缓存状态、展示状态或客户端投影过期。
- **R3.8.2**: 提交后的投影失败（HTTP 202）绝不能被误解为写入失败。Step3 的 pipeline 契约保持不变: 先提交，后投影。

---

## 4. 范围

Step4 覆盖四条结构性清理主线。它们不是分开的功能；而是 Step1-3 暴露债务的四个轴线。

### A. 后端写入/领域边界清理

从仍被分类为 `legacy-route-orchestration-visible` 或仍通过非 pipeline 路径拥有 load/save/project/logic 的 route 和 service 中抽取剩余的写入编排。退休 `route-owned-orchestration` 债务条目。确保没有 service、helper 或 route 局部回调为任何 `pipeline-migrated-*` 条目执行 pipeline-committer 工作。

**目标源（来自 Step1 inventory 的 `ROUTE_ORCHESTRATION_DEBT`）:**
- `server:player-login` — 登录拥有 lock/retry/save callback/projection（`backend/routes/playerRoutes.js`）。
- `admin:config-release-publish`、`admin:config-release-rollback` — 已分类的配置写入，委托给 service 拥有的持久化。Step4 不要求将其迁移到玩法 pipeline，但要求退休任何可能成为未来功能绕过 pipeline 所有权的模板的隐藏写入编排模式。

**目标模块:**
- `backend/routes/playerRoutes.js`（登录流程）
- `backend/routes/adminRoutes.js`（配置发布路径）
- `backend/services/authService.js`（登录持久化所有权）

### B. Worker/后台/共享状态清理

退休任何绕过 pipeline 所有权、幂等性或 owner 序列化的 worker 拥有的写入编排。确保 `world-worker.js` 和 `WorldWorkerService.js` 没有在 `CommandExecutionPipeline` 之外变更状态的代码路径（如果有，这些路径必须具有显式的、已记录的永久例外和增长预防测试）。

**目标源:**
- Phase3 Phase6 的诚实阻断项已通过命令拆分解决（验证记录确认 worker 现在使用 pipeline）。Step4 验证在 Phase 5-6 期间没有添加重新引入 worker 拥有的 save/upsert 的回归代码路径。
- `backend/services/realtime/WorldWorkerService.js` — 验证所有变更都通过 `CommandCommitter.commitCommandState` 或具有显式的永久例外。

### C. 前端命令语义与展示-领域分离清理

退休消费领域形态展示状态（`disabled`、`can*`、`ready`、`busy`、`cooldown`、`claimable`）来抑制命令提交的前端代码路径。Step3 的 `ClientCommandSender` 已经在 transport 级别仅强制执行传输/负载形状的局部阻塞，但上游代码路径（CanvasActionDispatcher、CanvasPanelActionRunner、CanvasGameApp）仍然包含 `disabled` 丢弃逻辑。Step4 必须结构性移除这些领域阻塞路径，而不仅仅是包装它们。

**目标源（来自 Step1 inventory `FRONTEND_COMMAND_PATHS`，`domain-blocker` 分类）:**
- `frontend:canvas-action-dispatcher-disabled-drop`（`frontend/js/platform/CanvasActionDispatcher.js`）
- `frontend:canvas-panel-action-runner-disabled-drop`（`frontend/js/platform/CanvasPanelActionRunner.js`）
- `frontend:canvas-game-app-advance-era-local-block`（`frontend/js/platform/CanvasGameApp.js`）

**目标源（来自 Step1 inventory `CLIENT_LOCAL_BLOCKS`）:**
- `frontend:tech-research-local-canresearch`
- `frontend:building-local-cost-disabled`
- `frontend:famous-candidate-availability`
- `frontend:territory-mission-ready`
- `frontend:world-march-passability`

### D. 读/投影/调试追踪清理

确保读/投影路径与写入正确性结构上分离。退休那些仍将投影组装与写入编排混杂在一起的路由中的投影纠缠。确保 command trace 支持对所有已迁移命令从客户端意图（commandId）到 response 的端到端追踪，经过 pipeline 各阶段（owner resolution → lock → commit → projection）。

**目标源:**
- `server:player-login` 路由中的投影组装（`backend/routes/playerRoutes.js`）
- Phase7 移交表中的 `COP-PROJECTION-001` 剩余仅报告发现项 — 标记投影/写入纠缠的领域业务候选报告条目。
- `CommandTrace.js` — 验证它对所有 pipeline 阶段记录了完整的 trace，如 `COP-TRACE-001` 所规定。

---

## 5. 现有债务来源

以下所有债务均从代码库中提取，并非为本 spec 凭空发明。每个来源都可追溯到具体的 inventory id、报告发现项或验证记录。

### 5.1 Step1 仅报告发现项（inventories.js）

这些在 Step1 inventory 中被分类为 `domain-blocker`，但需要以**当前源码**而非旧 inventory 备注为准重新核对。Step4 不得假设 Step1 备注仍然准确；若当前代码已局部退休某条债务，Step4 必须将该条目改写为“已退休验证 + 防回归门禁 + inventory 同步更新”，而不是继续描述为“待删除的旧代码”。

| 发现项 ID | 文件 | 分类 | 状态 |
| --- | --- | --- | --- |
| `frontend:canvas-action-dispatcher-disabled-drop` | `frontend/js/platform/CanvasActionDispatcher.js` | domain-blocker | **inventory 备注已过时**；当前代码中 `CanvasActionDispatcher.handle()` 已先调用 `ClientCommandSemantics.normalizeAction()`，命令 action 的 `disabled` 会被转为 `visualDisabled` 并删除。剩余工作是验证 `normalizeAction()` 覆盖全部命令提交 action、为此添加防回归门禁，并将 non-command / UI-local `disabled` 分类为 `classified-ui-local` |
| `frontend:canvas-panel-action-runner-disabled-drop` | `frontend/js/platform/CanvasPanelActionRunner.js` | domain-blocker | 当前代码中 `CanvasPanelActionRunner.run()` 仍有 `if (action.disabled) return true;`，且**尚未**经过 `normalizeAction()` 中和。该条仍需逐条分类 command-submit action 与 panel-only / UI-local action；只有 command-submit 路径上的 `disabled` early-return 需要退休，panel-only / UI-local `disabled` 可保留并标记为 `classified-ui-local` |
| `frontend:canvas-game-app-advance-era-local-block` | `frontend/js/platform/CanvasGameApp.js` | domain-blocker | **inventory 备注已过时**；当前代码中 `CanvasGameApp.advanceEra()` 已直接调用 `GameAPI.advanceEra()`，不再以 `canAdvanceEraNow()` 作为提交前守卫。剩余工作是验证该债务已退休、禁止重新引入 `if (!this.canAdvanceEraNow()) return false;`，并确认 `canAdvanceEraNow()` 仅用于视觉提示 |
| `frontend:tech-research-local-canresearch` | 科技研究动作点击目标 | domain-blocker | 仅报告 |
| `frontend:building-local-cost-disabled` | 建造/升级派发路径 | domain-blocker | 仅报告 |
| `frontend:famous-candidate-availability` | 接受/驳回名人动作 | domain-blocker | 仅报告 |
| `frontend:territory-mission-ready` | claimConquest 派发 | domain-blocker | 仅报告 |
| `frontend:world-march-passability` | startWorldMarch 派发 | domain-blocker | 仅报告 |

### 5.2 Phase7 剩余非阻塞债务（最终自审计）

| 债务 ID | 契约 | 当前状态 | Owner | 退休条件 |
| --- | --- | --- | --- | --- |
| `server:player-login` | `COP-ROUTE-001`、`COP-ENTRY-001`、`COP-PROJECTION-001` | 已分类为 auth/player 写入，未 pipeline-migrated | auth/platform | 若登录变成玩法命令或共享状态变更，加入 pipeline 和阻塞映射 |
| `admin:ops-login-audit` | `COP-ENTRY-001`、`COP-ROUTE-001`、`COP-TRACE-001`、`COP-IDEMP-001` | 已分类为 ops 写入 | ops/platform | 若变更玩法状态，添加 pipeline/阻塞映射条目 |
| `admin:ops-maintenance-state` | 同上组 | 同上状态 | ops/platform | 同上条件 |
| `admin:ops-restart-audit` | 同上组 | 同上状态 | ops/platform | 同上条件 |
| `admin:config-release-publish` | `COP-ENTRY-001`、`COP-ROUTE-001` | 已分类为 config 写入 | admin/config | 若配置发布变成玩法命令流量，迁移 |
| `admin:config-release-rollback` | 同上组 | 同上状态 | admin/config | 同上条件 |
| `diagnostic:client-events-ingest` | `COP-ENTRY-001`、`COP-TRACE-001` | 已分类为 diagnostic 写入 | observability | 若诊断摄取影响玩法状态 |
| `diagnostic:client-operation-log-ingest` | `COP-ENTRY-001`、`COP-TRACE-001`、`COP-CLIENT-001` | 同上状态 | observability | 同上条件 |
| `COP-OWNER-002: resolveCapture` | `COP-OWNER-002` | 保持私有玩家拥有 | territory/world | 除非未来范围令占领决策变为共享 |
| `COP-SHARED-001: loot/boss` | `COP-SHARED-001` | 未来的 owner 抽象，仅表示 | shared-world | 直到 loot/boss 路由存在 |
| `COP-CLIENT-001/002: report-only findings` | `COP-CLIENT-001`、`COP-CLIENT-002` | 仅报告展示-领域信号保留 | frontend | 必须结构性消除，而非仅传输阻止 |
| `COP-PROJECTION-001: domain business candidates` | `COP-PROJECTION-001` | 仅报告架构 backlog | architecture | 投影/写入纠缠必须退休 |

### 5.3 领域业务候选仅报告门禁

`scripts/report-domain-business-candidates.js` 标记了前端渲染器、平台壳或路由代码可能拥有玩法规则计算的结构性信号。这些是当前通过（exit 0）的仅报告发现项，但包含与上述前端领域阻塞和路由编排债务来源重叠的条目。Step4 必须在底层债务退休后将相关子集转换为阻塞门禁。

### 5.4 前端 ECS 仅报告门禁

以下仅报告脚本当前在 architecture smoke 中以 `--summary` 模式运行（exit 0 无论有无发现项）。每个脚本标识了 Step4 必须评估是否退休的前端 ECS 架构中的结构性债务:

- `scripts/report-frontend-ecs-mode-ownership.js` — 模式所有权骨干违规。
- `scripts/report-frontend-ecs-renderer-authority.js` — 渲染器外部写入权限违规。
- `scripts/report-frontend-ecs-input-branch.js` — 输入路径分支扩散。
- `scripts/report-frontend-ecs-literal-duplicate.js` — 字面量重复信号。

> **注意:** `scripts/report-frontend-ecs-bridge-shrink.js` 已从仅报告来源列表中移除，因为该脚本当前作为阻塞门禁运行（bridge/facade 文件增长已被现有 guard 覆盖）。

Step4 不得删除这些报告。每个报告在底层债务退休后要么转换为阻塞门禁，要么保留为仅报告，并具有显式的退休条件和增长预防测试。

### 5.5 Route/Handler 迁移门禁（阻塞，已强制执行）

以下**不是**债务 — 它们是已对已迁移 id 强制执行 Step3 契约的阻塞门禁。Step4 不得削弱它们:

- `scripts/check-command-route-migration.js` — 29 个已迁移 action，0 延期。
- `scripts/check-command-owner-entry-coverage.js` — 17 个 server 写入条目。
- `scripts/check-command-pipeline-foundation.js` — `withOwnerLocks` 公共方法、规范排序。
- `scripts/check-command-owner-blocking-map.js` — 127 个已迁移 id。

### 5.6 Command Owner 阻塞映射（已强制执行）

`scripts/check-command-owner-blocking-map.js` 中的 127 个已迁移 inventory id。分布: 9 个 server 写入、29 个游戏 action、33 个前端写入 helper、56 个前端命令路径。

### 5.7 最终移交表（Phase7）

`step3-phase2-7-verification-2026-07-10.md` "最终实现移交"章节中的 17 契约移交表记录了每个 `COP-*` 契约的剩余债务。这是 Step4 的权威基线。

---

## 6. 各阶段

### Phase 0: 债务 Inventory 标准化与验收基线

**目标:** 产出标准化债务目录，后续 Phase 1-7 的每个任务都必须引用。Phase 0 建立基线之前不得开始任何 Step4 工作。

**范围内:**
- 从以下来源提取每个仅报告发现项:
  - Step1 `FRONTEND_COMMAND_PATHS` 中 `domain-blocker` 分类条目。
  - Step1 `CLIENT_LOCAL_BLOCKS` 中 `domain-blocker` 分类条目。
  - Step1 `ROUTE_ORCHESTRATION_DEBT` 条目。
  - Phase7 最终自审计剩余非阻塞债务记录。
  - `scripts/report-domain-business-candidates.js` 中与 command-owner 债务重叠的发现项。
  - `scripts/report-frontend-ecs-*.js` 中与写入所有权或展示/命令分离关注点重叠的发现项。
- 为每个债务条目分配唯一的 `STEP4-DEBT-*` id。
- 为每个债务条目分配初始退休阶段（1-5）、目标模块和它触碰的具体 `COP-*` 契约。
- 记录当前基线: 债务条目数量、按阶段分布、按来源分布（Step1、Phase7、domain-candidates、frontend-ecs），以及 inventory 备注/状态与当前源码一致性的核对结果。
- **去重规则:** 以 `inventoryId` 为唯一债务键。同一底层债务可能被多个来源报告（例如 `FRONTEND_COMMAND_PATHS` 与 `CLIENT_LOCAL_BLOCKS` 可能引用同一源码模式），必须合并为单一条目，`sourceRefs` 数组记录所有来源引用，禁止对同一 `inventoryId` 重复计数。
- **`sourceRefs` 正式结构:** `sourceRefs` 不得只写“数组”。每个元素必须为:
  ```json
  {
    "file": "frontend/js/platform/CanvasActionDispatcher.js",
    "startLine": 50,
    "endLine": 53,
    "symbolOrPattern": "CanvasActionDispatcher.handle -> normalizeAction(action) / normalizedAction.disabled",
    "inventoryId": "frontend:canvas-action-dispatcher-disabled-drop"
  }
  ```
- **`check-step4-debt-catalog.js` 匹配逻辑:** 对每个 debt item，门禁必须验证:
  1. `sourceRefs[*].file` 指向的文件存在；
  2. `startLine` / `endLine` 为有效行范围，且 `startLine <= endLine`；
  3. 行范围文本或 `symbolOrPattern` 的 AST/模式匹配能在源码中重新定位对应的 `inventoryId` / source pattern；
  4. 同一 `inventoryId` 只能生成一个 debt item；
  5. 同一 `inventoryId` 的多来源证据必须合并到单个条目的 `sourceRefs` 中。
- **Phase 0 catalog JSON 示例:**
  ```json
  {
    "debtId": "STEP4-DEBT-011",
    "inventoryId": "frontend:canvas-action-dispatcher-disabled-drop",
    "classification": "domain-blocker",
    "currentStatus": "report-only",
    "targetPhase": 4,
    "contracts": ["COP-CLIENT-001", "COP-CLIENT-002"],
    "sourceRefs": [
      {
        "file": "frontend/js/platform/CanvasActionDispatcher.js",
        "startLine": 50,
        "endLine": 53,
        "symbolOrPattern": "CanvasActionDispatcher.handle -> normalizeAction(action) / normalizedAction.disabled",
        "inventoryId": "frontend:canvas-action-dispatcher-disabled-drop"
      },
      {
        "file": "scripts/command-owner-step1/inventories.js",
        "startLine": 573,
        "endLine": 582,
        "symbolOrPattern": "FRONTEND_COMMAND_PATHS entry",
        "inventoryId": "frontend:canvas-action-dispatcher-disabled-drop"
      }
    ]
  }
  ```
- **Phase 0 先验核对要求:** 在生成 catalog 之前，必须先对照当前源码验证 `scripts/command-owner-step1/inventories.js` 中相关条目的 `notes` / `status` 是否仍与现实一致。若 inventory 备注已过时，Phase 0 必须在 catalog 中记录“inventory stale”并将其列入 STEP4-T21 的执行更新清单。本轮如仅允许改文档，可不直接修改 `inventories.js`，但执行阶段不得跳过该同步动作。
- **`classified-ui-local` 元数据格式:** 与 D5 永久例外一样，凡保留 UI-local `disabled` 的条目必须具备完整元数据:
  ```json
  {
    "classification": "classified-ui-local",
    "actionType": "panelTabSwitch",
    "reason": "仅切换/刷新 UI 面板，不触发 ClientCommandSender",
    "evidenceRefs": [
      { "file": "frontend/js/platform/CanvasPanelActionRunner.js", "startLine": 160, "endLine": 168 }
    ],
    "proofNotClientCommandSender": "descriptor.execute 仅操作 panel surface / modal state，不调用 ClientCommandSender 或 CanvasActionController 命令路径",
    "owner": "frontend/platform",
    "growthPreventionTest": "scripts/tests/check-classified-ui-local-panel-actions.test.js"
  }
  ```
- **`retired-step4` 元数据格式:** 凡标记为已退休的 Step4 条目必须具备:
  ```json
  {
    "classification": "retired-step4",
    "retiredByTask": "STEP4-T13",
    "retirementEvidenceRefs": [
      { "file": "frontend/js/platform/CanvasGameApp.js", "startLine": 2810, "endLine": 2818 }
    ],
    "blockingGate": "scripts/check-frontend-command-semantics.js",
    "fireProbe": "重新引入 if (!this.canAdvanceEraNow()) return false; -> exit 1",
    "date": "2026-07-10",
    "contracts": ["COP-CLIENT-001", "COP-AUTHORITY-001", "COP-TIME-001"]
  }
  ```
- 添加 Phase 0 门禁测试，当债务目录与实际源码树不匹配时失败（防止 spec 与现实的漂移）。

**范围外:**
- 更改任何源代码。
- 更改任何仅报告或阻塞门禁。
- 声称任何债务已退休。

**目标模块 / 报告来源:**
- `scripts/command-owner-step1/inventories.js`（FRONTEND_COMMAND_PATHS、CLIENT_LOCAL_BLOCKS、ROUTE_ORCHESTRATION_DEBT）
- `step3-phase2-7-verification-2026-07-10.md`（最终自审计章节）
- `scripts/report-domain-business-candidates.js`
- `scripts/report-frontend-ecs-renderer-authority.js`
- `scripts/report-frontend-ecs-mode-ownership.js`
- `scripts/report-frontend-ecs-input-branch.js`
- `scripts/report-frontend-ecs-literal-duplicate.js`

**所需代码变更类别:** 仅新文件（债务目录模块 + Phase 0 门禁测试）。无行为变更。

**所需测试:**
- 债务目录产生确定性输出。
- Phase 0 门禁对当前树通过（目录匹配源码）。
- Phase 0 门禁在债务条目从目录移除但无源码变更时失败。
- Phase 0 门禁在出现新的仅报告发现项但无目录条目时失败。
- Phase 0 门禁在 inventory 备注声称的状态与源码现状不一致时报告漂移；Phase 6 之前可为 report-only，进入 blocking 前必须清零。

**所需架构门禁:**
- architecture smoke 中新增 `scripts/check-step4-debt-catalog.js`（初始为仅报告；Phase 6 变为阻塞）。

**反规避/假通过案例:**
- 目录条目无对应源码证据。
- 目录条目将 domain-blocker 重新分类为 `display-only` 但未做结构性代码退休。
- 目录条目基于 Step3 `ClientCommandSender` 传输阻止而宣称退休，但未移除上游领域检查代码。
- 门禁通过是因为它统计了目录条目数量但未验证源码行证据。

**完成条件:**
- `STEP4-DEBT-*` 目录覆盖所有已标识债务。
- 每个条目包含: debt id、`inventoryId`、分类、`COP-*` 契约、目标退休阶段、退休条件、当前状态、正式 `sourceRefs`、以及适用时的 `classified-ui-local` / `retired-step4` 元数据。
- Phase 0 门禁在 architecture smoke 中运行并目录匹配源码。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。
- `git diff --check` 通过。

**移交证据:**
- 债务目录模块（如 `scripts/step4-debt-catalog/index.js`）。
- Phase 0 验收记录，显示按来源和阶段的目录计数。
- Smoke 输出，显示门禁对当前树通过。

---

### Phase 1: 后端 Route / Service / Helper 职责退休

**目标:** 退休 `playerRoutes.js`（登录）中的路由拥有写入编排，以及任何为 `pipeline-migrated-*` 条目重复 pipeline 所有权的 service/helper 路径。确保没有非 pipeline 代码路径作为未来绕过的模板持续存在。

到 Phase 1 结束时，Step1 inventory 中的 `ROUTE_ORCHESTRATION_DEBT` 对所有对应命令为 `pipeline-migrated-*` 的条目必须为空。已分类的非玩法条目（ops、config、diagnostic）必须将其路由拥有编排模式记录为显式永久例外并具有增长预防测试，或被结构性退休。

**范围内:**
- `server:player-login`: 将登录持久化从路由回调（`playerRoutes.js` 中的 `repository.save`）移入 `CommandExecutionPipeline`，通过 `playerLogin` 命令定义，或者显式记录为什么 `playerLogin` 必须保持为已分类非玩法写入并将路由拥有编排作为永久例外。如果决定记录为永久例外，路由拥有编排必须仍然在结构上可见，并具有增长预防测试，在以下情况时失败:
  (a) 登录开始变更超出玩家状态创建范围的玩法状态，或
  (b) 另一路由复制登录模式用于玩法写入。
- `admin:config-release-*`: 验证无隐藏写入编排模式。记录或退休。
- 扫描 `backend/routes/` 和 `backend/services/` 下所有文件，找到不在 `CommandCommitter` 或 `OwnerLockRepository.withOwnerLocks` 内部的 `repository.save`、`repository.upsert`、`GameStateRepository.save`、`GameStateRepository.upsert` 或 owner-lock 调用。标记任何与 `pipeline-migrated-*` 条目相关的。

**范围外:**
- 将 ops/config/diagnostic 路由迁移到玩法 pipeline。
- 更改认证流程（登录仍是认证，非玩法）。
- 前端变更。

**目标模块 / 报告来源:**
- `backend/routes/playerRoutes.js`
- `backend/routes/adminRoutes.js`
- `backend/services/authService.js`
- Step1 `ROUTE_ORCHESTRATION_DEBT` 条目

**所需代码变更类别:**
- 登录路由的结构性重构 或 显式永久例外记录。
- 移除任何仍有路由拥有 save/持久化回调的 pipeline-migrated 条目。
- 对任何剩余路由拥有编排的增长预防门禁。

**所需测试:**
- 若登录进入 pipeline: 完整 pipeline 集成测试（owner 解析、幂等、提交、投影）。
- 若登录保持已分类: 增长预防测试，当新路由复制登录编排模式用于玩法命令时失败。
- 架构门禁，阻止路由文件中 `repository.save` 或 `GameStateRepository.*` 调用用于 pipeline-migrated inventory id。

**所需架构门禁:**
- 新增或更新门禁，检查已迁移 id 的路由拥有持久化。
- 登录模式传播的增长预防门禁。

**反规避/假通过案例:**
- 将 `repository.save` 从路由移到 helper 并声称路由干净。
- 重命名路由函数以避免门禁检测。
- 添加 pipeline facade 但内部仍然调用路由拥有 save。
- 路由回调仍拥有持久化的同时声称登录已"迁移"。

**完成条件:**
- `server:player-login` 要么具有显式永久例外记录和增长预防测试，要么其路由拥有编排已退休且登录进入 `CommandExecutionPipeline`。
- 任何 `pipeline-migrated-*` 条目不存在路由拥有 `save`/`upsert`。
- `backend/routes/` 文件不为任何已迁移条目直接调用 `repository.save` 或 `GameStateRepository.*`。
- 新/现有阻塞门禁通过。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。
- `git diff --check` 通过。
- 若登录进入 pipeline: 真实服务器证据。

**移交证据:**
- 登录退休决策记录（pipeline 入口 或 永久例外）。
- 路由拥有持久化扫描报告（已迁移 id 的违规数 0）。
- 增长预防测试输出。
- 真实服务器证据（如适用）。

---

### Phase 2: 领域 Handler 和 Committer 边界加固

**目标:** 验证并加固没有领域 handler 为 pipeline 迁移的命令保留锁或持久化所有权。确保 `CommandCommitter` 是为 pipeline 执行的命令调用仓库持久化的唯一组件。退休任何仍被分类为债务的 handler 拥有的 lock/save 路径。

Step3 Phase7 已经报告 `HANDLER_LOCK_PERSISTENCE_DEBT = []`（空）。Phase 2 验证这在结构上为真，并添加阻止回归的阻塞门禁: 任何直接**或通过被 handler 导入的 service/helper/facade 间接**调用 `repository.save`、`repository.upsert`、`OwnerLockRepository.*` 或 `withPlayerStateLock` 的新 handler 在 architecture smoke 中被阻止。

**范围内:**
- 审计 `backend/application/commands/` 和 `backend/actions/` 下所有文件的直接与间接 lock/save 调用。
- 添加阻塞门禁: `scripts/check-handler-boundary.js`。
- 验证所有暂存变更（返回 mutation 对象）的 handler 从不直接持久化。
- 为间接调用盲区定义机械化方案: 要么定义 import-recursive 扫描范围（handler → service/helper/facade 递归导入闭包），要么使用 CodeGraph/call graph 追踪 handler → service/helper/facade → `repository.save` / `OwnerLockRepository.*` / `withPlayerStateLock`。

**范围外:**
- Handler 业务逻辑更改。
- 新 owner 类型。
- 前端变更。

**目标模块 / 报告来源:**
- `backend/application/commands/*.js`
- `backend/actions/*.js`
- Step1 `HANDLER_LOCK_PERSISTENCE_DEBT`

**所需代码变更类别:**
- 若 Step3 已完全退休此债务，可为零代码变更。
- 最低要求: 添加具有 FIRE 探针的阻塞门禁。

**所需测试:**
- 新增阻塞门禁，具有合成的 FIRE 探针，证明能捕获:
  (a) 一个 handler 调用 `repository.save()`。
  (b) 一个 handler 获取 `withOwnerLocks()`。
  (c) 一个 handler 直接调用 `withPlayerStateLock()`。
  (d) 一个 handler 导入的 service/helper 内部调用 `repository.save()`。

**所需架构门禁:**
- architecture smoke 中的 `scripts/check-handler-boundary.js`（阻塞模式）。

**反规避/假通过案例:**
- Handler 将 save 移到 helper/service/facade，门禁仍必须追踪到。
- 门禁仅检查文件名模式，遗漏了其他目录中的 handler 文件。
- 门禁通过是因为不检查通过 service 注入或 import 链路到达的间接调用。

**完成条件:**
- Handler 边界门禁通过，违规数 0。
- 合成的 FIRE 探针全部触发门禁。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。

**移交证据:**
- Handler 边界门禁输出（违规数 0）。
- 合成的 FIRE 探针结果。
- Handler 审计报告，确认已迁移 handler 中零直接持久化。

---

### Phase 3: Worker / 后台 / 共享状态所有权清理

**目标:** 验证并加固 worker/后台写入在结构上与请求写入一致。确保没有 worker 代码路径在 `CommandExecutionPipeline` 之外变更玩家或共享状态。如果存在永久例外（如 worker 特定的批处理操作），必须有显式记录和增长预防测试。

Step3 Phase6 已经报告 worker 写入通过 `CommandExecutionPipeline` 进行，包含命令拆分（`worldWorkerPlayerTick`、`worldWorkerPersonUpdate`、`worldWorkerDiplomacyTick`）。Phase 3 验证这在结构上持久，并显式覆盖 worker → service/helper/facade 的间接调用链。

**范围内:**
- 审计 `backend/world-worker.js` 和 `backend/services/realtime/WorldWorkerService.js` 中 pipeline 之外的任何直接变更。
- 审计所有在 HTTP 请求上下文之外运行的后台/service 代码的状态变更。
- 添加阻塞门禁: `scripts/check-worker-write-ownership.js`。
- 记录任何永久例外。
- 为 worker 门禁定义 import-recursive / CodeGraph 追踪规则，覆盖 worker → service/helper/facade → `repository.save` / `OwnerLockRepository.*` / `withPlayerStateLock`。

**范围外:**
- 添加新 worker 命令。
- Worker 性能优化。
- 更改 worker 调度或心跳频率。

**目标模块 / 报告来源:**
- `backend/world-worker.js`
- `backend/services/realtime/WorldWorkerService.js`
- 任何其他变更游戏状态的后台进程。

**所需代码变更类别:**
- 若 Step3 已完全退休 worker 债务，可为零。
- 最低要求: 添加阻塞门禁。
- 若发现任何直接变更: 重构为 pipeline 入口或记录为永久例外。

**所需测试:**
- Worker 写入所有权门禁，具有 FIRE 探针。
- Worker 状态变更审计测试（若完全干净则为通过）。
- 若记录了永久例外: 增长预防测试。
- FIRE 探针必须包含: 将 `repository.save()` 放入 worker 导入的 service/helper 内部时，门禁 exit 1。

**所需架构门禁:**
- architecture smoke 中的 `scripts/check-worker-write-ownership.js`（阻塞模式）。

**反规避/假通过案例:**
- Worker 将变更移到 helper/service/facade，门禁仍必须追踪到。
- 门禁仅检查 `world-worker.js`，遗漏了 service 文件。
- Worker 存储了 pipeline 引用，但在回调外调用 save。

**完成条件:**
- Worker 写入所有权门禁通过，违规数 0（或有记录文档的永久例外和增长预防测试）。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。
- 真实 worker 证据: `verify-step4-phase3-real-server.js` 确认在同一进程证据中 worker 变更通过 pipeline。

**移交证据:**
- Worker 所有权审计报告。
- Worker 阻塞门禁输出。
- 真实 worker 证据 JSON。
- 永久例外记录（如有）。

---

### Phase 4: 前端展示 / 领域命令语义债务退休

**目标:** 结构性消除消费领域形态展示状态来抑制命令提交的前端命令提交路径。这是 Step3 通过在传输级别包装 `ClientCommandSender` 而推迟的核心结构性清理。**但 Step4 必须以当前源码为准重新基线**: `CanvasActionDispatcher.handle()` 已先调用 `ClientCommandSemantics.normalizeAction()`，`CanvasGameApp.advanceEra()` 已直接调用 `GameAPI.advanceEra()`；因此这两个条目在 Step4 中的任务重点是“验证现状 + 门禁防回归 + inventory 同步”，而不是继续描述为“删除仍然存在的旧守卫”。

Step3 在传输级别使命令提交路径无害（sender 拒绝领域阻塞）。Step4 使它们在结构上退休: 命令提交路径上的领域阻塞代码被移除或转换为永远不会到达命令派发的纯展示（视觉提示）操作。非命令/面板/展示 action 路径（如 `CanvasPanelActionRunner` 中的 panel-only action）需要逐条分类，不得一刀切要求进入 `ClientCommandSender`。

**范围内:**

> **清理范围限定:** Step4 仅禁止 **命令提交路径（command-submit path）** 消费领域形态展示状态来抑制命令提交。非命令/面板/展示 action 的 UI-local `disabled` 需要明确分类，不得简单要求所有 action 都进入 `ClientCommandSender`。

- **命令提交路径（必须退休）:**
  - `CanvasActionDispatcher.handle()`: **验证当前实现**继续先调用 `ClientCommandSemantics.normalizeAction()`，使所有命令 action 在进入 dispatcher 判定前将 `disabled` 转为 `visualDisabled` 并删除 `disabled`。Step4 门禁必须禁止移除该 `normalizeAction()` 调用，并验证 `ClientCommandSemantics.COMMAND_ACTION_TYPES` 覆盖所有命令提交 action。
  - `CanvasGameApp.advanceEra()`: **验证当前实现**继续直接调用 `GameAPI.advanceEra()`，禁止重新引入 `if (!this.canAdvanceEraNow()) return false;`。`canAdvanceEraNow()` 仅可用于视觉提示，不得进入命令提交决策。
  - 科技、建筑、名人、领土、世界行军的命令点击目标: 从命令派发决策中移除领域资格。点击目标可以显示视觉提示（变灰、tooltip），但命令提交动作不得被抑制。
- **非命令/面板/展示 action（需明确分类，不得强制进入 ClientCommandSender）:**
  - `CanvasPanelActionRunner.run()`: 其 `action.disabled` 可能为合法的 UI-local 状态（面板显示/隐藏、展示刷新、UI 状态切换等不产生命令提交的路径）。必须逐条分类: 若 action 最终通过 `ClientCommandSender` 提交命令，属于命令提交路径，领域 disabled 必须退休；若 action 仅操作 UI 面板且不产生命令，`action.disabled` 归类为 `classified-ui-local`，并按 Phase 0 定义记录 `actionType`、`reason`、`evidenceRefs`、`proofNotClientCommandSender`、`owner`、`growthPreventionTest`。
  - 其他不产生命令提交的 action 路径: 同样按上述规则明确分类，不得一刀切要求进入 `ClientCommandSender`。
- 渲染器和 presenter: 审计并确保命令提交消费者从不检查来自领域资格的 `disabled` 标志。将命令提交路径上的 `disabled` 转换为 `visualDisabled`（纯展示）。
- `scripts/command-owner-step1/inventories.js` 中 `frontend:canvas-action-dispatcher-disabled-drop`、`frontend:canvas-game-app-advance-era-local-block` 及与 `CanvasPanelActionRunner` 分类说明相关的 `notes` / `status` 当前已知过时；若本轮仅改文档，则必须在执行阶段由 STEP4-T01 / T21 明确更新。

**范围外:**
- 更改 `ClientCommandSender` 行为（已正确）。
- 更改渲染器渲染逻辑（视觉提示保留）。
- 添加新前端功能。
- 更改 Step1 inventory 分类逻辑（inventory 是证据，不是目标）。

**目标模块 / 报告来源:**
- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasPanelActionRunner.js`
- `frontend/js/platform/CanvasGameApp.js`
- `frontend/js/platform/CanvasActionController.js`
- `frontend/js/platform/CanvasGameShell.js`
- `frontend/js/platform/GameCommandService.js`
- 具有命令能力的 renderer 和 presenter
- Step1 `FRONTEND_COMMAND_PATHS` 中 `domain-blocker` 分类条目
- Step1 `CLIENT_LOCAL_BLOCKS` 中 `domain-blocker` 分类条目

**所需代码变更类别:**
- 派发器、面板 runner、game app 中领域阻塞代码的结构性移除。
- 当标志仍为视觉提示所需时，将 `disabled` 转换为 `visualDisabled`。
- 更新 Step1 inventory 以反映已退休状态。

**所需测试:**
- 前端测试证明 `CanvasActionDispatcher` 对路由到 `ClientCommandSender` 的命令 action，不被 `action.disabled` 阻断（包括 `visualDisabled=true` 的 action 仍被转发），且该语义来自 `normalizeAction()` 而非偶然遗漏。
- 前端测试证明 `CanvasActionDispatcher` 对 non-command / panel / UI-local action，`action.disabled` 行为保持不变，且该 action 在 inventory 中归类为 `classified-ui-local`，记录分类依据。
- 前端测试证明 `CanvasPanelActionRunner` 对最终进入 `ClientCommandSender` 的 action，`action.disabled` 提前返回已退休；对 panel-only action，保留 UI-local `disabled` 行为且不强制进入 `ClientCommandSender`。
- 前端测试证明 `CanvasGameApp.advanceEra()` 不会基于 `canAdvanceEraNow()` 在 `GameAPI.advanceEra()` 之前返回。
- 前端测试 / 门禁证明 `ClientCommandSemantics.COMMAND_ACTION_TYPES` 覆盖所有命令提交 action；删除任一命令 action 会导致门禁失败。
- 前端测试证明视觉提示仍然渲染（纯展示）。
- 具有合成 FIRE 探针的架构门禁测试。

**所需架构门禁:**
- 新增或更新 `scripts/check-frontend-command-semantics.js`，阻止命令提交路径上的领域资格，并验证 `CanvasActionDispatcher.handle()` 持续调用 `ClientCommandSemantics.normalizeAction()`、`ClientCommandSemantics.COMMAND_ACTION_TYPES` 覆盖完整。
- 更新 Step1 inventory，domain-blocker 条目标记为已退休。

**反规避/假通过案例:**
- 将 `disabled` 检查从派发器移到 helper 并声称已清理。
- 将 `disabled` 重命名为 `commandEligibility` 但仍然阻塞。
- 在渲染器和派发器之间添加新的中间组件，重新引入领域阻塞。
- 门禁通过是因为 `ClientCommandSender` 已经阻止，但上游代码仍存在死领域检查路径。

**完成条件:**
- 所有 `FRONTEND_COMMAND_PATHS` 中 `domain-blocker` 分类条目且属于命令提交路径的，要么结构性退休（代码移除/更改），要么显式重新分类为 `display-only` 并具有证据。
- 所有 `CLIENT_LOCAL_BLOCKS` 中 `domain-blocker` 分类条目已退休（生产者不再导致命令阻塞）。
- 非命令/面板/展示 action 路径（如 `CanvasPanelActionRunner` 中的 panel-only action）已完成分类: `classified-ui-local` 条目记录分类依据，不强制进入 `ClientCommandSender`。
- 新阻塞门禁通过，违规数 0。
- 现有阻塞门禁（`client-command-block-reasons`、`client-command-sender-coverage`）仍然通过。
- 视觉提示仍正确显示（回归测试）。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。
- 前端测试范围通过。

**移交证据:**
- 显示已移除领域阻塞代码路径的 diff。
- Step1 inventory 前后对比，显示已退休条目。
- 前端命令语义门禁输出。
- 视觉回归证据（截图或证明提示仍然渲染的单元测试）。

---

### Phase 5: 投影 / 读 / 调试追踪边界清理

**目标:** 确保读/投影路径与写入正确性在结构上分离。确保 `CommandTrace` 覆盖所有已迁移命令的所有 pipeline 阶段。退休 `COP-PROJECTION-001` 仅报告发现项标记的任何投影/写入纠缠。

**范围内:**
- 验证 `CommandTrace` 为所有已迁移命令记录 owner key、幂等状态、owner 等待、执行时长、验证结果、提交结果、修订版本、response 状态和有序阶段。
- 验证读路径（`GET /api/buildings`、`GET /api/game/...`、只读心跳 GET、projections）不依赖写入侧状态新鲜度来保证正确性。
- 验证提交后投影失败返回 202 且不回滚已提交状态。
- 审计 `backend/services/GameStateService.js` 和 `backend/services/ClientGameStateAssembler.js` 中决定写入正确性的任何读路径代码。
- 退休 Phase7 移交表中 `COP-PROJECTION-001` 的仅报告发现项: 标记投影/写入纠缠的领域业务候选条目。

**范围外:**
- 添加新投影类型。
- 优化读性能。
- 更改读路径投影格式。

**目标模块 / 报告来源:**
- `backend/application/commands/CommandTrace.js`
- `backend/services/GameStateService.js`
- `backend/services/ClientGameStateAssembler.js`
- `backend/routes/playerRoutes.js`（登录投影组装）
- Phase7 最终自审计 `COP-PROJECTION-001` 剩余债务
- `scripts/report-domain-business-candidates.js` 发现项

**所需代码变更类别:**
- `CommandTrace` 完整性审计及任何缺失字段补充。
- 投影/写入边界加固（若已正确可为零变更，但必须验证）。

**所需测试:**
- Trace 完整性测试: 断言已迁移命令记录了每个 pipeline 阶段。
- 投影独立性测试: 证明读路径优雅返回过期数据而不影响写入结果。
- 提交后投影失败测试: 证明 HTTP 202 且已提交状态完整。

**所需架构门禁:**
- 新增或更新 `scripts/check-projection-write-boundary.js`（初始仅报告，Phase 6 转为阻塞）。

**反规避/假通过案例:**
- 门禁检查 trace 字段名称但不验证运行时是否填充。
- 读路径有依赖写入侧缓存新鲜度的回退路径。
- 投影失败被静默吞噬且写入结果受到影响。

**完成条件:**
- `CommandTrace` 为所有已迁移命令记录所有所需字段。
- 读路径不以写入新鲜度为门控。
- 提交后投影失败被正确处理而不回滚写入。
- `COP-PROJECTION-001` 仅报告发现项减少或带有证据退休。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。

**移交证据:**
- Trace 完整性审计报告。
- 投影独立性证据（测试输出）。
- Phase7 风格移交中更新的 `COP-PROJECTION-001` 状态。

---

### Phase 6: 将已退休的仅报告债务转换为阻塞门禁

**目标:** 对于 Phases 1-5 中退休的每个债务条目，将对应的仅报告发现项转换为阻塞架构门禁。Step4 中不得有缺少阻止回归的阻塞门禁而被声称退休的债务。

此阶段遵循与 Step3 Phase 7（`STEP3-T18A`）相同的按 inventory id 翻转门禁模式: 每个已退休的债务 id 的对应仅报告报告发现项必须在同一变更切片中转换为阻塞失败。

门禁模式要求如下:
- 已验证生产违规数为 0 且债务已结构性退休的门禁，可以直接设为 blocking。
- 仍处于盘点、分类或退休中的门禁，先保持 report-only。
- 从 report-only 转为 blocking，必须同时具备“生产 0 违规”与“FIRE 探针命中”的证据。

**范围内:**
- 对 Phases 1-5 中标记为已退休的每个 `STEP4-DEBT-*` id:
  - 验证退休证据（代码 diff、测试输出）。
  - 在 architecture smoke 中添加/更新阻塞门禁。
  - 添加合成 FIRE 探针测试，证明门禁捕获回归。
  - 在 Step4 阻塞门禁映射中记录退休。
- 在底层债务已退休的地方，将 `report-domain-business-candidates.js` 的仅报告子发现项转换为阻塞门禁。
- 在底层债务已退休的地方，将相关 `report-frontend-ecs-*.js` 发现项转换为阻塞门禁。
- 更新 Step1 inventory 以反映 domain-blocker 条目的已退休状态。
- 更新 Phase7 阻塞门禁映射或创建 Step4 叠加映射。

**范围外:**
- 更改任何非退休仅报告发现项的状态。
- 删除报告脚本。

**目标模块 / 报告来源:**
- `scripts/run-architecture-smoke.js` 中的所有仅报告门禁。
- Step1 inventory。
- Step4 债务目录（Phase 0）。

**所需代码变更类别:**
- 新阻塞门禁。
- 更新 architecture smoke 清单。
- 更新 Step1 inventory（已退休债务的退休状态）。
- 更新阻塞门禁映射。

**所需测试:**
- 每个新阻塞门禁具有合成 FIRE 探针。
- 所有现有阻塞门禁仍然通过。
- 更新后的阻塞映射门禁覆盖新退休 id。

**所需架构门禁:**
- 每个已退休债务 id 具有一个阻塞门禁。
- `scripts/check-command-owner-blocking-map.js` 或 Step4 叠加覆盖新退休 id。

**反规避/假通过案例:**
- 在代码仍然有债务时将仅报告发现项转换为阻塞（假退休）。
- 添加门禁，其检查范围与原报告发现项不同。
- 将所有门禁转换推迟到末尾，不按 debt id 粒度。

**完成条件:**
- Phases 1-5 中退休的每个债务 id 具有对应的阻塞门禁。
- 每个阻塞门禁具有合成 FIRE 探针。
- Architecture smoke 强制执行所有新阻塞门禁。
- 更新后的阻塞映射覆盖新退休 id。
- 剩余仅报告发现项具有显式退休条件和增长预防测试。
- `npm test`、`npm run lint`、`npm run test:architecture` 通过。

**移交证据:**
- Step4 阻塞门禁映射。
- 按债务 id 的退休记录: debt id、退休证据、阻塞门禁名称、FIRE 探针结果。
- 更新后的 architecture smoke 输出。

---

### Phase 7: 最终自审计和剩余显式例外

**目标:** 产出 Step4 最终移交: 审计 Phase 0 的每个债务来源，验证退休或显式例外，在最终表中记录剩余债务，并验证所有 Step4 门禁端到端通过。

**范围内:**
- 审计 Phase 0 目录中的每个 `STEP4-DEBT-*` id。
- 对于每个已退休条目: 验证代码证据、阻塞门禁、FIRE 探针。
- 对于每个未退休条目: 验证具有 owner、原因、退休条件和增长预防测试（无新的无记录例外）。
- 运行完整端到端验证:
  - `npm test`（全量套件）
  - `npm run lint`
  - `npm run test:architecture`
  - `node scripts/check-source-encoding.js`
  - `git diff --check`
  - Phase 1-3 退休证据的真实服务器验证。
  - Phase 4 退休证据的真实前端测试范围。
- 产出映射 `COP-*` 契约到 Step4 退休证据的最终移交表。
- 列出剩余债务条目: 每个具有 owner、原因、退休条件、增长预防测试。
- 验证剩余债务数量严格小于 Phase 0 基线。

**范围外:**
- 退休 Phases 1-5 未覆盖的任何新债务。
- 添加新功能。
- 开发者套件 / 最佳路径（这是 Step5+ 的范围）。

**目标模块 / 报告来源:**
- 所有 Phase 0 债务目录条目。
- 所有 Phase 1-5 退休证据。
- 所有阻塞门禁（Step3 + Step4）。
- `command-owner-pipeline-contract-test-spec-2026-07-09.md`（契约准则）。

**所需代码变更类别:**
- 最终审计文档（此阶段产出验证记录）。
- 可能包括针对审计发现项的小型门禁调整。

**所需测试:**
- 全量测试套件通过。
- 所有架构门禁通过。
- 适用阶段的真实服务器/worker 证据。

**所需架构门禁:**
- Phase 7 门禁: `scripts/check-step4-final-audit.js`，将 Phase 0 目录与退休/剩余状态进行对账。

**反规避/假通过案例:**
- 审计声称退休但代码仍具有旧模式。
- 剩余债务被重新分类为"by design"但无结构性证据。
- 通过在不同类别间移动条目来减少计数，但未实际退休。

**完成条件:**
- 剩余债务计数 < Phase 0 基线计数。
- 每个剩余债务条目具有 owner、原因、退休条件、增长预防测试。
- 每个已退休债务条目具有代码证据、阻塞门禁、FIRE 探针。
- 完整端到端验证通过。
- 最终移交表完整。
- 无 `COP-*` 契约强制执行被削弱。

**移交证据:**
- Step4 最终验证记录（本文档，更新后）。
- Step4 最终移交表。
- 剩余债务目录。
- Architecture smoke 输出，显示所有门禁通过。
- 真实服务器/worker 证据 JSON 文件。

---

## 7. 退出条件

Step4 只有在以下所有条件为真时才完成:

1. **带代码证据的债务退休:** Phases 1-5 中退休的每个 `STEP4-DEBT-*` 条目具有代码级退休证据和对应的带有 FIRE 探针的阻塞门禁。

2. **Route/service/helper 不再隐藏写入编排:** 任何 route、service 或 helper 文件不为 `pipeline-migrated-*` 条目在 pipeline 之外拥有 load/validate/execute/save/project/revision-retry 工作。

3. **Handler 不再持有持久化/锁所有权:** 没有领域 handler 直接调用 `repository.save`、`OwnerLockRepository.*` 或 `withPlayerStateLock`。

4. **Worker/后台写入模型一致:** 所有变更玩家或共享状态的 worker/后台写入进入 `CommandExecutionPipeline`，具有与请求写入相同的 owner/幂等/trace 模型，或者具有带有增长预防测试的已记录永久例外。

5. **前端展示资格与命令提交分离:** `CanvasActionDispatcher` 和 `CanvasGameApp` 的命令提交路径不再包含领域阻塞代码路径。`CanvasPanelActionRunner` 及其他非命令 action 路径完成 `classified-ui-local` 分类。展示提示与命令提交决策在结构上分离。

6. **读/投影/调试追踪支持端到端追踪:** `CommandTrace` 为已迁移命令记录所有阶段。提交后投影失败不影响写入结果。读路径不依赖写入新鲜度。

7. **剩余债务减少且有显式记录:** 剩余债务条目数量严格小于 Phase 0 基线。每个剩余条目具有 owner、原因、退休条件和增长预防测试。

8. **全量测试套件通过:** `npm test`（全量套件）、`npm run lint`、`npm run test:architecture`、`node scripts/check-source-encoding.js`、`git diff --check`。

9. **真实服务器/worker 证据:** 在适用处（Phases 1、3 和任何写入所有权退休），真实服务器/worker 验证脚本使用与 Step3 相同的生产加载模式产生证据（真实 `backend/server.js`、真实 SQLite、真实 fetch 路径）。

10. **无 COP-* 回归:** 无 `COP-*` 契约强制执行从 Step3 状态被削弱。已迁移的 inventory id 不得从 `blocking-*` 退回到 `report-only-*`。

---

## 8. 待定决策 / 需调查项

以下问题必须在 Phase 0-1 期间回答。它们不是编写 spec 的阻塞项，但阻塞 Phase 1 的执行。

### D1: 玩家登录 — Pipeline 入口还是永久例外？

`server:player-login` 在 Step1 inventory 中被分类为 `classified-non-gameplay-command`。它仍然在路由代码（`backend/routes/playerRoutes.js`）中拥有 lock/retry/save callback/projection。

两个选项:
- **(a) 进入 pipeline。** 登录变为 `playerLogin` 命令，通过 `CommandExecutionPipeline` 执行，owner 为 `player:{normalizedPlayerId}` / `player:{playerId}`，真正的幂等性，pipeline 拥有的锁，`CommandCommitter` save，以及 pipeline 拥有的投影。这是结构上干净的选项，但需要认证流程更改。
- **(b) 永久例外。** 登录保持为已分类 auth/player 写入，路由拥有编排。这需要: (1) 显式永久例外记录，(2) 增长预防测试，当登录开始变更超出创建范围的玩法状态时失败，(3) 增长预防测试，当另一路由复制此模式用于玩法命令时失败。

**Phase 1 执行前需要决策。**

### D2: 前端领域阻塞项 — 完全移除还是结构性隔离？

某些前端领域阻塞项（如 `canvas-game-app-advance-era-local-block`）与 UI 流程深度耦合。完全移除可能需要大量推进时代 UI 序列的重构。结构性隔离将保留领域检查，但证明它永远不会到达命令派发（类似于现有 `ClientCommandSender` 传输阻止，但在 UI 层有代码级守卫）。

两个选项:
- **(a) 完全移除。** 从命令提交代码路径中移除所有领域资格检查。展示提示移动到纯视觉组件。
- **(b) 结构性隔离。** 将领域检查保留为 `visualDisabled` 赋值，添加架构守卫证明 `visualDisabled` 值不会被命令派发消费，并添加 FIRE 探针在任何派发消费者读取 `visualDisabled` 时触发。

**决策影响 Phase 4 的范围和工作量。**

### D3: report-domain-business-candidates.js 子集

此脚本标记广泛的结构性信号（数百个发现项）。许多是 command-owner 上下文中的误报。Step4 必须确定:
- 这些发现项的哪些子集与写入所有权债务重叠？**机械判定标准如下:** 若候选项满足任一条件，则视为与 command-owner 范围重叠:
  1. 其 `sourceRef.file` / `symbol` 与 Phase 0 catalog 中任一 `STEP4-DEBT-*` 的 `sourceRefs` 指向同一源码范围；
  2. 通过 import-recursive 或 CodeGraph/call graph，可从候选项到达 `repository.save`、`GameStateRepository.*`、`OwnerLockRepository.*`、`withPlayerStateLock`、或前端命令提交路径上的 `ClientCommandSender` 前置领域阻塞；
  3. 候选项位于 Step4 明确目标模块（route/handler/worker/frontend command-submit path）中，且其模式命中与对应 inventory 条目相同的 source pattern。
- 哪些子集是纯仅报告架构 backlog？
- 子集能否被提取为聚焦的阻塞门禁，而无需将完整的广泛扫描脚本维护为阻塞门禁？

**Phase 0 期间需要调查。**

### D4: 前端 ECS 仅报告门禁 — 退休标准

`report-frontend-ecs-*.js` 的四个门禁目前在 architecture smoke 中以仅报告方式运行。`report-frontend-ecs-bridge-shrink.js` 已作为现有阻塞 guard 运行，不在此分析范围内。对每个门禁，Step4 必须确定:
- 门禁是否已经零发现项（exit 0 且无发现项）？
- 如果有发现项，是否有任何与 Step4 范围（写入所有权、展示/命令分离）重叠？
- 若无重叠，门禁是否应保留为仅报告，具有明确的范围边界和退休条件？
- 若有重叠，哪些具体发现项需要退休？

**Phase 0 期间需要调查。** 在当前的 `npm run test:architecture` 输出中已经零发现项的任何门禁在功能上已退休，仅需转换为阻塞。

### D5: 永久例外模型

Step4 会将一些债务保留为永久例外（ops、config、diagnostic）。需要一致的永久例外格式。提议（来自 Step3 Phase7 模式）:

```js
{
  exceptionId: 'PERM-EXC-001',
  debtId: 'STEP4-DEBT-XXX',
  owner: 'auth/platform',
  reason: '登录是认证状态创建，不是玩法命令。',
  retirementCondition: '如果登录变更玩法状态或另一路由复制此模式。',
  growthPreventionTest: 'scripts/tests/perm-exc-login-pattern.test.js',
  contracts: ['COP-ROUTE-001'],
  lastReviewed: '2026-07-10'
}
```

**决策: 所有 Step4 永久例外采用此格式。**

---

## 9. Step4 范围外

以下工作明确不在 Step4 中:

- 开发者套件、脚手架、最佳路径演示或模板项目。
- 新命令类型、新路由、新 handler、新 owner 类型。
- 新功能、新玩法机制。
- 将 ops/config/diagnostic 路由迁移到玩法 pipeline。
- 删除仅报告脚本（报告保留；它们转换为阻塞或保留为仅报告并具有明确边界）。
- 更改 `ClientCommandSender` 行为。
- 更改 `CommandExecutionPipeline` 阶段顺序或添加新阶段。
- 添加 `loot:{lootId}` 或 `boss:{bossId}` 支持（这些是 Step5+ 功能工作，不是债务退休）。
- 与结构清理无关的性能优化。
- 将现有测试重写为新框架。
