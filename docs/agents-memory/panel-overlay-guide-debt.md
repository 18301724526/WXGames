---
name: panel-overlay-guide-debt
description: "名人面板 panelOverlay 3 根因:B(单池互冲)已于 2026-07-09 分池根修并入 main(77735c43 过渡修同日拆除);C(幽灵面板)大概率被开集投影根治待真机验证;A(高亮层序反转,视觉)仍待做。"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6712b250-dda7-49b1-9996-9b3735bea7a7
---

2026-07-08 22 头 agent 审计+对抗验证(13 confirmed / 5 refuted),完整输出存
`tasks/wailo3cgl.output`(session 6712b250 scratchpad,阅后即焚性质——要点全在本文)。

**根因 A — 层序反转(视觉)**:教程高亮/dim/气泡/手指恒画 mainHud(z1000,
TutorialCanvasRenderer.js:387 经 HudOverlay:193/252+CanvasFrame:321 调用,ctx=dialogueCtx||host.ctx 无重定向),
名人面板画 panelOverlay(z1001,不透明 plate+0.52 全屏 mask)→ 面板内目标的高亮完全被盖。
重构前两者同画布、高亮后画(git show 0e41a3f3:HudOverlayCanvasRenderer.js:229/255)。
受害步:famousPanelOpened/famousCardViewed(×2)/famousSeekOpened。
修法(推荐):高亮迁 panelOverlay 之上——新 tutorialHighlight 层插 1001/1002 之间,或借 tutorialDialogue(1003)
(复用 TutorialDialogueLayer.withDialogueContext 作用域 ctx 模式);注意 pulse 动画需逐帧驱动,别画进"只在
refreshPanelSurface 重绘"的面板面。

**根因 B — hitTargets 单池互冲(交互,最重)**:面板目标与 HUD 目标共用 surfaceState.hitTargets 单池
(HitTargetManager.js:32);任何全帧渲染(CanvasFrameRenderer.js:149/HudOverlay:150 无条件 setHitTargets([]))
只重建 HUD 目标,面板目标被冲掉且无恢复钩(famous 已被测试锁死移出全帧通道)→ 面板可见但不可点;
教程 advanceTo→applyApiState(render:true)→全帧→之后才 refreshCurrentHighlight(App:1362),高亮查找必落空;
showHighlight 的 miss-retry(TutorialGuideTargetResolver.js:88-93)还会主动全帧再冲一次(语义反转)。
触屏死锁,桌面靠 hover 半自愈。
修法(根修):hit targets 分池 per-surface(panel 池只由 renderPanelOverlaySurface 写),getCanvasTarget 按层序合并;
过渡修:全帧尾部若 manager.isPanelOpen 补 refreshPanelSurface + retry 在面板开着时改调 refreshPanelSurface。
**过渡修已落(77735c43,codex/pvpve-systems)**:CanvasPanelSurfaceManager.syncOpenPanelSurfacesAfterBaseRender
在 4 个基础面渲染收口(Shell.renderReadOnly/renderPanelSurface、App.renderCanvasSurface/renderPanelSurface 无壳分支)
同任务内重拍基础快照+重刷面板面;连带修了 captureBaseHitTargets has() 守卫导致的关面板恢复旧快照。
actor/fog 动画帧只写各自图层池不踩共享池。教程 miss-retry 的语义反转与分池根修仍待做。

**根因 C — 幽灵面板(快照关≠层清)**:教程守卫用快照级关闭(TutorialGuideController.js:690
closeIfOpen('showFamousPersons')等),但 panelOverlay 像素/可见性只有 manager.closePanel 会清
(clearPanelSurface→setPanelOverlayVisible(false) 唯一点 App:1660)→ famousSeekCompleted 教程自动关面板时
必现幽灵面板盖死 tech 引导;非教程路径(开 dock 命令面板)同样触发。hover 自愈被快照真值门挡死(Shell:804)。
修法:"快照开=层可见"单源——所有关 famous 的路径改走 manager.closePanel,或全帧前 reconcile isPanelOpen。

**卫星问题**:networkOverlay 断网重连模态藏面板后(假死观感);clearPanelOverlaySurface 无视 panelKey
(未来多面板互清雷);advance 在途窗口陈旧高亮+'talent-open-famous' 缺 not(isFamousPersonsOpen);
changePage/tooltip 不通知 refresh(被教程输入门兜住,cosmetic)。

**审计判干净的面**:教程门/输入门叠加规则自洽;showHighlight 解析链本身正确(池里有就能找到);
refreshCurrentHighlight 调用覆盖完备(问题全在时序与池,不在遗漏通知)。

**2026-07-09 更新（main 统一 + button-scheduler 重构移植完成）**：根因 B 的**分池根修 DONE 并入 main**（`d9b09fc2` 命名池 base/modal/guide 深度集成 HitTargetManager/CanvasSurfaceState 等 14 文件；`9aab2ea0` 8b 退休——`syncOpenPanelSurfacesAfterBaseRender`+`baseHitTargetsByPanel` 过渡修正式拆除，退休守卫测试锁死）；合并后全量 2260/2260 绿。根因 C 大概率被 Slice 6 开集投影（projectModalLayer 从 modal 状态推导、无开集则隐层）机制性根治——待真机验证；**根因 A（教程高亮画在 mainHud 被 panelOverlay 盖，视觉层序）此轮未动仍待做**。监督全程记录在 F:\AI Project\codex-watch。

关联:[[ui-redo-progress]] [[tutorial-guide-refresh-contract]] [[main-unification-2026-07-09]] [[canvas-layer-dom-order]]
