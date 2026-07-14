---
name: pvpve-systems-branch
description: "PVPVE + 三国志-depth systems (factions/AI/diplomacy/persons/relationships) build on codex/pvpve-systems branch; design + additive substrate done, integration deferred."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户要的大工程：PVPVE + 深度像三国志(RTK)看齐的势力/AI/外交/人物关系网/性格系统。分支 `codex/pvpve-systems`。**2026-07-08 重大状态变更:分支已快进吸收整条 refactor 线**(refactor tip 93bd4baf,Codex 07-07 白天先 merge 我们再叠 10 刀、经 refactor 测试服(:3003)白天实测)+ 我们的门禁修复 `f1553a35`。现三远端:`origin`(github,含全部)+`private`(Codex 主战场,它继续在 refactor 分支推)+`local`(WSL 部署验证,健康确认 `f1553a35`)。**Codex 白天那 10 刀的核心**:①encounters 迁共享 world_encounters 表(绕 WORLD_ANCHOR{0,0} 播种;"打了才知道"迁每玩家 worldCombat.encounterIntel+共享写入 stripPlayerIntel,比 battleReport 存实体上更正确)②PlayerStateLockRepository 玩家状态写序列化(action 20s/worker+心跳 waitMs=0 让位前台)③行军重复出征兵力快照修复(mission.formation 只存身份)④spine 渲染并入 actor pass+present 修复 ⑤canvas HUD 视觉改版(ui-hud 素材+MapCommand/ResourceTopBar)。**遗留隐患见任务 #57(WORLD_ANCHOR 营地覆盖回归-高)/#58(Atomics.wait 阻塞/fail-silent/锁key/死配置)**。每刀独立提交、过全门禁(npm test + lint + architecture + config --check;**Codex 的 refactor 快速门不跑 lint/architecture,merge 后必须补跑**)。**部署坑**:config-release 版本漂移门(见 [[local-dev-env]]);改 ecs/ 下文件要 `npm run build:ecs-runtime` 重打 bundle;渲染器新增 modal 事实读取撞 Batch-3 棘轮——决策一律做在 `buildRendererPanelFacts`(owner 侧,如 activeDockItemIds 预决策表),渲染器只消费成品。

**2026-07-08 晚:合并 Codex 白天 14 刀 → `c05a0a1a` 已部署 WSL(健康确认 succeeded)+推 origin。** Codex 白天三块(全在 private/main):①UI 收尾(5 子页+城池嵌套子UI 换锻铁+去 muddy 调色;**夹带 deploy.sh 回滚快照目录迁 DEPLOY_STATE_DIR**)②野怪营地锚点改 8 格活动 region+增量补种(**营地只增不减、投影读带写副作用=未来热点**)③名人面板三步重构(CanvasPanelSurfaceManager+FamousPersonsPanel+独立 panelOverlay 层 1001,spine/dialogue 顺延 1002/1003;**风险:面板开着时心跳全量渲染可能点击穿透**待真机验)。合并冲突解法:handle_openFamousPersons 以 manager 版为基底;随合并修:FamousPersonsPanel owner 契约对齐(getCanvasGameHost 优先)、eslint 抑制修剪。2203 测试+architecture 全绿。

**权威接力地图 = [docs/design/09-build-progress.md](../../docs/design/09-build-progress.md)**（列了每刀提交号/文件/测试 + 下一步精确落点）。设计套件 = `docs/design/00-09`（用户经 6 轮 Q&A 确认，08=confirmed-decisions 是决策权威）。

**已建（全绿、加法式、不碰现有行为）：**
- 阶段0：5 纯核 `shared/person/{personalityCore,relationshipCore}` + `shared/faction/{diplomacyCore,captureCore,factionCore,aiFactionCore}` + 7 配置表(personality_natures/tuning, relationship_tuning, diplomacy_tuning, capture_tuning, ai_faction_profile)。
- 阶段1：`FactionRepository`(factions表)+`FactionRegistryService` / `FactionDiplomacyRepository`(faction_diplomacy表)+`FactionDiplomacyService`(唯一写者) — compose 进 GameStateRepository。
- 阶段2逻辑：`PersonSocialFields`(性格/性别/取向/关系/factionId) + `FactionCaptureService`(②b招降编排) + `WorldPeopleRepository`(world_people表:在野+AI武将)+`WorldPeopleRegistryService`(唯一读门,玩家花名册∪共享表并集)。
- 阶段3逻辑：`WorldSocialTickService`(关系图谱tick:加权相遇→meet→crossings) + `WorldDiplomacyTickService`(外交漂移tick:共敌/邻接/主公相性→advanceEdge)。
- 阶段5逻辑：`aiFactionCore`(AIF-4纯决策核:personalityToWeights/scoreExpansionTargets/chooseFactionActions)。
- **②b 占城捕获招降全链 CODE-COMPLETE + 已部署 WSL local(fed4cc1b)待用户真机验**：后端捕获核(GarrisonCaptureResolver:占城胜利钩子读 garrison→rollCapture→gameState.captureDecisions,一tick一seed防重摇)+resolveCapture action+captureDecisions **持久化列**(game_states 逐列存,迁移 002,round-trip测)+前端投影+**canvas 捕获面板**(CapturePresenter/CaptureController/CaptureCanvasRenderer/GameAPI,自动浮现 must-choose 模态 斩杀/招降/放生,镜像 event-card 模式 9 seam)。占城路径零改(特征测试)。canvas 渲染 headless 验不了=用户真机验。验法:打距首城>3格的有守军城(near档 captureChance 0.25)→赢→~25%弹面板;招降成功入名将 tab。

**单一事实源硬约束（勿破）：** 玩家=势力(id `player_<id>`,身份仍 gameState.polity,只读证物化未迁移)；AI/中立势力在共享表(拒写玩家faction)；外交好感有向、状态对称(只经 applyStateChange 成对写)；关系边存人身上(relationshipCore)；aggression 单源=personality_natures(不复制)；world_people 拒写玩家人物(玩家花名册仍 gameState.famousPeople)。

**待接线（下一步，属"碰现有行为"，走 [[refactor-no-debt-for-safety]] 特征测试+读证等价+对抗review+用户一次性终验）：** 阶段2余(FamousPersonService 腾行后挂 PersonSocialFields + generator 播种写 world_people)；阶段3接线(两 tick 挂 WorldWorkerService + crossings→EventService + ②b 捕获面板 UI);阶段1.3(territory.ownerFactionId 派生)/1.4(势力级国库经济大改-最敏感);阶段4(每势力科技+Civ式科技树);阶段5余(AIF-0/1/2/3/5/6:AI城表+Seeder动态群雄+tick,先解 doc-05「审查发现」6单源违规+10缺口)。

相关：[[p0-combat-in-world]]（占城守军②a已建）、[[soldier-economy-design-intent]]（老兵营地③）、[[config-table-pipeline]]、[[architecture-refactor]]、[[bitecs-ecs-standard]]。
