# Northstar S8 覆盖率裁决草稿

起草：Codex

日期：2026-07-12

性质：纯文档草稿；不改产品代码；待 owner 裁决后才可进入 S9a。

## 1. 余量规则总账

结论：**S2 原始规则总数 70 - S7 已核销 14 = S8 余量 56**。

| 数字 | 出处 | 口径 |
|---|---|---|
| S2 原始总数 `70` | `3c8ee085^:docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json:14-15`：`flowRules=52`、`eventHandlers=18` | S7 E4 改写清单前，同一机器可读清单的字段和：`52 + 18 = 70`。 |
| S7 已核销 `14` | `docs/architecture/northstar-s7-verification-2026-07-12.md:207-220` 共 14 条逐规则核销行；`:222` 结构化复核 `removedCount=14` | 仅核销 flow rule；event handler 未核销。 |
| S8 余量 `56` | 当前 `docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json:14-15`：`flowRules=38`、`eventHandlers=18` | 当前权威快照已经包含 S7 核销结果：`38 + 18 = 56`；不得再从 56 二次减 14。 |

余量组成：flow rule 38 条，event handler 18 条。下表严格按当前 JSON 数组顺序展开，共 56 行。

## 2. 逐条草稿表

表名约定：

- target 表：`TutorialGuideTargetResolver`，键写成 `hitTarget:<type>`、`worldSiteAnchor:<alias>`、`softGuideId:<id>`；标“拟增 alias”的只是宿主表键，不是 query。
- event 表：`TutorialGuideEventRegistry.EVENT_CONTRACTS:<eventName>`。
- action 表：`TutorialActionMatches.actionMatches/<action.type>`，参数是声明式 action descriptor。
- query 表：`TutorialEngineQueryTable.QUERY_DEFINITIONS:<queryName>`；不用 query 时明确写明由步键、事件或 target 可用性决定。

