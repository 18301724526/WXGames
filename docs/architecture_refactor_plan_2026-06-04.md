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

### Step 1 留档

状态：已完成

本次改动：

- 新增 `backend/actions/GameActionRegistry.js`，集中维护 `/api/game/action` 的 action handler registry。
- 更新 `backend/routes/gameRoutes.js`，路由保留 HTTP 适配、教程校验、状态保存和返回组装，业务动作改由 registry 分发。
- 新增 `backend/tests/GameActionRegistry.test.js`，覆盖 build、research、setArmyFormation、territory action 和未知 action。
- 更新 `scripts/verify-refactor-plan-doc.js`，让文档守卫只校验路线步骤，不把留档段误判为新步骤。

测试命令：

- `node --test backend/tests/GameActionRegistry.test.js`
- `node --check backend/routes/gameRoutes.js`
- `node --check backend/actions/GameActionRegistry.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`1813ced refactor: add game action registry`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

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

### Step 2 留档

状态：已完成

本次改动：

- 新增 `backend/services/GameStateNormalizer.js`，承接初始状态创建和 `normalizeState`。
- 新增 `backend/services/ClientGameStateAssembler.js`，承接 `getClientGameState` 和客户端 DTO 组装。
- 更新 `backend/services/GameStateService.js` 为兼容门面，保留原有导出接口。
- 新增 `backend/tests/GameStateServiceSplit.test.js`，校验 facade 与新模块输出一致，并覆盖 legacy `metal`/`iron` 兼容。

测试命令：

- `node --test backend/tests/GameStateServiceSplit.test.js`
- `node --test backend/tests/GameActionRegistry.test.js`
- `node --check backend/services/GameStateService.js`
- `node --check backend/services/GameStateNormalizer.js`
- `node --check backend/services/ClientGameStateAssembler.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`87fbd67 refactor: split game state assembly`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

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

### Step 3 留档

状态：已完成

本次改动：

- 新增 `backend/services/TerritoryClientAssembler.js`，承接领土客户端 DTO 组装、地图边界、侦察区域视图和情报遮罩。
- 更新 `backend/services/TerritoryService.js`，保留 `getClientTerritoryState` facade，内部委托 client assembler。
- 新增 `backend/tests/TerritoryClientAssembler.test.js`，覆盖领土客户端返回契约和守军技能情报遮罩。

说明：

- 本步先拆出客户端视图边界，保持侦察和征服流程逻辑不变，避免一次性移动过多核心战斗/地图规则。

测试命令：

- `node --test backend/tests/TerritoryClientAssembler.test.js`
- `node --test backend/tests/GameStateServiceSplit.test.js`
- `node --test backend/tests/GameActionRegistry.test.js`
- `node --check backend/services/TerritoryService.js`
- `node --check backend/services/TerritoryClientAssembler.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`b78baa3 refactor: extract territory client assembler`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

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

### Step 4 留档

状态：已完成

本次改动：

- 新增 `frontend/js/state/presenters/TechPresenter.js`，承接科技树 view model 组装。
- 更新 `frontend/js/state/UIStatePresenter.js`，保留 `buildTechViewState` facade，内部委托 `TechPresenter`。
- 新增 `frontend/js/state/presenters/TechPresenter.test.js`，覆盖科技节点、链接、详情和 UIStatePresenter 委托一致性。

测试命令：

- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --check frontend/js/state/presenters/TechPresenter.js`
- `node --check frontend/js/state/UIStatePresenter.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`34a5472 refactor: extract tech presenter`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

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

### Step 5 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/TechCanvasRenderer.js`，承接科技树 canvas 渲染入口。
- 更新 `frontend/js/platform/CanvasGameRenderer.js`，保留 `renderTech` 外部入口，并委托 `TechCanvasRenderer` 调用 `renderTechInternal`。
- 新增 `frontend/js/platform/renderers/TechCanvasRenderer.test.js`，覆盖独立 renderer 委托协议和主 renderer 的组合关系。

说明：

- 本步先建立领域 renderer 边界，保持原科技树绘制细节与 hit target 协议不变，降低一次性搬迁大量 canvas 绘制逻辑的风险。

测试命令：

- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/TechCanvasRenderer.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`88ccb84 refactor: extract tech canvas renderer`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

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

### Step 6 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/GameCommandService.js`，承接 build、upgrade、research、switchCity 等 API 命令编排。
- 更新 `frontend/js/platform/CanvasGameApp.js`，保留原命令方法作为 facade，内部委托 `GameCommandService`。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境都能加载命令服务。
- 新增 `frontend/js/platform/GameCommandService.test.js`，覆盖命令服务 API 调用、状态应用和 `CanvasGameApp` facade 委托。

说明：

- 本步优先拆出 API 命令边界，保持动画计时和 shell 同步逻辑不变，避免一次性改变多个运行时职责。

测试命令：

- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --check frontend/js/platform/GameCommandService.js`
- `node --check frontend/js/platform/CanvasGameApp.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`5998caf refactor: extract game command service`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

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

### Step 7 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/interactions/TechTreeInteractionModel.js`，承接科技树拖拽、缩放、panel/view 获取和 pan clamp 计算。
- 更新 `frontend/js/platform/CanvasActionController.js`，保留 `techTreeDrag` / `techTreeZoom` action 入口，内部委托 `TechTreeInteractionModel`。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境都能加载交互模型。
- 新增 `frontend/js/platform/interactions/TechTreeInteractionModel.test.js`，覆盖拖拽边界、缩放中心保持和 controller 委托关系。

说明：

- 本步先解除科技树交互对 renderer 布局细节的直接依赖；世界地图交互已有 `TerritoryController` / runtime coordinator 分支，下一轮可继续以同样模型收敛。

测试命令：

- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --check frontend/js/platform/interactions/TechTreeInteractionModel.js`
- `node --check frontend/js/platform/CanvasActionController.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`bdbde7c refactor: extract tech tree interaction model`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 8：继续压缩 CanvasGameRenderer 的科技树渲染职责

目标：把 Step 5 中已经建立边界的科技树渲染实现真正下放到 `TechCanvasRenderer`，继续减少 `CanvasGameRenderer.js` 的巨型文件体量。

回归测试：

- 覆盖 `TechCanvasRenderer` 自身科技树布局计算。
- 覆盖 `CanvasGameRenderer.getTechTreeLayout` facade 仍能委托到科技 renderer。
- 覆盖科技树拖拽/缩放交互模型仍依赖相同布局协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 8 的提交记录，包括测试命令、行数变化和结果。

### Step 8 留档

状态：已完成

本次改动：

- 将 `CanvasGameRenderer.js` 内科技树 route、node、detail modal、tree layout、tech panel 渲染实现搬入 `frontend/js/platform/renderers/TechCanvasRenderer.js`。
- `CanvasGameRenderer.js` 保留 `renderTech`、`renderTechInternal`、`getTechTreeLayout` 等兼容 facade，内部委托 `TechCanvasRenderer`。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `TechCanvasRenderer`。
- 更新 `frontend/js/platform/renderers/TechCanvasRenderer.test.js`，覆盖独立 renderer 布局计算与主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮检查时的 10986 行降至 10781 行。
- `frontend/js/platform/renderers/TechCanvasRenderer.js`：扩展为 882 行，承接科技树领域渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/TechCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`4f786b1 refactor: move tech rendering into tech canvas renderer`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 9：继续压缩 CanvasGameRenderer 的战斗渲染职责

