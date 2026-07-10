# step5 Tranche 1 补丁单 + 引导开关整改单(2026-07-11,细颗粒 v3)

监督者出具。本单采用**细颗粒协议**:每个任务 = 一次 commit,自带机械验收判据,做完一个提交一个(commit message 带任务号)。监督者按 commit 逐个快审(L1),不再整批对抗审。禁止跨任务顺手改动;发现单外必须改的东西,写进交接说明,不动手。

诚实条款(每任务适用):最终说明必须如实列出"未做/未达标"项;验证证据来自真实进程/实跑,禁止占位断言。Tranche 1 验证文档因漏报 R-D4 未做已记违规一次,本单 A1 一并更正。

## 背景(审查结论)

Tranche 1 审查:R-D1 实质/R-D2/R-D3/R-D5 达标(探针 FIRE、冻结文件三方一致、数字精确复现);Part 0 证据修复 PASS。确认 FAIL 4 条 → 任务 A1-A3。
引导 1/0 开关(工作区 17 文件,未提交)审查:机械正确但确认 FAIL 6 条,**不得按现状提交** → 任务 B1-B4 整改后按序提交。

## Part A:Tranche 1 补丁(3 任务)

### A1|R-D4 落地:spec §7 数字化 + 验证文档更正(1 commit)
spec(step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md)第 264/417/418/485/575 行的"明显下降"全部替换为数字目标(以 phase0 baseline JSON 的实测数为基准:544/17/24;militaryView 67/activeTab 42/armyFormationEditor 23;authority-write 2;command-handler 137;12552/441 —— 按各 Phase 已裁定的目标写死数字与测量命令)。同 commit 在 step5-tranche1-verification-2026-07-11.md 追加更正节:承认 R-D4 当时未做且未申报。
**判据**:grep '明显下降' spec = 0 命中;每个退出条件带数字+可复跑的测量命令;验证文档含更正节。

### A2|R-D1 补全:边界逐字入 spec + UiRuntimeStateStore 经 StateWriter(1 commit)
① 裁决单 R-D1 的 ECS/UI 边界文本逐字写入 spec(Phase 2 节)。② 修复:UiRuntimeStateStore.js:92-97 syncOwnerState 直写 owner.state.currentTab/militaryView,违反 StateWriter.js:4-9 "exactly ONE place assigns owner .state" 契约——改为经 StateWriter 提交;WeakMap 副本不得成为第二权威(读路径仍以 owner.state 为准或明确单向投影,二选一并在文件头注明)。
**判据**:grep 边界关键句在 spec 命中;全仓除 StateWriter 外无第二处赋值 owner.state 导航字段(现有所有权门禁应能证明,若门禁盲区顺带堵上);相关测试实跑绿。

### A3|R-D2 补全:绕行扫描覆盖全清单(1 commit)
scripts/check-ui-runtime-field-ownership.js:6 BYPASS_SCAN_STORES 只含 UiRuntimeStateStore,findBypassAccesses 对其余 store 返回 []。扩展到清单全部 store(ModalStore 17 字段/BattleStore 2/TerritoryUiStateStore 10)。存量违规若有:能一并修则修,不能则列白名单文件并注明烧毁计划(白名单条目=债,须在说明中declared)。
**判据**:对 3 个 store 各造 1 个合成绕行违规,门禁均 FIRE(证据留 verification 文档,探针还原);现存代码 0 违规或白名单全部declared。

## Part B:引导开关整改(4 任务,改完才准提交那 17 个文件)

**裁定**:开关必须**可逆**(owner 原话"打开关闭隐藏"),关闭=运行时隐藏/挂起,不得改写存档;代码内默认值 = 1(开),owner 在自己环境用单点配置翻 0。

### B1|可逆语义(1 commit)
现状:flag=0 时 TutorialState.js:60-62 createCompletedTutorialState({disabled:true}) 在任何一次 load/normalize 把 disabled:true 烘焙进存档,off→on 后教程永久 completed(node 已实证,中途玩家进度灰飞烟灭)。改为:flag 只作运行时门(校验/推进/引导 UI 全部挂起),存档 tutorial 状态原样保留。
**判据**:node 往返测试——中途存档 off 一轮 load/normalize 再 on,教程步与 grants 与 off 前逐字节相等且可继续推进;该测试进 suite。

### B2|单源 + 单解析器(1 commit)
现状:后端 features.tutorialEnabled 与前端 FEATURES.TUTORIAL_ENABLED 双源无投影(前 0/后 1 时服务端 403 门照拦、客户端零引导 UI = 卡死组合);解析函数复制 6 份,CanvasGameApp.js:2715 那份漏 'false' 且是主检。改为:后端为唯一权威源,经客户端状态投影下发,前端只消费投影;解析器收敛为 1 份(shared/ 或复用 FeatureFlags.parseFlagValue),其余 5 份删除。
**判据**:grep 解析逻辑全仓恰 1 处定义;客户端快照含 tutorialEnabled 投影 + 契约测试;翻转开关只需改 1 个后端配置点。

### B3|归属登记 + 禁直写(1 commit)
TUTORIAL_ENABLED 及三个 tutorial 运行时字段登记进 UiRuntimeFieldOwnershipManifest.json(owner 归属明确);app.js:203-217 disableTutorialRuntime 删除——不得直写 state.tutorial、不得伸手清 canvasShell 内部字段,隐藏逻辑走 B1 的运行时门。
**判据**:所有权门禁绿;grep disableTutorialRuntime = 0;A2/A3 扩展后的绕行扫描对新字段生效。

### B4|还原被迁就的既有测试(1 commit)
GameStateServiceSplit.test.js 被改名+注入 tutorialEnabled:1+换 getClientGameStateFromNormalized 绕默认路径,CommandRouteMigration.test.js 被加 currentEra=1 等——因默认值回归 1,全部还原为改动前语义;FeatureFlags.resolve 丢弃未知键的契约变更一并评估(要么还原透传,要么写明契约+测试)。
**判据**:上述测试文件 diff 相对 92a81298 归零(或仅保留确有必要且declared 的差异);npm test 全绿。

## 提交纪律
A1→A2→A3→B1→B2→B3→B4 顺序提交,每 commit 后跑定向测试;全部完成后跑一次 npm test + run-architecture-smoke,结果写进各自说明。冻结三文件(CanvasPanelActionRunner*/CanvasPanelCompatibilityRetirement.test.js)照旧不得触碰。
教程解耦大工程(step6)另行立项,原料见 tutorial-coupling-inventory-2026-07-11.md —— 本单任何任务不得顺手开始解耦。
