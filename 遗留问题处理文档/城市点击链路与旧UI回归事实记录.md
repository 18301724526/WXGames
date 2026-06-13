# 城市点击链路与旧 UI 回归事实记录

记录日期：2026-06-13

本文档只记录本次只读检查得到的代码事实，不包含修复方案，也不代表已经改动业务代码。

## 一、现场问题

当前用户反馈的现象：

- 点击自己的首都没有任何反应。
- 点击分城会弹出旧的宽 UI，而不是正确的入城 HUD。

这两个现象不能简单按“一个按钮失效”处理。代码里同时存在两套城市相关入口链路：

- 地图城市图标链路：地图城市图标 -> `openWorldSite` -> 城市地点 HUD -> `enterCity`。
- 旧城市切换/分城链路：旧入口或分城列表 -> `jumpToSubcity` / `selectCity` -> `switchCity` -> 可能回到旧宽资源栏。

## 二、地图城市图标的正确链路

地图城市图标的预期链路如下：

1. `frontend/js/state/presenters/WorldTileMapPresenter.js`

   `WorldTileMapPresenter.buildWorldTileMapViewState()` 会遍历 `territoryState.territories`，按城市坐标生成或补全世界地图 tile，并写入 `siteId`。

   关键事实：

   - 如果城市存在于 `territoryState.territories`，并且有可解析坐标，就会生成对应 tile。
   - 生成的 tile 会携带 `siteId: site.id`。

2. `frontend/js/platform/renderers/WorldMapHitTargetModel.js`

   `createWorldTileSiteHitTargets()` 遍历可见 tile entry。只要 `tile.site` 存在，就注册：

   ```js
   { type: 'openWorldSite', siteId: layout.site.id, tileId: tile.id }
   ```

3. `frontend/js/platform/renderers/WorldMapStaticEntryRenderer.js`

   `drawWorldTileSite()` 在绘制城市地点后，也会给城市地点注册：

   ```js
   { type: 'openWorldSite', siteId: site.id, tileId: tile.id }
   ```

4. `frontend/js/platform/renderers/CanvasSurfaceHitTargets.js`

   `resolveHitTarget()` 从后往前解析 hit target。

   关键事实：

   - 非 background 的前景目标会优先返回。
   - `openWorldSite` 不是优先级 action，但只要它没有被后注册的遮罩或其他前景目标挡住，就应该被返回。
   - 教程遮罩存在时，只有匹配 allowed action 的目标能穿透。

5. `frontend/js/platform/CanvasGameShellInputRouter.js`

   `handleTap()` 会取 `renderer.getHitTarget(point)`。

   - 如果 action 是 `openWorldSite`，正常进入 `handleAction()`。
   - `handleAction()` 调用 `actionController.handle(action)`。
   - 若 `openWorldSite` 被处理成功，会同步本地选择状态。

6. `frontend/js/platform/CanvasTerritoryActionHandlers.js`

   `handle_openWorldSite()` 会取得 `siteId`，然后优先调用 `TerritoryController.openSiteDialog(siteId)`。

7. `frontend/js/controllers/TerritoryController.js`

   `openSiteDialog(siteId)` 会：

   - 设置 `uiState.selectedSiteId = siteId`。
   - 清空 `worldMarchTarget`。
   - 清空 `selectedWorldActorId`。
   - 调用 `onRenderRequested()`。

8. `frontend/app.js`

   `TerritoryController` 初始化时传入：

   ```js
   onRenderRequested: () => this.renderTerritory()
   ```

9. `frontend/js/platform/CanvasGameAppRenderingRuntime.js`

   `renderTerritory()` 当前会强制解析为地图首页世界视图：

   - `requestedTab: 'territory'`
   - `militaryView: 'world'`
   - `forceMapHome: true`

10. `frontend/js/platform/renderers/CanvasFrameRenderer.js`

    地图首页 overlay 渲染阶段会调用 `renderWorldSiteModal(state, options)`。

11. `frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.js`

    `renderWorldSiteModal()` 根据 `options.territoryUiState.selectedSiteId` 查找对应 detail。

    如果 detail 的 action 是 `city-command`，会渲染城市命令 HUD，并注册 `enterCity`。

## 三、首都点击无反应的事实边界

从代码事实看，首都点击如果走到 `openWorldSite`，后续应当出现城市地点 HUD。

因此“点击首都无反应”的断点不应先假设在 `enterCity()`。它更可能发生在以下层之一：

