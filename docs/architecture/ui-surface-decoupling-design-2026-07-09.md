# UI 全解耦 + 层级一次定盘 —— 设计定稿(2026-07-09)

> 状态:**设计稿,待所有者拍板。零代码改动。**
> 产出方式:4 面盘存(面板/按钮命中/调度/既定约束)→ 2 份独立设计(最小演进派/声明面模型派)→ 3 裁判
> 按 7 硬标准评审(2:1 胜最小演进派,但两案独立收敛到同一骨架,共识点即本稿主体;落选方案的 6 个机制
> 被裁定必须嫁接)。审计背景见 memory `panel-overlay-guide-debt`(三根因)与本文 §1(第 4 根因)。

---

## 0. 最高公理(所有者钦定,一票否决标准)

**按钮只负责告诉 Manager"我要什么";Manager 负责寻找、打开、卸载;每个面板由独立文件单独绘制;
这些 UI 操作不碰任何全帧、地图的东西。**(Unity 式思维)

- 反向耦合同罪:全帧/地图管线也不许"知道"面板。已落地的 `77735c43`
  (`syncOpenPanelSurfacesAfterBaseRender`,基础渲染收口补刷面板面)是方向修反的止血补丁,
  **本设计第一刀(刀1)连根删除**,由分池根修取代。
- 评审任何切片的验收问:这条改动让哪一侧知道了另一侧?答案必须是"都没有"。

公理在终局架构中的对应物:

| 公理概念 | 终局对应 | 单一职责 |
|---|---|---|
| 按钮 | 命中目标 → 意图(action) | 只发意图,不开不关不画 |
| Manager | `CanvasModalSnapshotAdapter`(账本唯一写入口)+ 面板投影器(无状态,寻找+绘制)+ `CanvasStageScheduler`(脏位调度) | 生命周期权威一处、像素推导一处、节拍一处 |
| 面板=独立文件 | `CanvasPanelRegistry` 条目;二期 PanelChrome 后瘦成纯内容文件(§6) | 只画自己 rect 里的内容 |
| 不碰全帧/地图 | 面板动作只脏 `modal` 位、教程动作只脏 `guide` 位;世界四层时钟原样不动 | 失效域隔离(§5) |

## 1. 现状裁定(盘存确认的事实,设计地基)

1. **8F 已执行完毕**(非记忆所记的 PLANNED):12 个 blocking panel 开状态已单源住 `ModalStore`,
   flat facts 由 `CanvasModeOwnershipRuntime.buildRendererPanelFacts`(:386)每次快照现算;唯一写入口
   `CanvasModalSnapshotAdapter`。**状态层不需要建,本设计只补像素/命中/层序/调度四面的单向推导。**
2. **三根因**(审计定罪):A 教程高亮/dim 画 mainHud(z1000)被 panelOverlay(z1001)盖;B 命中目标
   单池互冲(三处无条件 `setHitTargets([])`);C 快照关闭≠面板层清除(幽灵面板)。
3. **第 4 根因(盘存新罪):frame/hud 双通道条件不对称**——同一开状态在不同通道下画/不画
   (showLogs 只在 hud 非 map-home 分支画;settings/advisor 不在 frame-standard 序列;App 无 shell 路径
   硬传 `tutorialHighlight:null`)。模态可见性取决于"走哪条通道" = 必须消灭的结构病。
4. 关键意外事实:tutorialSpine/Dialogue 两层**已在** panelOverlay 之上(修 A 有现成高位槽);
   `RENDER_QUEUE`/`HIT_PRIORITY_QUEUE` 是零消费死脚手架(接管或删);"单池"实际是 5 池+1 快照表;
   世界 runtime tap 路径不认教程盾(`WorldMapInputActionMap.js:246` 旁路);`getCanvasTarget` 双实现
   扫描方向相反(Shell 倒序/App 正序);**教程 pulse 的 effectTimer 是 16ms 全帧引擎**(高亮+面板同开时
   panelOverlay 被 ~60fps 整块重画);`MODE_KEYS` 顺序承重只准尾部追加;编外三模态
   (armyFormationEditor/worldSiteModal/captureModal)不在 12+5 体系内。

