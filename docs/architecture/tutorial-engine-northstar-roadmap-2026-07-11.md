# 教程引擎北极星路线图 v2(2026-07-11)

方法论(owner 钦定):以通用教程引擎为最终目标反推全部支撑;小颗粒、每步服务终态、过审即进;在建工程重新锚定,不浪费已投入。
**v2 变更**:① owner 裁定终态为**纯前端教程**(服务端只做通用游戏规则校验,零教程逻辑)——后端轨道从"中间件化改造"改为"改键+整体删除",废除原中间件与后端教程事件总线两项投资;② 吸收 3 席自洽性审查全部 26 项发现。
本文档是 oracle:任务单只引用步骤号与判据。修订须经 owner。

## §0 终态定义(缺一即未完成)

### 0a 前端:通用教程引擎
- 引擎只执行通用流程(对话框/遮罩/高亮/等事件/请求动作/推进);步骤配置驱动:步键 → {脚本类型, 参数}。
- 脚本只用 ctx 接口(effects/waitFor/requestAction/resolveTarget/queries/next),禁直访 game/canvasShell/controller/renderer,禁写宿主字段(门禁强制,含动态键写法)。
- **推进权威在客户端**:ctx.next = 写唯一持久化的客户端游标(见 §1-1);无服务端教程步、无 advanceClientStep、无 403 教程门。
- 宿主提供四张映射表:target(三 resolver kind:hitTarget/worldSiteAnchor/softGuideId + type→panel 前置面表)、event、action(含宿主 actionMatches 等价比较器)、query。**query 表是逃生舱不是地基**(owner 立场:"引导不需要知道有多少兵"——脚本原则上不查游戏内部,走不下去优先改配置;query 条目数受预算约束,超限触发 S8 裁决)。
- 脚本类型预算 6-7 种;输入盾拆两层:策略(引擎:当前允许集)/执行(宿主:tap/drag/gesture 管线钩子+盾渲染)。
- 教程走死=配置问题(策划责任),不是程序问题;引擎提供步级 trace 支撑这个定责。

### 0b 后端:零教程概念
- 服务器只做**通用游戏规则校验**;删除:TutorialActionValidator 全部 403 教程门、syncEra2Tutorial、11 处内联 manualAdvance、gameState.tutorial 及其路由/投影。
- **作弊面唯一防线**:凡有价值发放(名人/首军)一律任务奖励,任务条件改键为**真实游戏状态**(建了房/存了编队/占了首城),服务端按事实校验——教程步不再是任何服务端条件。
- 六簇"教程态改游戏规则"改键为真实状态(决策表 D1),游戏规则文件零教程引用。
- 过渡期纪律:**不再新增任何服务端教程投资**(中间件化、投影推导等原方案全部作废);现存服务端教程逻辑维持原样直至 B3' 删除。

### 0c 开源边界与宿主终态面
- 引擎+通用脚本目录零游戏 import(门禁强制);宿主贡献=四张表+effects/盾执行实现。换项目=换表。
- 宿主事件面终态:ModalStore+StateWriter 双漏斗 change-notify + 18 个具名事件 + PanelActionRunner descriptor 为唯一 veto seam + 单一 ui-changed 订阅(36 处手工 poke 退役,冻结文件 3 处除外,见 §1-7)。
- A 类 ~12 簇(纯存储/投影/渲染委托)中属服务端教程存储/投影者随 B3' 删除;前端纯渲染委托钦定保留。**S12 终验不以"后端 45 文件计数清零"为判据**,以豁免清单核销。

## §1 不变量(每步任务单自动继承,违反即 FAIL)

