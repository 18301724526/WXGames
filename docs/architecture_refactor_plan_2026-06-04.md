# 架构重构执行计划

日期：2026-06-04

本文档用于约束后续架构重构的执行节奏，目标是逐步修复单一职责、开闭原则、渲染层和逻辑层分离的问题。每一步都必须独立提交、推送到服务器远端，并补充回归测试。

## 执行规则

1. 每一步只处理一个清晰边界，避免把多个业务域混在一次提交里。
2. 每一步必须先写或更新回归测试，再提交代码。
3. 每一步必须运行相关测试，并在提交说明或留档里记录测试命令和结果。
4. 每一步必须更新本文档的提交留档，说明本次改动范围、测试和提交结果。
5. 每一步提交后必须推送到服务器远端 `origin`。
6. 不修改无关文件，不覆盖未跟踪或用户已有改动。

## 当前架构问题

### 前端

- `frontend/js/platform/CanvasGameRenderer.js` 承担了战斗、科技、建筑、事件、世界地图、教程、登录、弹窗、命中目标等多个领域的渲染职责。
- `frontend/js/platform/CanvasGameApp.js` 同时处理 API、状态同步、渲染调度、动画计时、业务命令和 shell 状态同步。
- `frontend/js/platform/CanvasActionController.js` 直接读写 host、renderer、api 和 game state，交互逻辑依赖具体渲染实现。
- `frontend/js/state/UIStatePresenter.js` 已经是正确方向，但仍集中生成多个业务域 view model，需要继续按领域拆分。

### 后端

- `backend/routes/gameRoutes.js` 的 `/api/game/action` 使用长 `if/else` 分发 action，新增动作必须修改路由文件。
- `backend/services/GameStateService.js` 同时负责初始化、规范化、在线进度、时代进度、客户端 DTO 组装。
- `backend/services/TerritoryService.js` 同时负责侦察、征服、地图绑定、战斗结算、战后名人候选、客户端状态。
- `backend/repositories/GameStateRepository.js` 把 schema 初始化、迁移、序列化、反序列化和查询混在一个类里。

## 重构路线

### Step 0：建立重构文档和文档守卫测试

目标：把执行规则固化下来，确保后续每一步都带测试、提交、推送和留档。

改动范围：

- 新增本文档。
- 新增 `scripts/verify-refactor-plan-doc.js`。

回归测试：

- `node scripts/verify-refactor-plan-doc.js`

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 记录文档文件、测试文件、测试命令、提交哈希和推送目标。

### Step 1：拆出后端 action registry

目标：让 `/api/game/action` 路由只负责 HTTP 适配，动作分发通过 registry 完成，新增动作不再修改路由主体。

建议改动：

- 新增 `backend/actions/GameActionRegistry.js`。
- 将当前 `gameRoutes.js` 的 action 分支迁移到 registry handler。
- `gameRoutes.js` 只负责加载状态、教程校验、执行 action、保存状态、返回统一 view。

回归测试：

- 新增 action registry 单元测试。
- 覆盖至少 `build`、`research`、`setArmyFormation`、未知 action 四类分发。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 1 的提交记录，包括测试命令和结果。

### Step 2：拆分 GameStateService 的规范化和客户端 DTO

目标：把状态规范化和前端返回视图组装分离，降低领域服务之间的隐式耦合。

建议改动：

- 新增 `backend/services/GameStateNormalizer.js`。
- 新增 `backend/services/ClientGameStateAssembler.js`。
- `GameStateService.js` 保留兼容导出，内部委托新模块。

回归测试：

- 覆盖 `normalizeState` 对旧字段、城市、领土、科技、名人状态的兼容。
- 覆盖 `getClientGameState` 返回关键字段不丢失。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 2 的提交记录，包括测试命令和结果。

### Step 3：拆出 TerritoryService 的侦察和征服流程

目标：把领土规范化、侦察流程、征服流程、客户端视图分开。

建议改动：

- 新增 `backend/services/ScoutService.js`。
- 新增 `backend/services/ConquestService.js`。
- 新增 `backend/services/TerritoryClientAssembler.js`。
- `TerritoryService.js` 保留兼容 facade。

回归测试：

- 覆盖侦察开始、侦察领取、征服开始、征服领取。
- 覆盖世界地图 tile 绑定不回退。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 3 的提交记录，包括测试命令和结果。

### Step 4：拆分前端 UIStatePresenter

目标：让 view model 按业务域拆分，减少 renderer 对业务规则的直接理解。

建议改动：

- 新增 `frontend/js/state/presenters/BattlePresenter.js`。
- 新增 `frontend/js/state/presenters/WorldMapPresenter.js`。
- 新增 `frontend/js/state/presenters/TechPresenter.js`。
- `UIStatePresenter.js` 保留兼容静态方法，逐步委托。

回归测试：

- 覆盖 battle、world map、tech 三个 presenter 的关键 view state。
- 对比迁移前后核心字段一致。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 4 的提交记录，包括测试命令和结果。

### Step 5：拆分 CanvasGameRenderer 的领域 renderer

目标：让主 renderer 成为组合器，把具体领域渲染下放到独立 renderer。

建议改动：

- 新增 `frontend/js/platform/renderers/BattleCanvasRenderer.js`。
- 新增 `frontend/js/platform/renderers/TechCanvasRenderer.js`。
- 新增 `frontend/js/platform/renderers/WorldMapCanvasRenderer.js`。
- `CanvasGameRenderer.js` 保留外部入口和 hit target 协议。

回归测试：

- 覆盖主 renderer 仍能调用 battle、tech、world map renderer。
- 覆盖 hit target 类型和关键 action 不变。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 5 的提交记录，包括测试命令和结果。

### Step 6：收窄 CanvasGameApp 的应用编排职责

目标：把 API 命令、动画计时、shell 同步从 app 主类拆出去。

建议改动：

- 新增 `frontend/js/platform/GameCommandService.js`。
- 新增 `frontend/js/platform/AnimationScheduler.js`。
- 新增 `frontend/js/platform/CanvasShellStateBridge.js`。
- `CanvasGameApp.js` 保留生命周期和顶层协调。

回归测试：

- 覆盖 build、upgrade、research、switchCity 等命令仍调用正确 API 并应用状态。
- 覆盖 battle/world map 定时器不重复启动。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 6 的提交记录，包括测试命令和结果。

### Step 7：解除 CanvasActionController 对 renderer 的布局依赖

目标：让交互控制器只处理 action，不直接依赖 renderer 内部布局状态。

建议改动：

- 提取 `TechTreeInteractionModel`。
- 提取 `WorldMapInteractionModel`。
- controller 只读 interaction model，不读 renderer 的临时字段。

回归测试：

- 覆盖科技树拖拽、缩放、世界地图拖拽。
- 覆盖 action payload 与旧行为一致。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 7 的提交记录，包括测试命令和结果。

## 测试策略

后端优先使用 Node 内置 `node:test`，避免引入额外测试框架。前端纯逻辑模块也优先用 Node 测试；涉及 canvas 的地方先测试调用协议、view model、hit target，不在第一轮追求像素级测试。

每一步至少保留一个新增或更新的测试文件。测试必须覆盖本步最容易回归的协议边界。

## 提交留档

### Step 0 留档

状态：进行中

本次改动：

- 新增 `docs/architecture_refactor_plan_2026-06-04.md`。
- 新增 `scripts/verify-refactor-plan-doc.js`。

测试命令：

- `node scripts/verify-refactor-plan-doc.js`

提交结果：

- 提交哈希：待提交后记录在最终回复和 git 日志中。
- 推送目标：`origin main`。
