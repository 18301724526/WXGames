# Asset Path Table Order — 后端资源路径配表化（策划可配）

Status: **DRAFT，待 owner 终审后生效。2026-07-14。**
Authority: owner 指令（2026-07-14）：后端资源路径不能写死，必须进 Excel 配置表管线由策划配置。
Scope: 仅资源路径/调色板/图标类**表现层配置**的配表化与单源收敛。老经济数值表
（EraConfig/GameConfig/TechTree 等 34 表清单存量）按既有优先级另行推进，不混入本单。
纪律: 每任务独立提交；除 T5 明确标注外零行为变化（DTO 输出等价）；LF 换行；
`npm test` + `npm run lint` + `node scripts/build-config-tables.js check` 全绿才算完成。

## 已核实的硬编码清单（file:line 均为 main@07f02da9 后本地核实）

| # | 位置 | 内容 | 备注 |
|---|---|---|---|
| 1 | `backend/config/BattleConfig.js:78-81`（及 63-83 调色板、114-119 组装） | 战场背景图、敌我 sprite 目录、逐地形 hex 调色板 | 经战报 DTO `visual.map` 下发 |
| 2 | `backend/services/DefenderLeaderService.js:8` | `PORTRAIT_LAYER_BASE='assets/art/famous-person/layers/'` | 与 #3 双源重复 |
| 3 | `backend/services/famousPerson/FamousPersonConstants.js:5` | 同上常量第二份定义 | 单源违规 |
| 4 | `backend/services/territory/TerritoryConstants.js:26-31` | 地物类型→art 整张映射 | 与 #5 双源重复 |
| 5 | `backend/services/GameStateMigrationPipeline.js:17-24,480` | 同一张映射第三份；且 V4 迁移把 `art` **写进存档** | 已发布迁移，受校验契约保护 |
| 6 | `backend/services/territory/TerritoryInitialState.js:12` | `color:'#d9a441'` 写死并持久化进领地 | 同"表现层进存档"问题 |
| 7 | `shared/buildingConfig.json`（10 处 art + icon/name/label/order） | 建筑目录含美术路径与排版序 | 已是 JSON 但不在策划管线 |

## 任务（按序，每任务一个提交）

### T1 — 新表 `battle_stage`：战场表现层配置
- `config/tables/battle_stage.xlsx` + `table-schemas.js` 契约 + `backend/config/generated/battle_stage.json`。
- 列（建议，执行者可按现有 BattleConfig 结构细化）：`stage_id`、`terrain`、`background`、
  `attacker_sprite_dir`、`defender_sprite_dir`、调色板各色列。
- `BattleConfig.js` 改读 `ConfigTables`；**当前硬编码值转为表的初始内容**，代码内仅保留
  fail-safe 兜底（空表不崩服，回退到最小中性缺省，不再内嵌整张美术清单）。
- 验收：表填充后战报 DTO `visual.map` 输出与迁移前逐字节等价（characterization test）。

### T2 — 新表 `world_site_art`：地物类型→art/color，三源收敛
- `config/tables/world_site_art.xlsx`：`site_type`、`art`、`color`。
- `TerritoryConstants.js`、`TerritoryInitialState.js` 改读表，删除本地字面量。
- **禁止改动** `GameStateMigrationPipeline.js` 中已发布 V4 步骤的字面量（先核实其是否在
  迁移校验契约内——参照 `425df020` 恢复的契约；若受保护则原样保留，只允许注释标注
  "V4 内嵌字面量为已发布契约快照，运行时单源在 world_site_art 表"）。
- 验收：运行时新建/投影地物的 art/color 来自表；grep 后端生产代码此映射仅剩 V4 快照一处。

### T3 — 武将立绘层基路径与 palette 进表，双源收敛
- 并入 `world_site_art` 同一张表或独立 `portrait_art` 表（执行者判断，倾向独立表）：
  `portrait_layer_base`、palette 名录（如 `enemy_red`）。
- `DefenderLeaderService.js` 与 `FamousPersonConstants.js` 收敛到唯一读表入口
  （建议保留 FamousPersonConstants 作为唯一 accessor，DefenderLeaderService 引用它）。

### T4 — `building_catalog` 表化（承接 shared/buildingConfig.json）
- `config/tables/building_catalog.xlsx`，导表产物**继续生成到 `shared/buildingConfig.json`
  原路径**（该文件是前后端共同契约，加载路径不得变），纳入新鲜度门禁。
- 列覆盖现有全部字段：id、name、icon、art、category 及 label/order、成本等原样搬运。
- 验收：生成产物与现文件逐字节等价（首次导表即证明等价迁移）；前端加载零改动。

### T5 —（独立决策项，owner 批准后才执行）存档表现层数据剥离
- 现状：V4 迁移与领地初始化把 `art`/`color` 持久化进 game_states，违反
  "显示资产禁烘焙进存档"公理。
- 动作：新增存档 schema V5 迁移，剥离 territories 内 `art`/`color` 字段；DTO 投影层
  改为按 `site_type` 实时查 `world_site_art` 表回填，客户端可见负载**不变**。
- 验收：迁移前后 sync 全量负载 JSON diff 为零；存档内无 `assets/` 与 `#` 色值字面量；
  V5 依照已发布迁移 append-only 契约登记 checksum。

### T6 — 防回归门禁
- architecture-smoke 新增检查：`backend/` 生产代码（排除 `backend/config/generated/`、
  排除测试与 V4 已发布快照标注行）禁止出现 `assets/` 字面量；命中即 fail。
- `build-config-tables.js` 的表校验增加：art 列的路径必须实际存在于
  `frontend/assets/` 下（构建期抓拼写错误，策划填错表当场报）。

## 统一验收

- 每任务：`npm test` 绿、`npm run lint` 绿（部署门禁会跑 lint，勿留 stale suppression）、
  导表 `check` 新鲜度绿。
- 全单完成后：`grep -rn "assets/" backend/ --include="*.js"`（排除 generated/测试/V4 标注）
  零命中；策划改任一 xlsx → build → 部署后游戏内表现随表变化（提供一次演示证据）。
- 明确不做：不改 i18n 约定（中文 label 进表正常）；不动老经济数值配置；不改传输/DTO 形状。
