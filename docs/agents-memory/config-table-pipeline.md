---
name: config-table-pipeline
description: Excel 配置表→部署导表→游戏吃 JSON 的策划配置管线（scripts/build-config-tables.js + config/tables/*.xlsx + backend/config/generated + ConfigTables 加载器 + 新鲜度门禁 + 34 表清单）。
metadata:
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-05 建（提交 `c84ccb72` design / `c93229a7` refactor，双部署）。在既有配置注册表（backend/config/*.js + ConfigPipeline 版本化发布）**之上**加了一层**策划 Excel 编辑层**，不砸旧系统。

**管线**（`scripts/build-config-tables.js`，xlsx 库在 `backend/node_modules/xlsx`，脚本 `require('../backend/node_modules/xlsx')`）：
- `config/tables/table-schemas.js` = 每表**结构契约**(字段/类型/文档 label·fill·effect + 种子行)，是表结构的单一源。
- `--scaffold`：schemas→生成缺失的 `config/tables/<t>.xlsx`（`data` 表 + `字段说明` 表）。设计师编辑 `.xlsx` 的 data 行。
- `build`（默认）：`config/tables/*.xlsx` → `backend/config/generated/<t>.json`，类型转换在这里（int/float/bool/string/csv/json）。**JSON 放 backend/ 下随后端部署**，已提交。
- `--check`：新鲜度门禁，接进 `run-architecture-smoke.js`（`config tables freshness guard`，在 config-pipeline guard 后）——xlsx 改了忘导表→JSON 陈旧→CI 红→挡部署。这就是"部署自动导表"的保证（提交+门禁，同 ecs bundle 模式）。npm: `build:config-tables` / `config:tables:scaffold`。
- 游戏侧加载器 `backend/config/ConfigTables.js`：`getRows/getById/getTable/listTables`，**fail-safe**（表缺失读空表不崩服务）。主键=表第一列(idField)。

**已建 2 张 P0 表**（`cbaf9f5b`/refactor `489fb8e8` 定稿，含用户玩法答案）：
- `garrison`（占城守军，10 字段）：距离档 defended/ownerType/兵力/守将品质 + `reclaimHours`（**不驻防被夺回**，safe=0 永久）+ `captureChance`（打赢几率捕获守将）+ `recruitBaseRate`（招降基础成功率，后续好感度/羁绊/君主魅力系统加成；面板=斩杀/招降/放生）。
- `veteran_camp`（老兵营地，6 字段，**每城默认 1 级、可升级**）：**卸兵后悔兜底，与战斗伤兵无关**（我先前理解错，用户纠正）。卸兵→进营暂存→`retentionHours` 内线性流失、每流失一兵退 `refundRatio`(0.5)×兵价(`{food:1}`)；保留期内可原样取回编队；超 `capacity` 即时退款；level0/无营=即时退款（＝旧行为）。
  - 纯核 `shared/veteranCampCore.js`：batch canonical `{originalSoldiers,atMs,drained,withdrawn}`（drained/withdrawn **分开记**，否则 withdraw 会被下次 projectDrain 复活——真 bug，测试抓到，`a1d8831c` 后重写）；deposit/projectDrain/withdraw 幂等、总流失=原始存入、10 测试。
  - **后端引擎 DONE + 双部署 `03adb47c`**（design）/ refactor cherry-pick：`MilitaryService`（normalizeMilitaryState 加 veteranCamp 默认 1 级 / setArmyFormation reserveDelta<0 改 deposit / settleVeteranCampDrain 心跳 / veteranCampWithdraw / veteranCampUpgrade / getVeteranCampView）+ `CityService`（在线 tick + 离线结算都 settle，绝对 atMs 自动补离线窗口；DTO 只发投影 view）+ `GameActionRegistry` 两动作。退款走**分数 food**（避免 `floor(1*0.5)=0` 吞退款）。经 6 维对抗 review（exploit+double-credit 维度 0 发现）修 5 项：withdraw 显式 0=no-op、tick 写走 setCityMilitary 防别名漂移、refundRatio 用 Number.isFinite 兜底、DTO 去重、view 用已结算计数。
  - **客户端 UI DONE + 双部署 `19d2b511`**（design）/ refactor cherry-pick：军事面板加**第 4 个子 tab「老兵营」**（army/scout/world/veteranCamp），读 `state.cityState.cities[activeCity].veteranCamp` 投影 view（不读 raw military）；面板=等级/容量/保留 + 暂存计数 + 最近一批流失倒计时 + **全部取回**(soldiers 省略→后端退全部)/**升级**(粮，满级禁用)按钮，走 runAction→applyState 刷新。改 6 文件：MilitaryPresenter(nav+buildVeteranCampViewState+formatDurationShort)、MilitaryCanvasRenderer(子tab+renderVeteranCampView)、GameAPI(2 方法)、CanvasActionController(2 handler，respect disabled)、CanvasGameApp(militaryView 白名单+=veteranCamp)、LocaleTextRegistry(双语 military.veteranCamp.*)；index.html 6 个 ?v= 已 bump。**任务③闭环**（卸兵进营→老兵营 tab 可见→取回/流失退款）。**canvas 像素布局待用户真机看**。
  - **坑（加军事子 tab 要改 5 处白名单 + facade delegate，少一处静默失效）**：`72ebaf61` 修——(1) MilitaryPresenter nav 列表、(2) CanvasGameApp.switchMilitaryView 白名单、(3) **ShellPresenter.resolveMapHomeViewState 白名单**（漏了→renderCanvasSurface 把 state.militaryView 拍回 'army'，tab 秒回弹）、(4) CanvasModeOwnershipRuntime.setMilitaryView 白名单（fallback）、(5) **UIStatePresenterDelegates 既要进 DELEGATES 数组又要 defineStaticMethod**（production presenter 是 UIStatePresenter facade 不是 MilitaryPresenter，漏了→`presenter.buildXxx is not a function` 崩整个军事面板）。单测喂 state.militaryView/直调 MilitaryPresenter 会绕过 3、5 全绿——**对抗性 review 抓的两个 feature-blocker**。已加 facade+resolver 回归测试锁死。canvas 文本 `wrapTextLimit(text,maxWidth,maxLines,opts)` 第 3 参是 maxLines 不是 opts。旧即时"卸兵退50%粮"原在 `setArmyFormation` reserveDelta<0 分支（现已改为进营）。

**全量清点 = 34 张表**（workflow `w937jwoak`），P0/P1/P2 优先级 + 迁移风险，全在 `docs/config-tables/README.md`。迁移原则=存量逐张迁、每张验证、别一次砸。**风险表**（谨慎迁）：battle_rules/battle_sim_defaults/general_stat_factors（实时战斗 NaN 风险，强校验）、skill_effects（公式字符串别外置，只外置参数）、tech_nodes.parents（DAG 要图校验）、buildings 成本曲线（算法留代码）、march_movement.marchBlockedTerrains（地形名承重，枚举校验）。

坑：`.xlsx` 是二进制，`.gitattributes * -text` 让 git 当二进制（`git check-attr` = `text: unset`），不触发 CRLF/diff-check 污染；生成 JSON 用 `\n` 写、check 用 `\n` 比。

相关：[[march-spine-four-direction]]（march_movement 单源）、[[soldier-economy-design-intent]]（veteran_camp 是卸兵退款的真正归宿）、[[p0-combat-in-world]]（garrison=P0-1 空城守军）。
