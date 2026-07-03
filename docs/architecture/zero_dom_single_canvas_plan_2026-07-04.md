# 零 DOM 单画布渲染改造计划（2026-07-04）

> **状态：全部阶段已完成并部署**（ZD-0 `a098c393` / ZD-A `1a4fcc7c` / ZD-B `8db3a89a` / ZD-C `c45c1c44`+`2bfcef6c` / ZD-D `721cf770`+终验）。
> 实测结果：DOM 画布 6→**1**（唯一可见画布 `h5CanvasLayer`），6 层全部离屏 surface，
> clip DIV 清零，headless FPS 28→**71**，pan 像素级等价（ZD-B 100% 匹配），零 JS 错误，
> 立绘/对话框/雾/HUD 视觉与基线一致。DOM 边界由 `CanvasDomBoundary.test.js` 棘轮守卫
> （允许清单：H5CanvasRuntime 4 处 boot+回退、CanvasAssetRenderer 2 处兜底，只减不增）。
> 已知取舍：无 OffscreenCanvas 的老浏览器自动回退旧多画布 DOM 栈（旧测试全绿保障）；
> `H5UpdateRuntimeAdapter` 的更新提示画布**刻意保留独立 DOM**——它是部署更新逃生舱，
> 必须在游戏渲染循环损坏时仍可用，属 boot 边缘平台 chrome，不算渲染架构债。

## 目标

H5 渲染宿主去除全部运行期 DOM 机器（多 DOM `<canvas>`、`document.createElement`、`appendChild`/`insertBefore`、`canvas.style.*`、CSS z-index 合成），收敛为：

- **1 张可见 canvas（永久 2d）**：既是 mainHud 绘制面，又是最终合成目标。
- **离屏表面（OffscreenCanvas）**：webgl 层（worldFog、tutorialSpine）与其余图层的绘制面。
- **引擎合成**：每帧按 `CanvasLayerRegistry.PHYSICAL_LAYER_ORDER` 用 `drawImage` 合成，绘制顺序即 z 序。
- **boot 适配器**：唯一允许触 DOM 的模块——取可见 canvas、绑定指针事件、读 viewport/dpr、rAF。

该模型与微信小程序 1:1 对应（`wx.createCanvas` / `wx.createOffscreenCanvas({type:'webgl'})` / 2d `drawImage`），使 `canvas-runtime-v1` 契约的小程序实现成为纯新增工作。

## 已验证的事实基线（2026-07-04 实测）

- headless Chromium：`OffscreenCanvas` 2d/webgl 均可用；`drawImage(离屏webgl → 2d)` 像素精确（红块回读 `255,0,0,255`）；离屏 2d 支持 `measureText`。
- 拖动主路径**已经是快照重绘**（`updateWorldMapDragCompositor` → `refreshWorldMapLayerFromSnapshot` 每拖动帧 blit + `clearTransform`）；CSS `translate3d` 仅为快照失效兜底。→ 合成器不会引入新的性能量级。
- mainHud 每帧全量重绘（`CanvasGameApp.renderAnimationFrame` setInterval ~16ms）；worldActor 行军时 33ms；spine 自循环 60fps；水面 8fps；fog 按需（reveal/相机提交）。
- 图层 API 调用点共 61 处 / 11 文件，全部经 `H5CanvasRuntime` + `CanvasGameShell` 门面，无散逸直捣 DOM。
- 渲染器对 canvas 对象的成员访问：仅 `TutorialAdvisorCanvasRenderer.js` 一处 `canvas.style.opacity`（带 `if (canvas.style)` 守卫，值恒为 1）。
- `SpineWebglPlayer` 已 shim `addEventListener`、optional-chain `getBoundingClientRect` → OffscreenCanvas 兼容（需补 `cssWidth/cssHeight` 显式尺寸避免 targetRect/clipRect 错位）。
- `WorldFogCanvasRenderer` 零 DOM：注入 canvas/gl，掩码从 CPU `Uint8Array` `texImage2D` 上传。
- `preserveDrawingBuffer:false` 下 `drawImage(offscreen webgl)` 必须与渲染同一同步任务内完成 → present 挂点全部同步紧跟渲染。

