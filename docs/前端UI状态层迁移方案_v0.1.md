# 前端 UI 状态层迁移方案 v0.1

## 背景

当前前端已经把部分控件做成了游戏风格 UI，但本质仍然依赖 DOM：

- `index.html` 静态承载页面结构、弹窗、按钮、输入框。
- `app.js` 与各 Renderer 通过 `getElementById`、`querySelector`、`innerHTML`、`classList` 直接操作界面。
- 建筑、事件、疆域、侦察等模块会运行时拼 HTML。

这对 H5 版本可用，但不利于后续迁移到小游戏平台。小游戏侧没有完整浏览器 DOM，继续把业务显示计算和 DOM 绑定在一起，会导致迁移时需要重写大量逻辑。

## 目标

先不一次性重写 UI，而是增加一个中间层：

```plain
后端状态 gameState
  -> UIStatePresenter 生成纯 UI ViewState
  -> H5 DOM Renderer 消费 ViewState
  -> 未来 Canvas/小游戏 Renderer 消费同一个 ViewState
```

ViewState 必须是纯数据，不包含 DOM 节点、事件对象、CSS class 操作或 HTML 字符串。

## 第一阶段范围

第一阶段只迁移低风险且高频变化的两块：

- 资源条和资源详情弹窗。
- 人口管理面板。

原因：

- 这两块已经是全页面共享/高频更新 UI。
- 近期已经多次发生样式与布局调整。
- 它们逻辑相对简单，适合作为迁移模板。

## 已落地接口

新增模块：

- `frontend/js/state/UIStatePresenter.js`

当前提供：

- `buildResourceViewState(state)`
- `buildPopulationViewState(state)`
- `buildCitySwitcherViewState(state)`
- `buildCivilizationViewState(state, tutorial, options)`
- `buildMilitaryNavigationViewState(state)`
- `buildAdvisorViewState(guide)`
- `buildNamingPromptViewState(prompt)`
- `buildRecentLogViewState(entries)`
- `buildRequestLogViewState(logs)`
- `buildTerritorySummaryViewState(territoryState)`
- `buildBuildingViewState(state, tutorial, buildingConfig)`
- `buildBuildingCardViewState(state, tutorial, buildingConfig, id)`
- `buildEventViewState(state)`
- `buildEventModalViewState(eventData)`
- `buildMilitaryViewState(state)`
- `buildScoutControlViewState(state)`
- `buildWorldRadarViewState(territories, options)`
- `buildWorldSiteDialogViewState(territories, territoryState, uiState)`
- `buildWorldSiteActionViewState(site, territoryState, uiState)`
- `formatResourceAmount(value)`

资源 ViewState 包含：

- `text`：各资源数字、产速、详情文本。
- 资源数量超过或等于 1000 后统一使用紧凑单位：`k`、`M`、`G`、`T`，例如 `999`、`1k`、`1.2k`、`1.2M`。
- `visibility`：木材资源和木材详情是否显示。
- `classState`：资源条和净增长正负样式。

人口 ViewState 包含：

- `text`：总人口、上限、待分配、各职业人数。
- `jobs`：每个职业是否可增加、可减少、是否显示。
- `showCraftsman`：工匠职业是否显示。

城市切换器 ViewState 包含：

- `hidden`：是否隐藏城市切换器。
- `activeCityName`：当前显示城市名。
- `options`：每个城市的 id、名称、主城/分城标签、人口、建筑数量和选中状态。
- `signature`：城市选项签名，用于 H5 Renderer 判断是否需要重建菜单。

文明进阶 ViewState 包含：

- `text`：时代名、总览字段、进度文案、目标时代名、进阶按钮文案和时代描述。
- `progress`：进度百分比与进度条宽度。
- `advanceButton`：进阶按钮是否禁用，以及教程/分城/页签限制后的最终可点击状态。
- `conditions`：每个进阶条件的名称、达成样式和进度文案。

轻 UI 壳层 ViewState 包含：

- `authShell`：登录面板、主应用容器显示状态和登录提示文案。
- `authCredential`：记住密码开关、用户名输入值和密码输入值。
- `tutorialHighlight`：强引导遮罩、气泡和指针的几何位置。
- `tabNavigation`：主标签和页面的 active 状态。
- `tabLock`：教程锁定下主标签是否禁用、是否显示锁定态。
- `militaryNavigation`：军事子页的当前页、锁定状态、禁用状态、标题和 `aria-selected`。
- `advisor`：顾问按钮是否显示、顾问文案、是否可前往目标页和需要关闭弹窗的状态。
- `namingPrompt`：命名弹窗标题、说明、输入框占位符和当前提示 key。
- `recentLog`：最近日志是否为空、空状态文案和日志条目文本。
- `requestLog`：请求日志是否为空、接口、状态码、耗时和错误状态。
- `territorySummary`：疆域顶部势力名和已控制/已发现数量文案。

建筑 ViewState 包含：

- `ids`：当前可见建筑 id 列表，来自后端下发的解锁建筑和已建造建筑。
- `cards`：每张建筑卡片的名称、美术、等级、效果文本、军事文本、按钮状态和成本显示。
- `structureSignature`：用于 H5 Renderer 判断是否需要重建卡片骨架，避免高频心跳导致整块 DOM 重绘。

事件 ViewState 包含：

- `badge`：事件红点是否显示与显示文本。
- `pending.cards`：待处理事件卡片的 id、标题、描述、类型样式和倒计时提示。
- `history.items`：事件历史的图标、标题、结果文本和样式分类。
- `modal`：事件弹窗标题、描述、奖励/提示文本、选项按钮和主领取按钮状态。

