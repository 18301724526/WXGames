# Step5 运行时解耦与 BUG 可追踪性 Spec

日期: 2026-07-10

状态: DRAFT，待人工审阅后执行

前置文档:
- `docs/architecture/step4-existing-architecture-debt-retirement-spec-2026-07-10.md`
- `docs/architecture/step4-existing-architecture-debt-retirement-tasks-2026-07-10.md`
- `docs/architecture/step4-phase0-7-verification-2026-07-10.md`

当前基线提交:
- `ee99bebce1dfd6308e7eaa69f459f110378449d8`

---

## 1. 目标

Step5 的目标不是继续“记录债务”或“给旧结构加门禁”，而是开始实际拆除影响日常开发和线上排障的前端运行时债务。

本阶段必须交付三类实际收益:

1. **运行时单一事实源**
   - 服务端玩法状态、前端 UI 状态、渲染缓存、输入模式状态必须有清晰 owner。
   - 不允许继续通过 `game` / `canvasShell` / renderer / controller 多处互相镜像字段来表达同一状态。

2. **BUG 可追踪链路**
   - 从玩家点击 hit target，到 action dispatch，到 `ClientCommandSender`，到后端 `CommandTrace`，必须可以用同一个 trace/correlation 信息串起来。
   - 线上遇到“按钮点了没反应”“前端显示可点但后端拒绝”“状态刷新后 UI 错乱”时，不能再靠人工猜路径。

3. **代码级债务减少**
   - 必须减少当前 report-only 报告中的真实结构性发现项。
   - 不能只新增文档、allowlist 或包装器。
   - 每个退休项都必须有源码 diff、测试、门禁或审计证据。

一句话: Step5 是从“防止继续变烂”转向“拆掉影响开发的旧结构”。

---

## 2. 当前事实基线

### 2.1 Step4 已完成但留下的现实问题

Step4 最终状态:

- Step4 catalog: 20 个 debt item。
- 已退休: 7 个。
- `classified-ui-local`: 1 个。
- 剩余显式/永久例外: 12 个。
- `STEP4-DEBT-019` 和 `STEP4-DEBT-020` 仍为部分退休，代表前端 report-only 和 domain-business backlog 仍然存在。

Step4 的实际收益集中在:

- Command Owner Pipeline。
- owner locks。
- route/handler/worker 写入边界。
- projection write boundary。
- frontend command-submit 不再被领域展示状态阻塞。

Step4 没有解决的主要问题:

- 前端运行时状态 owner 不清。
- Canvas 平台层、renderer、controller、presenter 之间仍然存在大量交叉读写。
- UI 状态和服务端玩法状态仍然容易混在同一个 `game` 对象里。
- Renderer 仍包含规则判断、硬编码数字和“看起来像业务逻辑”的分支。
- 输入/action 分发表仍有大规模字符串和分支重复。
- BUG 追踪从前端 hit target 到后端 command trace 仍不够连贯。

### 2.2 当前 report-only 数量基线

以下命令在 `ee99bebc` 上得到当前基线:

```text
node scripts/report-domain-business-candidates.js --summary
findings: 544
high: 17
medium: 24
low: 503
by layer:
- backend-route: 3
- frontend-ecs: 57
- frontend-platform: 96
- frontend-renderer: 117
- frontend-state: 192
- shared: 36
- unclassified: 43
```

```text
node scripts/report-frontend-ecs-mode-ownership.js --summary
findings: 242
symbols: 15
largest symbols:
- militaryView: 67
- activeTab: 42
- armyFormationEditor: 23
- entityBattle: 15
```

```text
node scripts/report-frontend-ecs-renderer-authority.js --summary
findings: 174
by surface:
- renderer: 123
- world-map-runtime: 47
- render-runtime: 4
by role:
- authority-write: 2
- cache: 172
```

```text
node scripts/report-frontend-ecs-input-branch.js --summary
findings: 161
by surface:
- command-handler: 137
- input-branch: 14
- action-dispatch: 10
```