- 首都没有进入 `territoryState.territories`，或缺少可解析坐标，导致没有生成世界地图 site hit target。
- 首都视觉上显示了，但点击区域没有覆盖实际视觉位置。
- `openWorldSite` hit target 被更晚注册的前景目标、遮罩或旧面板挡住。
- `openWorldSite` 成功处理，但 `renderWorldSiteModal()` 没有在 `territoryState.territories` 里找到 `selectedSiteId` 对应的 detail。
- 教程遮罩或高亮存在时，实际点击 action 没有匹配 allowed action，所以被挡。

需要注意：当前 H5 实际通过 `CanvasGameShell.mount(... previewEnabled: true)` 进入 Shell 渲染。Shell 渲染会合并 `TerritoryController.uiState`、`CanvasGameApp.territoryUiState`、`CanvasGameShell.territoryUiState`。所以这次不能简单归因成“controller 设置了 selectedSiteId，但 renderer 只看 app 的另一个对象”。

## 四、分城点击弹旧宽 UI 的链路

分城存在两条不同链路。

### 1. 地图分城图标链路

如果点击的是地图上的分城图标，理论上应与首都一致：

```text
地图分城图标 -> openWorldSite -> openSiteDialog -> renderTerritory -> renderWorldSiteModal -> 入城 HUD
```

### 2. 旧分城列表/城市切换链路

当前代码里还存在另一条链路：

1. `frontend/js/platform/renderers/MapCommandCanvasRenderer.js`

   `renderFloatingSubcityButton()` 在地图首页渲染浮动“分城”按钮，并注册：

   ```js
   { type: 'openSubcityList' }
   ```

2. `frontend/js/platform/renderers/CityCanvasRenderer.js`

   `renderSubcityListPanel()` 渲染分城列表。每个非当前分城注册：

   ```js
   { type: 'jumpToSubcity', cityId: city.id }
   ```

3. `frontend/js/platform/CanvasCityActionHandlers.js`

   `handle_jumpToSubcity()` 做了三件事：

   - `openWorldSiteLocally(cityId)`
   - `centerWorldMapOnSite(cityId)`
   - 再构造 `selectAction = { ...action, type: 'selectCity', cityId }`

   然后继续走 `selectCity()`。

4. `frontend/js/platform/CanvasCityActionHandlers.js`

   `selectCity()` 调用：

   ```js
   game.switchCity(action.cityId)
   ```

5. `frontend/js/platform/GameCommandService.js`

   `switchCity(cityId)` 调 API 切城，然后 `applyApiState(result)`。

关键事实：

- `jumpToSubcity` 并不是纯粹“打开地图城市地点 HUD”。
- 它会继续触发 `selectCity/switchCity`。
- `switchCity()` 不等价于 `enterCity()`。
- `switchCity()` 不会设置 `showCityManagement = true`。
- `switchCity()` 不会明确打开入城 HUD。
- 因此该链路可能把玩家带回旧宽 UI 或旧城市切换表现。

## 五、旧宽资源栏的来源

旧宽资源栏来自：

`frontend/js/platform/renderers/ResourceTopBarCanvasRenderer.js`

`renderTopBar(state, options)` 的关键分支：

```js
if (options.isMapHome) return this.renderMapHomeTopBar(state);
```

如果 `options.isMapHome` 不为真，就走后面的旧宽资源栏实现。

旧宽资源栏还会渲染城市切换触发区，并注册：

```js
{ type: 'openCitySwitcher' }
```

这解释了为什么当流程没有稳定停在 map-home 世界视图时，旧宽 UI 会再次出现。

## 六、地图首页 overlay 目前仍允许旧面板出现

`frontend/js/platform/renderers/CanvasFrameRenderer.js`

`renderMapHomeOverlays()` 当前仍会在地图首页 overlay 阶段渲染：

- `renderFloatingSubcityButton()`
- `renderSubcityListPanel()`
- `renderCitySwitcherMenu()`
- `renderTaskCenterPanel()`
- `renderGuidebookPanel()`
- `renderWorldSiteModal()`
- `renderCityManagementPanel()`

事实含义：

- 地图首页并不是只承载世界地图 HUD。
- 旧分城列表、旧城市切换、任务中心、攻略面板仍可能作为 overlay 出现在地图首页。
- 这些入口如果没有被明确归属和门禁锁住，就会继续把旧链路带回当前游戏流程。

## 七、上次测试没有覆盖真实失败路径

`frontend/js/platform/CanvasGameApp.test.js`

当前新增过的测试验证的是：

```text
已经有 selectedSiteId=capital 时，调用 renderTerritory() 会走 map-home city HUD 渲染参数
```

它没有验证以下真实交互：

- 地图上的首都图标是否实际注册 `openWorldSite`。
- 点击首都坐标后是否真的进入 `handle_openWorldSite()`。
- 点击首都后是否真的渲染出 `enterCity` hit target。
- 点击地图上的分城图标是否与首都走同一条 `openWorldSite` 链路。
- `jumpToSubcity/selectCity/switchCity` 是否会把界面带回旧宽 UI。

