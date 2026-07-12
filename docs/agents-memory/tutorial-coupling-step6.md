---
name: tutorial-coupling-step6
description: "教程↔游戏逻辑强耦合清查完成(owner 点名认真对待)——清单在 repo docs,step6 解耦立项待发"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d09762d-931c-47fa-804a-fc511da650c4
---

Owner 2026-07-11 亲自发现:引导非纯钩子,与游戏逻辑强耦合(1/0 开关要动 17 文件即证据),要求认真对待。

清查已完成(一手取证),报告在 `docs/architecture/tutorial-coupling-inventory-2026-07-11.md`:后端 45 文件扩散、11 处直写 gameState.tutorial、命令管线 syncEra2Tutorial 双相内嵌 4 handler;前端 90 触点/22 hook/36 处 refreshCurrentHighlight;分类 A(纯钩子)≈12 / B(内嵌分支,需事件化)≈25 / C(教程直改游戏/UI 状态)6 簇,最重=TutorialGuideController.js:770-800 直改 tab/panel+5 处强制渲染(违 [[ui-decoupling-axiom]])。

解耦方向(已写进报告):后端命令管线单一 tutorial 中间件+领域事件订阅推进+TutorialPolicy 声明式接口(兵力 floor/建筑锁/出生点这类不可事件化规则);前端事件总线+单一 veto+教程只发意图;删双权威(getEffectiveTutorialState、BuildingPresenter 复刻步门)。**建议独立 step6**,排 step5 descriptor 稳定后;step5 后续 tranche 先把教程门禁统一走 descriptor 层当接缝。死代码候选:WorldExplorerRoutePlanner.js:265-377。关联 [[command-owner-pipeline-progress]]。

**2026-07-11 终态定案:纯前端教程(owner 裁定)+北极星路线图 v2 已提交(42931b87)**。oracle=docs/architecture/tutorial-engine-northstar-roadmap-2026-07-11.md:S1(=Tranche1 补丁单)→B1'(发放/任务条件改键,先于基线)→S2(转录投影判决器+规则清单)→S3(ctx 边界+分歧见证器)→S4(事件总线)/S5(target+action 表)→S6(割接)→S7(单链上引擎+query 表逃生舱)→S8(覆盖率数字裁决门)→S9a/b/c(全量迁移/输入盾拆分/客户端权威切换)→B2'(六簇改键,并行)→B3'(后端教程整体删除+存档迁移)→S12 终验。关键定案:①**推进权威在客户端**(单游标+重入投影,服务端零教程,403 教程门/syncEra2/manualAdvance 全删)——推翻我此前"服务端步权威"裁决(前提变了);②作弊面唯一防线=发放走任务奖励+真实状态条件(B1' 必须先行);③原 step6 后端中间件/事件总线构想**作废**;④六簇规则改键决策表 D1+游标存放 D2(默认 localStorage)待 owner 点头;⑤经 3 席自检修 26 处(S6 判据与冻结三件套的数学矛盾、S7 逐字节等价须规范投影模式、S3 零行为变更须 witness、我自己写出"LOC 实测下降"违 R-D4 纪律等)。step5 裁决单已附两轨划界修正案。D1/D2 已签(2ba498e8)。**S1 已收官**(Part A 三 commit+Part B 四 commit 全过审,第 9/10 轮 review-log;关键:Codex 弃烘焙 WIP 改后端 flag→投影→前端运行时门,可逆构造性成立,403 门被 flag 门住,解析器单源 shared/featureFlags.js,默认 1)。**B1' 过审**(发放→任务台账 gameState.taskRewardGrants+懒迁移双读;条件改真实状态)。**S2 过审**(转录投影判决器+规则清单 52/18+测试打标 95/47/1,重生成 diff 门禁)。**S2b 过审**(判决器全程化 64 条/completed/双跑同哈希);**重大**:判决器首跑抓出 Tranche1 回归——UiRuntimeStateStore 实例访问器遮蔽 CanvasGameApp 原型访问器=编队双状态源(第 8 轮 CONFIRMED#4 预警的实弹版),W2 修为"store 拥有状态、controller 拥有行为";债务记账:EventRegistry famousSeekCompleted 新增 C-1 导演实例(已申报,随 S7/S9 退役)。**S3 过审**(TutorialHostContext 1174 行单接缝,教程目录宿主直访=0,双门禁探针亲验 FIRE,witness 首跑抓夹具分歧诚实申报,宿主触点 393→205)。**S4 过审**(ChangeEventBus 薄总线+双漏斗加法 notify、18 事件契约+canOpenTab exclusions、host-surface regen 进 smoke 常驻;注意:Codex 自报"1681/1681"失实,实为 2400/2400,已记报告质量账,后续单已加"测试数字禁转述"条款)。**S5 过审**(target/action 两张表落地:204 注册点枚举+freshness 守卫、panel 表 16 型全覆盖补 1 漏、TutorialActionMatches 纯函数+纯度门禁;探针经清单过期路径 FIRE)。**S6 过审**(90 触点全割接进 ChangeEventBus、33 非冻结 poke 归零逐个具名特征测试、双通道拆净仅留 18 契约主题、旧 onXxx 只作冻结 HOOKS 总线别名;双归零 grep+基线 SHA 亲验)。**前端地基收官**:判决器+ctx 边界+总线+target/action 表+割接全就位。**S7 单已派**(92dfd110,L2:E1 query 表逃生舱最小集/E2 runner 核心 frontend/js/tutorial-engine/ 零游戏 import+重入测试+纯度门禁即上线/E3 本段纯数据配置/E4 分治接线+逐规则核销/E5 L2 验证包;迁移段=任务领取/开面板族;步键=服务端步名过渡,键源可替换,游标切换归 S9c)。S7 完成后审级 L2(需深审,可能开工作流)。launch.json+AGENTS.md 已应 owner 指示代提交(caf76aed)。提示词模板含 AGENTS.md 检索纪律。v3 细颗粒审查已验证:逐 commit 内联零 agent、分钟级。