```text
node scripts/report-frontend-ecs-literal-duplicate.js --summary
findings: 12552
by kind:
- numeric: 5151
- helper: 3456
- condition: 2591
- action-string: 441
```

### 2.3 当前代码热点

本 spec 以当前代码为准，优先处理以下热点:

| 热点 | 当前问题 | Step5 目标 |
| --- | --- | --- |
| `frontend/js/state/GameStateManager.js` | 对 API state 做兼容字段同步和局部变形，容易把服务端事实与前端别名混在一起 | 建立只读 server state snapshot 与派生 view model 边界 |
| `frontend/js/platform/CanvasGameApp.js` | `game` 作为万能对象承载服务端状态、UI 状态、控制器、renderer bridge | 把 UI runtime state 与 server game state 分离 |
| `frontend/js/platform/CanvasModeOwnershipRuntime.js` | mode/panel/editor 状态 owner 仍需通过报告脚本审计 | 将核心 mode state 收敛到单一 store/API |
| `frontend/js/platform/CanvasActionController.js` | action handling 和 input branch 仍集中，字符串分支多 | 建立 action registry / intent router，减少 switch/if 分支 |
| `frontend/js/platform/renderers/*` | renderer 内存在规则判断、硬编码数字、状态缓存 | renderer 只消费 presenter/view-model，不拥有玩法规则 |
| `frontend/js/api/ClientCommandSender.js` + `backend/application/commands/CommandTrace.js` | 后端已有 command trace，但前端点击到后端 command 的关联还不够直接 | 建立 client action trace 到 command trace 的关联字段 |

---

## 3. 非目标

Step5 明确不做以下事情:

1. 不新增玩法。
2. 不重写整个前端。
3. 不把所有 12552 个 literal duplicate 一次清零。
4. 不把纯展示分支误判为业务逻辑然后强行抽离。
5. 不削弱 Step1-Step4 任何阻塞门禁。
6. 不通过扩大 allowlist 来制造“报告变少”的假象。
7. 不把旧代码移动到 helper 后声称解耦。
8. 不把 UI-local 状态强行送进 `ClientCommandSender`。
9. 不把服务端 truth mirror 到多个前端对象后声称“多源同步”。
10. 不把大规模机械改名当成架构收益。

---

## 4. 不可协商规则

### R1. Server game state 只读化

前端从 API 得到的服务端玩法状态必须被视为 server snapshot。

允许:
- 替换整个 snapshot。
- 基于 snapshot 派生 view model。
- 为兼容旧 UI 提供只读 selector。

禁止:
- renderer 直接写 server snapshot。
- controller 直接给 server snapshot 添加 UI-only 字段。
- 在 `game.state`、`canvasShell.state`、renderer cache 之间来回复制同一玩法事实。

### R2. UI runtime state 单独归属

以下状态必须有 UI runtime owner:

- panel open/close。
- active tab。
- modal/naming/confirm/reward reveal。
- map pan/zoom。
- editor 状态，如 `armyFormationEditor`。
- input gesture 临时状态。
- renderer cache。

服务端玩法状态不得承载这些 UI-only 字段。

### R3. Renderer 只渲染，不判断玩法规则

Renderer 可以:
- 根据 view model 做布局分支。
- 根据 view model 的 `disabled` / `visible` / `tone` / `label` 绘制。
- 维护纯绘制 cache，但必须被分类为 renderer-owned cache。

Renderer 不可以:
- 判断是否可研究、可建造、可领取、可攻击、可派遣。
- 计算资源差额作为命令资格。
- 直接解释后端规则字段并做业务结论。
- 修改 command payload 或 server snapshot。

玩法展示判断必须进入 presenter/view-model 或 shared pure rule，renderer 只消费结果。

### R4. Input/action 必须 registry 化

物理输入到游戏行为的路径必须分层:

```text
physical input -> input intent -> action descriptor -> ui effect 或 command submit
```

禁止继续扩大以下模式:

- 在 `CanvasActionController` 里新增大段 `if (action.type === ...)`。
- 在 renderer 中手写 action string 且不经过注册表。
- 同一个 action string 在多个文件中拥有不同语义。

