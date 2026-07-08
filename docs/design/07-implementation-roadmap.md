# 07 落地路线图（codex 接力手册）

> 本文是把 `00`~`06` 设计变成代码的**有序建造计划**。北极星：单一事实源、玩家=势力、每阶段可测、配置表驱动、对抗性 review 后再部署。设计仍是 `NEEDS_REVISION`（各文档末「审查发现」+ `99-open-questions.md` 待用户逐条敲定）——**先与用户敲定该系统的开放问题，再建该系统**。

## 建造顺序（严格按依赖，从脊柱往上）

### 阶段 0 — 敲定 + 纯核（无风险、无持久化，先做）
不触碰共享持久层，先把**规则核**做成 `shared/` 纯模块 + 单测（本项目一贯模式：worldMarchCore / veteranCampCore / GarrisonPolicy）。这些核的**结构稳定**、**数值走配置表**，即使开放问题改数值也不返工：
- `shared/personalityCore.js`：性格类型集 + 相性(compatibility)函数 `compat(personA, personB) → rapport(-100..100)`；性格→行为权重。数值全部来自配置表 `personality` / `compat_matrix`。
- `shared/relationshipCore.js`：一条有向关系的迭代 `affinityStep(edge, event, personalities, cfg) → edge'`；关系 kind 阈值升降（陌生→相识→好友→义兄弟 / 政敌→宿敌）。稀疏、幂等、有界。
- `shared/diplomacyCore.js`：外交状态机 `transition(favorability, state, action, cfg) → {state, favorability}`；5 态（敌对/友好/中立/同盟/仇视）+ 好感度漂移。
- 配置表：`config/tables/` 新增 `personality.xlsx`、`compat_matrix.xlsx`、`relationship_tuning.xlsx`、`diplomacy_tuning.xlsx`（走现有 build-config-tables 管线 + 门禁）。
> 产出即可给后续所有系统消费，且**直接给 ②b 捕获招降**提供相性/关系加成（招降成功率 = `recruitBaseRate` + compat + 关系 + 君主魅力）。

### 阶段 1 — 脊柱 A：势力实体（最底层，其余都依赖）
按 `01-faction-model.md`。风险点=触碰共享持久层（新 `ai_faction_state` 表 + `shared_world_territories.ownerPlayerId` 语义扩展为 `ownerFactionId`）。做法：
1. `Faction` schema + `FactionRegistryService`（`backend/services/faction/`）+ `FactionRepository`（`backend/repositories/`，与 `SpawnAuthorityRepository` 同构）。
2. 归属单一源：`territory.ownerFactionId`（`player_<id>` / `ai_<slug>` / `null`=中立守军）。旧 `owner` 三态改为**派生投影**（当前玩家→player、别的 player/AI→hostile、null→neutral）。**一次性 migration + 惰性物化**，保留读证等价。
3. `polity → factions[player]`：`getPlayerFaction(playerId)` 成为唯一读点，`polity` 身份职责退役。
4. 先读证等价（旧行为不变）+ 特征测试，再对抗 review，再部署。**这是全项目最敏感的持久层改动，务必按 `refactor-no-debt` 纪律走。**

### 阶段 2 — 脊柱 B：世界人物注册表 + 性格落到人物
按 `02-person-personality.md`。共享世界人物表（在野武将 + AI 势力武将 + 玩家名册都在里面，`person.factionId`；玩家名册 = 查询 `factionId===player_<id>`）。给 person 加 `personality` / `compatibility` / `relationships` / `factionId` 字段（FamousPersonGenerator 生成时赋 personality，normalizePerson 保字段）。消费阶段 0 的 personalityCore。

### 阶段 3 — 关系网 + 外交（同构：有向关系 + 状态 + 迭代）
按 `03` / `04`。关系边**存在 person 上**（`person.relationships`），外交边**存在 faction 上**（`faction.diplomacy[other]`）——都是稀疏有向边，是各自实体的一部分，无全局矩阵副本。迭代只在 `WorldWorkerService` tick 跑一次（共享），事件（好友来投/背叛/义兄弟/宣战）走 EventService。

### 阶段 4 — 每势力科技 + 科技树 Civ 式重设计
按 `06`。先做**效果类型框架**（typed effect schema + 单一 effect-application resolver，把现有只解锁建筑一种扩成多种），再扩内容节点，再 per-faction（AI 也研究，玩家=一个 faction），最后迁 `tech_nodes.xlsx` 配置表（DAG+ref+effect 校验）。现有 38 节点迁移期保持可用。

### 阶段 5 — AI 城市 + AI 势力决策循环（顶层，消费全部）
按 `05`。AI 城=`shared_world_territories` 里 `ownerFactionId=ai_*` 的领土，**复用 CityService/TerritoryService**，不另造城模型。AI 决策循环挂 `WorldWorkerService` tick（节流、有界、seeded）：扩张/建造/研究/登用/开战/外交。**顺带交付被挂起的「夺回/驻防」**——AI 军队进攻玩家城即攻击驱动夺回（无驻防直接夺、有驻防打一场，接 GarrisonPolicy）。

## 贯穿全部的单一事实源守则
1. 城/领土归属只记 `territory.ownerFactionId`；`faction.cities`、`officers`、`territoryCount` 全查询派生，Faction 行不内联这些数组。
2. 关系是实体上的稀疏有向边（人在 person、外交在 faction），无全局关系/外交矩阵副本。
3. AI/外交/人物是**共享世界态**，每玩家请求经投影读取，模拟只在 world-worker tick 跑一次。
4. 数值（性格/相性/关系/外交/科技/AI 权重）全走配置表，不硬编码。
5. 每系统落地前：先敲定它的开放问题 → 纯核+单测 → 读证等价 → 对抗 review → 双部署。

## 已交付（本设计夜）
- `00`~`06` 完整设计 + `99` 开放问题 + 本路线图，均已提交（design 分支 `72e13b00`）。
- 架构定论：共享世界 PVPVE（见 `00` §4）。
- 尚无实现代码——按上面阶段 0 起步（先纯核，最安全）。
