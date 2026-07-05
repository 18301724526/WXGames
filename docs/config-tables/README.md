# 配置表系统（Excel → 部署自动导表 → 游戏吃 JSON）

策划在 Excel 里改数值，部署时自动转成游戏读取的 JSON。一处编辑、单一事实源、改数值不用碰代码。

## 目录结构

```
config/tables/                     # 策划编辑区（源）
  table-schemas.js                 #   每张表的字段契约（字段/类型/文档）+ 种子数据
  garrison.xlsx                    #   ← 你在 Excel 里编辑这些
  veteran_camp.xlsx
backend/config/generated/          # 导出产物（游戏读取，已提交、部署门禁保新鲜）
  garrison.json
  veteran_camp.json
backend/config/ConfigTables.js     # 游戏侧加载器：getRows/getById/getTable/listTables
scripts/build-config-tables.js     # 导表脚本（scaffold / build / check）
```

## 怎么用

1. **改数值**：用 Excel 打开 `config/tables/<表>.xlsx`，改 `data` 表里的行（`字段说明` 表是每个字段的文档，只读参考）。
2. **导表**：`npm run build:config-tables` → 重新生成 `backend/config/generated/*.json`。
3. **提交**：把改动的 `.xlsx` 和 `.json` 一起提交。
4. **部署**：`architecture-smoke` 里有 `config tables freshness guard`——如果 JSON 和 xlsx 不一致（忘了导表）会**红**，挡住部署。所以部署拿到的一定是新鲜 JSON。
   - 新建一张表：先在 `table-schemas.js` 写字段契约 + 种子，`npm run config:tables:scaffold` 生成 `.xlsx` 模板，再按上面流程。

## 每张表的字段怎么看

每个 `.xlsx` 里有 **`字段说明`** 工作表，四列：**字段 / 类型 / 含义 / 填什么 / 作用**——策划直接在文件里就能看。类型驱动导表时的转换：

| 类型 | 说明 | 单元格填 |
|---|---|---|
| `int` | 整数 | `300` |
| `float` | 小数 | `0.35` |
| `bool` | 布尔 | `true` / `false` / `是` / `1` |
| `string` | 文本 | `city_state` |
| `csv` | 逗号分隔→数组 | `ocean,river` |
| `json` | JSON→对象 | `{"food":260}` |

每张表第一列是**主键**（`idField`），游戏侧用 `ConfigTables.getById(表名, 主键值)` 取行。

## 游戏里怎么读

```js
const ConfigTables = require('./config/ConfigTables');
ConfigTables.getRows('garrison');            // 全部行
ConfigTables.getById('garrison', 'near');    // 按主键取一行
ConfigTables.getById('veteran_camp', 2);     // 老兵营地 2 级参数
```
加载器 **fail-safe**：表缺失/损坏读成空表（不会崩服务器；新鲜度问题交给 CI 门禁）。

---

# 全量清点：游戏里所有可配置的东西（34 张表）

一次穷尽勘察（读遍 `backend/config/*` + 散落常量）的结果。**P0 已建表**，其余是迁移路线图（存量配置逐张迁移、每张验证，不一次性砸掉能跑的系统）。
### P0 — 新功能，无既有配置（优先做）

| 表名 | 形态 | 字段数 | 作用 | 现来源 |
|---|---|---|---|---|
| `garrison` | 行表 | 8 | 占城守军规则（哪些空城有守将/兵力/品质/重生） | 新(本表) |
| `veteran_camp` | 行表 | 6 | 老兵营地（阵亡转伤兵、恢复、升级） | 新(本表) |
| `tutorial_grants` | key-value | 3 | 新手发放（初始将领品质/兵源/首城） | FamousPersonGenerator/TutorialGrantService |

### P1 — 自成一体的数值，好迁移

