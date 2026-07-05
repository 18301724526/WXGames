# 09 建造进度日志（codex 接力精确落点）

> 分支 `codex/pvpve-systems`（从 design HEAD 切出，只推 `origin`=github 备份，**不推 local/private 测试服**，中途不部署不真机测试）。每刀独立提交、过全门禁（npm test + lint + architecture）。本文=**codex 从任意点接手的地图**：已建什么、在哪、下一步做什么。设计权威=`08-confirmed-decisions.md`；顺序=`07-implementation-roadmap.md`。

## 已建（提交号 · 文件 · 测试）

### 阶段 0 — 纯规则核 + 配置表（全 DONE，纯、无持久层、可测）
所有核**同 veteranCampCore 风格**：config 行由调用方传入、纯函数、单测；数值全在 `config/tables/*.xlsx`→`backend/config/generated/*.json`（走现有 build-config-tables 管线 + 新鲜度门禁）。
| 核 | 文件 | 表 | 提交 |
|---|---|---|---|
| 性格+多维相性 | `shared/person/personalityCore.js` | personality_natures, personality_tuning | `90651b84` |
| 关系网 | `shared/person/relationshipCore.js` | relationship_tuning | `5fdb920f` |
| 外交状态机 | `shared/faction/diplomacyCore.js` | diplomacy_tuning | `5fdb920f` |
| ②b 捕获招降 | `shared/faction/captureCore.js` | capture_tuning | `aa5f3320` |
| 势力实体模型 | `shared/faction/factionCore.js` | （无，纯逻辑） | `e31bdb4e` |

### 阶段 1 — 势力持久层脊柱（进行中，**加法式、不碰现有行为**）
| 切片 | 文件 | 提交 |
|---|---|---|
| 1.1 势力仓库 + 注册表读门 | `backend/repositories/FactionRepository.js`（共享 `factions` 表）+ `backend/services/faction/FactionRegistryService.js`（玩家 faction 从 gameState.polity 物化、AI/中立从仓库）；已 compose 进 `GameStateRepository`（constructor+init） | `fd55b653` |
| 1.2 外交仓库 + 服务 | `backend/repositories/FactionDiplomacyRepository.js`（共享 `faction_diplomacy` 表）+ `backend/services/faction/FactionDiplomacyService.js`（唯一写者：adjustFavorability 有向 / applyStateChange 成对镜像 / advanceEdge tick / performAction 宣战/提盟/破盟/求和） | `186fd851` |

**已建关键单一事实源约束（勿破）**：
- 玩家 = 势力（id `player_<playerId>`），身份现仍在 `gameState.polity`，`FactionRegistryService` 只做**读证等价物化**（未迁移，polity 仍权威）。
- AI/中立势力在共享 `factions` 表（world 授权写，不进任何玩家 gameState）；`FactionRepository.upsertFaction` **拒绝写玩家 faction**。
- 外交好感度**有向**（每侧一行）、状态**对称**（只经 `applyStateChange` 成对写）。
- 势力行**不存** cities/officers/diplomacy——全查询派生。

## 下一步（未做，codex 从这里接）

### 阶段 1 余下
- **1.3 归属单一源 `territory.ownerFactionId`**：在 `TerritoryStateNormalizer` 加派生字段（`player`→`player_<playerId>`、中立→`neutral_<siteId>`、AI→`ai_<slug>`），旧 `owner` 三态改**派生投影**；`shared_world_territories.ownerPlayerId` 语义扩展。**读证等价 + 特征测试**（碰现有领土渲染，务必对抗 review）。
- **1.4 势力级国库（经济大改，决策 01-4）**：玩家资源从 per-city 收敛到势力 treasury。**最敏感**——先特征测试锁现行为、读证等价迁移、对抗 review、**需用户在场终验**。可最后做/或先只给 AI 用势力池、玩家延后。

### 阶段 2 — 世界人物注册表 + 性格落 person
- **DONE：人物社交字段逻辑** `backend/services/person/PersonSocialFields.js`（`normalizeSocial(raw, id)` → `{personality, gender, orientation, relationships, factionId}`，消费 personalityCore+relationshipCore，确定性种子=人物 id，老存档自动 backfill；性别/取向比例进 personality_tuning）+ 5 测试。提交 `bd766b24`。
- **DONE：②b 招降编排** `backend/services/faction/FactionCaptureService.js`（`createFactionCaptureService()`）——把真人/势力数据喂进 captureCore：`rollCapture(garrisonBand, roll)`（守军 captureChance）、`recruitChance(captive, recruiterRuler, inFactionKind, garrisonBand)`（band recruitBaseRate + 主公魅力 + 主公↔俘虏 personalityCore.compatScore 相性 + relationshipCore.recruitModifier 关系加成/宿敌宁死不降）、`resolveDisposition(choice, chance, roll)`（斩杀/招降/放生→captureCore.dispositionOutcome）。纯决策层：读人物不复制、config 从 ConfigTables 可覆盖；实际花名册变更(acceptFamousPerson)+胜利钩子+面板 UI 由调用方接（阶段 3）。6 测试。提交见下方。
- **待接线（codex 一刀）**：把社交字段挂进 `FamousPersonService.normalizePerson` 的 person 对象——**但 FamousPersonService 现 498 行，god-file 门禁 `<500`，直接加 require+spread=+2 行会破门**。步骤：①先从 FamousPersonService 抽一个既有 helper 到独立模块腾行（如把某段 normalize 逻辑外移），②再在 person 对象里加一行 `...PersonSocialFields.normalizeSocial(raw, id),` + 顶部 require。**这刀要读证等价**（现有 person 形状只增字段不变旧字段）+ 更新 FamousPersonArchitecture 测试的字段清单。
- **待做：世界人物注册表** 新共享 `world_people` 表 + 仓库（在野武将 + AI 势力武将；玩家花名册仍 `gameState.famousPeople`，逻辑注册表=两者视图并集）。`FamousPersonGenerator` 生成时调 assignPersonality 播种。

### 阶段 3 — 关系/外交接线
- 关系迭代（relationshipCore.meet/drift/events）挂 `WorldWorkerService` tick（每势力 meetPairs），事件（好友来投/背叛/义兄弟）走 EventService。
- 外交漂移/AI 外交（FactionDiplomacyService.advanceEdge）挂 tick。
- **②b 捕获面板接线**：胜利钩子 rollCapture → 面板 UI(斩杀/招降/放生) → captureCore.recruitSuccessChance（喂 compatScore + relationshipCore.recruitModifier + 魅力 + garrison recruitBaseRate）→ dispositionOutcome。

### 阶段 4 — 每势力科技 + 科技树重设计（保留选1、knowledge 产点、战前折算加成、AI 粗粒度可见）
### 阶段 5 — AI 城（复用 territory/CityService）+ AI 决策循环（动态群雄、AI 互战、进视野投影、出生保护、**首都失守→临时营地+重建任务链**）

## 门禁 & 纪律（每刀）
`npm test`（node --test）+ `npm run lint` + `npm run test:architecture`（含 config 新鲜度）全绿再提交。持久层/经济改动按 [[refactor-no-debt-for-safety]]：特征测试→读证等价→对抗 review→（需真机的）用户终验。数值全走配置表。