## 2. 目标层级栈(合成序定稿,唯一新层)

| # | layer | zIndex | 内容(定稿后) | 变化 |
|---|-------|--------|--------------|------|
| 1-4 | worldMap/worldFog/worldActor/worldActorSpine | 997-999 | 世界四层 | **不动**(时钟/池全不碰) |
| 5 | `mainHud` | 1000 | **仅** 顶栏/tab/dock/页签内容/浮钮/世界 HUD——不再画任何模态、任何教程像素 | 剥离 |
| 6 | `panelOverlay` | 1001 | **全部 20 模态**:12 blocking + 3 编外 + 5 对话模态;层内按 `CAPTURE_PRIORITY` 逆序绘制(对话 band 恒最后=恒最顶) | 扩容 |
| 7 | **`guideOverlay`(新)** | 1002 | 教程 dim/金框/气泡/盾像素 + networkOverlay | **唯一新层** |
| 8 | `tutorialSpine` | 1003 | 军师 spine(纯视觉) | 只改 zIndex |
| 9 | `tutorialDialogue` | 1004 | 军师对话 | 只改 zIndex |

- **根因 A 死法**:`renderTutorialHighlight` 改画 guideOverlay。物理上教程像素恒盖一切模态。
- **不加 feedback 层**(裁判共识:声明面模型的第二新层被折回):对话模态压面板靠 panelOverlay
  **层内 painter 顺序 = CAPTURE_PRIORITY 逆序**,与输入捕获序同源,不另立优先级表。
- **单源推导(嫁接①)**:zIndex 与 legacy DOM 插入序从 `PHYSICAL_LAYER_ORDER` 数组下标推导,
  "三处一致"从测试粘合降为一处声明;特征测试断言推导数组与现常量逐字节相等(刀0,零行为)。
- **层缺席降级**:层 API 全 OPTIONAL(canvas-runtime-v1 红线)。无层环境(小程序单画布/headless)按
  pass 序同 ctx 连画 base→panels→dialogs→guide;死脚手架 `RENDER_QUEUE` 接管为 pass 序单源,
  `HIT_PRIORITY_QUEUE` 删除(由 §4 `POOL_ORDER` 取代)。
- networkOverlay 迁 guideOverlay 尾段;reconnecting 期间调度器 `setLayerVisible(spine/dialogue,false)`。

## 3. 面板模型(根因 C 构造性消灭)

### 3.1 CanvasPanelRegistry:1 → 20 条

条目 = `{key, subtype, band:'panel'|'dialog', isOpen(snapshot), render(ctx,view)}`。绘制函数**一行不改**
只注册。双开合法性(commandPanel(tech)+techDetail)天然支持:投影按 open 集全画。
`clearPanelOverlaySurface`(无视 panelKey 的互清雷)随 per-panel clear 概念一起**删除**——只有整层重投影。

- 编外三模态收编:armyFormationEditor 后期迁 ModalStore(ModeKeys **尾部追加**+bundle 重打,独立刀);
  worldSite/capture 状态是 gameplay 事实不进 ModalStore,**经 `buildRendererPanelFacts` 加派生键**
  `panel.showWorldSite/showCapture`(嫁接⑤,activeDockItemIds 先例)——isOpen 禁止直读 gameplay state,
  守住 owner 决策/渲染器纯消费棘轮。

### 3.2 像素 = 开状态的纯投影(FogRevealModel 钦定形状)

`CanvasPanelSurfaceManager` 蜕变为**无状态投影器**:每个 modal 脏帧从 `snapshot.panel.*` 现算 open 集
→ 清层 → 按 band+CAPTURE_PRIORITY 逆序逐条 render → open 集空则隐藏层。**像素不再有自己的账本**,
"快照关了像素还在"的状态组合无法表达——教程守卫直调 adapter 关快照(root C 的两处旁路
TutorialGuideController:544/EventRegistry:252)照旧合法,下一帧像素必然消失。

