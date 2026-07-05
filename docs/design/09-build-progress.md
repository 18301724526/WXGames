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
- **DONE：世界人物注册表**
  - `backend/repositories/WorldPeopleRepository.js`（共享 `world_people` 表：在野武将 factionId=null + AI 势力武将 factionId=ai_*；person JSON 权威、社交字段经 PersonSocialFields 单源规范化、id/factionId 镜像列查询）。`upsertPerson` **拒绝写玩家 faction 人物**（玩家花名册仍 `gameState.famousPeople`）；`getRoninPeople`（招募池）/`getPeopleByFaction`/`getAllPeople`/`deletePerson`（俘虏入玩家时移出）。已 compose 进 `GameStateRepository`（`worldPeopleRepo` + init）。5 测试。
  - `backend/services/person/WorldPeopleRegistryService.js`（**唯一读门**，镜像 FactionRegistryService）：`materializePlayerRoster`（玩家 famousPeople 读证等价投影+盖 player factionId+社交 backfill）、`getPerson`（先自家花名册后共享表）、`getRoninPeople`、`getPeopleByFaction`（自家→花名册/AI→共享）、`getAllPeople`（并集视图）。4 测试。提交见下方。
  - **待做（阶段2余）：** `FamousPersonService.normalizePerson` 挂 PersonSocialFields（需先腾行，见上）；`FamousPersonGenerator` 生成在野/AI 武将时调 assignPersonality 播种并写入 world_people。

### 阶段 3 — 关系/外交接线
- **DONE：关系迭代 tick 逻辑** `backend/services/person/WorldSocialTickService.js`（`createWorldSocialTickService({natures})`）——纯编排：`advanceRelationships(people, {prng, meetPairs, nowMs, personalityTuning, relTuning, decay})` 让高 meetRateMult 的人加权发起相遇→`relationshipCore.meet`（对称有向边、同 compatScore 相性、各自 loyaltyDriftMult 漂移）→返回**更新后的 people + meets + crossings(became_friend/became_enemy)**；`decayAll` 闲置边衰减。**不碰输入**（克隆）、随机全走注入 PRNG（确定性）。6 测试（含高相性对最终结义 became_friend 端到端）。提交见下方。
- **待接线（codex）**：把 `advanceRelationships` 挂 `WorldWorkerService` tick——喂 `WorldPeopleRegistryService.getAllPeople` 的并集人群、每 tick meetPairs（relationship_tuning.meetPairsPerTick）、种子=worldId+tick，回写 world_people repo（AI/在野）+玩家花名册（自家），crossings→EventService（好友来投/结义/反目）。
- ~~关系迭代（relationshipCore.meet/drift/events）挂 `WorldWorkerService` tick（每势力 meetPairs），事件（好友来投/背叛/义兄弟）走 EventService。~~（逻辑已建，见上；余接线）
- **DONE：外交迭代 tick 逻辑** `backend/services/faction/WorldDiplomacyTickService.js`（`createWorldDiplomacyTickService({diplomacyService, personalityTuning})`）——为每对势力算漂移上下文：`sharedEnemyCount`（同时敌视第三方=共敌抱团）、`bordering`（注入谓词，真实邻接待 1.3 territory.ownerFactionId）、`rulerCompat`（两主公 personalityCore.compatScore 相性）→`FactionDiplomacyService.advanceEdge`（唯一写者）。`advanceAll({factionIds, now, bordering, rulerOf})` 遍历无序对。上下文对称（两向共用）。4 测试（含共敌+相容主公 200 tick 漂移至 friendly 端到端）。提交见下方。
- **待接线（codex）**：`advanceAll` 挂 `WorldWorkerService` tick——factionIds=FactionRegistryService.getAliveFactions、rulerOf=按 faction.rulerPersonId 查 WorldPeopleRegistryService、bordering=territory.ownerFactionId 邻接（待 1.3）。
- ~~外交漂移/AI 外交（FactionDiplomacyService.advanceEdge）挂 tick。~~（逻辑已建，见上；余接线）
- **②b 捕获面板接线**：胜利钩子 rollCapture → 面板 UI(斩杀/招降/放生) → captureCore.recruitSuccessChance（喂 compatScore + relationshipCore.recruitModifier + 魅力 + garrison recruitBaseRate）→ dispositionOutcome。

