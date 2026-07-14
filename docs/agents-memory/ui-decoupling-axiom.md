---
name: ui-decoupling-axiom
description: 用户钦定的 UI 架构最高公理(Unity 式思维):按钮只发意图→Manager 管生命周期→每面板独立文件独立绘制;UI 操作零接触全帧/地图管线。评审任何 UI 方案先过这条。
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6712b250-dda7-49b1-9996-9b3735bea7a7
---

用户 2026-07-08 亲述的核心逻辑(原话大意):**按钮只负责告诉调度器 Manager"我要什么";
Manager 负责寻找、打开、卸载;面板由独立文件单独绘制(名人面板一个文件、建筑面板一个文件);
用 Unity 等游戏引擎的思维。这些 UI 操作不应该碰任何全帧、地图的东西。**

**Why:** 名人面板解耦(panelOverlay)后暴露 3 个根因,根源都是 UI 与全帧管线互相越权
(面板像素由全帧层绘制、命中目标共池被全帧覆盖、关闭快照与像素可见性分属不同 owner)。
用户判断逐点贴补丁只会把下一块面板的坑埋更深。

**How to apply:**
- 按钮/命中目标 = 纯意图发射器,不直接开关任何东西;
- PanelSurfaceManager = 唯一生命周期权威(find/open/unload),开状态与像素可见性同源于它;
- 每面板 = 独立文件 + 自己的 surface + 自己的命中目标池;查询按层序合并,全帧渲染对面板池零权限;
- **反向耦合同样违规**:全帧/地图管线不许"知道"面板(77735c43 的
  syncOpenPanelSurfacesAfterBaseRender 让基础渲染收口补刷面板面 = 方向修反的过渡修,
  终局架构必须拆除,由分池根修取代);
- 评审任何 UI 设计/修复,先问:这条改动让哪一侧知道了另一侧?答案应该是"都没有"。
- **用户追加的第二层目标:通用面板(PanelChrome)**——壳(铁板/标题栏/关闭/tab/遮罩+内容 rect 推导+
  标准命中目标+生命周期接线)提成单源,面板文件瘦成"只画内容 rect 里的东西+内容意图表";
  新增面板=一个内容文件+registry 一行。壳给 2~3 个变体参数(居中模态/全屏页/轻量),
  壳内禁条件分裂成新 god-file。ModalPlateRenderer(⑧a)已把视觉单源化,壳事实上已趋同。

**设计已定稿待拍板**:[docs/architecture/ui-surface-decoupling-design-2026-07-09.md](../../docs/architecture/ui-surface-decoupling-design-2026-07-09.md)
(2 设计×3 裁判共识骨架:唯一新层 overlaySurface(1002)/面板=无状态投影(FogRevealModel 形)/命中三池
beginPass+合并视图解析+blockingOverlayActive 掩蔽/调度三脏位+composite rAF 单点/frame-hud 双通道第4根因
一并杀;规格裁定:dim 对非面板焦点对话豁免、tap-matrix golden 为刀1 硬门、遮罩解析必须合并视图
(域内自闭已被验尸判死);刀0-7+终验,刀1 删 77735c43;**盘存重大更正:8F 已执行非 PLANNED**)。

关联:[[refactor-no-debt-for-safety]] [[bitecs-ecs-standard]]