## 分阶段（每阶段独立可上线，全门禁 + 提交 + 双推送）

### ZD-0 基线 + 深读（本文档）✅
基线截图 `tmp/zerodom-baseline/`；机制清单（上文）；无生产码改动。

### ZD-A fog + spine WebGL 迁离屏
- `H5CanvasRuntime`：`createOffscreenSurface` / `syncLayerDrawSurface` / `presentLayer(name)` / `getLayerDrawSurface(name)`；`ensureLayerCanvas` 对 `contextType!=='2d'` 的层创建并返回离屏绘制面（DOM 画布降为 2d 呈现面）；`resizeCanvas` 同步离屏尺寸。无 `OffscreenCanvas` 时优雅回退旧行为（node 测试/老浏览器）。
- `SpineWebglPlayer`：新增 `onFrame` 回调（每帧渲染后触发 present）+ `cssWidth/cssHeight` 显式尺寸。
- `TutorialAdvisorCanvasRenderer`：创建 player 时传 `cssWidth/cssHeight` + `onFrame → runtime.presentLayer('tutorialSpine')`。
- `CanvasGameShell`：`renderWorldFogLayer` 及 `setWorldMapLayerVisible` 的 fog 清除处同步 present。
- 效果：DOM 里不再有任何 webgl 画布 → 永久消灭 webgl-vs-2d 跨上下文合成怪癖（上一轮 spine 盖对话框 bug 的整个类别）。

### ZD-B CanvasLayerCompositor + 世界层离屏
- 新增 DOM-free `CanvasLayerCompositor`（注入 surface 工厂；持层状态 translate/visible/alpha；按 PHYSICAL_LAYER_ORDER 向目标 ctx 合成；世界层 pan 用 source-rect 偏移 blit，复用 `WorldMapLayerCacheStore.getVisibleBlit` 语义）。
- worldMap/worldFog/worldActor 变离屏 surface；`setLayerTranslate` 变合成状态写 + 请求合成（替代 CSS transform 兜底）；`_layerName` 标记补到 surface。

### ZD-C 折叠单画布
- mainHud 可见画布成为唯一 DOM 画布 + 合成目标；spine/dialogue 并入合成 pass（spine present → 合成序内 drawImage + globalAlpha）。
- 删除 `insertLayerElementInStackOrder` / `collectManagedStackElements` / `ensureLayerHost` / `applyCanvasLayerStyle` / `applyLayerHostStyle` / `setLayerTransform` DOM 半边 / `setLayerVisible` 的 style.display 半边（变合成 visible 标志）。
- DOM 收敛进 boot 适配器（取画布 + `H5CanvasInputController.bindEvents` + viewport/dpr + rAF）。

### ZD-D 清扫 + 守卫 + 终验
- `H5UpdateRuntimeAdapter` 更新提示画布归入 boot 适配器职责（平台 chrome，非游戏渲染）或并入合成顶层 pass。
- 移除 `CanvasAssetRenderer` 的 `ownerDocument`/`document.createElement` 离屏兜底。
- 新增 DOM 边界守卫测试：boot 适配器之外的 platform 层禁 `document.`/`appendChild`/`.style.`。
- 终验：完整 playtest 教程走通 + 基线截图对比 + 全门禁；用户真机一次性验收。

## 不变量（每阶段回归红线）

1. 视觉等价：基线截图场景（intro 对话、世界地图+雾、行军）像素结构一致。
2. 图层 API 名不变（`ensureLayerCanvas`/`getLayerMetrics`/`setLayerTranslate`/`setLayerVisible`…为契约 OPTIONAL 方法，语义由 DOM 实现换为合成实现）。
3. backing-store epoch 语义不变（bake 校验依赖）。
4. 命中测试纯几何（HitTargetManager），不依赖 DOM——已核实，勿引入。
5. render→present/composite 同一同步任务（preserveDrawingBuffer:false 约束）。
6. `npm test` + `npm run lint` + `npm run test:architecture` + prettier 全绿；LF。