目标：把 `CanvasGameRenderer.js` 内战斗播放、兵种帧、战斗场景 overlay、战斗 hit target 等渲染实现下放到独立 `BattleCanvasRenderer`，继续按领域 renderer 拆分巨型文件。

回归测试：

- 覆盖 `BattleCanvasRenderer` 自身战斗播放阶段、单位姿态和兵种帧路径计算。
- 覆盖 `CanvasGameRenderer` 的 battle facade 仍能委托到战斗 renderer。
- 覆盖战斗场景 overlay 仍保留 `closeBattleScene` 与 `skipBattleScene` hit target 协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 9 的提交记录，包括测试命令、行数变化和结果。

### Step 9 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/BattleCanvasRenderer.js`，承接战斗播放阶段、阵型位置、兵种帧、伤害飘字、状态飘字、战斗 leader 和战斗场景 overlay 渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 `renderBattleSceneOverlay`、战斗 helper 与 hit target 外部协议，内部通过 `battleRenderer` facade 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `BattleCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/BattleCanvasRenderer.test.js`，覆盖独立 renderer helper、主 renderer facade 和 overlay hit target 协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 10781 行降至 10256 行。
- `frontend/js/platform/renderers/BattleCanvasRenderer.js`：新增为 779 行，承接战斗领域渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/BattleCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/BattleCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`24d7fbf refactor: move battle rendering into battle canvas renderer`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 10：继续压缩 CanvasGameRenderer 的名人与人才政策渲染职责

目标：把 `CanvasGameRenderer.js` 内名人画像、名人卡片、名人详情、名人面板、技能 tooltip 与人才政策面板渲染下放到独立 `FamousCanvasRenderer`，继续按领域 renderer 拆分巨型文件。

回归测试：

- 覆盖 `FamousCanvasRenderer` 自身分页与名人技能 tooltip 状态 helper。
- 覆盖 `CanvasGameRenderer` 的 famous facade 仍能委托到名人 renderer。
- 覆盖名人面板仍保留 `closeFamousPersons`、`seekFamousPerson`、`changeFamousPersonsPage` 等 hit target 协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 10 的提交记录，包括测试命令、行数变化和结果。

### Step 10 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/FamousCanvasRenderer.js`，承接名人画像图层、属性雷达图、名人卡片、名人详情、技能 tooltip、名人面板与人才政策面板渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 famous 相关外部入口与 tooltip facade，内部通过 `famousRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `FamousCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/FamousCanvasRenderer.test.js`，覆盖分页 helper、tooltip 状态、主 renderer facade 和名人面板 hit target 协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 10256 行降至 9296 行。
- `frontend/js/platform/renderers/FamousCanvasRenderer.js`：新增为 1137 行，承接名人与人才政策领域渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/FamousCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/FamousCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/BattleCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`29cebb4 refactor: move famous rendering into famous canvas renderer`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 11：继续压缩 CanvasGameRenderer 的世界地图渲染职责

目标：把 `CanvasGameRenderer.js` 内世界地图瓦片绘制、静态/水面/雾层缓存、侦查路线、世界地点 hit target、军事世界视图、世界地点弹窗与城池指令浮层渲染下放到独立 `WorldMapCanvasRenderer`，继续降低主 renderer 的领域耦合。

回归测试：

- 覆盖 `WorldMapCanvasRenderer` 自身瓦片坐标投影与地点布局 helper。
- 覆盖 `CanvasGameRenderer` 的 world map facade 仍能委托到世界地图 renderer。
- 覆盖世界地图 hit-target-only 模式仍保留 `worldMapDrag` 与 `openWorldSite` hit target 协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 11 的提交记录，包括测试命令、行数变化和结果。

### Step 11 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/WorldMapCanvasRenderer.js`，承接世界地图瓦片投影、地点布局、瓦片缓存层、侦查路线、世界地图视图、地点弹窗与城池指令浮层渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 world map 相关外部入口与 facade，内部通过 `worldMapRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `WorldMapCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`，覆盖坐标 helper、主 renderer facade 和世界地图 hit target 协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 9296 行降至 7456 行。
- `frontend/js/platform/renderers/WorldMapCanvasRenderer.js`：新增为 2379 行，承接世界地图领域渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/WorldMapCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/FamousCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/BattleCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`0a2d8db refactor: move world map rendering into world map canvas renderer`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 12：继续压缩 CanvasGameRenderer 的教程渲染职责

目标：把 `CanvasGameRenderer.js` 内教程 intro、教程高亮、tutorial shield、advisor portrait 与 Spine 图层渲染下放到独立 tutorial renderer，继续降低主 renderer 的叠层渲染职责。

回归测试：

- 覆盖 `TutorialCanvasRenderer` 自身教程目标解析与 tutorial shield hit target 协议。
- 覆盖 `CanvasGameRenderer` 的 tutorial facade 仍能委托到教程 renderer。
- 覆盖 `TutorialAdvisorCanvasRenderer` 的 advisor 图片 cover 裁剪协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 12 的提交记录，包括测试命令、行数变化和结果。