| 表名 | 形态 | 字段数 | 作用 | 现来源 |
|---|---|---|---|---|
| `resource_economy` | key-value | 10 | 资源产出/消耗/离线效率 | GameConfig.js |
| `population_by_era` | key-value | 4 | 人口上限/增长/各时代帽 | GameConfig.js |
| `formation_policy` | key-value | 5 | 编队槽位/成员/兵力上限规则 | buildingConfig.json/military |
| `march_movement` | key-value | 8 | 行军步时长/路线上限/世界边界/禁行地形 | WorldExplorerShared/worldMarchCore/WorldMapConstants |
| `scout_exploration` | key-value | 12 | 侦察时长/揭示半径/分支 | TerritoryConstants/WorldAiExplorer |
| `world_topology` | key-value | 13 | 世界宽高/环绕/种子/分块 | WorldMapConstants/WorldMapTopology |
| `spawn_generation` | key-value | 5 | 出生点/站点生成参数 | WorldMapService |
| `event_scheduling` | key-value | 4 | 世界事件调度 | WorldEvent* |
| `encounter_timing` | key-value | 5 | 到达接战/撤退窗口/结算超时 | WorldCombatEncounterService |
| `battle_rules` | key-value | 7 | 战斗规则(技能/属性回退) | BattleConfig.js |
| `battle_sim_defaults` | key-value | 13 | 实时战斗模拟默认值 | battleSimCore.js |
| `general_stat_factors` | key-value | 10 | 将领属性→战力换算 | FormationStrengthService |
| `skill_quality_budgets` | 行表 | 7 | 技能品质预算 | SkillGeneratorConstants |
| `famous_growth_by_quality` | 行表 | 2 | 将领成长(按品质) | FamousPersonProgression |
| `defender_quality_by_threat` | 行表 | 2 | 守将品质(按威胁) | DefenderLeaderService |
| `defender_profiles` | 行表 | 11 | 守将阵营模板 | DefenderLeaderService |
| `camp_archetypes` | 行表 | 8 | 野怪营地类型 | WorldCampConfig.js |
| `camp_placement` | key-value | 5 | 营地铺设参数 | WorldCampConfig.js |
| `camp_ring_bands` | 行表 | 2 | 营地环带 | WorldCampConfig.js |

### P2 — 大型既有注册表/有逻辑耦合，谨慎迁移

| 表名 | 形态 | 字段数 | 作用 | 现来源 |
|---|---|---|---|---|
| `generals_archetypes` | 行表 | 13 | 将领品类(属性/名字池/技能对) | FamousPersonConstants.js |
| `skill_templates` | 行表 | 10 | 技能模板 | SkillGeneratorConstants |
| `skill_effects` | 行表 | 5 | 技能效果 | SkillGeneratorConstants |
| `era_advancement` | 行表 | 6 | 时代推进(解锁/阈值) | EraConfig.js |
| `tech_nodes` | 行表 | 7 | 科技节点(成本/前置/效果) | TechTreeConfig.js |
| `tech_era_grants` | 行表 | 3 | 时代科技赠予 | TechTreeConfig.js |
| `tutorial_steps` | 行表 | 5 | 新手步骤流程 | TutorialFlowConfig.js |
| `tutorial_pass_through_actions` | 行表 | 1 | 教程放行动作 | TutorialFlowConfig.js |
| `tasks` | 行表 | 8 | 任务中心(奖励/条件) | defaultTaskDefinitions.json |
| `buildings` | 行表 | 12 | 建筑(成本/产出/维护) | buildingConfig.json/BuildingConfig.js |
| `site_templates` | 行表 | 8 | 站点模板 | Territory* |
| `performance_budgets` | 行表 | 3 | 性能预算 | PerformanceCapacityBudget |

## 迁移风险（务必注意的耦合点）