### R5. BUG trace 必须跨前后端贯通

每次用户触发命令提交路径时，必须能关联:

- hit target id / source surface。
- action type。
- action descriptor id。
- command type。
- command id。
- idempotency key。
- request id。
- server trace id。
- response status。
- state revision 或 deployment id。

如果某个 action 是 UI-local，不进入命令链路，也必须能记录:

- action type。
- UI owner。
- 被处理的 runtime store。
- 是否触发 render。

### R6. 报告减少必须来自代码退休

任何 report-only findings 数量下降，必须满足:

1. 源码中的旧模式被删除或被结构性替代。
2. 相关测试覆盖新边界。
3. 门禁或报告脚本能防止旧模式回归。
4. 文档记录具体 retired finding subset。

只改报告脚本、只改 allowlist、只改分类，不算退休。

---

## 5. 范围

### A. 前端运行时状态拆层

目标:
- 建立 server snapshot 与 UI runtime state 的明确边界。
- 退休 `GameStateManager` / `CanvasGameApp` / `canvasShell` 中最危险的状态镜像。
- 让 mode ownership 报告中的核心符号达到已裁定数字目标:`activeTab` 42 -> 33、`militaryView` 67 -> 65、`armyFormationEditor` 23 -> 11；测量命令为 `node scripts/report-frontend-ecs-mode-ownership.js --summary`。

目标符号:
- `activeTab`
- `militaryView`
- `armyFormationEditor`
- `entityBattle`
- `activeEventId`
- `show*` panel flags

预期产物:
- 一个明确的 UI runtime state store 或等价 API。
- selector/presenter 从 server snapshot + UI runtime state 组合 view model。
- 原有 direct field mirror 逐项退休或分类。

### B. Renderer 规则退出

目标:
- Renderer 不再拥有玩法规则判断。
- High severity domain-business renderer findings 必须优先退休。

优先目标:
- `frontend/js/platform/renderers/BuildingCanvasRenderer.js`
- `frontend/js/platform/renderers/TechCanvasRenderer.js`
- `frontend/js/platform/renderers/ResourceTopBarCanvasRenderer.js`
- `frontend/js/platform/renderers/BattleCanvasModel.js`
- `frontend/js/platform/renderers/WorldMapStaticEntryRenderer.js`

允许保留:
- 纯布局判断。
- 纯视觉状态判断。
- renderer-owned cache，前提是报告脚本能识别为 cache 而不是 authority write。

### C. Input/action 分发收敛

目标:
- 将 `frontend-ecs-input-branch` 的 `command-handler` 类发现项从大分支迁移到 action descriptor。
- 命令 action 与 UI-local action 在注册表中可机械区分。
- 新 action 必须声明 owner、surface、payload builder、handler 类型。

预期产物:
- action descriptor registry。
- input intent router。
- legacy fallback 计数与阻塞门禁。

### D. 前后端 trace 贯通

目标:
- 用户动作到后端 command trace 能连起来。
- 排查 BUG 时能按一个 trace id 找到“点击了什么、前端如何路由、命令是否发出、后端如何处理、最终状态是否更新”。

预期产物:
- client action trace envelope。
- `ClientCommandSender` 注入或传递 trace metadata。
- `CommandTrace` 记录对应 client trace 字段。
- client operation log / server trace 可通过 request id 或 trace id 对齐。

---

## 6. 分阶段执行

### Phase 0: 冻结基线和选择退休子集

目标:
- 冻结当前 report-only 数量。
- 将 Step5 要退休的 findings 子集写成机械目录。
- 明确哪些 findings 本阶段不碰，避免范围爆炸。

必须执行:

```text
codegraph sync .
node scripts/report-domain-business-candidates.js --summary
node scripts/report-frontend-ecs-mode-ownership.js --summary
node scripts/report-frontend-ecs-renderer-authority.js --summary
node scripts/report-frontend-ecs-input-branch.js --summary
node scripts/report-frontend-ecs-literal-duplicate.js --summary
npm run test:architecture
```