**删除清单**:manager 的 open 记账/openPanel/closePanel、`baseHitTargetsByPanel` capture/restore、
`syncOpenPanelSurfacesAfterBaseRender`×4 调用点(=77735c43)、双实例四个建点(唯一构造点 Shell.mount)、
`renderPanelOverlaySurface` 的 canvas-swap 手法、famousPersons 三份并行 action 入口收敛为一。

## 4. 命中目标模型(根因 B 构造性消灭)

### 4.1 分池:池归属 = 重建权

单池裂为三具名池(同一 `HitTargetManager` 加命名空间,纯几何):

| 池 | 唯一重建者 | 内容 |
|----|-----------|------|
| `guide` | guideOverlay 帧 | 教程盾 + 焦点目标(TutorialCanvasRenderer:424 隐式再注册链显式随迁) |
| `modal` | 面板投影器帧 | 20 模态全部目标(含各自 background/自盾) |
| `base` | base 帧(CanvasFrameRenderer) | 顶栏/dock/页签/浮钮/世界 HUD;runtime 池照旧 append |

API:`beginPass(pool)` 使 pass 内 `addHitTarget` 落入指定池且只清该池(粗粒度落域,禁嵌套,grep 门禁);
三处无条件 `setHitTargets([])` **删除**。世界侧独立池、famousSkill 副池不动。
**全帧只能重建 base 池,面板目标物理上冲不掉;面板帧只能重建 modal 池,教程盾冲不掉。**

### 4.2 解析:合并视图 + capture 掩蔽(裁定:此为唯一正确形态)

`POOL_ORDER=['guide','modal','base']`(与合成序同文件单源)。`resolveHitTarget` 在**三段拼接的合并视图**
上跑今天同一算法(盾解析/自顶向下/background 兜底),语义零漂移。
**规格级裁定**:盾的 allowedAction 穿透扫描本质上跨池(放行目标在 modal/base 池)——分域后解析
**必须是合并视图**,任何"域内自闭解析"都会打断教程放行路径造成新死锁(声明面模型 §3.2 被裁判验尸判死,
本稿不采)。

- **掩蔽规则**:`facts.blockingOverlayActive`(ModeResolver 单源,含 commandPanel payload 判定)为真时
  base 池整体退出解析;tech carve-out 原样成立。fail-closed:模态漏注册自盾时 facts 兜底。
- `DEFAULT_PRIORITY_ACTIONS` 双源(CanvasSurfaceHitTargets.js:65 与 WorldMapInputActionMap.js:88)
  **收敛一处声明两处消费**(嫁接③),限定 base 池未掩蔽时生效。
- 世界路由前置条件加 `guide 池无覆盖盾 && !blockingOverlayActive`——runtime 不认盾的旁路封死。
- `getCanvasTarget` 收敛单实现(Shell 倒序为正典,App:3271 副本删除)。
- **miss-retry(TutorialGuideTargetResolver:88-93)删除**,替代:查询前 `scheduler.flush(['base','modal'])`
  (同步只画脏面,嫁接⑥)——消除查询与在途脏帧竞态,不再制造全帧。

## 5. 调度器契约(`CanvasStageScheduler`,派生器非 owner)

三个脏位 + rAF 合并,flush 末尾**一次** `compositeStage`:

| 脏位 | 失效源 | 刷什么 |
|------|--------|--------|
| `base` | action afterHandled(默认)、心跳、tab 切换、transition | mainHud 一帧(只画 base 内容) |
| `modal` | **`modalRevision`**(adapter 唯一写出口自增,含教程守卫旁路)、**panel-facts 浅 diff**(16 键+payload 版本,嫁接④——famousPersons 5 动作白名单特例自动退化删除)、tooltip hover | 投影器一帧 |
| `guide` | showHighlight/hide、refreshCurrentHighlight、16ms pulse、networkOverlay 态 | guideOverlay 一帧 |

- **pulse 降维**:effectTimer 16ms 只脏 guide → 高亮呼吸从 60fps 全帧+面板重画风暴降为单层局部+blit。
- **floatingTexts/rewardReveal 动效迁出 base**(嫁接,裁判 3):挂 guideOverlay 尾段/dialog band 局部钟,
  否则 pulse 降维红利被浮字动画全帧吃回。