1. **单游标+重入投影**:教程进度=恰好一个持久化客户端游标(存放见 D2);表现=每次从(游标+当前 UI 事实)重算的无状态投影,脚本无内部执行位置;reload 后自愈。
2. **零服务端教程**(终态)+过渡期不新增服务端教程投资。
3. **发放走任务条件**:任何有价值发放必须服务端按真实游戏状态条件校验,禁由客户端教程进度触发。
4. resolveTarget 返回可逐帧重解析、fail-closed 的 locator;锚点丢失清高亮回退。
5. 禁写门禁在先:扩 ctx 面必同步扩所有权/绕行门禁并留 FIRE 证据;动态键写法(setIfChanged 类)必须在扫描正则覆盖内(落点 S3)。
6. no-debt-for-safety:特征网+读证等价先行;playtest 规范转录投影(S2)为等价判决器;TutorialGuideArchitecture.test.js 属反特征测试,任务单明示允许改写。
7. 冻结三件套(CanvasPanelActionRunner*)不碰;其内 3 处 refreshCurrentHighlight poke 与 HOOKS 方法名(canOpenTab/onFamousPersons*/refreshCurrentHighlight 等)为 **declared 残留+命名契约**:S9 后新引擎适配器必须保留这组方法名,残留随未来解冻单处理。
8. 审级 v3:逐 commit L1;S7/S9a-c/B3' 升 L2;绊线即升。
9. **基线重录协议**:任何合法改变转录投影内容的步骤(行为变更或粒度变更),必须在同一批 commit 内重录 S2 基线并 declared 差异;禁止对着过期基线比对。

## §2 在建工程锚定

| 在建物 | 锚定 |
|---|---|
| Tranche1 补丁单 A1-A3+B1-B4(已派) | = S1,**原单原判据不变**(v1 曾给 A3 加动态键判据,收回——该判据移交 S3);B2 后端单源投影为**过渡期正确**,随 B3' 删除,不白做 |
| 引导 1/0 开关(17 文件 WIP) | 经 S1 整改后为过渡开关;B3' 后自然退化为纯前端 flag |
| step5 UiRuntimeStateStore/所有权门禁 | ctx.effects 地基;**共享工件**:check-ui-runtime-field-ownership.js 与 manifest 两轨共用,改动 commit message 须标注轨道归属;step5 裁决单已追加修正案:"教程镜像字段收敛/删除归本路线 S3/S9c,step5 各 Phase 遇 tutorial 字段违规只登记不修" |
| step5 descriptor registry(2/16) | ctx.requestAction 的置换目标而非硬前置:S7 允许经 S3 适配器回落遗留 host 方法;S9c 设入口门(见 S9c) |
| CanvasPanelActionRunner HOOKS | veto seam 钦定模板+§1-7 命名契约 |
| 教程测试 143 个+playtest 脚本 | S2 特征网;后端 47 个教程测试在 B3' 按清单退役(declared),不再"保持绿" |
| step5 Phase3/5/6/7 | 不入本路线,step5 自有轨道 |
| 原 step6 后端中间件/事件总线构想 | **作废**(纯前端终态下无必要),清查报告解耦方向 1-2 由"改键+删除"取代 |

## §3 分步(1 任务=1 commit;判据机械;每步引用本节判据即成任务单)

**S1|Tranche1 补丁单落地**(7 commits,已派,原单不变)——B1 可逆语义/B2 过渡期单源/B3 归属登记/B4 测试还原照旧;A3 按原单(3 store 各 1 合成绕行探针 FIRE)。

**B1'|发放与任务条件改键**(3-4 commits,行为变更,**先于 S2 基线**)——名人/首军发放:TutorialGrantService 直写链→任务奖励经正规 action 层;defaultTaskDefinitions 三处 tutorialStepAtLeast + TaskProgressEvaluator/Normalizer 的教程步条件→真实状态条件(hasBuilding/formationSaved/firstCityOccupied)。判据:famousPeople 写点全仓唯一且在 FamousPersonService(所有权式扫描+合成探针 FIRE);tutorial 目录与 grant 链 grep gameState.famousPeople=0;任务条件 grep tutorialStepAtLeast=0;新条件逐个契约测试;领取流程定向 playtest 段留档。

