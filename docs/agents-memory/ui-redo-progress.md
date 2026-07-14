---
name: ui-redo-progress
description: UI/UX full redo — approved reference, three delivered slices (tokens/top bar/dock/squad panel/floating buttons/nameplates), architecture conventions for further UI work, and what remains (screen-wide consistency, map & city art redo).
metadata:
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户嫌旧 UI"太丑/太原始",重做全部 UI/UX。**定稿 = `docs/design/ui-hud-reference/user-references/layout-reference-v2.webp`（已从工作树删除，取用走 git 历史 38dbaab6 之前版本）**(用户提供:暗铁/青铜金属盘+香槟金线图标+上暗下暖;经历 7 轮抽卡试错后用户拍板,布局+风格双满意;"做旧不做亮"——提亮现代化被否)。审美红线:忌满金/发光/传奇页游感、忌纯扁平(读作原型)、忌宣纸浅色(冲掉游戏氛围)、忌工业条纹二次元风。

**三刀全落地并部署(至 `11f312f1`,2026-07-08):**
1. **UiThemeTokens.js** = 全 UI 色板/字号/间距/圆角/发丝线**单源**(21 色带定稿采样坐标;禁散落硬编码)+ `getDockMetrics(width)` 按**屏宽百分比**现算 dock 几何(徽章Ø23%W/托盘19.6%W/槽带13.7%W,maxHeightPx 104 平板钳制待真机确认)。
2. 顶栏:铁盘 9-slice+6 资源位(粮木石铁知人序)+FPS/延迟/时钟**常显**(用户确认是正式 HUD 非调试;决策 owner 侧 showTopBarDebugStats=true)。
3. dock:首都/任务大圆徽章(**v2 做旧青铜**,v1 太亮被否)+中央内嵌槽带四格(科技/文明/名人/设置)。
4. 编队快捷面板(替换 acba8c2c 旧黑条):`MilitaryPresenter.buildSquadQuickPanelViewState` 投影(显隐决策在 presenter,行军中=busyFormations×时间投影青玉点),点行 openArmyFormation;浮钮 分城/事件/账号 做旧新样式;城池名牌(等级角标+名,level 暂用 intel 等级待换真源);探索中/回到本城 chip。

**UI 工作架构约定(后续所有 UI 刀必守):** 色值只从 UiThemeTokens 读;mode/panel 决策只在 `buildRendererPanelFacts`(owner 侧,activeDockItemIds/showTopBarDebugStats 先例),非 modal 的 UI 数据经 presenter 投影,渲染器零决策;素材走 ui-hud 管线(生成配方见 [[image-gen-relay]]);每刀全门禁+headless 预览截图(tmp/ harness)供视觉审;**命令链 && 硬链**(曾因 ; 链 lint 红出门一次)。

**第四刀(收敛刀,f57b094f..aed0a7e8,已部署):** dock **一体化**重构——用户判词"参考图是一个整体,你的是拼图感"是结构级病:托盘必须是可见的"地"(渐变+棱线),徽章**零上溢嵌入**(PIL 实测推翻 35%/10-20% 先验;**定稿要实测别猜**),中央凹井非浮盒,单一顶光。徽章 v3=从定稿裁圆域当生成锚一发即中。**两个重磅根因**:①FPS `--` 双因(0 被 `??` 遮蔽 + map-home rAF 环不喂表);延迟字段从来不存在→实装心跳 RTT 实测;②**编队名空白=陈旧缓存**——`index.html` 的 `?v` 爆破参数五刀没 bump,浏览器混装新旧脚本;**每次改前端脚本必须 bump ?v**(本次统一 -uiredo6)。**部署目标警告**:kodagame.top/wxgame-refactor 没有 UI 重做代码,真机验收只认 http://localhost(WSL),同 [[playtest-refactor-server-target]] 坑。

**夜刀批(2026-07-09 凌晨,af7598ec..0e41a3f3,三端已部署):**
- 编队快捷面板命名:玩家改名 > 主将名+队(`military.formation.leaderSquad` '{name}队')> 部队N。
- 设置=居中模态(遮罩+✕);**ModalPlateRenderer 共享面板 painter 单源**(锻铁盘/标题栏/✕/tab条/卡片三调/按钮三态 primary·secondary·danger·disabled/进度条,全 token,painter 零决策 rect 交调用方注册 hit-target)——任务中心/文明/名人/设置/城池命令五面板已全迁,生图 0 次。
- **部署拓扑变更**:【作废：已被 2026-07-09 main 统一取代，现只有单一 main，接活基于 main HEAD】refactor 分支已推到 private 部署环境(kodagame.top/wxgame-refactor,:3003)，GitHub 双分支同步到 0e41a3f3——**Codex 下次接活基于此 HEAD,别再从 93bd4baf 分叉**。

**遗留:** 旧 hud-icon-* 7 枚无消费者待清退；账号浮钮 action 仍是 requestResetGame；城内视图仍是旧样式；名人技能徽章和属性 chip 仍是旧绿色系；名牌 level 待换真源；托盘颗粒纹理仍需收敛。**下一步:** 城内视图和剩余面板迁 painter，再做真机总验与地图/城池美术重做。