- **spine 显式泵**:`refreshLayerPresentCache` 置 needs-composite 位,rAF 泵统一带上屏
  (采声明面模型形态,无 33ms 魔法数);webgl 同任务 present 红线不动。
- **教程通知集中化**:adapter 出口 `modalRevision++` 同点发 `onModalMutation` → 每宏任务一次
  `refreshCurrentHighlight()`。171 处散点通知从纪律改结构(分批退役);事件驱动,非每帧重跑 registry。
- drag 期间 defer 只挡 base,**guide 脏位放行**;`renderWorldMapSnapshotDragFrame` 全帧分支删除。
- **通道不对称(第 4 根因)死于结构**:模态只有投影器一个家,frame/hud 序列的模态条件表全删,
  HudOverlayCanvasRenderer 通道 + 休眠 renderPanelSurface 整条删除。

## 6. 通用面板 PanelChrome(所有者追加目标,二期)

地基就位后,面板从"整绘制函数注册"进化为"壳+内容":

- **壳(PanelChrome)单源**:铁板/标题栏/关闭钮/tab 条/遮罩绘制(走既有 ModalPlateRenderer/token)+
  内容 rect 推导(titleBar.contentTop 先例)+ 标准命中目标(关闭/遮罩点关/tab 切换,注册进 modal 池)+
  生命周期接线。**2~3 个变体参数**(居中模态/全屏页/轻量),壳内禁条件分裂成新 god-file。
- **内容文件**:`XxxPanel = {key, title, tabs?, renderContent(renderer, rect, facts), contentActions}`。
  新增面板 = 一个内容文件 + registry 一行;改面板只动它自己的文件。
- 迁移节奏:刀级基建(刀0-6)完成后逐面板换装,每面板一刀,特征测试锁"壳几何+标准动作不变"。
  这是把 12 个面板从 god-file 渲染器搬进独立文件的时机(公理"面板=独立文件"的落地点)。

## 7. 规格级裁定(裁判异议的强制吸收)

1. **dim 不得罩住系统级打断对话**(两案共犯的设计性回归,定稿前必须定):裁定采**豁免制**——
   dialog band 有非教程焦点的模态开着时(如教程中途网络错误 confirmDialog),guideOverlay 的 dim/高亮
   **整帧隐藏**(教程暂挂,输入本就被对话 band 捕获);若教程焦点就在对话上(如领奖步),照常渲染。
   补特征测试:教程高亮活跃 + confirmDialog 弹出 → guide 层该帧无 dim 绘制。
2. **改造前 tap 矩阵 golden 是刀1 的硬性完成条件**(非可选):脚本化录制(每 tab × 每面板开态 × 盾态
   → resolve 结果)在现行代码先录基线,改后重放比对;掩蔽规则"精确等价"的声称必须以此为证,
   防 tech 同族未记录 carve-out 被静默误杀。
3. **新旧解析器双跑一个部署周期**(裁判 2 要求):刀1 部署 WSL 后旧 resolver 以只记日志模式并行跑,
   记录分歧;这是 READ-PROOF 级等价证据、随刀删除的特征化仪器,不是 wrapper 债。
4. **刀5(调度器)落地前对 spine 泵 + drag-defer 做一次 WSL 短实测**:验的是新机制而非等价性,
   不违反"中途人肉验证=红旗"(该红旗管的是等价性验证)。
5. `MODE_KEYS` 只准尾部追加(mask 持久化承重);armyFormationEditor 迁移独立提交便于回滚。

## 8. 迁移切片(每刀独立落地+特征测试+零 wrapper 债)