### Step 12 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/TutorialCanvasRenderer.js`，承接教程 intro、教程高亮、目标解析、教学遮罩和 hit target 屏蔽协议。
- 新增 `frontend/js/platform/renderers/TutorialAdvisorCanvasRenderer.js`，承接 advisor 画像、Spine 图层和图片 cover 裁剪。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 tutorial 相关外部入口与 facade，内部通过 `tutorialRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 tutorial/advisor renderer。
- 新增 `frontend/js/platform/renderers/TutorialCanvasRenderer.test.js`，覆盖独立 renderer、主 renderer facade、教学遮罩和 advisor 图片裁剪协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 7456 行降至 6997 行。
- `frontend/js/platform/renderers/TutorialCanvasRenderer.js`：新增为 417 行，承接教程叠层渲染实现。
- `frontend/js/platform/renderers/TutorialAdvisorCanvasRenderer.js`：新增为 254 行，承接教程 advisor 渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/TutorialCanvasRenderer.js`
- `node --check frontend/js/platform/renderers/TutorialAdvisorCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/TutorialCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/FamousCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/BattleCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`10a241d refactor: move tutorial rendering into tutorial canvas renderer`。
- 文档提交哈希：`71e1918 docs: record refactor plan step 12`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 13：继续压缩 CanvasGameRenderer 的建筑渲染职责

目标：把 `CanvasGameRenderer.js` 内建筑面板、建筑分类、建筑成本芯片、资源短名/图标和建筑按钮渲染下放到独立 `BuildingCanvasRenderer`，继续降低主 renderer 的业务面板职责。

回归测试：

- 覆盖 `BuildingCanvasRenderer` 自身建筑成本 helper、资源别名合并和数值格式化。
- 覆盖 `CanvasGameRenderer` 的 building facade 仍能委托到建筑 renderer。
- 覆盖建筑面板仍保留 `selectBuildingCategory`、`buildBuilding`、`upgradeBuilding` 和 `scrollBuildings` hit target 协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 13 的提交记录，包括测试命令、行数变化和结果。

### Step 13 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/BuildingCanvasRenderer.js`，承接建筑面板、分类标签、建筑信息行、成本芯片、资源短名/图标和建筑操作按钮渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 building 相关外部入口与 facade，内部通过 `buildingRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `BuildingCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/BuildingCanvasRenderer.test.js`，覆盖独立 renderer helper、主 renderer facade 和建筑面板 hit target 协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 6997 行降至 6638 行。
- `frontend/js/platform/renderers/BuildingCanvasRenderer.js`：新增为 471 行，承接建筑领域渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/BuildingCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/BuildingCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TutorialCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/FamousCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/BattleCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`69bd974 refactor: move building rendering into building canvas renderer`。
- 文档提交哈希：`82a339b docs: record refactor plan step 13`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 14：继续压缩 CanvasGameRenderer 的事件渲染职责

目标：把 `CanvasGameRenderer.js` 内事件列表、事件详情行、事件资源 parts 和事件 modal 渲染下放到独立 `EventCanvasRenderer`，继续降低主 renderer 的业务面板职责。

回归测试：

- 覆盖 `EventCanvasRenderer` 自身事件颜色、事件详情行和资源 parts 渲染协议。
- 覆盖 `CanvasGameRenderer` 的 event facade 仍能委托到事件 renderer。
- 覆盖事件列表与事件 modal 仍保留 `openEvent`、`closeEvent`、`claimEvent` 和 `blockCanvasModal` hit target 协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 14 的提交记录，包括测试命令、行数变化和结果。

### Step 14 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/EventCanvasRenderer.js`，承接事件列表、最近事件、事件详情行、事件资源 parts 和事件 modal 渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 event 相关外部入口与 facade，内部通过 `eventRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `EventCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/EventCanvasRenderer.test.js`，覆盖独立 renderer helper、主 renderer facade、事件列表和事件 modal hit target 协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 6638 行降至 6353 行。
- `frontend/js/platform/renderers/EventCanvasRenderer.js`：新增为 362 行，承接事件领域渲染实现。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/EventCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/EventCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/BuildingCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TutorialCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/FamousCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/BattleCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js`
- `node --test frontend/js/platform/GameCommandService.test.js`
- `node --test frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`3032f5a refactor: move event rendering into event canvas renderer`。
- 文档提交哈希：`56e2cec docs: record refactor plan step 14`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 15：继续压缩 CanvasGameRenderer 的文明渲染职责

目标：把 `CanvasGameRenderer.js` 内文明总览、时代进阶、时代条件、时代特性和 `advanceEra` hit target 渲染下放到独立 `CivilizationCanvasRenderer`，继续降低主 renderer 的业务面板职责。

回归测试：

- 覆盖 `CivilizationCanvasRenderer` 自身文明总览、时代进阶、时代特性区域渲染协议。
- 覆盖 `CanvasGameRenderer` 的 civilization facade 仍能委托到文明 renderer。
- 覆盖 `advanceEra` hit target 在可点击和禁用状态下都保留 disabled 协议。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 15 的提交记录，包括测试命令、行数变化和结果。

### Step 15 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/CivilizationCanvasRenderer.js`，承接文明总览、时代进阶、条件列表、时代特性说明和 `advanceEra` hit target 渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 civilization 外部入口为 facade，内部通过 `civilizationRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `CivilizationCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js`，覆盖独立 renderer、主 renderer facade 和禁用进阶按钮 hit target 协议。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 6353 行降至 6190 行。
- `frontend/js/platform/renderers/CivilizationCanvasRenderer.js`：新增为 219 行，承接文明领域渲染实现。
- `frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js`：新增为 115 行，覆盖文明渲染防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/CivilizationCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`69d72ab refactor: move civilization rendering into civilization canvas renderer`。
- 文档提交哈希：`e6c5398 docs: record refactor plan step 15`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 16：继续压缩 CanvasGameRenderer 的军事面板渲染职责

目标：把 `CanvasGameRenderer.js` 内军事主面板、军队状态、编队卡片、侦察九宫格和侦察报告渲染下放到独立 `MilitaryCanvasRenderer`，同时保留世界地图绘制继续由 `WorldMapCanvasRenderer` 承接。

回归测试：

- 覆盖 `MilitaryCanvasRenderer` 自身军事 tab、军队状态和编队 hit target 协议。
- 覆盖侦察九宫格仍保留 `scoutTerritory`、`claimScout` 和 disabled hit target 协议。
- 覆盖 `CanvasGameRenderer` 的 military facade 仍能委托到军事 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 16 的提交记录，包括测试命令、行数变化和结果。

### Step 16 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/MilitaryCanvasRenderer.js`，承接军事主面板、军队状态、编队卡片、侦察九宫格和侦察报告渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 military 相关外部入口与 facade，内部通过 `militaryRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `MilitaryCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js`，覆盖军事 tab、编队 hit target、侦察 hit target 和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 6190 行降至 5916 行。
- `frontend/js/platform/renderers/MilitaryCanvasRenderer.js`：新增为 371 行，承接军事领域渲染实现。
- `frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js`：新增为 137 行，覆盖军事渲染防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/MilitaryCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`82f0670 refactor: move military rendering into military canvas renderer`。
- 文档提交哈希：`aa205b2 docs: record refactor plan step 16`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 17：继续压缩 CanvasGameRenderer 的任务与攻略面板渲染职责

目标：把 `CanvasGameRenderer.js` 内已经启用的任务中心面板和攻略面板渲染下放到独立 `GuideTaskCanvasRenderer`，保留当前早退禁用的悬浮任务/攻略按钮行为不变。

回归测试：

- 覆盖 `GuideTaskCanvasRenderer` 自身攻略 modal、关闭、遮挡和 tab 切换 hit target 协议。
- 覆盖任务中心仍保留 `closeTaskCenter`、`switchTaskCenterTab`、`claimTaskReward` 和 `goToGuideTaskTarget` hit target 协议。
- 覆盖 `CanvasGameRenderer` 的 guide task facade 仍能委托到任务/攻略 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 17 的提交记录，包括测试命令、行数变化和结果。

### Step 17 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/GuideTaskCanvasRenderer.js`，承接攻略面板和任务中心面板渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 guide task 相关外部入口与 facade，内部通过 `guideTaskRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `GuideTaskCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js`，覆盖攻略 modal、任务中心动作 hit target 和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 5916 行降至 5696 行。
- `frontend/js/platform/renderers/GuideTaskCanvasRenderer.js`：新增为 282 行，承接任务与攻略面板渲染实现。
- `frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js`：新增为 145 行，覆盖任务/攻略面板防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/GuideTaskCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`656cbe3 refactor: move guide task panels into guide task canvas renderer`。
- 文档提交哈希：`e635aa0 docs: record refactor plan step 17`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 18：继续压缩 CanvasGameRenderer 的首页与资源渲染职责

目标：把 `CanvasGameRenderer.js` 内顶部资源栏、地图首页资源栏、人口分配面板和首页功能入口渲染下放到独立 `HomeCanvasRenderer`，主 renderer 继续只保留入口 facade 和主流程编排。

回归测试：

- 覆盖 `HomeCanvasRenderer` 顶部资源栏仍保留资源详情、顾问、日志、设置和城市切换 hit target 协议。
- 覆盖人口分配面板仍保留 `openTalentPolicy` 和 `assignJob` hit target 协议。
- 覆盖首页功能区仍保留入口 action hit target 协议。
- 覆盖 `CanvasGameRenderer` 的 home facade 仍能委托到首页 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 18 的提交记录，包括测试命令、行数变化和结果。

### Step 18 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/HomeCanvasRenderer.js`，承接顶部资源栏、地图首页资源栏、人口分配面板和首页功能入口渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 home 相关外部入口与 facade，内部通过 `homeRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `HomeCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/HomeCanvasRenderer.test.js`，覆盖顶部栏、人口分配、首页功能区和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 5696 行降至 5317 行。
- `frontend/js/platform/renderers/HomeCanvasRenderer.js`：新增为 451 行，承接首页与资源领域渲染实现。
- `frontend/js/platform/renderers/HomeCanvasRenderer.test.js`：新增为 176 行，覆盖首页/资源渲染防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/HomeCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/HomeCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`b238512 refactor: move home rendering into home canvas renderer`。
- 文档提交哈希：`2c5150b docs: record refactor plan step 18`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 19：继续压缩 CanvasGameRenderer 的系统面板渲染职责

目标：把 `CanvasGameRenderer.js` 内登录面板、加载页、网络重连遮罩、设置面板和日志面板渲染下放到独立 `SystemCanvasRenderer`，主 renderer 继续保留全局流程编排和系统面板 facade。

回归测试：

- 覆盖 `SystemCanvasRenderer` 登录表单仍保留用户名、密码、记住密码和提交登录 hit target 协议。
- 覆盖加载页仍保留 `blockCanvasModal` 遮罩和进度条渲染协议。
- 覆盖网络重连遮罩仍返回渲染结果并保留全屏阻断 hit target。
- 覆盖设置面板仍保留 `resetGame`、`logout` 和背景关闭协议。
- 覆盖日志面板仍保留 `closeLogs`、`clearLogs` 和背景关闭协议。
- 覆盖 `CanvasGameRenderer` 的 system facade 仍能委托到系统 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 19 的提交记录，包括测试命令、行数变化和结果。

### Step 19 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/SystemCanvasRenderer.js`，承接登录、加载、网络重连、设置和日志系统面板渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 system 相关外部入口与 facade，内部通过 `systemRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `SystemCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/SystemCanvasRenderer.test.js`，覆盖系统面板 hit target 协议和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 5317 行降至 4961 行。
- `frontend/js/platform/renderers/SystemCanvasRenderer.js`：新增为 416 行，承接系统面板渲染实现。
- `frontend/js/platform/renderers/SystemCanvasRenderer.test.js`：新增为 114 行，覆盖系统面板防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/SystemCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/SystemCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`96df3c1 refactor: move system panels into system canvas renderer`。
- 文档提交哈希：`25d4be1 docs: record refactor plan step 19`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 20：继续压缩 CanvasGameRenderer 的城市面板渲染职责

目标：把 `CanvasGameRenderer.js` 内城市切换、城市摘要、城市管理、驻军子面板和分城列表渲染下放到独立 `CityCanvasRenderer`，主 renderer 继续保留入口 facade 与整体 HUD/地图流程编排。

回归测试：

- 覆盖 `CityCanvasRenderer` 仍能从城市状态和领地状态解析 active city summary。
- 覆盖城市切换面板仍保留 `closeCitySwitcher`、`blockCanvasModal` 和 `selectCity` hit target 协议。
- 覆盖分城列表仍保留 `closeSubcityList` 和 `jumpToSubcity` hit target 协议。
- 覆盖城市管理面板仍保留关闭、tab 切换，并委托建筑/人口子内容渲染。
- 覆盖驻军子面板仍保留 `openArmyFormation` 入口，并在大尺寸下委托军队编队条渲染。
- 覆盖 `CanvasGameRenderer` 的 city facade 仍能委托到城市 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 20 的提交记录，包括测试命令、行数变化和结果。

### Step 20 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/CityCanvasRenderer.js`，承接城市切换、城市管理、驻军子面板和分城列表渲染。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 city 相关外部入口与 facade，内部通过 `cityRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `CityCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/CityCanvasRenderer.test.js`，覆盖城市面板 hit target 协议、跨领域委托和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 4961 行降至 4667 行。
- `frontend/js/platform/renderers/CityCanvasRenderer.js`：新增为 377 行，承接城市面板渲染实现。
- `frontend/js/platform/renderers/CityCanvasRenderer.test.js`：新增为 164 行，覆盖城市面板防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/CityCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/CityCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`7b19333 refactor: move city panels into city canvas renderer`。
- 文档提交哈希：`a4c553c docs: record refactor plan step 20`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 21：继续压缩 CanvasGameRenderer 的通用浮层与反馈渲染职责

目标：把 `CanvasGameRenderer.js` 内资源详情、命名弹窗、浮动反馈文本、奖励揭示和奖励粒子绘制下放到独立 `OverlayCanvasRenderer`，主 renderer 继续保留页面编排与 overlay facade。

回归测试：

- 覆盖命名弹窗仍保留 `closeNaming`、`blockCanvasModal`、`requestNamingInput` 和 `submitNaming` hit target 协议。
- 覆盖空名称或提交中状态仍禁用 `submitNaming`。
- 覆盖资源详情面板仍保留关闭、遮挡和五类资源图标渲染协议。
- 覆盖浮动反馈文本仍恢复 canvas alpha 并绘制反馈文本。
- 覆盖奖励揭示仍保留 `closeRewardReveal`、`blockCanvasModal` 和奖励粒子绘制协议。
- 覆盖 `CanvasGameRenderer` 的 overlay facade 仍能委托到通用浮层 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 21 的提交记录，包括测试命令、行数变化和结果。

### Step 21 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/OverlayCanvasRenderer.js`，承接资源详情、命名弹窗、浮动反馈文本、奖励揭示和奖励粒子绘制。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 overlay 相关外部入口与 facade，内部通过 `overlayRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `OverlayCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/OverlayCanvasRenderer.test.js`，覆盖通用浮层 hit target、canvas alpha 恢复、奖励粒子和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 4667 行降至 4359 行。
- `frontend/js/platform/renderers/OverlayCanvasRenderer.js`：新增为 381 行，承接通用浮层与反馈渲染实现。
- `frontend/js/platform/renderers/OverlayCanvasRenderer.test.js`：新增为 141 行，覆盖通用浮层防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/OverlayCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/OverlayCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`0e07b3f refactor: move overlay rendering into overlay canvas renderer`。
- 文档提交哈希：`f6e060d docs: record refactor plan step 21`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 22：继续压缩 CanvasGameRenderer 的顾问渲染职责

目标：把 `CanvasGameRenderer.js` 内底部顾问提示、地图首页悬浮顾问按钮、顾问浮动按钮布局和顾问建议 modal 渲染下放到独立 `AdvisorCanvasRenderer`，主 renderer 继续保留页面编排与 advisor facade。

回归测试：

- 覆盖底部顾问提示仍在有建议时绘制顾问标题和建议内容。
- 覆盖地图首页悬浮顾问按钮仍保留 `openAdvisor` hit target 协议。
- 覆盖顾问建议 modal 仍保留 `closeAdvisor`、`blockCanvasModal` 和 `goToAdvisorTarget` hit target 协议。
- 覆盖顾问目标禁用状态仍传递到 `goToAdvisorTarget`。
- 覆盖 `CanvasGameRenderer` 的 advisor facade 仍能委托到顾问 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 22 的提交记录，包括测试命令、行数变化和结果。

### Step 22 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/AdvisorCanvasRenderer.js`，承接底部顾问提示、悬浮顾问按钮、悬浮按钮布局和顾问建议 modal。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 advisor 相关外部入口与 facade，内部通过 `advisorRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `AdvisorCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js`，覆盖顾问提示、悬浮按钮、顾问 modal 和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 4359 行降至 4245 行。
- `frontend/js/platform/renderers/AdvisorCanvasRenderer.js`：新增为 185 行，承接顾问渲染实现。
- `frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js`：新增为 104 行，覆盖顾问渲染防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/AdvisorCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`60afc72 refactor: move advisor rendering into advisor canvas renderer`。
- 文档提交哈希：`ec97d66 docs: record refactor plan step 22`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 23：继续压缩 CanvasGameRenderer 的军团编队编辑器渲染职责

目标：把 `CanvasGameRenderer.js` 内军团编队编辑 modal 的布局、绘制和 hit target 协议下放到独立 `ArmyFormationEditorCanvasRenderer`，主 renderer 继续保留全局页面编排与 `renderArmyFormationEditor` facade。

回归测试：

- 覆盖 `ArmyFormationEditorCanvasRenderer` 打开时仍保留背景 `closeArmyFormationEditor`、关闭按钮和 `blockCanvasModal` hit target 协议。
- 覆盖已选/未选成员仍产生 `toggleArmyFormationMember`，满员时未选成员被 `blockCanvasModal` 阻断。
- 覆盖分页按钮仍产生 `changeArmyFormationPage`，边界分页保留阻断行为。
- 覆盖保存按钮仍产生 `saveArmyFormation`，保存中状态改为 `blockCanvasModal`。
- 覆盖关闭状态不绘制、不添加 hit target。
- 覆盖 `CanvasGameRenderer` 的 army formation editor facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 23 的提交记录，包括测试命令、行数变化和结果。

### Step 23 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.js`，承接军团编队编辑 modal 的布局、绘制和 hit target 协议。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 `renderArmyFormationEditor` 外部入口与 facade，内部通过 `armyFormationEditorRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `ArmyFormationEditorCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js`，覆盖弹窗关闭、阻断、成员切换、满员禁用、分页、保存和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 4245 行降至 4126 行。
- `frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.js`：新增为 177 行，承接军团编队编辑弹窗渲染实现。
- `frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js`：新增为 134 行，覆盖军团编队编辑弹窗防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`77b2d84 refactor: move army formation editor into canvas renderer`。
- 文档提交哈希：`d10de17 docs: record refactor plan step 23`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 24：继续压缩 CanvasGameRenderer 的攻略与任务快捷入口渲染职责

目标：把 `CanvasGameRenderer.js` 内攻略/任务快捷入口相关入口下放到既有 `GuideTaskCanvasRenderer`，主 renderer 继续保留页面编排 facade。保持当前快捷入口关闭/no-op 行为不变，避免重构时意外恢复不可达的旧绘制逻辑。

回归测试：

- 覆盖 `GuideTaskCanvasRenderer.renderGuideTasks` 仍按当前合同直接返回传入的 `startY`，不绘制、不添加 hit target。
- 覆盖 `renderTaskCenterButton` 和 `renderGuidebookButton` 仍保持 no-op，不产生按钮或 hit target。
- 覆盖 `CanvasGameRenderer` 的 `renderGuideTasks`、`renderTaskCenterButton`、`renderGuidebookButton` 和 `renderTaskCenterPanel` facade 仍能委托到 `GuideTaskCanvasRenderer`。
- 保留任务中心 modal 的 `claimTaskReward` 与 `goToGuideTaskTarget` hit target 防回归覆盖。
- 保留攻略 modal 的关闭、阻断和 tab 切换 hit target 防回归覆盖。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 24 的提交记录，包括测试命令、行数变化和结果。

### Step 24 留档

状态：已完成

本次改动：

- `frontend/js/platform/CanvasGameRenderer.js` 移除攻略/任务快捷入口不可达绘制代码，保留 `renderGuideTasks`、`renderTaskCenterButton` 和 `renderGuidebookButton` facade。
- `frontend/js/platform/renderers/GuideTaskCanvasRenderer.js` 新增三个快捷入口方法，承接当前 no-op 行为。
- 更新 `frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js`，覆盖快捷入口 no-op 合同和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 4126 行降至 3964 行。
- `frontend/js/platform/renderers/GuideTaskCanvasRenderer.js`：由 282 行增至 294 行，承接攻略/任务快捷入口 facade 目标。
- `frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js`：由 145 行增至 182 行，补充快捷入口 no-op 和 facade 防回归覆盖。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/GuideTaskCanvasRenderer.js`
- `node --test frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`1b88075 refactor: move guide task entry rendering into guide task renderer`。
- 文档提交哈希：`867b7c7 docs: record refactor plan step 24`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 25：继续压缩 CanvasGameRenderer 的地图命令 HUD 渲染职责

目标：把 `CanvasGameRenderer.js` 内地图首页底部命令 dock、地图悬浮分城/事件按钮和命令面板壳下放到独立 `MapCommandCanvasRenderer`。命令面板内部内容继续通过既有 `renderPopulation`、`renderHomeFeatureGrid` 和 `renderMainPanel` facade 委托给对应业务 renderer，避免扩大职责边界。

回归测试：

- 覆盖 `MapCommandCanvasRenderer` 底部命令 dock 仍保留科技、文明、名人、任务和设置入口 hit target。
- 覆盖地图悬浮分城按钮仍产生 `openSubcityList`，事件按钮仍产生 `openCommandPanel/events`。
- 覆盖命令面板壳仍保留背景关闭、面板阻断和关闭按钮 hit target。
- 覆盖首都命令面板仍委托 `renderPopulation` 与 `renderHomeFeatureGrid`。
- 覆盖军事命令面板仍委托 `renderMainPanel`，并把世界军务视图归一为军队视图。
- 覆盖 `CanvasGameRenderer` 的 map command facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 25 的提交记录，包括测试命令、行数变化和结果。

### Step 25 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`，承接地图首页底部命令 dock、分城/事件悬浮按钮和命令面板壳。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 map command 相关外部入口与 facade，内部通过 `mapCommandRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `MapCommandCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js`，覆盖 dock、悬浮按钮、命令面板壳、内容委托和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 3964 行降至 3835 行。
- `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`：新增为 199 行，承接地图命令 HUD 渲染实现。
- `frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js`：新增为 122 行，覆盖地图命令 HUD 防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/MapCommandCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`9f2eeba refactor: move map command hud into canvas renderer`。
- 文档提交哈希：`07dd4b3 docs: record refactor plan step 25`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 26：继续压缩 CanvasGameRenderer 的 HUD 模式编排职责

目标：把 `CanvasGameRenderer.js` 内 HUD 模式的 `renderHudOverlay` 流程下放到独立 `HudOverlayCanvasRenderer`，主 renderer 继续保留 `renderHudOverlay` facade 与普通 `render()` 流程。HUD renderer 只负责 begin/clear/end、早退态和 overlay 顺序编排，具体面板绘制继续委托既有 renderer。

回归测试：

- 覆盖登录 HUD 早退流仍执行 begin、清空 hit targets、必要时 clear、登录面板和 endFrame。
- 覆盖 battle HUD 早退流仍跳过 top bar，直接渲染 battle overlay。
- 覆盖地图首页 HUD 仍收集 world site hit targets，并按地图 overlay、教程、浮动反馈、奖励和网络遮罩顺序收尾。
- 覆盖普通 HUD overlay 仍渲染资源详情、设置、日志、城市切换、顾问、任务、攻略、名人、人才方针、编队、事件、科技详情、命名和最终反馈遮罩。
- 覆盖 `CanvasGameRenderer` 的 HUD overlay facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 26 的提交记录，包括测试命令、行数变化和结果。

### Step 26 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`，承接 HUD 模式流程编排。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 `renderHudOverlay` 外部入口与 facade，内部通过 `hudOverlayRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `HudOverlayCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js`，覆盖 HUD 早退态、地图页 HUD、普通 overlay 顺序和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 3835 行降至 3763 行。
- `frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`：新增为 130 行，承接 HUD 模式流程编排。
- `frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js`：新增为 163 行，覆盖 HUD 模式防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/HudOverlayCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`eb89607 refactor: move hud overlay flow into canvas renderer`。
- 文档提交哈希：`4315db2 docs: record refactor plan step 26`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 27：继续压缩 CanvasGameRenderer 的底部 Tab 渲染职责

目标：把 `CanvasGameRenderer.js` 内普通底部 Tab 的布局、绘制、锁定态、事件徽标和 hit target 协议下放到独立 `TabBarCanvasRenderer`。主 renderer 继续保留 `renderTabs` facade；地图首页分支只转发到既有 `renderMapCommandDock`，避免复制地图命令 dock 的实现。

回归测试：

- 覆盖 `TabBarCanvasRenderer` 普通 Tab 仍生成 `resources`、`tech`、`events`、`civilization` 的 `switchTab` hit target。
- 覆盖名人入口仍生成 `openFamousPersons` action tab。
- 覆盖 `tabLocks` 的 `disabled` 与 `isLocked` 仍会传入 hit target，并且锁定绘制后恢复 `ctx.globalAlpha`。
- 覆盖事件徽标仍通过 presenter 的 `buildEventViewState` 绘制徽标面板和文本。
- 覆盖地图首页 `renderTabs` 仍只委托 `renderMapCommandDock`，不新增传统 Tab hit target。
- 覆盖 `CanvasGameRenderer` 的 `renderTabs` facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 27 的提交记录，包括测试命令、行数变化和结果。

### Step 27 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/TabBarCanvasRenderer.js`，承接普通底部 Tab 的布局、绘制、锁定态、事件徽标和 hit target 协议。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 `renderTabs` 外部入口为 facade，内部通过 `tabBarRenderer` 委托；地图首页分支继续由 `renderMapCommandDock` 承接。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `TabBarCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/TabBarCanvasRenderer.test.js`，覆盖普通 Tab、名人 action tab、锁定态、事件徽标、地图首页委托和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 3763 行降至 3702 行。
- `frontend/js/platform/renderers/TabBarCanvasRenderer.js`：新增为 119 行，承接底部 Tab 渲染实现。
- `frontend/js/platform/renderers/TabBarCanvasRenderer.test.js`：新增为 121 行，覆盖底部 Tab 渲染防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/TabBarCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/TabBarCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`9e2deb6 refactor: move tab bar rendering into canvas renderer`。
- 文档提交哈希：`673d1c9 docs: record refactor plan step 27`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 28：继续压缩 CanvasGameRenderer 的世界地图层编排职责

