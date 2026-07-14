---
name: pvpve-systems-design
description: PVPVE + 三国志深度五大系统（科技树/外交/AI势力+城/人物关系网+性格）的完整设计蓝图 docs/design/ 已交付双部署；架构定论=共享世界；实现按 07 路线图从纯核起步。
metadata:
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

⚠️ codex/pvpve-systems 已并入单一 main；docs/design/ 设计套件已在 38dbaab6 从工作树删除，取用走 git 历史（如 git show 38dbaab6^:docs/design/08-confirmed-decisions.md）。分支推送指引作废。

2026-07-06 夜：用户要把游戏做成 **PVPVE + 三国志(光荣 RTK)深度**，五大系统：科技树重设计(文明式)、外交、AI 势力+AI 城市、人物关系网+性格。要求：**先看项目+参考三国志→提问定设计→夜间自主推进；严格单一事实源，禁任何为效率牺牲底层的实现**。用户答复 Q1=「哪怕完不成也要做完设计，一个系统一个系统详细，起床叫停→整理进度→公司 codex 继续」，其余 Q 全 [No preference]（信我按三国志设计）。

**交付：完整设计蓝图 `docs/design/`（提交 `72e13b00`+`a669bc63`，双部署）**：00 愿景+单一事实源脊柱、01 势力实体、02 人物性格+相性、03 关系网+迭代+好友来投、04 外交(好感度+敌对/友好/中立/同盟/仇视)、05 AI势力+城+决策循环、06 科技树Civ式重设计、07 落地路线图(codex 接力)、99 开放问题(~40 条待用户逐条敲定)。每系统经 design workflow 深化(高 effort)+ **单一事实源对抗审查**(全 NEEDS_REVISION，违规+缺口附在各文档末「审查发现」，落地前修正)。

**架构定论（有代码证据，勘察 agent）= 共享世界 PVPVE**：一个规范世界(`WorldMapConstants.DEFAULT_WORLD_SEED`+canonical tile id)，多真人+AI 势力共处；每玩家 `game_states` 行(playerId PK)；`shared_world_territories`(ownerPlayerId)=所有玩家领土单一源；跨玩家经 `getClientProjectionForPlayer→sharedWorldTerritories(excludePlayerId)` 投影(存盘前 strip)；`player_spawn_allocations` 防撞；`WorldWorkerService` tick(~5s) 推进活跃玩家。→ **单一事实源结论**：真人玩家=一个势力(playerId)；AI 势力活在**共享世界态**(新 `ai_faction_state` 表/仓库，平行 shared_world_territories，不进任何玩家 gameState)；AI 城复用 `shared_world_territories`(`ownerFactionId=ai_<slug>`)不另造城模型；外交+世界人物注册表同为共享态经投影下发；AI/关系模拟只在 world-worker tick 跑一次。

**脊柱**：A=势力(Faction，玩家+AI 同模型，`territory.ownerFactionId` 单一源，cities/officers/外交全查询派生)；B=人物(扩 personality/相性/relationships/factionId，世界人物注册表)。

**全 6 系统设计已逐条 Q&A 确认（`docs/design/08-confirmed-decisions.md` 权威，取代 99）**：01 玩家=势力零特例 + **纯动态群雄割据**（空城被认领即诞生）+ 中立守军=轻量中立势力 + **玩家也走势力级国库(经济大改)**；02 性格只驱动行为(不双源) + 配置表自由加 + **多维相性向量** + 来投=在野+挖墙角；03 **性别+取向现在就加** + 背叛只带亲兵 + 招降硬上限+宁死不降 + 特殊态可和解事件；04 同盟可选参战 + 离线提案收件箱 + 首版无朝贡 + 名声只波及接壤 + 好感 min 聚合；05 出生保护环 + **首都失守→远点刷临时营地+势力重建任务链(不淘汰)** + **AI 互战(真群雄)** + AI 行军进视野才投影；06 **保留每时代选1**(Civ 深度=扩节点/多效果类型/每势力，不改全解锁网) + knowledge 持续产科技点 + 战前折算加成 + AI 科技粗粒度情报。放大 scope：势力级国库/动态群雄+AI互战/首都重建流程/性别取向/多维相性/中立轻量势力/外交收件箱。