军事/侦察 ViewState 包含：

- `military.text`：士兵数量、防御、可用士兵、出征士兵和训练文案。
- `military.training`：训练进度条宽度。
- `scout.statusText`：侦察页顶部状态文案。
- `scout.cells`：九宫格式侦察控件的中心格、方向按钮、倒计时、禁用状态和操作类型。

世界雷达 ViewState 包含：

- `signature`：地图站点结构签名，用于判断是否需要重建雷达 DOM。
- `pan`：当前雷达拖拽偏移。
- `sites`：每个地点的 id、样式分类、标题、美术、显示名和雷达百分比坐标。

世界地点弹窗 ViewState 包含：

- `showModal`：是否显示地点详情弹窗。
- `details`：每个地点的可见状态、名称、归属、距离、规模、威胁、摘要、防御、推荐士兵、行军提示和上次战斗备注。
- `action`：每个地点的操作按钮、按钮禁用状态、行动提示和出征表单字段。
- `signature`：地点详情内容签名，用于 H5 Renderer 判断是否需要更新弹窗内容。

疆域交互 UIState 包含：

- `selectedSiteId`：当前打开的世界地点。
- `worldPanX` / `worldPanY`：雷达拖拽偏移。
- `expeditionConfigSiteId`：当前展开出征配置的地点。
- `expeditionTroopType` / `expeditionLeader` / `expeditionSoldiers`：出征草稿字段。

## 约束

- 后端仍是唯一数值来源，前端 ViewState 只做显示格式化。
- DOM Renderer 不再自行推导资源、人口、城市切换器、文明进阶面板、轻 UI 壳层、建筑卡片、事件系统、军事/侦察、世界雷达地图和世界地点弹窗的显示规则，只读取 ViewState。
- 后续新增 UI 优先先写 ViewState，再写 DOM 渲染。
- 不在 ViewState 里拼 HTML，HTML 只属于 H5 Renderer。

## 后续迁移顺序建议

1. 建筑卡片：把建筑状态、按钮状态、成本显示抽成 ViewState。（已完成基础迁移）
2. 事件系统：把事件卡片、事件选项、倒计时文本抽成 ViewState。（已完成基础迁移）
3. 军事/侦察：把军队状态、侦察方向按钮、倒计时抽成 ViewState。（已完成基础迁移）
4. 世界雷达：把坐标、视觉偏移、选中态、行动面板抽成 ViewState。（地图布局、站点基础显示、弹窗行动面板和交互草稿状态已完成）
5. 城市切换器与文明进阶面板：把城市选项、时代进度、按钮状态和条件列表抽成 ViewState。（已完成基础迁移）
6. 顾问、命名、日志和军事子页导航：把轻 UI 壳层的显示文案、禁用态、锁定态抽成 ViewState。（已完成基础迁移）
7. 疆域摘要和请求日志：把顶部疆域摘要、请求日志列表和错误状态抽成 ViewState。（已完成基础迁移）
8. 页面导航和弹窗：把通用 `classList` 状态切换继续收敛到 UI Adapter。（主标签导航与教程锁定已完成；弹窗开关和剩余事件绑定仍属后续 H5 Adapter 收敛范围）

## 迁移归档

### 2026-05-19 04:09:20 +08:00

范围：事件系统基础 ViewState 迁移。

原来：

- `EventUIRenderer` 直接从 `gameState` 读取 `eventQueue`、`eventHistory` 和 `resources.knowledgePerSecond`。
- 事件红点、待处理卡片、历史记录、倒计时提示、奖励预览、弹窗选项和主领取按钮状态都在 DOM Renderer 内部推导。
- 倒计时格式化、事件类型提示和奖励文本属于 H5 Renderer 逻辑，未来迁移到 Canvas/小游戏时需要重写。

改成：

- 新增 `UIStatePresenter.buildEventViewState(state)`，统一输出事件红点、待处理事件卡片、事件历史和知识产速文本。
- 新增 `UIStatePresenter.buildEventModalViewState(eventData)`，统一输出弹窗标题、描述、奖励/倒计时提示、选项按钮和主领取按钮状态。
- `EventUIRenderer` 只消费 ViewState 并写入当前 H5 DOM；HTML 字符串仍保留在 H5 Renderer 内，不进入 ViewState。
- 事件奖励预览复用资源紧凑单位规则，例如 `1250` 显示为 `1.2k`。
- `frontend/index.html` 中 `EventUIRenderer.js` 缓存版本更新为 `event-viewstate-v1`。

验证：

- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\event-ui-renderer.test.js frontend\tests\tutorial-controller.test.js`
- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\js\ui\EventUIRenderer.js`

### 2026-05-19 04:20:13 +08:00

范围：军事面板与侦察控件基础 ViewState 迁移。

原来：

- `app.js` 的 `renderMilitary()` 直接读取 `military`、`buildingEffects`、`territoryState`，自行计算士兵数量、防御、可用士兵、出征士兵和训练进度。
- `app.js` 的 `renderScoutControls()` 直接读取 `territoryState.directions` 与 `territoryState.scoutMissions`，自行计算侦察状态文案、倒计时、九宫格方向按钮、报告按钮和锁定按钮。
- 倒计时计算、训练条百分比、侦察按钮状态都绑在 H5 页面对象里，未来迁移时会和 DOM 渲染一起被重写。

改成：