| 刀 | 内容 | 关键删除交账 | 测试锚点 |
|----|------|-------------|---------|
| **刀0 立表读证** | zIndex/DOM 插入序改从 PHYSICAL_LAYER_ORDER 推导;RENDER_QUEUE 接管为 pass 序 / HIT_PRIORITY_QUEUE 删 | 三处手工常量 | 推导=现常量逐字节相等;当天可落 |
| **刀0b 基线录制** | tap 矩阵 golden(改造前) | — | golden 入库,刀1 的门 |
| **刀1 命中分池** | 三池+beginPass;合并视图 resolve+掩蔽;getCanvasTarget 单实现;DEFAULT_PRIORITY 单源;查询前 flush | capture/restore、**syncOpenPanelSurfacesAfterBaseRender(=77735c43)**、miss-retry、App 副本 | tap golden 重放;池隔离(base 全帧后 modal 池原样);双跑分歧日志 |
| **刀2 guideOverlay** | 层注册(推导制);教程像素/networkOverlay 迁层;guide 池写入;**dim 豁免规则** | mainHud 上高亮/dim/network 绘制点 | DOM 序 probe(非像素);dim-豁免特征测试 |
| **刀3 面板投影器** | Registry 扩 20;投影器无状态化;adapter 出口 modalRevision;单构造点 | manager 记账全套、clearPanelOverlaySurface、双实例、canvas-swap | 幽灵面板测试(adapter 直关→下帧像素+命中双消失);双开绘序 |
| **刀4 通道收敛** | 全模态入投影器 band;frame/hud 模态条件表剥离;hud 通道删除;App 无壳路径走顺序回退(真 tutorialHighlight) | HudOverlayCanvasRenderer 通路、renderPanelSurface 休眠路、:288-352 条件表 | 每模态×每 tab 开/可见矩阵(golden 按修正后语义有意识重写) |
| **刀5 调度器** | 三脏位;pulse/hover/动效局部化;spine 泵;通知集中化;drag 放行 guide | effectTimer 全帧链、散点 refresh 通知(分批)、snapshotDragFrame 全帧分支 | 失效矩阵测试;pulse 不触 base(spy);**WSL 短实测 spine/drag** |
| **刀6 收尾** | armyFormationEditor 迁 ModalStore(追加+bundle);techDetail 双源退役;reset 表补 settings/logs/advisor;citySwitcher 双 toggle 收敛 | techUiState.detailOpen OR 读+双清;host 字段 | mode-vocab 门禁;mask 兼容(旧档读入不变) |
| **刀7+ PanelChrome** | 壳单源+逐面板换内容文件(§6) | 各面板在 god-file 里的壳代码 | 每面板一刀,壳几何 golden |
| **终验** | grep 门禁固化(§4.1);删除清单核销;**一次性 LIVE 终验**(教程全流程/面板矩阵/drag 期高亮/dim 豁免/小程序回退) | — | 只验测试编不出的像素/动画/帧序残渣 |

依赖:刀0→0b→1→2→3→4→5→6(刀2/3 可并行);每刀过全门禁(npm test/lint/architecture/LF)推 local 验证。
**协调点**:另一会话的根因 B 修复(77735c43)按临时物对待,刀1 是其终态归宿,其特征测试保留复用。

## 9. 风险与代价

- **改动半径**:核心 ~15 文件;20 个模态绘制函数与 ~120 case action 表**零改动**(刀7 之前)。
  最大行为面 = 刀4 的通道条件表剥离(现状本就不对称,golden 按修正后语义重写)与刀5 的 42 处
  renderActive 散点收窄。
- **bundle**:刀0-5 不触 `ecs/mode/**`;仅刀6 重打(worktree 先 `npm ci` 老坑)。
- **小程序可移植净改善**:pass 序即单画布绘制契约;命中纯几何与层无关。
- **性能净收益**:高亮期 60fps 全帧风暴→guide 层局部;hover 整链→modal 层局部;composite 收归 rAF 单点。
  新增成本:panel-facts 浅 diff(微秒级)+guideOverlay 一层 blit(与既有 8 层同量级)。
- **残余风险**:掩蔽×DEFAULT_PRIORITY×carve-out 组合面靠 tap golden 铺满;legacy DOM 回退无自动化
  像素验证(DOM 序 probe+终验);与并行会话修复的合流需一次 rebase 对齐(删补丁是设计内动作)。
