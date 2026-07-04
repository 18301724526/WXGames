# P0 玩法填充：战斗接入世界（2026-07-05）

## 一句话
游戏不缺战斗系统——它已建好、已接线、可重放。缺的是**可打的内容**、**利害关系**、**真实数值**。P0 补这三样，每片独立可回退。

## 勘察定论（证据见 workflow wj1345lpu）
- **战斗核** `shared/battleSimCore.js`：seeded 纯函数（mulberry32），前后端共用。后端出权威结果，前端 `EntityBattleController` 用同 `setup+inputStream` 重放群体混战动画。三国群英传战斗场景是活的。
- **占城打一场已闭环**：`claimConquest → resolveMission → ConquestBattleService.resolveConquestBattle`，按伤亡扣兵、出带 replay 的战报，前端 `enter-battle` 已送进战斗场景。**空城不打是因为走了 settlement 免战分支**（owner==='neutral' → 0 伤亡定居）。
- **打野怪打一场已闭环**：`startWorldMarch → resolveMarchTarget → resolveMissionArrival → resolveEncounterBattle`。真实体战斗，胜后 encounter 重生可反复刷。**但全世界只有 1 个硬编码桩**（`hostile_force_capital_ridge`，capital+{q:2,r:-1}，40 兵）。
- **伤亡是真的**：`applyCasualtiesToFormationSnapshot` 写回幸存者，战死数当前永久蒸发。
- **真实缺口在数值**：`BattleSimService.DEFAULT_BALANCE` 与 `BattleConfig.DEFENDER_PROFILES_BY_OWNER` 全是标注 PLACEHOLDER 的占位平衡；技能在 core 里 stub、占城 inputStream 写死 allOut → 技能未参战。

## 单源/可回退原则（用户约束）
每个机制满足：① 事实源单一（一处配置/一处规则）；② 模块化（新文件/新字段，不改全局语义）；③ 移除即回退（删调用/删标志位，旧存档缺省值退回原行为，零破坏）。

## 切片顺序

### 切片 1（先做）：野怪营地 = 可重生的遭遇战生成器
**现状**：`WorldCombatEncounterService` 只 seed 1 个固定桩；`normalizeEncounter` 已参数化可归一任意 encounter；`normalizeCombatState` 遍历全部 encounter。
**做法（全 additive）**：
- 新 `backend/config/WorldCampConfig.js`（单源）：营地原型表（soldiers/quality/threat/战利品/重生冷却）+ 放置参数（距都城环带、地形、上限、密度）。走 config-pipeline 登记。
- 新 `backend/services/worldCombat/WorldCampSpawner.js`（纯）：`planCamps(seed, capitalCoord, opts)` 由 seed 确定性铺点（仿 world-gen `roll01`），避水/避占用/上限内；`seedCampEncounters(gameState, now)` 落成 encounter 数组条目（复用现有 encounter 数据形状 + `art` 指 `world-site-camp-cutout.png`）。
- `normalizeCombatState` 调 `seedCampEncounters`（幂等确定性），旧单桩降为营地表的一个条目或保留为 fallback。
- **重生改 `respawnAt` 门控**（新字段）：resolved 营地过冷却才回来，不再无条件秒刷。
- 胜利战利品：`resolveEncounterBattle` 胜利分支按营地配置发资源（+为切片 3 预留伤兵分流）。
- 地图标记：encounter 挂 `art`（营地贴图）+ 程序化守军兵力徽章（纯 ctx，复用 owner 圆点调色板）。
**回退**：不调 `seedCampEncounters` → 只剩原单桩（保留）；删 `respawnAt` 判定 → 回无条件重生。存档里多出的 encounters 被 `normalizeEncounter` 逐条归一，不崩。
**美术**：零新贴图（camp/battle 序列帧/战场背景全在盘）。

### 切片 2：空城守军 = 占城先打一场
**阻断点**：`TerritoryCombatTargets.normalizeGarrison` 对 owner∈{player,neutral} 恒返回 null；`getOccupationMode` 对 neutral 判 settlement 免战。
**做法**：site 加显式 `hasGarrison` 标志位（**不改 neutral 全局语义**）；仅该位为真时绕过 garrison 短路 + `getOccupationMode` 返回 conquest（进 `resolveConquestBattle`）。守军强度按距离/地形从 config 表取（近弱远强梯度）。战败处理：部队损失，城不易主。
**回退**：删标志位判定，旧存档缺省 false → 回免战定居。

### 切片 3：老兵营地 = 伤亡资产化
**冲突**：现 50% 退款（`MilitaryService` 卸兵 `soldierRefundRatio`）是老兵营地的"临时贴现替身"。
**做法**：**替换非叠加**——保留卸兵分支与常量，把退资源改为记 `|reserveDelta|` 入城市新字段"伤兵营"；战斗伤亡分流同一字段。两条伤亡落点（占城 `settleFormationSnapshot` / 世界战斗 `settleMissionSnapshot`）**必须经同一纯函数截流**否则不一致。伤兵按节奏（worker tick 时间投影）恢复为预备兵/精锐。`famousPerson.woundedUntil` 字段已持久化、无 recovery 消费者 = 现成挂点。
**回退**：伤兵字段缺省空 + feature 常量开关，关掉回纯退粮。

### 全局：真实平衡数值（贯穿三片）
把 `BattleSimService.DEFAULT_BALANCE` / `BattleConfig` 占位数值搬进 config registry（单源、可调、可测），让守军梯度、战利品、伤亡比例有真配置。切片 1 先立营地档，切片 2 复用同表给空城守军。

## 门禁与验证
每片：npm test（1920+ 基线）+ lint + architecture-smoke + i18n key 覆盖（新文案双语）；WSL 行为探针（派兵打营地→战斗→战利品→重生冷却）；双分支部署。