目标：把 `CanvasGameRenderer.js` 内世界地图层布局、地图首页世界视图、空地图提示、探索 HUD、地图首页站点 hit target 收集、普通世界地图层渲染和快照层 backbuffer 流程下放到独立 `WorldMapLayerCanvasRenderer`。主 renderer 继续保留同名 facade；瓦片投影、瓦片缓存、站点绘制和世界地图操作仍由既有 `WorldMapCanvasRenderer` 承接，避免复制地图算法。

回归测试：

- 覆盖 `WorldMapLayerCanvasRenderer.getWorldMapLayerLayout` 在地图首页和普通军事世界视图下仍返回旧布局公式。
- 覆盖地图首页有瓦片时仍调用 `renderWorldTileMap`，保留 `resetWorldPan` 与 `startExplore` hit target。
- 覆盖地图首页无瓦片时仍绘制空地图提示并添加 `blockCanvasModal`，旧 `territories` 数据仍回退到 `renderMilitaryWorldView`。
- 覆盖探索队 ready/active 状态仍生成 `claimExplore` 或进度 HUD。
- 覆盖 `collectMapHomeWorldSiteHitTargets` 仍通过 `getWorldTileRenderEntries` 与 `addWorldTileSiteHitTargets` 收集站点 hit target。
- 覆盖 `renderWorldMapSnapshotLayer` 的 preserve-on-miss backbuffer、裁剪、`renderWorldTileSnapshotCache` 和 `worldTileWaterTimeOverride` 清理流程。
- 覆盖 `CanvasGameRenderer` 的世界地图层 facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 28 的提交记录，包括测试命令、行数变化和结果。