因此，上次测试能通过，但不能证明“点击首都/分城后正确出现入城 HUD”。

## 八、下一步应先补的事实型测试

后续如果进入修改阶段，应先用 TDD 暴露问题，而不是直接打补丁。

建议优先补以下测试：

1. 首都地图点击测试

   输入：包含首都 territory 和 world tile 的状态。

   断言：

   - 渲染后存在 `openWorldSite` hit target。
   - 点击首都命中区后处理 `openWorldSite`。
   - 处理后 `selectedSiteId` 为首都。
   - 渲染后存在 `enterCity` hit target。

2. 分城地图点击测试

   输入：包含首都和分城的状态。

   断言：

   - 分城地图图标注册 `openWorldSite`。
   - 点击分城地图图标后出现同类城市地点 HUD。
   - 不触发 `jumpToSubcity`。
   - 不触发 `switchCity`。

3. 旧分城列表链路测试

   输入：打开 `showSubcityList` 后点击分城项。

   断言：

   - 当前行为会走 `jumpToSubcity -> selectCity -> switchCity`。
   - 该行为与“地图城市图标打开入城 HUD”不是同一条链路。
   - 后续修复时必须明确决定该旧入口是删除、迁移，还是改为只打开地图城市 HUD。

4. 旧宽 UI 防回归测试

   输入：从地图首页点击首都/分城。

   断言：

   - `ResourceTopBarCanvasRenderer.renderTopBar()` 不应进入非 map-home 宽资源栏分支。
   - 不应注册 `openCitySwitcher`。
   - 应注册 `enterCity`。

## 九、当前结论

当前问题不是单个按钮失效，而是城市入口架构没有唯一化。

事实上，项目里仍同时存在：

- 地图城市图标的 `openWorldSite` 链路。
- 旧分城列表的 `jumpToSubcity/selectCity/switchCity` 链路。
- 非 map-home 的旧宽资源栏和 `openCitySwitcher`。
- 地图首页 overlay 中对旧面板的继续承载。

在没有测试门禁前，任何直接改动都容易再次出现：

- 表面隐藏旧入口，但旧 handler 仍能被其他地方调用。
- 修了首都，但分城走旧链路。
- 修了分城列表，但误删地图首页有用 HUD。
- 切城状态同步后又回到旧宽 UI。

因此，下一步必须先用测试把“地图城市点击必须打开入城 HUD，不能回到旧宽 UI”锁死，再逐个处理旧入口归属。

## 十、2026-06-13 本次修复事实

本次先修复“点击城市应出现 HUD”的最小闭环，不处理旧页面删除和旧入口清理。

已确认的真实断点：

- 世界地图运行时命中目标由 `WorldMapRuntime.syncHitTargetsFromRenderer()` 合并主地图命中目标与 actor 层命中目标。
- `WorldMapInputActionMap.getHitTarget()` 原本按数组从后往前取前景目标。actor 层目标后合并，因此当部队回城后站在城市图标上时，`selectWorldActor` 会抢掉 `openWorldSite`。
- 主 HUD 命中目标由 `CanvasSurfaceHitTargets.resolveHitTarget()` 处理。这里也把 `selectWorldActor` 放进优先级 action，因此同样会让 actor 选择压过城市入口。
- 这解释了“部队回城后站在城头，点击首都没有打开城市 HUD”的现象：点击被解析成了 `selectWorldActor`，没有进入 `openWorldSite -> openSiteDialog -> renderWorldSiteModal`。

本次修复边界：

- 在 `frontend/js/domain/WorldMapInputActionMap.js` 中增加城市入口识别：当 `selectWorldActor` 与 `openWorldSite` / `enterCity` 重叠时，优先返回城市入口。
- 在 `frontend/js/platform/renderers/CanvasSurfaceHitTargets.js` 中同步相同规则：`selectWorldActor` 不能抢掉城市入口。
- `returnWorldMarch`、`stopWorldMarch`、`startWorldMarch` 等明确按钮仍保留原优先级，不被本次规则改变。
- `CanvasGameShell` 层新增测试确认：当 actor 与 city hit target 重叠时，点击会派发 `openWorldSite`，并同步 `selectedSiteId`。
- `CanvasGameShell` 层新增测试确认：`openWorldSite` 后渲染仍保持 `activeTab: 'military'`、`militaryView: 'world'`、`isMapHome: true`，避免回到非 map-home 旧宽资源栏路径。

已加门禁：

- `frontend/js/domain/WorldMapInputActionMap.test.js`
  - `WorldMapInputActionMap keeps a city click as openWorldSite when an actor stands on the city`