完成条件:
- 产出 Step5 baseline 表。
- 选出第一批退休目标:
  - domain-business high findings: 17/17 必须分类；其中属于 renderer/platform/state 真实债务的必须进入退休计划。
  - renderer authority `authority-write`: 2/2 必须退休或证明为误报并修正报告。
  - mode ownership 中 `militaryView`、`activeTab`、`armyFormationEditor` 必须进入退休计划。
  - input branch 中 `command-handler` 137 个发现必须至少按 action descriptor 迁移一个完整垂直切片。

反规避:
- 不允许只把 high 改成 medium。
- 不允许只新增 ignore。
- 不允许把旧状态字段重命名后继续多处写。

### Phase 1: 建立 BUG trace 链路

目标:
- 先把排障能力打通，后续拆债有证据链。

范围:
- `frontend/js/platform/CanvasActionDispatcher.js`
- `frontend/js/platform/CanvasActionDispatchRegistry.js`
- `frontend/js/api/ClientCommandSender.js`
- `frontend/js/api/GameAPI.js`
- `backend/application/commands/CommandTrace.js`
- 相关测试。

行为变更:
- 生成 `clientActionTraceId`。
- 每个 command-submit action 携带:
  - `sourceSurface`
  - `hitTargetId`
  - `actionType`
  - `actionDescriptorId`
  - `visualDisabled`
  - `clientActionTraceId`
- `ClientCommandSender` 将 metadata 放入 command envelope 或 request metadata。
- 后端 `CommandTrace` 记录这些字段。
- UI-local action 不进入 command，但进入 client operation log。

所需测试:
- 点击一个命令 action，断言 client trace id 出现在 command envelope 与 server trace。
- 点击一个 UI-local action，断言只记录 UI-local trace，不创建 command envelope。
- 失败响应也保留 trace id。

完成证据:
- 一个真实或 synthetic 命令 trace，可从前端 action 跟到后端 command phase。
- `npm test` 相关 focused tests 通过。

### Phase 2: UI runtime state store

R-D1 boundary text:

```text
Boundary, to be stated verbatim in the spec and enforced: the ECS layer (world/fog/
frame/mode simulation state) is REAL bitecs only; UI runtime state (militaryView,
activeTab, armyFormationEditor, and the other §2 fields) belongs to the established
store family (ModalStore / BattleStore / TerritoryUiStateStore precedent). The new
`UiRuntimeStateStore` must follow that family's exact pattern (same subscription/commit
conventions as StateWriter-committed stores). Any ECS-simulation field found in the UI
store is a gate violation.
```

目标:
- 把 UI-only 状态从 `game.state` / `canvasShell` / renderer 零散字段中剥离。

第一批状态:
- `activeTab`
- `militaryView`
- `armyFormationEditor`
- panel open flags。

行为变更:
- 新增或收敛到一个 UI runtime owner。
- `CanvasGameApp` 只能通过 owner API 读写这些状态。
- `canvasShell` 不再作为第二事实源。
- renderer 只能读 snapshot，不能写 owner 字段。

所需测试:
- active tab 切换只写 UI runtime owner。
- military view 切换只写 UI runtime owner。
- army formation editor open/close 不再在 app/shell 之间复制。
- renderer 读取的是 snapshot，不直接写 host 字段。

目标指标:
- `report-frontend-ecs-mode-ownership.js --summary` 中:
  - `activeTab` findings 从 Phase 0 baseline 42 收敛到 33；测量命令为 `node scripts/report-frontend-ecs-mode-ownership.js --summary`。
  - `militaryView` findings 从 Phase 0 baseline 67 收敛到 65；测量命令为 `node scripts/report-frontend-ecs-mode-ownership.js --summary`。
  - `armyFormationEditor` findings 从 Phase 0 baseline 23 收敛到 11，write/mirror findings 归零或进入明确 owner；测量命令为 `node scripts/report-frontend-ecs-mode-ownership.js --summary`。