- 新增 `UIStatePresenter.buildMilitaryViewState(state)`，统一输出军队状态文本和训练进度条宽度。
- 新增 `UIStatePresenter.buildScoutControlViewState(state)`，统一输出侦察状态文案和九宫格控件数据。
- `app.js` 保留现有 DOM 写入入口，但只消费 ViewState，不再自己推导军队与侦察显示规则。
- `getMissionRemainingSeconds()` 与 `formatScoutCountdown()` 变成兼容包装，内部委托给 `UIStatePresenter`。
- `frontend/index.html` 中 `UIStatePresenter.js` 缓存版本更新为 `ui-state-v3`，`app.js` 缓存版本更新为 `military-scout-viewstate-v1`。

验证：

- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\app-tutorial-targets.test.js`
- `node --test frontend\tests\*.test.js`
- `npm.cmd test`
- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\app.js`

### 2026-05-19 04:24:13 +08:00

范围：世界雷达地图布局与站点基础显示 ViewState 迁移。

原来：

- `TerritoryUIRenderer` 自己计算雷达坐标、距离归一、半径、角度和重叠避让。
- 地图站点的 class、标题、美术、显示名、CSS 百分比坐标和地图签名都在 H5 Renderer 内部推导。
- `render()` 里直接调用 renderer 内部布局算法决定是否重建地图 DOM。

改成：

- 新增 `UIStatePresenter.buildWorldRadarViewState(territories, options)`，统一输出地图签名、拖拽偏移和地点显示状态。
- 新增 `UIStatePresenter.buildWorldRadarLayout()`、`getWorldRadarPosition()`、`resolveWorldRadarPosition()` 等纯数据布局方法。
- `TerritoryUIRenderer.renderMap()` 只消费世界雷达 ViewState 并拼当前 H5 HTML。
- `TerritoryUIRenderer` 保留 `getRadarPosition()`、`buildRadarLayout()` 等兼容包装，内部委托给 `UIStatePresenter`，便于旧测试与后续渐进迁移。
- `frontend/index.html` 中 `TerritoryUIRenderer.js` 缓存版本更新为 `world-radar-viewstate-v1`。

暂未迁移：

- 地点详情弹窗内容、出征表单、行动按钮仍保留在 `TerritoryUIRenderer`，因为它们当前依赖 H5 `dataset` 暂存交互状态。下一轮需要先把选中地点、出征草稿和行动面板状态抽成 ViewState。

验证：

- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\territory-ui-renderer.test.js frontend\tests\app-tutorial-targets.test.js`
- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\js\ui\TerritoryUIRenderer.js`
- `node -c frontend\app.js`

### 2026-05-19 04:33:39 +08:00

范围：世界地点详情弹窗与出征行动面板 ViewState 迁移。

原来：

- `TerritoryUIRenderer` 直接在 H5 Renderer 内部计算地点状态、归属、距离、规模、威胁、效果摘要、防御和推荐士兵文案。
- 行军耗时、已抵达待接管、上次战斗备注、占领/管理/改名按钮、出征表单字段和按钮禁用状态都由 DOM Renderer 自行推导。
- 地点弹窗内容签名读取 `container.dataset` 后手写拼装，显示规则和 H5 暂存交互状态混在一起。

改成：

- 新增 `UIStatePresenter.buildWorldSiteDialogViewState(territories, territoryState, uiState)`，统一输出地点详情弹窗的显示状态和内容签名。
- 新增 `UIStatePresenter.buildWorldSiteActionViewState(site, territoryState, uiState)` 与出征表单 ViewState，统一输出操作按钮、禁用状态、提示文案和出征草稿字段。
- `TerritoryUIRenderer` 保留兼容包装方法，但内部委托给 `UIStatePresenter`；实际渲染只消费 ViewState 并拼 H5 HTML。
- H5 `dataset` 暂时只作为当前页面的 UI 交互草稿输入，由 Renderer 收集后传入 Presenter，不再在 Renderer 内部推导业务显示结果。
- `frontend/index.html` 中 `UIStatePresenter.js` 缓存版本更新为 `ui-state-v4`，`TerritoryUIRenderer.js` 缓存版本更新为 `world-dialog-viewstate-v1`。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\js\ui\TerritoryUIRenderer.js`
- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\territory-ui-renderer.test.js`

### 2026-05-19 04:38:54 +08:00

范围：城市切换器与文明进阶面板 ViewState 迁移。

原来：

- `app.js.renderCitySwitcher()` 直接读取 `cityState.cities`，自行判断是否隐藏、当前城市名、主城/分城标签、人口建筑摘要和菜单签名。
- `app.js.renderCivilization()` 直接计算时代总览、进度条宽度、进阶按钮禁用状态、教程未解锁文案、分城不可进阶文案和条件列表。
- `canAdvanceEraByTutorial()` 与 `canAdvanceEraNow()` 的显示/交互判断散落在页面对象里，未来小游戏 Renderer 无法复用。

改成：