- **battle_rules / battle_sim_defaults / general_stat_factors**：实时 bitecs 战斗模拟的调参，每个字段直喂 tick 循环、无兜底；空/错格会让战斗 NaN 或卡死——**导表时强校验、部署门禁**。`skillRules`/`fallbackLeaderAttributes` 是嵌套语义，**整块存 JSON 列，别拆散成松散列**。
- **skill_templates / skill_effects**：当前值来自 `create()` 公式（如 `1.2 + roll*0.3`）；**参数化（baseValue/rollMultiplier）安全，但别把任意公式字符串外置**，要和生成器代码对齐。
- **tutorial_steps**：37 步有序依赖图，步骤名**按名字持久化进存档**；在 Excel 里改名/换序会**静默卡住进行中的新手引导**和 403 编队门——**最后迁，且要加名字稳定性守卫**。
- **buildings.upgradeCosts/costGrowth**：自动升级成本 + 取整逻辑在 `BuildingConfig.js`；表**只供输入，生成曲线/取整算法留在代码**，别外置算法本身。
- **tech_nodes.parents**：前置是 DAG，Excel 打错字会造出不可达或成环科技、编译期查不出——**导表脚本要加图校验**。
- **march_movement.marchBlockedTerrains**：`coast`/`shore` 地形名在寻路里是承重的，填错会静默让水可走或陆地不可走——**导表时按地形注册表枚举校验**。

## 迁移路线图（建议顺序）

1. **P0（已建表，待接线）**：`garrison`（任务②）、`veteran_camp`（任务③）——见下方字段详情。
2. **P1 首批**：`tutorial_grants`（把初始将领品质/兵源常量收进表）、`march_movement`（步时长/路线上限/世界边界——现在散在 3 处，正好并进一张表实现真单源）、`resource_economy`、`population_by_era`。这些自成一体、好迁移。
3. **P1 其余** + **P2**：按需迁移，每张迁移时保持行为、加校验、过门禁，风险表按上面注意事项处理。

---

# P0 表字段详情（已建好，你现在就能改）

## `garrison` — 占城守军规则

按“距首城的距离档”决定空城是否有守军。占领有守军的城要先打赢到达战斗。出生区（safe 档）不设防，保护新手引导。

| 字段 | 类型 | 含义 | 填什么 | 作用 |
|---|---|---|---|---|
| `bandId` | string | 距离档标识（主键） | `safe`/`near`/`frontier`/`deep`，唯一 | 标识这一档 |
| `maxDistance` | int | 本档距离上限（格） | 离首城 ≤ 此格数归本档；最后一档填 9999 | 决定城落在哪档 |
| `defended` | bool | 本档空城是否有守军 | safe 填 `false`（保护出生区/教程），其余 `true` | false=直接占；true=先打守军 |
| `ownerType` | string | 守军阵营类型 | `city_state`/`tribe`/`ruin_guardians`/`neutral` | 决定守将品类/名字池/立绘 |
| `baseSoldiers` | int | 守军基础兵力 | 如 `300` | 守军初始兵力 |
| `soldiersPerScale` | int | 每点站点规模额外兵力 | 如 `120` | 兵力 = base + scale×此值 |
| `leaderQuality` | string | 守将品质（留空=按威胁自动） | `common`/`good`/`great`/`legendary` 或空 | 空=按威胁定档，填了强制 |
| `respawnHours` | float | 被清后重生守军的小时数 | `0`=不重生；如 `6` | 清守军后此时长重生（0=占领后永久归你） |

## `veteran_camp` — 老兵营地

每城一座；战斗阵亡的一部分转“伤兵”存入营地，随时间恢复成可用兵。等级越高转化率/容量/恢复越好。

| 字段 | 类型 | 含义 | 填什么 | 作用 |
|---|---|---|---|---|
| `level` | int | 营地等级（主键） | `0,1,2,3…`，0=无营地 | 城按当前营地等级取对应行 |
| `upgradeCostGrain` | int | 升到本级的粮食成本 | 0 级填 0；如 `800`/`2400` | 从上一级升本级的粮耗 |
| `woundedRatio` | float | 阵亡转伤兵比例(0~1) | 如 `0.35` | 战斗结算时按比例把阵亡转伤兵（其余真死） |
| `capacity` | int | 伤兵容量上限 | 如 `500` | 超出的阵亡按真死 |
| `recoverPerHour` | int | 每小时恢复的伤兵数 | 如 `40` | 心跳/worker 把伤兵恢复成该城兵 |
| `unlockEra` | int | 解锁所需时代 | 如 `0`/`2` | 达到此时代才能建/升本级 |