反规避:
- 不允许新增 `syncUiStateToGame()` 这类全量镜像函数。
- 不允许用 Proxy 隐藏多源写入。
- 不允许把 `canvasShell` 改名成 `runtimeShell` 后继续当事实源。

### Phase 3: Renderer 规则退出第一批

目标:
- 从 renderer 中抽走 high severity 规则判断。

第一批候选:
- `BuildingCanvasRenderer` 中的建造/升级按钮状态与 cost 展示。
- `TechCanvasRenderer` 中的 `canResearch` / disabled reason 展示。
- `ResourceTopBarCanvasRenderer` 中的人口/资源派生计算。
- `BattleCanvasModel` 中的伤害展示判断。
- `WorldMapStaticEntryRenderer` 中的等级/地块规则展示。

行为变更:
- presenter/view-model 负责把规则解释为显示字段。
- renderer 只画字段，不解释规则。
- hardcoded gameplay number 必须进入 presenter/shared config 或被证明为纯布局数字。

所需测试:
- presenter test 覆盖规则派生。
- renderer test 覆盖只消费 view model。
- domain-business report 对对应 high finding 减少。

完成条件:
- domain-business high findings 中 renderer 相关项全部退休或被机械证明为纯展示误报。
- `report-frontend-ecs-renderer-authority.js` 中 `authority-write` 为 0。

### Phase 4: Input/action descriptor registry

目标:
- 把命令 action 与 UI-local action 从大分支迁移到可审计 descriptor。

第一批垂直切片:
- building build/upgrade。
- tech research。
- territory claim/start conquest。
- world march start/confirm。

descriptor 必须声明:
- `actionType`
- `owner`
- `surface`
- `kind`: `command-submit` 或 `ui-local`
- `commandType`，仅 command-submit 需要。
- `payloadBuilder`
- `traceFields`
- `visualStateSource`

行为变更:
- `CanvasActionController` 不再为这些 action 维护独立业务分支。
- `CanvasActionDispatchRegistry` 通过 descriptor 决定 route。
- action string 不得在 renderer、controller、API helper 多处拥有不同含义。

所需测试:
- 每个迁移 action 的 descriptor 单测。
- command-submit action 进入 `ClientCommandSender`。
- UI-local action 不进入 `ClientCommandSender`。
- visualDisabled 不阻断 command-submit。

目标指标:
- `report-frontend-ecs-input-branch.js --summary` 中 `command-handler` 从 Phase 0 baseline 137 收敛到 135；测量命令为 `node scripts/report-frontend-ecs-input-branch.js --summary`。
- `report-frontend-ecs-literal-duplicate.js --summary` 中 literal duplicate 以 Phase 0 baseline 12552 为全量基准，不要求全量清零；`action-string` 从 441 收敛到 439，或迁移子集被 registry-owned 分类；测量命令为 `node scripts/report-frontend-ecs-literal-duplicate.js --summary`。

### Phase 5: Server snapshot / view model 边界

目标:
- 让前端服务端状态应用路径更清晰，减少 `GameStateManager` 的隐式 mutation。

范围:
- `frontend/js/state/GameStateManager.js`
- `frontend/js/services/GameStateSync.js`
- `frontend/app.js`
- presenters。

行为变更:
- API payload 进入后形成 server snapshot。
- 兼容字段通过 selector/view model 提供。
- 不再在原始 state 上补写 `food`、`wood`、`population` 等别名作为事实。
- 如果短期无法完全移除别名，必须将别名生成集中到一个 compatibility adapter，并标记为 Step5 临时兼容层，有退休条件。

所需测试:
- apply API state 不修改输入 payload。
- selector 能提供旧 UI 需要的字段。
- renderer/presenter 不依赖 mutation side effect。

目标指标:
- domain-business `frontend-state` 中 authority-state-mutation 高/中风险发现下降。

### Phase 6: 门禁升级与旧路径删除

目标:
- 将已经退休的子集从 report-only 转为 focused blocking。

必须新增或升级:
- Step5 runtime state ownership gate。
- Step5 renderer authority focused gate。
- Step5 action descriptor coverage gate。
- Step5 client/server trace linkage gate。
- Step5 final audit gate。

