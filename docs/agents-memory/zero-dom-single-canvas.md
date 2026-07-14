---
name: zero-dom-single-canvas
description: H5 渲染已折叠为零 DOM 单画布 stage 合成（6 DOM 画布→1，全层离屏 surface）；关键机制、守卫、坑与回退语义。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-04 自主完成（用户指令"哪怕是H5适配我也不想看到任何DOM"+全程自主）。H5 渲染从 6 张 DOM 画布 + CSS z-index 折叠为**唯一可见画布 + 全层 OffscreenCanvas + 引擎 stage 合成**。工作在 refactor 分支，提交链 `a098c393→1a4fcc7c(ZD-A)→8db3a89a(ZD-B)→c45c1c44+2bfcef6c(ZD-C)→721cf770(ZD-D)`，全部已部署 private+WSL。计划文档：[docs/architecture/zero_dom_single_canvas_plan_2026-07-04.md](../../docs/architecture/zero_dom_single_canvas_plan_2026-07-04.md)。

**机制（H5CanvasRuntime）**：`ensureLayerCanvas(name)` 返回离屏 surface（`layerSurfaces` Map；`_viewportPadding/_fixedRect/_pixelRatioOverride/_backingStoreEpoch` 挂 surface，复用 `H5CanvasViewport.resizeCanvas` 的非 style 半边）。`compositeStage()` 按 `PHYSICAL_LAYER_ORDER` 把可见层画到唯一可见画布：世界层（padded）用 source-rect 偏移实现 pan（`sx=(padding-tx)*ratio`，与 CSS translate3d 像素级等价），fixedRect 层（spine/dialogue）落到 rect，全幅层（mainHud）铺满。`setLayerTranslate/Visible` 写 compositeState + 同步合成。webgl 层（fog/spine）有 `_presentCache`（2d 离屏快照）——**preserveDrawingBuffer:false 的 webgl 缓冲只在同任务可读**，present/refresh 必须紧跟渲染同任务；合成读 cache 跨任务安全。spine 60fps 走 `refreshLayerPresentCache`（只刷 cache），由 16ms HUD 帧 `renderReadOnly` 末尾的 compositeStage 兜底消化（挂点还有 shell 各世界渲染出口的 presentLayer）。

**实测**：DOM 画布 6→1、clip DIV 0、headless FPS 28→71（合成反而更快）、pan 100% 像素匹配。终验覆盖渲染、命中、picker、进城和编队面板，均通过。

**Why**：层叠不再依赖浏览器/WebView 合成器（彻底消灭 spine盖对话框那类 z-index/DOM-order bug 类），且模型与 wx 小程序 1:1（createCanvas/createOffscreenCanvas/drawImage），小程序 runtime 变纯新增工作。

**How to apply / 坑**：
- **守卫**：`frontend/js/platform/CanvasDomBoundary.test.js` 棘轮（H5CanvasRuntime≤4、CanvasAssetRenderer≤2、其余 0）。新增层必须走 registry+surface，禁止 DOM。
- **死循环坑**：`ensureLayerCanvas` 里调 `ensureCanvas()` 会对已存在画布跑 `resize()`→resizeHandlers→重入渲染管线→无限循环（已修 `2bfcef6c`：guard `if (!this.canvas)`）。任何"确保存在"逻辑不要用带副作用的 ensure。
- **回退**：无 OffscreenCanvas → 完整旧多画布 DOM 栈自动回退（mainHud 回退到可见画布）；node 测试 mock 全走回退所以旧测试不破。
- `H5UpdateRuntimeAdapter` 更新提示画布**刻意保留 DOM**（部署逃生舱，游戏循环坏了也要能提示刷新）。
- headless 截图验证 spine 时等 ≥14s（资源加载晚于 9s 会误判立绘丢失）。

Supersedes [[canvas-layer-dom-order]] 的多画布 DOM 顺序修复（那套 insertLayerElementInStackOrder 已随 DOM 栈删除，仅回退路径保留）。Relates [[canvas-only-miniprogram-portability]]（小程序 runtime 现在只差 REQUIRED_METHODS 的 wx 实现）。