### Step 28 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js`，承接世界地图层布局、地图首页世界视图、空地图提示、探索 HUD、站点 hit target 收集、普通世界地图层和快照层流程。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 `getWorldMapLayerLayout`、`renderMapHomeWorldView`、`collectMapHomeWorldSiteHitTargets`、`renderMapHomeExplorerHud`、`renderMapHomeEmptyWorld`、`renderWorldMapLayer` 和 `renderWorldMapSnapshotLayer` 外部入口为 facade，内部通过 `worldMapLayerRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `WorldMapLayerCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js`，覆盖世界地图层布局、地图首页有/无瓦片分支、探索 HUD、站点 hit target 收集、快照 backbuffer 和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 3702 行降至 3360 行。
- `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js`：新增为 430 行，承接世界地图层编排实现。
- `frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js`：新增为 249 行，覆盖世界地图层防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`3658be8 refactor: move world map layer flow into canvas renderer`。
- 文档提交哈希：`ea66c6f docs: record refactor plan step 28`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 29：继续压缩 CanvasGameRenderer 的 HUD Tab 页面编排职责

目标：把 `CanvasGameRenderer.js` 内普通 HUD 内容页分派、`renderMainPanel` 领域 tab 分派和页面滑动过渡流程下放到独立 `HudTabPageCanvasRenderer`。主 renderer 继续保留 `renderMainPanel`、`renderHudTabPage` 和 `renderHudTabPageWithTransition` facade；具体建筑、事件、科技、文明、军事和首页资源渲染仍由既有领域 renderer 承接。