每个 gate 必须有 FIRE 测试:
- 注入一个旧式 mirror write，应失败。
- 注入一个 renderer rule branch，应失败。
- 注入一个未注册 command action，应失败。
- 注入一个缺 trace metadata 的 command，应失败。

反规避:
- 不允许直接把广泛 report-only 全量改 blocking，导致误报阻塞。
- 只允许把已经退休且 production 0 violation 的 focused subset 改 blocking。

### Phase 7: 最终验证与移交

目标:
- 证明 Step5 不是“又加了一层门禁”，而是实际减少了代码债。

最终文档必须记录:
- 每个退休 finding 的原始报告来源。
- 源码 diff 摘要。
- 测试证据。
- 门禁证据。
- 数量变化:
  - domain-business high/medium。
  - ECS mode ownership。
  - renderer authority。
  - input branch。
  - action-string duplicates。
- 剩余 findings 的 owner、原因、退休条件。

最终验证必须包括:

```text
codegraph sync .
npm test
npm run lint
npm run test:architecture
node scripts/check-source-encoding.js
git diff --check
```

如涉及真实命令链路:
- 必须补充真实服务或真实浏览器 trace 证据。

---

## 7. 退出条件

Step5 只有在以下条件全部满足时才算完成:

1. `clientActionTraceId` 或等价 trace id 能贯通前端 action 与后端 `CommandTrace`。
2. UI runtime state 至少完成 `activeTab`、`militaryView`、`armyFormationEditor` 三个高价值符号的 owner 收敛。
3. `report-frontend-ecs-mode-ownership.js --summary` 对上述三个符号达到 `activeTab` 33、`militaryView` 65、`armyFormationEditor` 11 的目标值，基线为 42/67/23，并有逐项解释；测量命令为 `node scripts/report-frontend-ecs-mode-ownership.js --summary`。
4. renderer authority 的 `authority-write` 从 Phase 0 baseline 2 收敛到 0，或每一项都有源码级退休证据；测量命令为 `node scripts/report-frontend-ecs-renderer-authority.js --summary`。
5. domain-business findings 以 Phase 0 baseline 544 为总量基准、17 high / 24 medium 为裁定基准；frontend renderer/platform/state 的真实 high 债务已退休或具有机械证明的误报分类；测量命令为 `node scripts/report-domain-business-candidates.js --summary`。
6. 至少一个完整 command 垂直切片通过 action descriptor registry，覆盖 building/tech/territory/world-march 中至少一类；Tranche 1 building 切片的 `command-handler` 从 Phase 0 baseline 137 收敛到 135，测量命令为 `node scripts/report-frontend-ecs-input-branch.js --summary`。
7. `CanvasActionController` 对该垂直切片不再拥有命令业务分支；Tranche 1 building 切片同时要求 `action-string` 从 Phase 0 baseline 441 收敛到 439，测量命令为 `node scripts/report-frontend-ecs-literal-duplicate.js --summary`。
8. `GameStateManager` 不再对 API payload 做未隔离的玩法事实 mutation；若保留 compatibility adapter，必须有明确退休条件。
9. 新增 focused blocking gates，并具有 FIRE 测试。
10. 所有 Step1-Step4 既有门禁仍通过。
11. `npm test`、`npm run lint`、`npm run test:architecture`、`node scripts/check-source-encoding.js`、`git diff --check` 通过。
12. 最终验证文档用数字证明债务减少，而不是只写“结构更清晰”。

---

## 8. 成功后的真实收益预期

如果 Step5 按本 spec 完成，预期收益是:

### 性能

不是主目标。

可能有小幅间接收益:
- renderer 少做重复规则判断。
- action routing 少走大分支。
- state mirror 减少后，部分重复 render/dirty 标记减少。

但不得把 Step5 宣称为性能优化项目，除非有真实 profile 证据。

### 架构

会有实质改善:
- server snapshot、UI runtime state、renderer cache 分层。
- command action 与 UI-local action 结构化区分。
- renderer 不再拥有玩法规则。
- action registry 成为新增交互的入口。