**S2|特征网与判决器**(2-3 commits)——① playtest 增加 `--transcript` 规范投影模式:有序 {步键, 动作类型, target type, panelKey} 序列,排除字段白名单(时间戳/durationMs/waitedMs/实体 id 与人名[名人 RNG 时间种子]/像素指标/坐标)入 repo;② 同 commit 在 WSL 本地部署**连跑两次**,投影 diff 为空,两个 runId+空 diff 入 verification;③ 机器可读规则清单导出(步名+规则种类+来源工厂)入 repo——S7/S8/S9 的一切计数以此清单为准;④ 143 测试打标(可复用/退役候选/反特征)。

**S3|ctx 边界**(3-5 commits)——枚举 FlowRegistry+EventRegistry 实调的 ~40 个宿主方法归入 ctx 六接口;适配器**保留逐调用点回退序**(三宿主镜像读:Controller:135 state 优先 vs EventRegistry:80 host.state 垫底——收敛引用不收敛语义)+**分歧见证器**(三源不等计数+trace);门禁:tutorial/ 禁直访 game./canvasShell.(唯适配器豁免)+扫描正则补动态键/setIfChanged 形态,两者 FIRE 探针。判据:教程测试(除反特征)全绿;grep 仅命中适配器;动态键探针 FIRE;全程 playtest+全测试 witness==0(若 FIRE→如实改判行为变更走 L2,不得自称零行为)。

**S4|事件总线**(2-3 commits)——双漏斗(ModalStore/StateWriter)change-notify+薄 emit/subscribe;**18 事件必备字段契约文件**入 repo(从 EventRegistry 反推:tabClicked→tabId、buildingAction→buildingId+action、5 个 syncFromResult 依赖事件须运载命令结果对象…);canOpenTab 明文排除出事件表,veto seam=PanelActionRunner descriptor 钩子。判据:总线单测;每 emit 站点按契约文件校验;一条端到端断言(命令结果经 payload 抵达消费者);尚不割接。

**S5|target 表+action 表**(3-4 commits)——教程用 hit-target type 显式枚举+改名门禁(计数命令与口径写进任务单,不预写总数);type→panel 表 9→全;三 resolver kind 各单测;清算 CanvasGameApp:3392-3438 DOM 遗留 id 链;action 表含 actionMatches 等价比较器(从 Shell:1093-1119 匹配语义抽取,配特征测试)。判据:改名合成探针 FIRE;kind 单测绿;比较器特征测试绿。

**S6|割接**(3-4 commits,依赖 S4,与 S5 并行)——90 触点 onXxx→emit;33 处非冻结 poke 退役:逐 poke 特征测试(以原 file:line 命名,经漏斗驱动同一 UI 变化断言订阅路径刷新)+每批期望计数(33→N→0)+每批**全程投影比对**。判据:非 tutorial 非冻结文件 refreshCurrentHighlight=0(冻结 3 处 declared);投影 diff 空或差异 declared+基线重录(§1-9)。

**S7|单链上引擎**(5-6 commits,依赖 S5+S6)——首 commit=query 表最小集(仅本段所需谓词,逐条 justify+单测);StepScript runner(游标+重入投影,§1-1);迁移段=任务领取/开面板族或兵营段(以 S2 规则清单圈定);ctx.requestAction 允许回落遗留 host 方法(descriptor 化为置换目标)。判据:该段投影与基线 diff 空;**逐规则核销清单**(删一条销一条,出自 S2 清单);所有权门禁绿。【L2】

**S8|覆盖率裁决门**(1 commit)——余下规则(数出自 S2 清单)逐条改写 {脚本类型,参数} 草稿,报告脚本类型/query 条目的真实预算消耗,不适配者 file:line;owner 据实裁边界(含开源包装是否保留)。**数字裁决**。