**实现进度**：设计 00~08 全部双部署。**代码在独立特性分支 `codex/pvpve-systems`**（从 design HEAD 切出，用户令"切好分支、中途不部署不测试、只推 github 备份"；`git push origin codex/pvpve-systems`，**不推 local/private 免污染测试服**）。**5 个纯核 + 6 配置表全部 DONE + 测试**（同 veteranCampCore 风格：config 行传入、纯、可测；数值全走 config/tables）：
- `shared/person/personalityCore.js`（`90651b84`）：3 轴(boldness/sociability/integrity -1~1)=**多维相性向量**(从 doc02 一维环调和)+8 气性 nature；性格只驱动行为不碰战斗数值；assignPersonality/compatScore/nearestNature/behaviorMult。表 personality_natures+personality_tuning。
- `shared/person/relationshipCore.js`（`5fdb920f`）：人↔人有向稀疏边(存人身上，网=边的并集，无全局矩阵)；resolveKind(affinity 轴+meetCount+迟滞 / 事件 flags 特殊态义兄弟/恋慕/主従/宿敌不自动解)、meet(建/触边+向相性 setpoint 漂移)、decayEdge、evictOverCap、applyRelationEvent(swear/betray/reconcile)、**recruitModifier(②b 招降关系加成)**。表 relationship_tuning。
- `shared/faction/diplomacyCore.js`（`5fdb920f`）：势力↔势力 5 态机(neutral/friendly/allied/hostile/nemesis)；好感有向+状态对称(mutualFav=min 驱动被动迁移+迟滞+仇视持续)、actionTransition(宣战/提盟/破盟/求和)、favorabilityDrift(衰减+共同敌人+接壤+君主相性)、stateEffects(同盟可选参战)。表 diplomacy_tuning。
- `shared/faction/captureCore.js`（`aa5f3320`）：**②b 捕获招降**——rollCapture、recruitSuccessChance(base+魅力+相性+关系加成，封顶 recruitCap；军中宿敌→宁死不降=0)、dispositionOutcome(斩杀/招降/放生)。消费 personality+relationship 核。表 capture_tuning。
- `shared/faction/factionCore.js`（`e31bdb4e`）：势力实体模型——id 命名空间(player_/ai_/neutral_)、normalizeFaction(玩家+AI 都势力级国库、AI 带 tech/aiProfile、玩家 tech 留 gameState.techs)、relationToViewer、lifecycle(alive/collapsed/**rebuilding 首都失守临时营地重建**)；**行上无 cities[]/officers[]/diplomacy 全查询派生**。

全绿 2032 测试。**下一步(整合层、更重、宜新上下文)**：阶段 1 势力持久层脊柱(新共享 `ai_faction_state`+`faction_diplomacy` 表 + FactionRepository/DiplomacyRepository + polity→factions[player] 迁移 + owner→ownerFactionId + **势力级国库经济大改**，按 [[refactor-no-debt-for-safety]] 读证等价)；阶段 2 世界人物注册表 + 性格/性别落 person；阶段 3-5 关系/外交/AI 城/AI 决策/②b 面板接线。原设计按 `07-implementation-roadmap.md`：`shared/` 纯核(personalityCore/relationshipCore/diplomacyCore)+配置表，无持久层风险，且直接给**待做的 ②b 捕获招降**提供相性/关系加成。阶段 1 势力实体是最敏感的共享持久层迁移(polity→factions[player]、owner→ownerFactionId)，按 [[refactor-no-debt-for-safety]] 纪律。相关：[[garrison-occupy-2a]]（②b 捕获面板消费本系统；夺回/驻防由阶段5 AI攻城交付）、[[config-table-pipeline]]（新增性格/相性/外交/科技配置表）、[[battle-system]]、[[bitecs-ecs-standard]]。