- 新增 `UIStatePresenter.buildCitySwitcherViewState(state)`，统一输出城市切换器是否显示、当前城市名、城市选项和菜单签名。
- 新增 `UIStatePresenter.buildCivilizationViewState(state, tutorial, options)`，统一输出文明总览、时代进度、进阶按钮状态、进阶文案和条件列表。
- `app.js.renderCitySwitcher()` 与 `app.js.renderCivilization()` 只消费 ViewState 写入 H5 DOM。
- `canAdvanceEraByTutorial()` 与 `canAdvanceEraNow()` 改为委托 `UIStatePresenter`，避免页面对象保留另一套进阶显示判断。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\city-switcher.test.js frontend\tests\app-tutorial-targets.test.js`

### 2026-05-19 04:45:36 +08:00

范围：顾问、命名、最近日志与军事子页导航轻 UI 壳层 ViewState 迁移。

原来：

- `app.js.renderMilitaryView()` 和 `updateMilitaryViewLocks()` 直接计算军事子页当前页、古典时代前锁定状态、按钮禁用状态、标题和 `aria-selected`。
- `app.js.updateAdvisor()` 直接读取 `softGuide`，自行决定顾问按钮是否显示、弹窗文案、前往按钮禁用状态和弹窗关闭。
- `app.js.openNamingModal()` 直接从后端提示拼命名弹窗标题、说明、占位符和提示 key。
- `app.js.showRecentLogs()` 直接读取 DOM 日志节点并拼带大量内联样式的日志 HTML。

改成：

- 新增 `UIStatePresenter.buildMilitaryNavigationViewState(state)`，统一输出军事子页当前页、锁定/禁用状态、按钮标题和 `aria-selected`。
- 新增 `UIStatePresenter.buildAdvisorViewState(guide)` 与 `getAdvisorTargetTab(target)`，统一输出顾问按钮/弹窗状态和目标页解析。
- 新增 `UIStatePresenter.buildNamingPromptViewState(prompt)`，统一输出命名弹窗的标题、说明、占位符和提示 key。
- 新增 `UIStatePresenter.buildRecentLogViewState(entries)`，统一输出最近日志空状态和条目文本。
- 最近日志展示从内联样式改为 `.recent-log-empty`、`.recent-log-list`、`.recent-log-item` CSS 类，H5 Renderer 只消费 ViewState 生成结构。
- 教程步骤规则仍保留在 `TutorialController`，本轮没有改变流程控制职责。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\app-tutorial-targets.test.js frontend\tests\resource-art.test.js`

### 2026-05-19 04:50:31 +08:00

范围：疆域顶部摘要与请求日志 ViewState 收尾迁移。

原来：

- `app.js.renderTerritory()` 直接从 `territoryState` 拼势力名和 `已控制/已发现` 文案。
- `logs.js.showRequestLogs()` 自己截取请求日志、判断错误状态、拼请求日志表格，并带大量内联样式。
- `frontend/index.html` 的 `style.css`、`app.js`、`logs.js` 和 `UIStatePresenter.js` 缓存版本仍停留在较早迁移阶段。

改成：

- 新增 `UIStatePresenter.buildTerritorySummaryViewState(territoryState)`，统一输出势力名和疆域数量文案。
- 新增 `UIStatePresenter.buildRequestLogViewState(logs)`，统一输出请求日志空状态、接口、状态码、耗时和错误状态。
- `logs.js` 改为消费请求日志 ViewState，只负责渲染当前 H5 表格结构。
- 请求日志内联样式迁移到 `.request-log-empty`、`.request-log-table-wrap`、`.request-log-table` 等 CSS 类。
- `frontend/index.html` 缓存版本更新为 `style.css?v=ui-state-shell-v1`、`UIStatePresenter.js?v=ui-state-v5`、`app.js?v=ui-state-shell-v1`、`logs.js?v=ui-state-shell-v1`。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\app.js`
- `node -c frontend\logs.js`
- `node --test frontend\tests\ui-state-presenter.test.js frontend\tests\app-tutorial-targets.test.js frontend\tests\resource-art.test.js frontend\tests\population-hud.test.js`

### 2026-05-19 04:59:41 +08:00

范围：疆域雷达与出征交互临时状态去 DOM 化。

原来：

- `TerritoryController` 把当前选中地点写入 `container.dataset.selectedSiteId`，地点弹窗开关和详情显隐直接操作当前 DOM。
- 雷达拖拽偏移写入 `container.dataset.worldPanX/worldPanY`，Renderer 再从 DOM 读取偏移参与地图渲染。
- 出征配置草稿写入 `container.dataset.expeditionConfigSiteId`、`expeditionTroopType`、`expeditionLeader`、`expeditionSoldiers`。
- `TerritoryUIRenderer` 读取这些 DOM `dataset` 字段后再传给 `UIStatePresenter`，导致 H5 节点同时承担渲染容器和交互状态仓库职责。

改成：

- `TerritoryController` 新增独立 `uiState`，集中保存 `selectedSiteId`、雷达偏移和出征草稿。
- `TerritoryController.getUiState()` 对外提供纯对象快照，供 Renderer/Presenter 消费。
- 打开/关闭地点弹窗只更新 `uiState` 并请求重新渲染，不再手动改弹窗 DOM 显隐。
- 雷达拖拽只更新 Controller 内部 `uiState`，H5 层即时写 CSS 变量保持拖拽手感，但不再把偏移落到 DOM `dataset`。
- `TerritoryUIRenderer` 改为通过注入的 `getUiState()` 读取交互状态，默认返回空对象；不再读取 `dataset.selectedSiteId`、`dataset.worldPanX` 或出征草稿字段。
- `app.js` 在创建 `TerritoryUIRenderer` 时注入 `territoryController.getUiState()`，让 H5 Renderer 继续消费同一份 Presenter ViewState。
- `frontend/index.html` 更新 `TerritoryController.js`、`TerritoryUIRenderer.js` 和 `app.js` 缓存版本为 `territory-ui-state-v1`。

验证：

- `node -c frontend\js\controllers\TerritoryController.js`
- `node -c frontend\js\ui\TerritoryUIRenderer.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\territory-controller.test.js frontend\tests\territory-ui-renderer.test.js frontend\tests\resource-art.test.js frontend\tests\ui-state-presenter.test.js`

### 2026-05-19 05:03:42 +08:00

范围：登录账号壳层显示状态 ViewState 迁移。

原来：

- `auth.js.showLoginPanel()` 直接决定 `loginPanel` 和 `app` 的 `display` 值，并在同一段逻辑里写登录提示。
- 登录成功和已有 token 自动启动时，`auth.js` 直接把登录面板隐藏、主应用显示。
- `fillRememberedCredentials()` 直接从 `localStorage` 推导记住密码开关、用户名回填和密码回填规则。
- 登录壳层显示规则无法在 Node 里脱离 DOM 单独验证，未来迁移小游戏时需要重写一遍。

改成：

- 新增 `UIStatePresenter.buildAuthShellViewState(options)`，统一输出登录面板是否显示、主应用是否显示和登录提示文案。
- 新增 `UIStatePresenter.buildAuthCredentialViewState(credentials)`，统一输出记住密码勾选状态、用户名输入值和密码输入值。
- `auth.js` 新增 `applyAuthShellView(view)` 和 `showAuthenticatedShell()`，只负责把 ViewState 写入当前 H5 DOM。
- `fillRememberedCredentials()` 只读取本地存储并把原始值交给 Presenter，由 Presenter 决定密码是否回填。
- `frontend/index.html` 更新 `UIStatePresenter.js` 缓存版本为 `ui-state-v6`，`auth.js` 缓存版本为 `auth-viewstate-v1`。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\auth.js`
- `node --test frontend\tests\auth.test.js frontend\tests\ui-state-presenter.test.js frontend\tests\resource-art.test.js`