### 阶段 4 — 每势力科技 + 科技树重设计（保留选1、knowledge 产点、战前折算加成、AI 粗粒度可见）
- **DONE：Slice T1 效果类型框架（纯、零行为变化）** `shared/techEffectSchema.js`（唯一效果 schema：9 类 typed effect `unlockBuilding/unlockUnit/resourceOutput/globalOutput/combatModifier/abilityUnlock/diplomacyModifier/populationBonus/techRateBonus` + `validateEffect`/`normalizeEffect`/`describeEffectKey` i18n key；**op 语义定死解 doc-06 审查#7：`mul`=对基-1 乘子的加法式增量**，两个 +0.2→×1.4 非 ×1.44）+ `shared/tech/techEffectResolver.js`（唯一 fold：`resolve(researched, nodeDefs)`→effects 快照；**兼容读旧 38 节点的 legacy object 形状** `{unlockedBuildings,resourceEntrances}` + 新 typed 数组；`resourceEntrances` 保留为**纯展示**不数值化=解审查#5；非法 effect fail-closed 忽略；`getUnlockedBuildings` 薄封装泛化）。9 测试（含真实 38 节点 union）。提交见下方。
- **待接（T2-T6，读证等价切片+真机终验）**：T2 `TechEffectAggregator.mergeInto` 接产出管线(applyDerivedStatsToCity)；T3 内容上数值+补科技网；T4 per-faction 签名切换(research/resolve/getClientState 吃 faction)；T5 `tech_nodes`/`tech_era_grants` 迁表+导表 DAG 校验钩子；T6 客户端 typed-effect 渲染+AI 研究循环。⚠️ 落地须解 doc-06「审查发现」4 单源违规(eraChoices 双写/cost vs 字面量1/战斗注入锚点/knowledge 字段两义)+8 缺口。


### 阶段 5 — AI 城（复用 territory/CityService）+ AI 决策循环（动态群雄、AI 互战、进视野投影、出生保护、**首都失守→临时营地+重建任务链**）
- **DONE：AIF-4 纯决策核** `shared/faction/aiFactionCore.js`（纯、无 IO、确定性）+ 配置表 `ai_faction_profile`（4 原型 aggressive/economic/diplomatic/balanced：行动权重基线+攻城参数；**好战 aggression 不复制，单源=personality_natures.aggression**，本表只给原型基线权重，君主性格调制）。函数：`personalityToWeights`（原型基线×君主 aggression/交游调制，归一）、`scoreExpansionTargets`（距离/守军/价值打分，**排除超程/自城/出生保护玩家**05-1，targetPlayerBias 抬玩家城）、`scoreRecruitCandidates`（品质+角色缺口，compat 占位）、`chooseFactionActions`（按预算加权选可行意图：SETTLE/ATTACK/BUILD/RESEARCH/RECRUIT/TRAIN/DIPLOMACY/IDLE；弱势想攻先 TRAIN；无事 IDLE；注入 PRNG 确定）。9 测试。提交见下方。
- **DONE：对抗审查修复（阶段 2/3/5 全substrate 单源审查）** 一轮对抗 review 抓 4 缺陷，全修+回归测试锁定：H1 `chooseFactionActions` expand 家族(settle/attack/train 三键)共享 `weights.expand` 权重(原各领全额→扩张概率翻倍系统性偏战，`categoryOf`+按可用子键均分修)；H2 `WorldPeopleRegistryService.getAllPeople` 同 id 双份(花名册+共享表)且 factionId 冲突→按 id 去重、玩家花名册权威胜；L1 强城 reduce 从 null 起→0 兵城选不出连 TRAIN 都不发→IDLE(改首城种子);L2 `WorldDiplomacyTickService` factionIds 未去重→自配对/共敌双计(sharedEnemyCount/advanceAll 均 dedup)。+4 回归测试(含 H1 3000 种子统计)。提交见下方。
- **DONE：第二轮对抗验证（4 修复全 CORRECT_AND_COMPLETE）+ 完备性 critic 抓 3 漏网**，全修+回归：**C1(HIGH)** `diplomacyCore.clampFavorability` 每 tick `Math.round` → 亚 0.5/tick 漂移全丢、被动漂移子系统失效(违 doc-04 累加后 clamp)→去掉 round 让 favorability 连续浮点累积 + `faction_diplomacy.favorability` 列 INTEGER→REAL；**C2(MED)** `FactionDiplomacyService.advanceEdge` 的 `nemesisStreak` 只写 (a,b) 单向行却驱动对称态迁移→交替调用两向各自计数永不达阈→镜像写两行；**C3(LOW)** `FactionRepository.upsertFaction` 部分写会把 `createdAt` 清 null→存在则保留守卫。+3 回归(含 C1 亚 0.5 累积 / C2 交替序达 nemesis / C3 createdAt 保留)。提交见下方。
- **待接线（AIF-0/1/2/3/5/6，需先解 doc-05「审查发现」的存储层单源冲突）**：`ai_faction_state`/`ai_faction_cities` 表 + 仓库、Seeder（动态群雄=空城被认领才诞生，非静态铺设）、城成长复用 advanceAllCities、`AiFactionService.tick` 挂 WorldWorkerService（shared 单次）、执行 executeIntent + 复用 startWorldMarch/resolveBattle。⚠️ doc-05 审查已列 6 单源违规 + 10 缺口（advanceAllCities 双源、shared_world_territories 写者冲突、startWorldMarch 无玩家上下文不可调、投影优先级不认 AI…），落地前逐条解决，属**碰现有行为**切片，走 [[refactor-no-debt-for-safety]] + 用户终验。

## 门禁 & 纪律（每刀）
`npm test`（node --test）+ `npm run lint` + `npm run test:architecture`（含 config 新鲜度）全绿再提交。持久层/经济改动按 [[refactor-no-debt-for-safety]]：特征测试→读证等价→对抗 review→（需真机的）用户终验。数值全走配置表。