**S9a|规则批全量迁移**(commit 数按 S8 实测重估)——判据沿 S7 模式(投影 diff+核销清单)。【L2】
**S9b|输入盾拆分**(2-3 commits)——策略层(引擎允许集)/执行层(宿主管线钩子)分离;Shell:1159-1359 盾逻辑、CanvasSurfaceHitTargets、CanvasLayerRegistry 的教程渗入收敛。判据:策略层单测;盾期间 tap/drag 穿透合成探针(允许集外必拦);拦截段投影比对;§1-7 命名契约保持。【L2】
**S9c|客户端权威切换+旧引擎退役**(3-4 commits)——**入口门:descriptor 覆盖已迁段全部 command-submit 动作,未达即停,升级 owner 重排 step5 tranche(S11 硬边)**。游标落地(D2);切断对服务端步的读依赖;删 FlowRegistry/Controller 导演方法与客户端步合成:grep getEffectiveTutorialState=0(定义 CanvasGameApp:1204+调用 :1088,:1225)、BuildingPresenter:404-407 复刻段 grep 步名=0、CivilizationPresenter 步门同法;开源纯度门禁上线(引擎目录零游戏 import+合成探针 FIRE)。判据如上逐条+全程投影(按 §1-9 重录基线,服务端步→客户端游标为 declared 粒度变更)。【L2】

**B2'|六簇规则改键**(4-6 commits,与 S3-S9 并行;等价改键,读证+定向测试,不触发基线重录;若某簇判定行为变更→按 §1-9 处理)——按 D1 决策表逐簇 1 commit。判据:每簇旧键 grep=0(完整命令+显式豁免文件清单写进任务单,禁模糊路径过滤——TutorialProgressService.js 等根目录门面属 B3' 范围不误伤);等价读证;定向测试。

**B3'|后端教程删除+存档迁移**(4-5 commits,依赖 S9c+B1'+B2')——删 TutorialActionValidator/syncEra2Tutorial(8 处接线)/11 处内联 manualAdvance/gameState.tutorial 与路由投影/开关后端机器(B2 产物);存档迁移(旧档 tutorial 字段清理,迁移测试);死代码 WorldExplorerRoutePlanner.js:265-377 清算(判据 grep 调用方=0);后端 47 教程测试按清单退役 declared。判据:backend grep 教程符号=0(完整命令+豁免清单);npm test 全绿;迁移测试双向(带/不带旧字段)。【L2】

**S11|联合点**——actionType↔command 命名映射契约表(1 commit 文档);descriptor 14/16 缺口按 step5 Phase4 tranche 补;S9c 入口门为硬边,倒挂时升级 owner。

**S12|终验**——基线重录后全程 playtest+npm test+smoke+纯度门禁;核销表逐项对账(含 0c 豁免声明)。完成即教程解耦收官,step6 不另立。

## §4 依赖图

S1 → B1' → S2 → S3 → S4 → S6 → S7(S3 → S5 与 S4/S6 并行,S7 汇合 S5+S6)→ S8 → S9a → S9b → S9c → B3' → S12
B2' 并行于 S3..S9(等价改键;变行为即触发 §1-9);S11 文档随时,descriptor 实现挂 step5 Phase4,硬边指向 S9c 入口门。
(S5↔S6 无共享交付物可并行;S6 真实前置仅 S4。)

## §5 决策表(已签:2026-07-11 owner 确认默认值生效)

- **D1 六簇改键**:建筑锁→「尚无 house 建筑」;占领 settlement 模式→「玩家占领城计数=0」;事件门→仅「era2 phaseCompleted」;出生点 tutorialTarget→更名"新手出生质量规则"(开档一次性,不读运行时教程态);兵力 floor→键任务奖励发放记录(随 B1' 迁移出 tutorial.grants);era2 教程激活→删除(新引擎客户端观察时代推进自行开链)。
- **D2 游标存放**:默认 localStorage 起步(换设备教程重来,dev 阶段可接受);备选=服务端透明 blob(纯存储、永不解读)。

## §6 效率契约

任务单=步骤号+判据引用,单页;审级 §1-8;方向级异议只在 S8 处理一次;计数一律出自 S2 机器清单或任务单内写明的计数命令,禁"明显下降"式口述判据。