### 2026-05-19 05:10:41 +08:00

范围：教程强引导高亮几何 ViewState 迁移。

原来：

- `TutorialUIRenderer` 在 H5 Renderer 内部自行计算 spotlight 遮罩的 `top/left/width/height`。
- 气泡位置和手指指针位置也在 Renderer 内部读取 viewport 后直接计算。
- 这些坐标算法和 DOM 样式写入绑定在一起，未来 Canvas/小游戏渲染教程高亮时需要重新实现同一套几何逻辑。

改成：

- 新增 `UIStatePresenter.buildTutorialHighlightViewState(rect, viewport)`，统一输出 `overlay`、`bubble` 和 `pointer` 的位置样式值。
- `TutorialUIRenderer` 保留滚动目标、类名切换和样式写入职责，但位置计算改为消费 Presenter 输出。
- `TutorialUIRenderer` 增加 Presenter 解析入口，浏览器优先使用 `window.UIStatePresenter`，Node 测试环境可兼容加载同一模块。
- `frontend/index.html` 更新 `UIStatePresenter.js` 缓存版本为 `ui-state-v7`，`TutorialUIRenderer.js` 缓存版本为 `tutorial-viewstate-v1`。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\js\ui\TutorialUIRenderer.js`
- `node --test frontend\tests\tutorial-ui-renderer.test.js frontend\tests\ui-state-presenter.test.js frontend\tests\resource-art.test.js`

### 2026-05-19 05:13:23 +08:00

范围：主标签页面导航与教程锁定状态 ViewState 迁移。

原来：

- `app.js.switchTab()` 自行把 `territory` 映射到 `military`，并直接判断每个 `.page` 与 `.tab-btn` 是否 active。
- `app.js.updateTabLocks()` 直接遍历 DOM 按钮，调用 `tutorialController.canOpenTab()` 后自行决定 `is-locked` 和 `disabled`。
- 主导航状态和 H5 DOM 绑定在一起，未来小游戏渲染主页面切换时仍需要重写 active/locked 判断。

改成：

- 新增 `UIStatePresenter.buildTabNavigationViewState(state, options)`，统一输出主标签和页面 active 状态，并保留 `territory -> military` 的展示映射。
- 新增 `UIStatePresenter.buildTabLockViewState(tabs, canOpenTab)`，统一输出每个标签是否禁用和是否显示锁定态。
- `app.js.switchTab()` 只消费导航 ViewState 写入当前 H5 class。
- `app.js.updateTabLocks()` 只收集按钮 id，并把锁定判断委托给 Presenter，再写回 H5 DOM。
- `frontend/index.html` 更新 `UIStatePresenter.js` 缓存版本为 `ui-state-v8`，`app.js` 缓存版本为 `tab-navigation-viewstate-v1`。

验证：

- `node -c frontend\js\state\UIStatePresenter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\app-tutorial-targets.test.js frontend\tests\ui-state-presenter.test.js frontend\tests\resource-art.test.js`

### 2026-05-19 21:32:25 +08:00

范围：小游戏平台无 DOM 入口与 Canvas 交互壳层落地。

原来：

- H5 入口统一从 `frontend/index.html` 加载 `app.js`、`auth.js`、`population.js`、`logs.js`、`floating-text.js`、`DOMHelper` 和各 DOM Renderer。
- `GameAPI` 默认依赖浏览器 `fetch`，微信小游戏/抖音小游戏环境需要再写一套请求适配。
- 前端显示状态已经逐步迁入 `UIStatePresenter`，但还没有独立的小游戏入口消费这些 ViewState。
- 小游戏路径如果直接复用 H5 文件，会碰到 `document`、`querySelector`、`innerHTML`、`classList`、`localStorage` 等平台不兼容能力。

改成：

- 新增 `frontend/minigame/game.js` 作为小游戏入口，只加载配置、`UIStatePresenter`、`GameAPI` 和 `frontend/js/platform/*`，不加载任何 H5 DOM 适配文件。
- 新增 `frontend/minigame/game.json`，按小游戏工程约定声明竖屏、隐藏状态栏和网络超时配置。
- 新增 `PlatformRuntime`，统一封装微信/抖音风格的 `createCanvas`、`getSystemInfoSync`、同步存储、`request`、定时器和触摸事件；H5 兜底仅用于本地调试。
- `GameAPI` 增加 `transport.request()` 注入能力，并补充 `assignJob(job, count)`，小游戏端可通过平台 request 发起同一套后端动作。
- 新增 `MiniGameCanvasRenderer`，直接消费 `UIStatePresenter` 输出，在 Canvas 上绘制资源条、人口、建造、事件、文明进阶、军事/侦察、顾问和底部页签。
- 新增 `MiniGameApp`，维护 `activeTab`、同步后端状态、分发 Canvas 命中区域到后端动作；人口加减、建造/升级、事件处理、进阶、侦察/领取侦察报告不再依赖 DOM Controller。
- H5 DOM 代码保留为 H5 Adapter；小游戏入口的测试会固定禁止引用 `app.js`、`auth.js`、`population.js`、`logs.js`、`floating-text.js`、`DOMHelper` 以及 `document/getElementById/querySelector/innerHTML/classList`。

验证：

- `node -c frontend\js\api\GameAPI.js`
- `node -c frontend\js\platform\PlatformRuntime.js`
- `node -c frontend\js\platform\MiniGameCanvasRenderer.js`
- `node -c frontend\js\platform\MiniGameApp.js`
- `node -c frontend\minigame\game.js`
- `node --test frontend\tests\game-api.test.js frontend\tests\minigame-platform.test.js frontend\tests\ui-state-presenter.test.js`

### 2026-05-19 22:43:07 +08:00

范围：H5 静态入口去内联事件化。

原来：

- `frontend/index.html` 登录按钮直接写 `onclick="Game.handleLogin()"`。
- 日志弹窗遮罩和关闭按钮直接写内联关闭逻辑，并直接访问 `document.getElementById('logModal')`。
- 设置菜单里的“重置游戏”和“退出登录”直接通过 `onclick` 调用 `Game.resetGame()`、`Game.logout()` 和 `Game.toggleSettings()`。
- H5 静态结构仍携带行为脚本，后续迁移小游戏或替换渲染入口时，需要继续清理 HTML 里的事件逻辑。

改成：

- `index.html` 只保留结构和稳定节点 id：`btnLogin`、`btnCloseLogModal`、`btnResetGame`、`btnLogout`。
- 登录点击事件移入 `auth.js` 的 H5 账号适配层，由 `mountAuthMethods()` 绑定。
- 请求日志新增 `closeRequestLogs()`，日志遮罩与关闭按钮事件移入 `app.js.bindBaseEvents()`。
- 设置菜单的重置和退出事件移入 `app.js.bindBaseEvents()`，并在动作后统一关闭设置菜单。
- `frontend/tests/resource-art.test.js` 增加断言：`index.html` 不再允许出现 `on*="..."` 形式的内联事件。

验证：

- `rg -n "\son[a-z]+=" frontend\index.html`
- `node -c frontend\app.js`
- `node -c frontend\auth.js`
- `node -c frontend\logs.js`
- `node --test frontend\tests\auth.test.js frontend\tests\resource-art.test.js frontend\tests\app-tutorial-targets.test.js`

### 2026-05-19 22:52:09 +08:00

范围：请求日志/最近日志弹窗 H5 壳层适配器抽离。

原来：

- `logs.js.showRequestLogs()` 直接查找 `logModal` 和 `logModalContent`，自行写 `innerHTML`、`style.display` 和 `classList.add('active')`。
- `logs.js.closeRequestLogs()` 直接操作日志弹窗 DOM。
- `app.js.showRecentLogs()` 也重复查找同一组日志弹窗节点，并自行打开弹窗。
- 请求日志和最近日志共用同一个 H5 弹窗，但打开/关闭/写内容逻辑散落在两个模块里。

改成：

- 新增 `frontend/js/ui/LogModalAdapter.js`，集中负责 H5 日志弹窗的内容写入、打开和关闭。
- `app.js` 初始化 `this.logModal`，并把最近日志弹窗打开动作委托给 adapter。
- `logs.js` 只负责请求日志数据缓存和 HTML 字符串生成，弹窗打开/关闭统一委托 `this.logModal`。
- `frontend/index.html` 增加 `LogModalAdapter.js?v=log-modal-adapter-v1`。
- 新增 `frontend/tests/log-modal-adapter.test.js` 验证 adapter 的内容写入与显隐状态。

验证：

- `node -c frontend\js\ui\LogModalAdapter.js`
- `node -c frontend\app.js`
- `node -c frontend\logs.js`
- `node --test frontend\tests\log-modal-adapter.test.js frontend\tests\resource-art.test.js frontend\tests\app-tutorial-targets.test.js`

### 2026-05-19 22:55:59 +08:00

范围：飘字效果 H5 Adapter 抽离。

原来：

- `floating-text.js` 在 `game.showFloatingText()` 内直接 `document.querySelector()`、`document.getElementById('fxLayer')` 和 `document.createElement()`。
- `app.js.showFloatingText()` 仍查找旧的 `window.showFloatingText` 全局函数，和 `mountFloatingText(game)` 的挂载方式不一致。
- 飘字效果是临时反馈，但 DOM 创建逻辑没有集中到可替换的渲染适配器里。

改成：

- `floating-text.js` 新增 `FloatingTextAdapter`，集中负责 H5 飘字节点创建、定位、插入和移除。
- `mountFloatingText(game)` 只创建 `game.floatingText`，并注入 `fxLayer` 与目标解析函数。
- `app.js.showFloatingText()` 改为调用 `this.floatingText.show(message)`，失败时回退到日志。
- `frontend/index.html` 更新 `floating-text.js` 缓存版本为 `floating-adapter-v1`。
- 新增 `frontend/tests/floating-text.test.js` 验证飘字 adapter 的节点创建、位置计算和失败回退返回值。

验证：

- `node -c frontend\floating-text.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\floating-text.test.js frontend\tests\resource-art.test.js frontend\tests\app-tutorial-targets.test.js`

### 2026-05-19 23:01:26 +08:00

范围：运行时最近日志 H5 Adapter 抽离。

原来：

- `app.js.log()` 每次写日志都直接 `document.getElementById('logContent')`、`document.createElement()`、`prepend()` 和 `removeChild()`。
- `app.js.showRecentLogs()` 再通过 `document.querySelectorAll('#logContent .log-item')` 从 DOM 反推最近日志内容。
- 最近日志既是业务反馈数据，又被隐藏 DOM 当成唯一数据源，不利于小游戏入口复用。

改成：

- `app.js` 新增 `recentLogs` 纯数据数组，`log(message)` 只写入数据并限制最多 30 条。
- 新增 `frontend/js/ui/RuntimeLogAdapter.js`，集中负责把最近日志数组渲染成 H5 `#logContent`。
- `showRecentLogs()` 改为直接读取 `recentLogs` 构造 ViewState，不再扫描 DOM。
- `UIStatePresenter.buildRecentLogViewState()` 支持 `{ text }` 日志对象，同时保留字符串和旧 `textContent` 兼容。
- `frontend/index.html` 加载 `RuntimeLogAdapter.js?v=runtime-log-adapter-v1`。
- 新增 `frontend/tests/runtime-log-adapter.test.js` 验证 H5 日志写入、HTML 转义和条数限制。

验证：

- `node -c frontend\js\ui\RuntimeLogAdapter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\runtime-log-adapter.test.js frontend\tests\log-modal-adapter.test.js frontend\tests\resource-art.test.js frontend\tests\app-tutorial-targets.test.js`

### 2026-05-19 23:09:18 +08:00

范围：账号登录壳层 H5 Adapter 抽离。

原来：

- `auth.js` 直接读取登录输入框、记住密码复选框和设置菜单 DOM。
- `setLoginMessage()`、`applyAuthShellView()`、`fillRememberedCredentials()` 和登录事件绑定都散落在账号流程模块里。
- 登录流程、ViewState 构造和 H5 节点写入仍混在一个文件，后续小游戏入口需要重新实现同一批账号壳层交互。

改成：

- 新增 `frontend/js/ui/AuthShellAdapter.js`，集中负责登录面板显示、提示文本、账号输入回填、读取凭据、设置菜单开关和登录事件绑定。
- `auth.js` 初始化 `game.authShell`，账号流程只调用 adapter 方法，不再直接读写登录壳层 DOM。
- `frontend/index.html` 加载 `AuthShellAdapter.js?v=auth-shell-adapter-v1`，并更新 `auth.js` 缓存版本为 `auth-shell-adapter-v1`。
- 新增 `frontend/tests/auth-shell-adapter.test.js` 覆盖 H5 登录壳层写入、凭据读取、设置菜单开关和登录事件。
- 更新 `frontend/tests/auth.test.js`，让账号流程测试通过注入 adapter 验证现有登录行为不变。

验证：

- `node -c frontend\js\ui\AuthShellAdapter.js`
- `node -c frontend\auth.js`
- `node --test frontend\tests\auth-shell-adapter.test.js frontend\tests\auth.test.js frontend\tests\resource-art.test.js`

### 2026-05-19 23:14:52 +08:00

范围：人口管理面板 H5 Adapter 抽离。

原来：

- `population.js.updatePopulationButtons()` 直接 `document.querySelectorAll()` 查找职业加减按钮并写 `disabled`。
- `population.js` 直接通过 `document.getElementById('craftsmanCard')` 控制工匠卡显示。
- `bindPopulationEvents()` 在人口流程模块里遍历按钮、写 `dataset.popBound`，并读取 `classList.contains('btn-plus')` 推导加减方向。

改成：

- 新增 `frontend/js/ui/PopulationPanelAdapter.js`，集中负责职业按钮禁用态、工匠卡显示和 H5 点击绑定。
- `population.js` 初始化 `game.populationPanel`，渲染人口时只构造 ViewState、写基础文本并交给 adapter。
- `bindPopulationEvents()` 改为委托 `populationPanel.bind()`，业务模块只接收 `(job, delta)`。
- `frontend/index.html` 加载 `PopulationPanelAdapter.js?v=population-panel-adapter-v1`，并更新 `population.js` 缓存版本。
- 新增 `frontend/tests/population-panel-adapter.test.js` 验证按钮状态、工匠卡显示和自绘按钮点击分配。

验证：

- `node -c frontend\js\ui\PopulationPanelAdapter.js`
- `node -c frontend\population.js`
- `node --test frontend\tests\population-panel-adapter.test.js frontend\tests\population-hud.test.js frontend\tests\resource-art.test.js frontend\tests\minigame-platform.test.js`

### 2026-05-19 23:18:55 +08:00

范围：资源详情弹窗 H5 Adapter 抽离。

原来：

- `app.js.bindBaseEvents()` 直接读取 `resourcePanel`、`resourceDetailModal` 和 `btnCloseResourceDetail` 并绑定点击事件。
- `app.js.openResourceDetails()` / `closeResourceDetails()` 直接 `document.getElementById('resourceDetailModal')` 并切换 `show` 类。
- 弹窗开关属于 H5 壳层行为，但散在主游戏对象里。

改成：

- 新增 `frontend/js/ui/ResourceDetailModalAdapter.js`，集中负责资源条点击、遮罩关闭、关闭按钮和弹窗 `show` 类切换。
- `app.js` 初始化 `this.resourceDetailModal`，绑定时只传入 `onOpen` / `onClose`。
- `openResourceDetails()` 保留打开前刷新资源详情的业务动作，再委托 adapter 打开弹窗。
- `frontend/index.html` 加载 `ResourceDetailModalAdapter.js?v=resource-detail-modal-adapter-v1`。
- 新增 `frontend/tests/resource-detail-modal-adapter.test.js` 验证 H5 弹窗交互和显隐状态。

验证：

- `node -c frontend\js\ui\ResourceDetailModalAdapter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\resource-detail-modal-adapter.test.js frontend\tests\resource-art.test.js frontend\tests\resource-renderer.test.js frontend\tests\app-tutorial-targets.test.js`

### 2026-05-19 23:21:32 +08:00

范围：顾问面板 H5 Adapter 抽离。

原来：

- `app.js.bindBaseEvents()` 直接给 `advisorBtn`、`advisorModal`、关闭按钮、稍后再说和前往按钮绑定事件。
- `app.js.updateAdvisor()` 直接写顾问按钮 `hidden`、顾问文案、前往按钮 `disabled`，并在无建议时关闭弹窗。
- `openAdvisor()` / `closeAdvisor()` 直接读取 `advisorModal` 并切换 `show` 类。

改成：

- 新增 `frontend/js/ui/AdvisorPanelAdapter.js`，集中负责顾问按钮、顾问弹窗、文案、按钮状态和 H5 交互绑定。
- `app.js` 初始化 `this.advisorPanel`，绑定时只传入 `onOpen` / `onClose` / `onGo`。
- `updateAdvisor()` 保留 `activeAdvisor` 业务状态，显示写入交给 adapter。
- `frontend/index.html` 加载 `AdvisorPanelAdapter.js?v=advisor-panel-adapter-v1`。
- 新增 `frontend/tests/advisor-panel-adapter.test.js` 验证顾问面板渲染、打开关闭和前往事件。

验证：

- `node -c frontend\js\ui\AdvisorPanelAdapter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\advisor-panel-adapter.test.js frontend\tests\app-tutorial-targets.test.js frontend\tests\resource-art.test.js`

### 2026-05-19 23:25:55 +08:00

范围：领地/势力命名弹窗 H5 Adapter 抽离。

原来：

- `app.js.bindBaseEvents()` 直接给命名弹窗遮罩、关闭按钮和确认按钮绑定事件。
- `openNamingModal()` 直接写 `namingTitle`、`namingMessage`、`namingInput.placeholder`，并切换弹窗 `show` 类和聚焦输入框。
- `submitNaming()` 直接读取输入框 value，并手动切换确认按钮 disabled。

改成：

- 新增 `frontend/js/ui/NamingModalAdapter.js`，集中负责命名弹窗文案写入、输入框清空/聚焦、遮罩关闭、提交事件、读取名称和提交中状态。
- `app.js` 初始化 `this.namingModal`，命名业务只保留 prompt 状态和后端 API 调用。
- `openNamingModal()` 改为构造 ViewState 后交给 adapter 打开。
- `submitNaming()` 改为从 adapter 读取名称并切换提交状态。
- `frontend/index.html` 加载 `NamingModalAdapter.js?v=naming-modal-adapter-v1`。
- 新增 `frontend/tests/naming-modal-adapter.test.js` 验证 H5 弹窗写入、输入读取、提交状态和事件绑定。

验证：

- `node -c frontend\js\ui\NamingModalAdapter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\naming-modal-adapter.test.js frontend\tests\app-tutorial-targets.test.js frontend\tests\resource-art.test.js frontend\tests\ui-state-presenter.test.js`

### 2026-05-19 23:30:40 +08:00

范围：请求日志弹窗关闭事件收敛。

原来：

- `app.js.bindBaseEvents()` 直接读取 `logModal` 和 `btnCloseLogModal`。
- 日志弹窗内容和显隐已由 `LogModalAdapter` 管理，但遮罩关闭和关闭按钮仍散在主游戏对象里。

改成：

- `LogModalAdapter` 新增 `closeButton` 注入和 `bindClose(onClose)`。
- `app.js` 初始化日志弹窗 adapter 时传入关闭按钮，并把关闭事件委托给 `logModal.bindClose()`。
- 日志弹窗的内容写入、显隐和关闭交互都集中到 H5 adapter。

验证：

- `node -c frontend\js\ui\LogModalAdapter.js`
- `node -c frontend\app.js`
- `node --test frontend\tests\log-modal-adapter.test.js frontend\tests\app-tutorial-targets.test.js`

## 判断标准

一个模块完成迁移的标准：

- 核心显示状态可在 Node 测试中不依赖 `document` 直接生成。
- DOM Renderer 只负责把 ViewState 写入当前 H5 节点。
- 未来小游戏 Renderer 可以复用同一份 ViewState。