- `frontend/js/platform/renderers/CanvasSurfaceRenderer.test.js`
  - 更新 hit target priority 断言，城市入口压过重叠 actor 选择。
- `frontend/js/platform/CanvasGameShell.test.js`
  - `CanvasGameShell routes a city tap to openWorldSite when an actor overlaps the city`
  - `CanvasGameShell keeps map-home HUD rendering after an open world site action`

本次没有处理的范围：

- 没有删除旧宽资源栏代码。
- 没有删除旧分城列表、任务、攻略等 overlay 入口。
- 没有修改 `jumpToSubcity/selectCity/switchCity` 旧链路。
- 没有把所有旧页面彻底迁移或删除。

这些仍属于后续“旧入口归属与删除”任务，不能把本次命中目标修复误认为旧 UI 清理已经完成。

## 九、2026-06-14：第 29-31 步人才/方针引导旧 resources 壳回归修复事实

用户复现的新现象：

- 进入游戏后看到旧宽资源栏和旧底部 Tab。
- 点击“重置账号”后取消，界面会临时变成正确的窄资源栏和正确底部 dock。
- 再点击已占领城市 `123`，旧宽资源栏和旧底部 Tab 又会回来。

确认事实：

- `test1` 账号服务端状态是 `tutorial.currentStep = 31`，`tutorial.completed = false`。
- 第 31 步属于 `talentPolicyApplied`，也就是人才/方针后的手动人才分配引导阶段。
- 原代码里的 `TutorialGuideUiStateCoordinator.ensureCityPeopleGuideVisible()` 会主动设置：
  - `mapHomeActive = false`
  - `currentTab = 'resources'`
  - `militaryView = 'army'`
  - `renderReadOnly(..., 'resources', { forceMapHome: false, allowDefaultMapHome: false })`
- 这不是缓存问题，也不是简单入口隐藏问题，而是教程架构仍把第 29-31 步目标写成旧 `resources` 壳。

本次修复事实：

- `frontend/js/tutorial/TutorialGuideUiStateCoordinator.js`
  - 第 29-31 步人才/方针引导现在保持 `mapHomeActive = true`。
  - 引导目标页签改为 `currentTab = 'military'`、`militaryView = 'world'`。
  - 渲染入口改为 `renderReadOnly(..., 'military', { forceMapHome: true, isMapHome: true })`。
  - 高亮刷新选项同步改为 `renderActiveTab: 'military'` 和 map-home 强制选项。
- `frontend/js/tutorial/TutorialGuideStepPolicy.js`
  - 第 29-31 步客户端 tab gate 从只允许 `resources` 改为只允许 `military`。
- `backend/services/tutorial/TutorialTabAccess.js`
  - 后端教程 tab gate 同步从只允许 `resources` 改为只允许 `military`。

已加门禁：

- `frontend/js/tutorial/TutorialGuideController.test.js`
  - `TutorialGuideController keeps map home while opening city people guide directly`
  - 覆盖第 29-31 步打开城市管理人才页时必须保持 `military/world/mapHomeActive=true`。
- `frontend/js/platform/CanvasGameShell.test.js`
  - `CanvasGameShell keeps highlighted city people guides on map home`
  - 覆盖教程高亮重渲染不得把状态改回 `resources/army/mapHomeActive=false`。
- `frontend/js/tutorial/TutorialGuideStepPolicy.test.js`
  - 覆盖第 29-31 步客户端 gate 允许 `military`。
- `backend/tests/TutorialProgressService.test.js`
  - 覆盖第 29-31 步服务端 gate 允许 `military`、拒绝 `resources`。

已验证：

- `node --test frontend/js/tutorial/TutorialGuideController.test.js frontend/js/tutorial/TutorialGuideStepPolicy.test.js frontend/js/platform/CanvasGameShell.test.js backend/tests/TutorialProgressService.test.js`
- `node --test frontend/js/tutorial/*.test.js backend/tests/Tutorial*.test.js backend/tests/TerritoryActionTutorial.test.js`
- `node --test frontend/js/platform/CanvasCityActionHandlers.test.js frontend/js/platform/renderers/CanvasFrameRenderer.test.js frontend/js/platform/renderers/CityCanvasRenderer.test.js frontend/js/platform/renderers/HudOverlayCanvasRenderer.test.js`

本次没有处理的范围：

- 没有删除 `CanvasFrameRenderer` 的 standard frame / 旧 resources 渲染代码。
- 没有删除旧 `jumpToSubcity/selectCity/switchCity` 链路。
- 没有删除其它仍可能存在的旧 resources 业务入口。
- 本次只把已复现的第 29-31 步教程回归链路从旧 resources 壳迁到 map-home 城市管理浮层，并用测试锁住。