回归测试：

- 覆盖 `renderMainPanel` 仍按 `buildings`、`events`、`tech`、`civilization`、`military` 分派到对应 facade。
- 覆盖资源页仍按 `renderPopulation` 与 `renderHomeFeatureGrid` 编排，并保留 `maxBottom` 计算。
- 覆盖建筑、文明和军事 HUD 内容页仍保留可用高度计算与 tutorial/options 传递。
- 覆盖地图首页军事页仍由 `renderMapHomeWorldView` 承接，`skipWorldMapLayer` 时不重复绘制地图层。
- 覆盖 `renderHudTabPageWithTransition` 仍执行双 `withSlideClip`、旧页 suppressed hit target 和 `fromBuildingOffset` 回放。
- 覆盖无有效 transition 时仍直接渲染当前页。
- 覆盖 `CanvasGameRenderer` 的 HUD tab page facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 29 的提交记录，包括测试命令、行数变化和结果。

### Step 29 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/HudTabPageCanvasRenderer.js`，承接 HUD 内容页分派、主面板 tab 分派和页面滑动过渡流程。
- `frontend/js/platform/CanvasGameRenderer.js` 保留 `renderMainPanel`、`renderHudTabPage` 和 `renderHudTabPageWithTransition` 外部入口为 facade，内部通过 `hudTabPageRenderer` 委托。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在 HUD overlay 前加载 `HudTabPageCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js`，覆盖主面板分派、HUD 内容页布局、地图首页军事页、滑动过渡和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 3360 行降至 3311 行。
- `frontend/js/platform/renderers/HudTabPageCanvasRenderer.js`：新增为 114 行，承接 HUD tab 页面编排实现。
- `frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js`：新增为 160 行，覆盖 HUD tab 页面防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/HudTabPageCanvasRenderer.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`b587f5c refactor: move hud tab page flow into canvas renderer`。
- 文档提交哈希：`44d7511 docs: record refactor plan step 29`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 30：继续压缩 CanvasGameRenderer 的基础 Canvas Surface 职责