### 冗余代码

会开始减少:
- 删除部分 app/shell mirror。
- 删除部分 controller 大分支。
- 删除 renderer 中重复规则判断。
- action string 重复会在迁移子集内下降。

但不会一次性清完全部重复。

### 单一源

会明显改善:
- 服务端玩法事实由 server snapshot 管。
- UI-only 状态由 runtime store 管。
- renderer 只读 view model。
- action 语义由 descriptor registry 管。

### BUG 定位

会明显改善:
- 能从用户点击追到 action descriptor。
- 能从 action descriptor 追到 command envelope。
- 能从 command envelope 追到后端 `CommandTrace`。
- UI-local 不发命令也能解释“为什么没有网络请求”。

这是 Step5 的核心收益。

---

## 9. 待定决策

### D1: UI runtime state store 是新建还是收敛现有 runtime？

选项 A: 新建 `frontend/js/state/UiRuntimeStateStore.js`。

优点:
- 边界最清晰。
- 容易测试。

缺点:
- 需要迁移旧调用。

选项 B: 收敛现有 `CanvasModeOwnershipRuntime` / modal snapshot adapter。

优点:
- 利用已有代码。

缺点:
- 可能继续让 runtime 既当规则又当状态 owner。

建议:
- Phase 0 先用 CodeGraph 和报告脚本确认现有 runtime 的调用面。
- 若现有 runtime 已承担过多职责，则新建 store，并让旧 runtime 只做 adapter。

### D2: presenter 与 shared pure rule 的边界

原则:
- 玩法规则、资源计算、资格判断优先进入 shared pure rule 或 backend-authoritative response。
- 纯展示文案、布局、视觉 tone 进入 presenter。
- renderer 不拥有两者。

### D3: literal duplicate 是否进入 Step5 退出条件？

不把 12552 全量清零作为 Step5 退出条件。

只要求:
- 迁移 action descriptor 后，相关 action-string duplicate 下降或变为 registry-owned。
- hardcoded gameplay number 的 high/medium 子集必须被处理。
- 纯颜色、布局数字、资产路径不作为 Step5 主线。

### D4: 是否允许临时 compatibility adapter？

允许，但必须满足:
- 单一文件。
- 有 `STEP5-COMPAT-*` id。
- 有退休条件。
- 有测试证明 adapter 不写回 server snapshot。
- 不能作为长期新事实源。

---

## 10. 执行顺序建议

推荐顺序:

1. Phase 0: 冻结基线。
2. Phase 1: trace 贯通。
3. Phase 2: UI runtime state store。
4. Phase 4: action descriptor registry，先做一个完整垂直切片。
5. Phase 3: renderer 规则退出，跟随已迁移垂直切片做。
6. Phase 5: server snapshot / view model 边界。
7. Phase 6: 门禁升级。
8. Phase 7: final audit。

理由:
- 先有 trace，拆债过程出问题能定位。
- 先收 UI state owner，再迁移 action/renderer，避免继续依赖旧多源状态。
- 先做一个完整垂直切片，证明方案可落地，再扩大范围。

---

## 11. 审阅要求

执行前需要对本 spec 做一次机械化落地审阅，审阅人必须对照当前代码回答:

1. Phase 0 的基线命令是否都存在且可运行？
2. Phase 1 trace 字段是否能在现有 `ClientCommandSender` / `CommandTrace` 中落地？
3. Phase 2 的 UI runtime state store 是否会与现有 `CanvasModeOwnershipRuntime` 冲突？
4. Phase 3 的 renderer findings 是否能明确区分“玩法规则”和“纯展示分支”？
5. Phase 4 的 action descriptor 是否能覆盖至少一个完整 command 垂直切片？
6. Phase 5 是否能做到不修改 API payload？
7. Phase 6 的 focused blocking gate 是否能避免广泛误报？
8. 退出条件是否可用命令和测试验证，而不是靠主观判断？

如果任一问题回答为“不能”，必须先修 spec，不得直接进入代码执行。
