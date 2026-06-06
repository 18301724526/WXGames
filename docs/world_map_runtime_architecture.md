# 大地图独立运行时架构方案

## 目标

大地图不能再作为“军事页面里的一个组件”被 UI renderer 顺带绘制。它必须成为常驻游戏场景：拖动只更新本地 camera，地图 runtime 自己决定何时绘制，HUD、浮层和同步数据只作为覆盖层或数据补丁参与。

## 现有问题

- 地图拖动经过 `worldMapDrag -> actionController -> territoryController -> renderCanvasSurface`。
- 一次输入会牵动 presenter、HUD、地图、hitTargets、心跳刷新等整条 UI 链路。
- 原型流畅但接入后卡顿，说明瓶颈不是 Canvas/H5/素材，而是地图被接进了页面式渲染架构。

## 正确架构

0. Canvas-only UI 是死规矩
   - 游戏业务 UI 禁止迁回 DOM，禁止新增 DOM 按钮、DOM 面板、DOM HUD 或 DOM 浮层。
   - 任务、引导、建筑、人口、事件、军事、科技、文明、名人、弹窗、HUD、调试按钮等游戏内可见业务界面，都只能由 Canvas 绘制和 Canvas hitTargets 承载。
   - 允许使用多 canvas 分层：世界地图 canvas、HUD/UI canvas、教程/Spine/对话 canvas。
   - 浏览器 H5 宿主层只能创建 canvas、挂载 canvas、绑定输入事件；不能用 DOM overlay、DOM 节点或 HTML 字符串替代任何游戏 UI。
   - 地图层和 UI 层的分离只能在 canvas runtime 内完成，不能以 DOM overlay 替代。

1. `WorldMapRuntime` 常驻
   - 持有 `camera.x/y`、拖动状态、地图命中区域、地图渲染调度。
   - 拖动时只更新 camera，不派发全局 `worldMapDrag` action。

2. 地图层和 HUD 层分离
   - 地图 runtime 负责 tile、地点、路线、动态地图效果。
   - `CanvasGameRenderer` 负责顶部状态、Dock、浮层和业务面板。
   - HUD 更新不得强制地图完整重绘。

3. 命中检测分流
   - HUD 按原 hitTargets 处理按钮和浮层。
   - 地图空白区域、地点、地块由 `WorldMapRuntime` 处理。

4. 同步不打断地图
   - 服务端同步只更新内存状态。
   - 用户拖动时不走全局 UI 重绘。
   - 地图 runtime 在下一帧或 dirty 区域刷新。

5. 双端一致
   - H5 可用独立 world map canvas 承载地图层。
   - 小游戏端可先在同一 canvas 中按“地图先、HUD 后”绘制，但输入/camera/runtime 规则必须一致。

## 第一阶段落地范围

- 新增 `frontend/js/platform/WorldMapRuntime.js`。
  - 持有地图本地 `camera.x/y`，拖动期间直接更新 camera。
  - 维护地图自己的命中区，只收集 `openWorldSite`、`resetWorldPan`、`worldMapDrag` 这类地图动作。
  - 只在地图输入视口内接管拖动，顶部资源条、底部 Dock、浮层仍交给 HUD。
- H5 `CanvasGameShell`：
  - 地图首页拖动优先交给 `WorldMapRuntime`。
  - 拖动不再派发 `worldMapDrag` action。
  - 拖动过程中优先移动独立 world map canvas 的 compositor transform，松手后再提交最终 camera 并重绘地图层。
  - HUD 未命中时再交给地图 runtime 处理地图点击。
  - 地图层由 runtime 渲染，HUD pass 不再重复绘制地图本体。
- 小游戏 `CanvasGameApp`：
  - 初始化同一套 `WorldMapRuntime`。
  - 地图首页拖动优先走 runtime camera。
  - 渲染时地图先画，HUD 以 `skipWorldMapLayer` 和 `preserveCanvas` 方式覆盖，避免单 canvas 端把地图层清掉。

## 本次代码入口

- H5 入口 `frontend/index.html` 加载 `WorldMapRuntime.js`。
- 小游戏入口 `frontend/minigame/game.js` 加载 `WorldMapRuntime.js`。
- H5 双 Canvas 路径：`CanvasGameShell` 创建被动 world map canvas，`WorldMapRuntime` 负责地图层，HUD canvas 只画覆盖层。
- 小游戏路径：`CanvasGameApp` 使用同一个 renderer 先画 runtime 地图，再保留画布绘制 HUD。
- 共享 renderer：`CanvasGameRenderer.renderWorldMapLayer()` 默认仍作为被动图层不污染 HUD hitTargets；只有 runtime 传入 `collectHitTargets` 时才收集地图命中区。

## 后续阶段

1. 地图 tile/chunk 缓存 runtime 化，减少可见区域重复计算。
2. 地点、城市、队伍、路线使用空间索引命中，不再依赖渲染时重建大量 hitTargets。
3. 地图动态层拆分：静态地形、路线/任务、选中光圈、水面动画分别刷新。
4. 同步数据 patch 到地图 runtime，按 chunk/object dirty 刷新。
5. 城市经营、军队、事件逐步地图化，业务面板作为 overlay 打开。

## 验收标准

- 地图首页拖动不触发 `worldMapDrag` action。
- 地图首页拖动不调用完整业务 action/render 链路。
- HUD 和地图点击分流：按钮走 HUD，地图对象走 runtime。
- H5 和小游戏都使用 `WorldMapRuntime`。
- 已解锁地图首页仍可打开世界地点面板、重置视角、使用底部 Dock。

## 测试方法

自动化：

- `node --test frontend\tests\h5-canvas-runtime.test.js frontend\tests\minigame-platform.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\ui-state-presenter.test.js`
- `cd backend && npm test`

手机手测：

1. 进入一个已到古典时代、已有 tile 世界地图的账号。
2. 第一屏应是 tile 大地图，顶部资源条和底部 Dock 可见。
3. 连续短拖、松手、再拖，预期地图立即响应，不再出现每次重新按下都长时间卡住。
4. 拖动中底部 Dock 不应被地图误接管，点击建筑、科技、事件、文明、军事仍可进入原有入口。
5. 点击已发现世界地点，预期仍打开现有世界点面板；点击回到本城，视角归零。
6. 进入未到古典时代的新号，预期仍保持早期首页和教程流程。

## 后续性能阶段

第一阶段解决的是架构入口：地图拖动不再穿过全局 UI action/render 链。若地图规模继续扩大，下一阶段要继续做：

- chunk 级地形缓存和 dirty 区域刷新。
- 地点、队伍、路线的空间索引命中。
- 静态地形、水面、路线、选中效果分层刷新。
- 心跳同步数据 patch 到 runtime，而不是触发整页重绘。