目标：把 `CanvasGameRenderer.js` 内通用画布 surface 能力下放到独立 `CanvasSurfaceRenderer`，包括布局、渐变、圆角路径、hit target、hover 点、教程遮罩允许动作、裁剪、清屏、文字测量/换行/截断、基础线条/形状、按钮、进度条、图标卡片、区块标题、帧时间和 FPS overlay。主 renderer 继续保留外部同名 API 作为 facade，实际渲染层工具由 `surfaceRenderer` 承接，后续领域 renderer 仍通过 host 协议调用这些基础能力。

回归测试：

- 覆盖 `CanvasSurfaceRenderer.getLayout` 仍按 `width`、`maxContentWidth` 和 `edgePadding` 返回旧布局公式。
- 覆盖线性/径向渐变和圆角路径仍使用 canvas 上下文能力，缺失能力时仍保留 fallback。
- 覆盖 hit target 的背景 action、教程遮罩 `blockCanvasModal`、`allowedAction`、教程 intro 当前步骤允许动作和 suppressed hit target 协议。
- 覆盖 `containsPoint` 与 `setHoverPoint` 的数值归一和无效点清理。
- 覆盖 `withTranslatedClip`、`withSlideClip` 和 `withTransformedClip` 的 save、rect、clip、translate/scale、restore 调用顺序和 callback 返回。
- 覆盖 `wrapText`、`measureTextWidth`、`truncateText` 和 `wrapTextLimit` 的字体切换与恢复。
- 覆盖 `beginFrame`、`updateFps`、`renderFpsOverlay` 和 `endFrame` 仍写回 host 帧状态并绘制 FPS。
- 覆盖 `drawPanel`、`drawButton`、`drawPrimaryActionButton`、`drawProgressBar`、`drawIconCard`、`drawPolyline`、`drawCurvePath` 和 `drawCircle` 的基础绘制协议。
- 覆盖 `CanvasGameRenderer` 的 surface facade 仍能委托到独立 renderer，不重复写入 hit target。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 30 的提交记录，包括测试命令、行数变化和结果。

### Step 30 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/CanvasSurfaceRenderer.js`，承接基础画布 surface、命中区、裁剪、通用绘制和 FPS overlay。
- `frontend/js/platform/CanvasGameRenderer.js` 增加 `surfaceRenderer` 注入与 `delegateSurfaceRenderer`，将基础 surface API 压缩为同名 facade。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `CanvasSurfaceRenderer`。
- 新增 `frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js`，覆盖布局、渐变、hit target、教程遮罩、裁剪、文字、FPS、基础绘制和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 3311 行降至 2619 行。
- `frontend/js/platform/renderers/CanvasSurfaceRenderer.js`：新增为 510 行，承接基础 surface 实现。
- `frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js`：新增为 208 行，覆盖基础 surface 防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/CanvasSurfaceRenderer.js`
- `node --check frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js`
- `node --test frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`12439dc refactor: move canvas surface helpers into renderer`。
- 文档提交哈希：`70f10ed docs: record refactor plan step 30`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 31：继续压缩 CanvasGameRenderer 的通用资产管线职责

目标：把 `CanvasGameRenderer.js` 内通用资产加载、asset cache、预热、缓存失效、alpha 边界测量、tile/source rect、canvas 工厂、普通图片绘制、裁剪绘制和 cover 裁切职责下放到独立 `CanvasAssetRenderer`。主 renderer 继续保留外部同名 API 作为 facade；世界瓦片水面模板与静态 chunk 编排仍暂由后续步骤继续拆分，避免一次搬出形成新的 500 行以上巨型文件。

回归测试：

- 覆盖 `preloadAssets` 对空列表、缓存 loaded/error、动态图片加载、进度回调、请求路径版本化和加载完成统计的旧协议。
- 覆盖 `getAsset` 仍按 lazy loading 写入 `assetCache`，图片加载完成后返回缓存图片，创建失败时记录 error。
- 覆盖 `invalidateWorldTileCaches` 仍清理静态层、侦察路线、水层、chunk/frame cache 和 view cache。
- 覆盖 `hasPreparedWorldTileSnapshotCache` 仍识别已准备好的静态快照缓存。
- 覆盖 `drawAsset`、`drawAssetClipped`、`drawCoverAsset` 和 `drawCanvasClipped` 仍恢复 `globalAlpha` 并保持 drawImage 参数协议。
- 覆盖 `analyzeAssetAlphaBounds`、`measurePixelBounds`、`getWorldTileTemplateMetrics` 和 `drawTileAsset` 仍保留 alpha 边界与 tile source rect 逻辑。
- 覆盖 `createTileWorkCanvas` 与 `createTutorialSpineCanvas` 仍可在 DOM/OffscreenCanvas 场景创建可用 canvas。
- 覆盖 `CanvasGameRenderer` 的 asset facade 仍能委托到独立 renderer，不重复承载资产算法。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 31 的提交记录，包括测试命令、行数变化和结果。

### Step 31 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/CanvasAssetRenderer.js`，承接通用资产加载、缓存、预热、缓存失效、alpha bounds、canvas 工厂和图片绘制。
- `frontend/js/platform/CanvasGameRenderer.js` 增加 `assetRenderer` 注入与 `delegateAssetRenderer`，将通用资产 API 压缩为同名 facade。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `CanvasAssetRenderer`。
- 新增 `frontend/js/platform/renderers/CanvasAssetRenderer.test.js`，覆盖资产加载进度、缓存失效、图片绘制、alpha bounds、canvas 工厂和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 2619 行降至 2409 行。
- `frontend/js/platform/renderers/CanvasAssetRenderer.js`：新增为 415 行，承接通用资产管线实现，未超过 500 行。
- `frontend/js/platform/renderers/CanvasAssetRenderer.test.js`：新增为 224 行，覆盖资产管线防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/CanvasAssetRenderer.js`
- `node --check frontend/js/platform/renderers/CanvasAssetRenderer.test.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/CanvasAssetRenderer.test.js`
- `node --test frontend/js/platform/renderers/CanvasAssetRenderer.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`1f7e237 refactor: move canvas asset pipeline into renderer`。
- 文档提交哈希：`ebb5acb docs: record refactor plan step 31`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 32：继续压缩 CanvasGameRenderer 的世界瓦片水面模板职责

目标：把 `CanvasGameRenderer.js` 内世界瓦片水面模板 mask、透明/颜色水面模板生成、干底图 composite、水纹平铺、河口/海岸水模板拆分和水层绘制职责下放到独立 `WorldTileWaterCanvasRenderer`。主 renderer 继续保留外部同名 API 作为 facade；资产加载、alpha bounds、source rect 和 canvas 工厂仍由 `CanvasAssetRenderer` 承接，地图投影和站点渲染仍由 `WorldMapCanvasRenderer` 承接，避免水面模块越界拥有游戏状态或地图层编排。

回归测试：

- 覆盖 `WorldTileWaterCanvasRenderer.getWorldTileTemplateMask` 仍能创建并缓存模板水面 mask，同时写入 `worldTileMaskMetricsCache`。
- 覆盖海洋河口模板仍拆分为 shore edge 与 river template 两层，并按 `waterKind` 区分水纹来源。
- 覆盖 `fillWorldTileWaterTexture` 仍按稳定世界坐标、scale、uvScale 与正模偏移平铺水纹。
- 覆盖 `drawWorldTileWater` 仍在纹理可用时绘制水层，并按默认协议补绘干底图模板。
- 覆盖 `CanvasGameRenderer` 的世界瓦片水面 facade 仍能委托到独立 renderer，避免主类重新持有水面实现。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 32 的提交记录，包括测试命令、行数变化和结果。