| 序号 | 规则名 | 来源工厂 `file:line` | 拟用脚本类型 | 参数草案（target / event / action / query） | 迁移风险注记 |
|---|---|---|---|---|---|
| R01 | `advisor-open` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:365` | 不迁脚本；宿主 overlay 优先级豁免 | target=`—（全局遮挡层）`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/closeAdvisor`；query=`—（由 modal 变更通知）` | 全局 advisor 可压住任意步，高于单游标脚本；塞入步配置会漏掉跨步遮挡。 |
| R02 | `reward-reveal-open` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:366` | 不迁脚本；宿主 overlay 优先级豁免 | target=`—（全局遮挡层）`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/closeRewardReveal`；query=`—（由 modal 变更通知）` | reward reveal 同样跨步；应保留宿主输入白名单与隐藏高亮优先级。 |
| R03 | `capital-site-picker-follow-through` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:374` | `orderedTargetFlow`（拟增） | target=`hitTarget:chooseWorldTarget`，参数 `siteAlias=capitalSite`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/chooseWorldTarget`，参数 `targetId=$resolvedCandidateId`；query=`—（target 可用性）` | candidate id 运行时生成，必须由 target 表解析，禁止进入配置或 query。 |
| R04 | `first-city-site-picker-follow-through` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:384` | `orderedTargetFlow`（拟增） | target=`hitTarget:chooseWorldTarget`，参数 `siteAlias=firstExploreCity`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/chooseWorldTarget`，参数 `targetId=$resolvedCandidateId`；query=`—（target 可用性）` | 同一规则覆盖三个步键；客户端游标配置须显式列出三处引用。 |
| R05 | `first-era-open-civilization` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:401` | `ensureSurfaceThenHighlight` | target=`hitTarget:openCommandPanel`，参数 `panel=civilization`；event=`EVENT_CONTRACTS:commandPanelOpened`；action=`TutorialActionMatches.actionMatches/openCommandPanel`，参数 `panel=civilization`；query=`QUERY_DEFINITIONS:isCommandPanelOpen(civilization)` | 现逻辑用 `isOnTab`，终态统一到 command panel 映射时需做投影对比。 |
| R06 | `first-era-advance` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:407` | `highlightActionWait` | target=`hitTarget:advanceEra`；event=`EVENT_CONTRACTS:eraAdvanced`；action=`TutorialActionMatches.actionMatches/advanceEra`；query=`—（步键决定）` | `eraAdvanced` 还带服务端 result；S9c 后脚本只消费成功事件并推进客户端游标。 |
| R07 | `farm-build` | `factory:makeBuildRule`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:412` | `ensureSurfaceThenHighlight` | target=`hitTarget:buildBuilding`，参数 `buildingId=farm`；event=`EVENT_CONTRACTS:buildingAction`；action=`TutorialActionMatches.actionMatches/buildBuilding`，参数 `buildingId=farm`；query=`—（步键决定）` | 现 `showBuildingGuide` 会强制打开 buildings 面；该副作用须落 effects/target 前置面表。 |
| R08 | `era2-advance` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:418` | `highlightActionWait` | target=`hitTarget:advanceEra`；event=`EVENT_CONTRACTS:eraAdvanced`；action=`TutorialActionMatches.actionMatches/advanceEra`；query=`QUERY_DEFINITIONS:isCommandPanelOpen(civilization)` | 可通过把游标放在“civilization 已开”事件之后移除 query；当前先复用已有条目。 |
| R09 | `era2-open-forest-event` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:423` | `orderedTargetFlow`（拟增） | target=`hitTarget:openEvent`，参数 `eventId=evt_settlement_forest_001`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/openEvent`，同 eventId；query=`—（target 可用性）` | 现与领取规则共用服务端步；建议新增客户端子游标 `forestEventOpened`，不新增 `isEventOpen` query。 |
| R10 | `era2-claim-forest-event` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:434` | `orderedTargetFlow`（拟增） | target=`hitTarget:claimEvent`，参数 `eventId=evt_settlement_forest_001,optionId=opt_collect_wood`；event=`tutorialStateChanged` 或新增通用 `eventClaimed`；action=`TutorialActionMatches.actionMatches/claimEvent`，同参数；query=`—（客户端子游标）` | 18 事件表没有具名 `eventClaimed`；复用 `tutorialStateChanged` 会延续服务端教程耦合，建议 owner 允许新增通用事件。 |
| R11 | `lumbermill-build` | `factory:makeBuildRule`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:452` | `ensureSurfaceThenHighlight` | target=`hitTarget:buildBuilding`，参数 `buildingId=lumbermill`；event=`EVENT_CONTRACTS:buildingAction`；action=`TutorialActionMatches.actionMatches/buildBuilding`，参数 `buildingId=lumbermill`；query=`—（两个步键各挂同一配置）` | 两个旧步名命中同规则；迁移时不得折叠掉直达 build 的旁路。 |
| R12 | `era3-advance` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:461` | `highlightActionWait` | target=`hitTarget:advanceEra`；event=`EVENT_CONTRACTS:eraAdvanced`；action=`TutorialActionMatches.actionMatches/advanceEra`；query=`QUERY_DEFINITIONS:isCommandPanelOpen(civilization)` | 与 R08 同类，可在客户端细游标落地后去掉 query。 |
| R13 | `barracks-build` | `factory:makeBuildRule`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:474` | `ensureSurfaceThenHighlight` | target=`hitTarget:buildBuilding`，参数 `buildingId=barracks`；event=`EVENT_CONTRACTS:buildingAction`；action=`TutorialActionMatches.actionMatches/buildBuilding`，参数 `buildingId=barracks`；query=`—（两个步键各挂同一配置）` | 旧逻辑允许从 world-map home 强开 buildings；effects 前置必须保持。 |
| R14 | `scout-open-famous` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:483` | `highlightActionWait` | target=`hitTarget:openFamousPersons`；event=`EVENT_CONTRACTS:famousPersonsOpened`；action=`TutorialActionMatches.actionMatches/openFamousPersons`；query=`—（target 可用性）` | 不新增 `isFamousPersonsOpen`；面板已开时 open target 不可用，事件推进负责自愈。 |
| R15 | `scout-open-famous-detail` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:488` | `ensureSurfaceThenHighlight` | target=`hitTarget:openFamousPersonDetail`，参数 `personAlias=scoutFamousPerson`；event=`EVENT_CONTRACTS:famousPersonDetailOpened`；action=`TutorialActionMatches.actionMatches/openFamousPersonDetail`，参数 `personId=$resolvedPersonId`；query=`—（target 表解析）` | 名人 id 是运行时值，只允许 alias 进入配置。 |
| R16 | `scout-close-famous-detail` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:493` | `orderedTargetFlow`（拟增） | target=`hitTarget:closeFamousPersonDetail`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/closeFamousPersonDetail`；query=`—（target 可用性）` | 与 R17 同一步有顺序要求：先 detail 后 panel；必须按可用 target 有序选择。 |
| R17 | `scout-close-famous-panel` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:504` | `orderedTargetFlow`（拟增） | target=`hitTarget:closeFamousPersons`；event=`EVENT_CONTRACTS:famousPersonsClosed`；action=`TutorialActionMatches.actionMatches/closeFamousPersons`；query=`—（target 可用性）` | 关闭 detail 后需重投影再命中本条；不能把两个关闭动作一次性发出。 |
| R18 | `scout-enter-selected-capital` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:515` | `orderedTargetFlow`（拟增） | target=`worldSiteAnchor:capitalSite` 后接 `hitTarget:enterCity`；event=`EVENT_CONTRACTS:cityEntered`；action=`TutorialActionMatches.actionMatches/enterCity`，参数 `cityId=$capitalSiteId`；query=`—（target 可用性）` | 仅当首都已选中才出现 enter action；由 resolver 返回可用性，不新增 `isWorldSiteSelected`。 |
| R19 | `scout-focus-capital` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:522` | `effectSequence`（拟增） | target=`worldSiteAnchor:capitalSite`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/openWorldSite`，参数 `siteId=$capitalSiteId`；query=`—（target 可用性）` | 当前 `focusCapitalSite` 同时居中、选中、重绘；需拆成可审计 effects，不能藏宿主大方法。 |
| R20 | `scout-switch-city-military-tab` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:527` | `ensureSurfaceThenHighlight` | target=`hitTarget:switchCityManagementTab`，参数 `tab=military`；event=`EVENT_CONTRACTS:cityManagementOpened`；action=`TutorialActionMatches.actionMatches/switchCityManagementTab`，参数 `tab=military`；query=`—（target 可用性）` | 要求 people/city 面已打开；由 target 前置面表负责，不加 tab 状态 query。 |
| R21 | `scout-open-formation` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:542` | `ensureSurfaceThenHighlight` | target=`hitTarget:openArmyFormation`，参数 `cityAlias=capitalCity,slot=1`；event=`EVENT_CONTRACTS:armyFormationOpened`；action=`TutorialActionMatches.actionMatches/openArmyFormation`，同参数；query=`—（target 可用性）` | cityId 运行时解析；slot 别名比较必须沿用 action 表等价语义。 |
| R22 | `scout-formation-member-or-save` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:558` | `orderedTargetFlow`（拟增） | target 依次=`hitTarget:toggleArmyFormationMember(personAlias=scoutFamousPerson)`、`hitTarget:autoReplenishArmyFormation`、`hitTarget:saveArmyFormation`；event=`EVENT_CONTRACTS:armyFormationSaved`；action 分别=`toggleArmyFormationMember/autoReplenishArmyFormation/saveArmyFormation`；query=`—（按 enabled target 顺序）` | 三分支最容易诱发“有多少兵”query；应让 renderer/target 表暴露当前可执行动作，配置只排优先级。 |
| R23 | `scout-select-world-target` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:566` | `effectSequence`（拟增） | target=`hitTarget:selectWorldMarchTarget`，优先参数 `targetAlias=firstExploreCityCoord`，无专属 target 时退通用键；event=`EVENT_CONTRACTS:worldMarchTargetSelected`；action=`TutorialActionMatches.actionMatches/selectWorldMarchTarget`；query=`—（resolver 两级回退）` | 需保留“先清旧 target、再定位、专属 target 不可用则通用 target”的顺序。 |
| R24 | `scout-open-world-formation-picker` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:597` | `orderedTargetFlow`（拟增） | target=`hitTarget:openWorldMarchFormationPicker`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/openWorldMarchFormationPicker`；query=`—（target 可用性）` | 与 R25 共用步键；picker 打开后本 target 消失，下一 target 出现。 |
| R25 | `scout-start-world-march` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:613` | `orderedTargetFlow`（拟增） | target=`hitTarget:startWorldMarch`，参数 `formationSlot=1`；event=`EVENT_CONTRACTS:exploreStarted`；action=`TutorialActionMatches.actionMatches/startWorldMarch`，同参数；query=`—（target 可用性）` | picker/警告弹窗可能改变可点击面；input shield 必须接受 action 表的等价参数。 |
| R26 | `scout-explore-active` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:626` | `effectSequence`（拟增） | target=`—（hideHighlight effect）`；event=`EVENT_CONTRACTS:exploreStarted`；action=`—（不请求动作）`；query=`—（进入该客户端游标即隐藏）` | 旧 `hasActiveWorldExplorerMission` 是内部状态查询；应由 `exploreStarted` 成功事件直接切到隐藏步。 |
| R27 | `first-city-discovered` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:633` | `orderedTargetFlow`（拟增） | target 依次=`worldSiteAnchor:firstExploreCity`、`hitTarget:conquer`；event=`modal.changed`；action 依次=`openWorldSite(siteAlias=firstExploreCity)`、`conquer(territoryId=$siteId)`；query=`—（target 可用性）` | 当前 open/focus/conquer 三段混在 renderer helper；迁移必须拆成可追踪分支。 |
| R28 | `first-city-conquest-ready` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:638` | `highlightActionWait` | target=`hitTarget:claimConquest`，参数 `territoryAlias=firstExploreCity`；event=`tutorialStateChanged` 或新增通用 `conquestClaimed`；action=`TutorialActionMatches.actionMatches/claimConquest`；query=`—（步键决定）` | 18 事件表缺少通用占领领取事件；不应继续借服务端教程状态通知推进。 |
| R29 | `first-city-occupied` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:653` | `orderedTargetFlow`（拟增） | target 依次=`hitTarget:renameCity`、`hitTarget:submitNaming`、`hitTarget:requestNamingInput`；event=`modal.changed`；action 分别=`renameCity/submitNaming/requestNamingInput`，参数 `territoryAlias=firstExploreCity`；query=`—（enabled target 顺序）` | 命名输入值不得进 query；将 enabled 的 submit 放在 request input 前，空值时 submit 自然不可用。 |
| R30 | `first-city-named` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:658` | `orderedTargetFlow`（拟增） | target 依次=`hitTarget:submitNaming`、`hitTarget:requestNamingInput`；event=`modal.changed`；action=`TutorialActionMatches.actionMatches/submitNaming` 或 `/requestNamingInput`；query=`—（enabled target 顺序）` | 需要 `effectSequence` 前置 `openNaming(type=polity)`；owner 决定组合类型还是允许脚本引用 effect 前置。 |
| R31 | `talent-policy-open-direct` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:659` | `effectSequence`（拟增） | target=`—（ensureCityPeopleGuideVisible effect）`；event=`EVENT_CONTRACTS:talentPolicyOpened`；action=`—（不模拟点击）`；query=`—（配置直接 next）` | 当前一次 render 内触发 event 并推进，重入性差；建议改配置为显式客户端子游标，不保留自触发事件。 |
| R32 | `talent-policy-apply-direct` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:673` | `orderedTargetFlow`（拟增） | target=`hitTarget:switchCityManagementTab`，参数 `tab=people`；event=`EVENT_CONTRACTS:cityManagementOpened`；action=`TutorialActionMatches.actionMatches/switchCityManagementTab`；query=`—（target 不可用时 ctx.next）` | “tab 已开即自动 next”需 ordered flow 支持 `noTarget -> next`，否则会新增不必要 query。 |
| R33 | `talent-adjustment` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:694` | `orderedTargetFlow`（拟增） | target 依次=`hitTarget:switchCityManagementTab(tab=people)`、`hitTarget:assignJob(delta!=0)`；event=`EVENT_CONTRACTS:cityManagementOpened` 加通用 action 成功事件；action=`switchCityManagementTab/assignJob`；query=`—（target 表过滤可执行动作）` | `pickManualAssignAction` 的宿主选择逻辑应收敛为 target alias，不能复制到脚本。 |
| R34 | `talent-open-famous` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:699` | `highlightActionWait` | target=`hitTarget:openFamousPersons`；event=`EVENT_CONTRACTS:famousPersonsOpened`；action=`TutorialActionMatches.actionMatches/openFamousPersons`；query=`—（步键决定）` | 与 R14 文案不同但结构相同，应复用类型而非新增类型。 |
| R35 | `famous-seek-open-panel` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:710` | `orderedTargetFlow`（拟增） | target=`hitTarget:openFamousPersons`；event=`EVENT_CONTRACTS:famousPersonsOpened`；action=`TutorialActionMatches.actionMatches/openFamousPersons`；query=`—（target 可用性）` | 与 R36 同一步键，面板打开后自然转下一可用 target。 |
| R36 | `famous-seek-action` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:721` | `orderedTargetFlow`（拟增） | target=`hitTarget:seekFamousPerson`；event=`tutorialStateChanged` 或新增通用 `famousSeekCompleted`；action=`TutorialActionMatches.actionMatches/seekFamousPerson`；query=`—（target 可用性）` | 不能依赖服务端教程步通知完成；应由通用命令成功事件切游标。 |
| R37 | `final-tech-soft-guide` | `handwritten`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:732` | `effectSequence`（拟增） | target=`softGuideId:tech-tree`（target 表拟补键）；event=`EVENT_CONTRACTS:advisorClosed`；action=`TutorialActionMatches.actionMatches/closeAdvisor`；query=`—（两个步键各挂配置）` | `tech-tree` 当前不在 `SOFT_GUIDE_TARGET_BY_ID`；必须补明确映射，禁止字符串旁路。 |
| R38 | `house-build` | `factory:makeBuildRule`；`frontend/js/tutorial/TutorialGuideFlowRegistry.js:738` | `ensureSurfaceThenHighlight` | target=`hitTarget:buildBuilding`，参数 `buildingId=house`；event=`EVENT_CONTRACTS:buildingAction`；action=`TutorialActionMatches.actionMatches/buildBuilding`，参数 `buildingId=house`；query=`—（步键决定）` | 当前特制 helper 不强开 surface；迁移应以 target 可用性保持这一差异，不能机械套其他 build rule。 |
| R39 | `tabClicked` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:133` | `waitEventThenNext`；veto 部分宿主保留 | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:tabClicked`，filter `tabId=civilization`；action=`TutorialActionMatches.actionMatches/switchTab`；query=`—（事件 payload）` | `canOpenTab` 明文不属于 event 表；推进可迁，veto 必须留 PanelActionRunner/输入策略层。 |
| R40 | `commandPanelOpened` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:142` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:commandPanelOpened`，按 `panelId` 配置多条 next；action=`TutorialActionMatches.actionMatches/openCommandPanel`；query=`—（事件 payload）` | 一 handler 覆盖 8 个步名；迁移后必须拆成每游标一条配置，不能保留步骤分支函数。 |
| R41 | `cityEntered` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:163` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:cityEntered`；action=`TutorialActionMatches.actionMatches/enterCity`；query=`—（事件到达）` | 旧逻辑允许从更早步骤单调跳到 `cityEntered`；客户端单游标是否保留追赶语义需 owner 裁决。 |
| R42 | `buildingAction` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:173` | `allowActionSet`（拟增） | target=`—（输入策略）`；event=`EVENT_CONTRACTS:buildingAction`；action=`TutorialActionMatches.actionMatches/buildBuilding`，按游标配置 `farm/lumbermill/house`；query=`—（当前游标决定允许集）` | 这是 action 前 veto，不是普通事后事件；若不加类型只能保留宿主豁免至 S9b。 |
| R43 | `eraAdvanced` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:183` | `waitEventThenNext`（允许 after-effects 参数） | target=`softGuideId:task-center-button/events-button/famous-persons-button`；event=`EVENT_CONTRACTS:eraAdvanced`；action=`TutorialActionMatches.actionMatches/advanceEra`；query=`—（当前游标+事件）` | 旧 handler 同时 sync result、推进后表现、跨段 soft guide；需拆为事件推进和声明式 effects，不能保留大分支。 |
| R44 | `taskRewardClaimed` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:216` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:taskRewardClaimed`；action=`TutorialActionMatches.actionMatches/claimTaskReward`，参数 taskId 由配置；query=`—（事件 payload/客户端游标）` | 当前返回值被调用链当 bool 使用；割接前要确认无 veto 语义依赖。 |
| R45 | `famousPersonsOpened` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:221` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:famousPersonsOpened`；action=`TutorialActionMatches.actionMatches/openFamousPersons`；query=`—（当前游标）` | 一事件覆盖 scout 与 seek 两段；拆成配置后 next 目标必须逐游标写全。 |
| R46 | `talentPolicyOpened` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:231` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:talentPolicyOpened`；action=`—（当前为内部事件）`；query=`—（当前游标）` | 旧 handler 可连续推进两次；终态应拆客户端子游标，禁止一次事件隐式跨两步。 |
| R47 | `tutorialStateChanged` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:241` | 不迁脚本；S9c 删除教程态同步 | target=`—`；event=`EVENT_CONTRACTS:tutorialStateChanged`；action=`—`；query=`—` | 该规则的核心是同步服务端 tutorial result，和终态“客户端唯一游标”冲突；关闭 famous surface 的残余 effect 应挂通用成功事件。 |
| R48 | `famousPersonDetailOpened` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:250` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:famousPersonDetailOpened`，filter `personId=$scoutFamousPersonId`；action=`TutorialActionMatches.actionMatches/openFamousPersonDetail`；query=`—（event 参数 alias）` | scout id 动态比较应由 event/action 表 alias 解析，禁止 query 或内联函数。 |
| R49 | `armyFormationOpened` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:262` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:armyFormationOpened`；action=`TutorialActionMatches.actionMatches/openArmyFormation`；query=`—（当前游标）` | 结构简单；注意只在 `famousCardViewed` 推进，重复打开不得越步。 |
| R50 | `armyFormationSaved` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:269` | `waitEventThenNext`（允许 after-effects 参数） | target=`—（close editor/ensure map effects）`；event=`EVENT_CONTRACTS:armyFormationSaved`；action=`TutorialActionMatches.actionMatches/saveArmyFormation`；query=`—（当前游标）` | 当前包含关闭所有 editor、清 world target、刷新；这些必须成为声明式 effects 或宿主原子 effect。 |
| R51 | `militaryViewSwitched` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:286` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:militaryViewSwitched`，filter `view=world`；action=`TutorialActionMatches.actionMatches/switchMilitaryView`，参数 `view=world`；query=`—（事件 payload）` | 只迁推进；不得把 view 状态另做 query。 |
| R52 | `famousPersonsClosed` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:295` | 不迁脚本；宿主 `ui-changed` 刷新豁免 | target=`—`；event=`EVENT_CONTRACTS:famousPersonsClosed`；action=`TutorialActionMatches.actionMatches/closeFamousPersons`；query=`—` | 规则只做 surface 清理与 projection refresh，没有游标语义；应归宿主漏斗通知。 |
| R53 | `cityManagementOpened` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:301` | `waitEventThenNext`；普通刷新宿主保留 | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:cityManagementOpened`，filter `tab=people`；action=`TutorialActionMatches.actionMatches/switchCityManagementTab`；query=`—（事件 payload）` | `people` 分支可配置推进；其他 tab 只刷新，不能制造空脚本规则。 |
| R54 | `worldMarchTargetSelected` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:310` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:worldMarchTargetSelected`；action=`TutorialActionMatches.actionMatches/selectWorldMarchTarget`；query=`—（当前游标）` | 事件在旧逻辑可从 `scoutFormationSaved` 直跳；需与 R23 的 target 回退做同一段投影验证。 |
| R55 | `exploreStarted` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:317` | `waitEventThenNext` | target=`—（不投影 target）`；event=`EVENT_CONTRACTS:exploreStarted`；action=`TutorialActionMatches.actionMatches/startWorldMarch`；query=`—（事件到达）` | 删除服务端 tutorial sync 后，事件必须携带足够的通用命令成功信息供客户端 next。 |
| R56 | `advisorClosed` | `factory:createDefaultHandlers`；`frontend/js/tutorial/TutorialGuideEventRegistry.js:323` | `waitEventThenNext`（允许 after-effects 参数） | target=`—（close/clear soft guide effects）`；event=`EVENT_CONTRACTS:advisorClosed`；action=`TutorialActionMatches.actionMatches/closeAdvisor`；query=`—（当前游标）` | 只有 `finalTechOpened` 才 next 到 completed；其他步骤仍需关闭并刷新，配置要分开。 |

## 3. 预算实报

### 3.1 脚本类型

现有注册表 3 种：`highlightActionWait`、`ensureSurfaceThenHighlight`、`waitEventThenNext`。

草稿新增 3 种：

| 拟增类型 | 用途 | 不与现有类型硬并的理由 |
|---|---|---|
| `orderedTargetFlow` | 依次解析多个 target，选择首个可执行 action；支持 `noTarget -> next` | 避免把 UI 内部状态变成 query，也避免在配置中写谓词。 |
| `effectSequence` | 有序执行通用 effects/resolveTarget/requestAction，再等待事件或 next | 用于定位、开命名面、隐藏高亮、soft guide、清理 surface 等无单一点击 target 的流程。 |
| `allowActionSet` | 按游标输出输入盾允许 action 集 | `buildingAction` 是 action 前 veto，不是投影后等待事件；归 S9b 策略层。 |

去重后总数：**6 种（含 S7 已用的 3 种）**，在路线图 `6-7` 预算内，无超预算标红项。

合并建议：若 owner 要把预算压到 5 种，可将 `orderedTargetFlow` 合入 `highlightActionWait`，把 `clauses[].when` 扩展为声明式 `targetAvailable`；不建议把 `allowActionSet` 合入表现脚本，因为会混淆投影与 veto 时序。

### 3.2 query 表新增条目

**新增 0 条；终态仍复用现有 2 条 `isTaskCenterOpen`、`isCommandPanelOpen`。** 余量规则只需要后者；前者仅 S7 已迁段继续使用。

以下候选全部拒绝新增，并给出配置改法：

| 被拒绝的 query 候选 | 为什么不加 | 配置改法 |
|---|---|---|
| `isEventOpen` / `activeEventId` | UI target 可用性和事件足以表达；query 会把 modal 细节变成脚本地基。 | 在 `commandPanelOpened(events)` 后增加客户端子游标 `forestEventOpened`；`openEvent` target 消失后选择 `claimEvent` target。 |
| `isFamousPersonsOpen` / `isFamousPersonDetailOpen` | 面板开关可由 open/close target 是否存在表达。 | `orderedTargetFlow` 按 `close detail -> close panel -> next target` 排序。 |
| `isCityManagementTabOpen` | tab 状态可由 `switchCityManagementTab` target 的可执行性和 `cityManagementOpened` payload 表达。 | target 前置面表确保 surface；事件 filter 写 `tab=people/military`。 |
| `formationMemberIds` / `soldierCount` | 违反 owner 立场“引导不需要知道有多少兵”。 | renderer/target 表只暴露当前可执行的 `toggle`、`autoReplenish`、`save` action，配置按优先级选择。 |
| `isWorldSiteSelected` / `firstExploreCityId` | 实体 id 与选中态属于宿主解析，不应进入 query。 | 使用 `worldSiteAnchor:firstExploreCity` 与 action alias，resolver 返回 live target/descriptor。 |
| `namingInputValue` | 文本值是 UI 内部状态，脚本不应读取。 | 把 enabled 的 `submitNaming` 排在 `requestNamingInput` 前；空值时 submit target 不可执行。 |
| `hasActiveWorldExplorerMission` | 这是游戏内部事实，不是引导必需事实。 | `exploreStarted` 成功事件直接切换到隐藏高亮的客户端游标。 |

### 3.3 不适配或仅部分适配引擎的规则

| 编号 | 规则与来源 | 不适配原因 | 三选一建议 |
|---|---|---|---|
| X1 | `advisor-open`，`TutorialGuideFlowRegistry.js:365` | 跨所有游标的 overlay 优先级，不是某一步脚本。 | **推荐：保留宿主豁免**；改配置会复制到全部步，加脚本类型也仍需全局抢占。 |
| X2 | `reward-reveal-open`，`TutorialGuideFlowRegistry.js:366` | 跨所有游标的 modal 遮挡与关闭白名单。 | **推荐：保留宿主豁免**；理由同 X1。 |
| X3 | `tabClicked`，`TutorialGuideEventRegistry.js:133` 的 `canOpenTab` 部分 | 这是 PanelActionRunner 事前 veto，event 到达后再处理已过时。 | **推荐：保留宿主豁免**；推进部分改配置，veto 留 action/输入策略层。 |
| X4 | `buildingAction`，`TutorialGuideEventRegistry.js:173` | 纯事前 veto，不属于 highlight/wait/next 投影。 | **推荐：加脚本类型 `allowActionSet`**；它正好成为 S9b 引擎策略层输出。 |
| X5 | `tutorialStateChanged`，`TutorialGuideEventRegistry.js:241` | 核心是同步服务端教程态，与客户端唯一游标终态冲突。 | **推荐：改配置并删除规则**；把关闭 famous surface 挂到通用 seek 成功事件。 |
| X6 | `famousPersonsClosed`，`TutorialGuideEventRegistry.js:295` | 只有宿主 surface 清理和 projection refresh，无步骤推进。 | **推荐：保留宿主豁免**；归单一 `ui-changed` 订阅。 |
| X7 | `cityManagementOpened`，`TutorialGuideEventRegistry.js:301` 的非 `people` 分支 | 非 `people` 分支只 refresh，无脚本业务。 | **推荐：保留宿主豁免**；`people` 分支单独改配置。 |

## 4. owner 裁决问题

1. **forest event 与 conquest/famous seek 的成功事件：复用 `tutorialStateChanged`，还是新增通用命令成功事件？** 推荐新增 `eventClaimed`、`conquestClaimed`、`famousSeekCompleted`（或一个带 action descriptor 的统一成功事件），因为复用教程态事件会阻塞 S9c 删除服务端教程。
2. **是否批准新增 `orderedTargetFlow`？** 推荐批准，因为它用 target 可用性替代至少 6 个潜在 query，守住“query 是逃生舱”的边界。
3. **是否批准新增 `effectSequence`？** 推荐批准，但 effects 键必须是冻结宿主表条目，禁止配置函数和宿主大方法旁路。
4. **`buildingAction` 事前 veto：加 `allowActionSet`，还是保留宿主豁免到 S9b？** 推荐现在裁定类型、S9b 实现，S9a 期间允许宿主过渡豁免，避免表现迁移和输入盾拆分互相倒挂。
5. **全局 `advisor-open`、`reward-reveal-open` 是否永久作为开源包装的宿主 overlay policy？** 推荐永久保留宿主豁免，因为它们是容器遮挡优先级，不是游戏规则也不是步骤配置。
6. **`cityEntered` 是否保留“从更早游标单调追赶”的语义？** 推荐不保留隐式跨步跳转，改为每个允许入口显式配置 next，教程走死才能准确归因到配置。
7. **命名流程 `first-city-named`：允许 `orderedTargetFlow` 带前置 effects，还是组合 `effectSequence -> orderedTargetFlow`？** 推荐允许通用 `beforeEffects` 参数，避免为命名专造第 7 种类型。
8. **`waitEventThenNext` 是否允许声明式 `afterEffects`？** 推荐允许，覆盖 army formation 保存后的清理和 advisor 关闭后的 soft-guide 清理，仍保持 6 种预算。
9. **`tech-tree` 是否补入 `SOFT_GUIDE_TARGET_BY_ID`？** 推荐补入明确映射；不接受字符串直通，否则 target 表不完整。
10. **动态实体参数是否统一使用 alias（`capitalSite`、`firstExploreCity`、`scoutFamousPerson`）？** 推荐统一 alias，由 target/event/action 表解析 live id，配置与 trace 均不记录随机实体 id。

## 5. 可复跑验证附录

以下命令均在仓库根目录执行；输出为本草稿完成时原文。

### A. S2 原始总数

```powershell
git show 3c8ee085^:docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const x=JSON.parse(s.replace(/^\uFEFF/,''));console.log('flowRules='+x.counts.flowRules);console.log('eventHandlers='+x.counts.eventHandlers);console.log('s2Total='+(x.counts.flowRules+x.counts.eventHandlers))})"
```

```text
flowRules=52
eventHandlers=18
s2Total=70
```

### B. S7 核销数

```powershell
node -e "const fs=require('fs');const s=fs.readFileSync('docs/architecture/northstar-s7-verification-2026-07-12.md','utf8');const b=s.split('逐规则核销:')[1].split('结构化核对结果:')[0];console.log('s7Retired='+b.split(/\r?\n/).filter(line=>line.startsWith('| ')&&line.endsWith('| 是 |')).length)"
```

```text
s7Retired=14
```

### C. 当前余量

```powershell
node -e "const x=require('./docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json');console.log('flowRules='+x.counts.flowRules);console.log('eventHandlers='+x.counts.eventHandlers);console.log('remaining='+(x.counts.flowRules+x.counts.eventHandlers))"
```

```text
flowRules=38
eventHandlers=18
remaining=56
```

### D. 逐条草稿行数

```powershell
rg -c '^\| R\d{2} \|' docs/architecture/northstar-s8-coverage-draft-2026-07-12.md
```

```text
56
```

### E. 脚本类型预算

```powershell
node -e "const current=require('./frontend/js/tutorial-engine/StepScriptTypeRegistry').SCRIPT_TYPE_NAMES;const added=['orderedTargetFlow','effectSequence','allowActionSet'];const all=[...new Set([...current,...added])];console.log('current='+current.length+' '+current.join(','));console.log('added='+added.length+' '+added.join(','));console.log('total='+all.length+' '+all.join(','))"
```

```text
current=3 highlightActionWait,ensureSurfaceThenHighlight,waitEventThenNext
added=3 orderedTargetFlow,effectSequence,allowActionSet
total=6 highlightActionWait,ensureSurfaceThenHighlight,waitEventThenNext,orderedTargetFlow,effectSequence,allowActionSet
```

### F. query 新增预算

```powershell
node -e "const q=require('./frontend/js/tutorial/TutorialEngineQueryTable').QUERY_DEFINITIONS;const added=[];console.log('current='+Object.keys(q).length+' '+Object.keys(q).join(','));console.log('added='+added.length);console.log('final='+(Object.keys(q).length+added.length))"
```

```text
current=2 isTaskCenterOpen,isCommandPanelOpen
added=0
final=2
```

### G. 不适配清单行数

```powershell
rg -c '^\| X\d+ \|' docs/architecture/northstar-s8-coverage-draft-2026-07-12.md
```

```text
7
```