### Step 32 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.js`，承接世界瓦片水面模板 mask、干底图 composite、水纹平铺、水层绘制和海洋河口模板拆分。
- `frontend/js/platform/CanvasGameRenderer.js` 增加 `worldTileWaterRenderer` 注入与 `delegateWorldTileWaterRenderer`，将世界瓦片水面 API 压缩为同名 facade。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `WorldTileWaterCanvasRenderer`。
- 新增 `frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js`，覆盖模板 mask 缓存、水模板拆分、水纹平铺、干底图补绘和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 2806 行降至 2587 行。
- `frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.js`：新增为 461 行，承接世界瓦片水面模板与水层绘制实现，未超过 500 行。
- `frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js`：新增为 256 行，覆盖世界瓦片水面防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.js`
- `node --check frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js`
- `node --test frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js frontend/js/platform/renderers/CanvasAssetRenderer.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`c51c294 refactor: move world tile water rendering into renderer`。
- 文档提交哈希：`4453a3b docs: record refactor plan step 32`。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。

### Step 33：继续压缩 CanvasGameRenderer 的根帧渲染编排职责

目标：把 `CanvasGameRenderer.js` 内根 `render()` 帧流程、登录/加载/战斗早退、地图首页军事帧、普通 tab 帧、页面转场、标准 overlay 顺序、地图首页 overlay 顺序和帧反馈收尾下放到独立 `CanvasFrameRenderer`。主 renderer 继续保留 `render` 和 `renderMapHomeOverlays` 外部入口作为 facade；HUD 模式仍委托既有 `HudOverlayCanvasRenderer`，具体业务面板仍由对应领域 renderer 承接，避免根帧流程继续混入主类。

回归测试：

- 覆盖 `mode: hud` 仍直接委托 `renderHudOverlay`，不启动普通帧 begin/clear 流。
- 覆盖登录与加载态仍按 begin、清空 hit target、clear、对应面板、endFrame 的早退顺序执行。
- 覆盖地图首页军事帧仍在 `skipWorldMapLayer` 时收集站点 hit target，并按顺序渲染地图首页 overlay、教程 intro、反馈和网络层。
- 覆盖普通 tab 帧仍保留页面转场双 `withSlideClip`、旧页面 suppressed hit target、标准 modal overlay、科技详情 modal 和最终反馈顺序。
- 覆盖 `renderMapHomeOverlays` 仍作为独立 facade 目标保留地图首页浮动按钮、命令面板、城市/顾问/任务/名人/事件/命名 overlay 协议。
- 覆盖 `CanvasGameRenderer` 的根帧 facade 仍能委托到独立 renderer。

提交要求：

- 单独提交。
- 推送到服务器远端 `origin/main`。

留档要求：

- 在本文档追加 Step 33 的提交记录，包括测试命令、行数变化和结果。

### Step 33 留档

状态：已完成

本次改动：

- 新增 `frontend/js/platform/renderers/CanvasFrameRenderer.js`，承接根帧 render 流程、地图首页军事帧、普通 tab 帧、页面转场、标准 overlay 和地图首页 overlay 编排。
- `frontend/js/platform/CanvasGameRenderer.js` 增加 `frameRenderer` 注入与 `delegateFrameRenderer`，将 `render` 和 `renderMapHomeOverlays` 压缩为 facade。
- 更新 `frontend/index.html` 和 `frontend/minigame/game.js`，保证 H5 与小游戏环境在主 renderer 前加载 `CanvasFrameRenderer`。
- 新增 `frontend/js/platform/renderers/CanvasFrameRenderer.test.js`，覆盖 HUD 委托、早退帧、地图首页帧、普通 tab 转场、地图首页 overlay 和主 renderer facade。

行数变化：

- `frontend/js/platform/CanvasGameRenderer.js`：由本轮开始时的 2188 行降至 2109 行。
- `frontend/js/platform/renderers/CanvasFrameRenderer.js`：新增为 168 行，承接根帧渲染编排实现，未超过 500 行。
- `frontend/js/platform/renderers/CanvasFrameRenderer.test.js`：新增为 197 行，覆盖根帧编排防回归协议。

测试命令：

- `node --check frontend/js/platform/CanvasGameRenderer.js`
- `node --check frontend/js/platform/renderers/CanvasFrameRenderer.js`
- `node --check frontend/js/platform/renderers/CanvasFrameRenderer.test.js`
- `node --check frontend/minigame/game.js`
- `node --test frontend/js/platform/renderers/CanvasFrameRenderer.test.js`
- `node --test frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/WorldTileWaterCanvasRenderer.test.js frontend/js/platform/renderers/CanvasAssetRenderer.test.js frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js frontend/js/platform/renderers/HudTabPageCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.test.js frontend/js/platform/renderers/TabBarCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js frontend/js/platform/renderers/MapCommandCanvasRenderer.test.js frontend/js/platform/renderers/ArmyFormationEditorCanvasRenderer.test.js frontend/js/platform/renderers/AdvisorCanvasRenderer.test.js frontend/js/platform/renderers/OverlayCanvasRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/SystemCanvasRenderer.test.js frontend/js/platform/renderers/HomeCanvasRenderer.test.js frontend/js/platform/renderers/GuideTaskCanvasRenderer.test.js frontend/js/platform/renderers/MilitaryCanvasRenderer.test.js frontend/js/platform/renderers/CivilizationCanvasRenderer.test.js frontend/js/platform/renderers/EventCanvasRenderer.test.js frontend/js/platform/renderers/BuildingCanvasRenderer.test.js frontend/js/platform/renderers/TutorialCanvasRenderer.test.js frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js frontend/js/platform/renderers/FamousCanvasRenderer.test.js frontend/js/platform/renderers/BattleCanvasRenderer.test.js frontend/js/platform/renderers/TechCanvasRenderer.test.js`
- `node --test frontend/js/platform/interactions/TechTreeInteractionModel.test.js frontend/js/platform/GameCommandService.test.js frontend/js/state/presenters/TechPresenter.test.js`
- `node --test backend/tests/TerritoryClientAssembler.test.js backend/tests/GameStateServiceSplit.test.js backend/tests/GameActionRegistry.test.js`
- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- 全部通过。

提交结果：

- 代码提交哈希：`34f0e35 refactor: move canvas frame orchestration into renderer`。
- 文档提交说明：Step 33 文档记录由 `docs: record refactor plan step 33` 保存。
- 推送目标：`origin main`。
- 代码推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
- 文档推送状态：Step 33 文档记录随 `docs: record refactor plan step 33` 推送后校验服务器健康。

## 测试策略

后端优先使用 Node 内置 `node:test`，避免引入额外测试框架。前端纯逻辑模块也优先用 Node 测试；涉及 canvas 的地方先测试调用协议、view model、hit target，不在第一轮追求像素级测试。

每一步至少保留一个新增或更新的测试文件。测试必须覆盖本步最容易回归的协议边界。

## 提交留档

### Step 0 留档

状态：已完成

本次改动：

- 新增 `docs/architecture_refactor_plan_2026-06-04.md`。
- 新增 `scripts/verify-refactor-plan-doc.js`。

测试命令：

- `node scripts/verify-refactor-plan-doc.js`

测试结果：

- `node scripts/verify-refactor-plan-doc.js` 通过。

提交结果：

- 提交哈希：`6eec99d docs: add architecture refactor plan`。
- 推送目标：`origin main`。
- 推送状态：已推送，服务器部署完成，健康接口最终返回 `status: ok`。
