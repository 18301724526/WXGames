# 教程↔游戏逻辑耦合清查报告(2026-07-11)

监督者出具。owner 亲自发现并定性:"现在的引导和游戏逻辑强耦合了,不是单纯的钩子触发,这个也需要认真对待"。
本报告是一手取证的耦合点清单,作为未来 step6(教程解耦)spec 的证据基础。只清查,未改任何代码。

直接证据:给引导加一个 1/0 开关需要改动 17 个文件(横跨后端 GameConfig/GameStateNormalizer/GameStateService/GameplayConfigRuntime/TutorialState 与前端 app.js/CanvasGameApp/CanvasGameShell)。纯钩子架构应当在单一接缝即可关闭。

## 量化总览

- 后端:45 个非 tutorial 非测试文件引用 tutorial(actions 6、application/commands 7、routes/projections 3、领域 services ~25、config/repo 4)。
- 后端在 backend/services/tutorial/ 之外直写 gameState.tutorial:11 处、8 个文件。
- 前端:8 个非 tutorial 非测试文件共 90 处 tutorialController 触点、22 个 hook 方法、36 处手工散布的 refreshCurrentHighlight。
- CanvasGameShell ~101 处、CanvasGameApp ~112 处、CanvasActionController 40+ 处。
- 分类:A(纯钩子/存储/投影,可留)≈12 簇;B(游戏逻辑内嵌教程分支,需倒转为事件+订阅)≈25 簇=主体;C(教程直改游戏/UI 状态,最重)6 簇。

## C 类(教程当导演,最重,6 簇)

1. **前端 TutorialGuideController 直改游戏/UI 单源状态并强制渲染**:frontend/js/tutorial/TutorialGuideController.js:770-800 直改 game.state.currentTab/militaryView、game.activeTab/mapHomeActive/activeCityManagementTab,经 CanvasModalSnapshotAdapter 开关 showCityManagement/showTaskCenter/showFamousPersons/activeCommandPanel;:580,631,678,725,816 五处强制 game.renderCanvasSurface。违反 UI 解耦公理(教程应只发意图)。
2. **后端 TutorialGrantService 直写游戏实体**:TaskRewardClaimer.js:24,41 → recordFirstArmyGrant/grantScoutFamousPerson;TutorialGrantService.js:51,64,92 直写 gameState.tutorial.grants;FamousPersonService.js:311-318 直接 push gameState.famousPeople。应改任务奖励经正规 action 层(与既有裁定一致)。
3. **游戏服务内联直写 gameState.tutorial 推进步骤(11 处/8 文件)**:TerritoryAction.js:14、MilitaryService.js:438-442、TaskCenterService.js:17-23、WorldExplorerActions.js:283、WorldExplorerProgression.js:279、GameStateNormalizer.js:153 + 5 个 command handler。
4. app.js:203-217 disableTutorialRuntime 直写 this.state.tutorial + 直改 canvasShell 内部字段(本次开关 WIP 新增,同罪)。
5. 教程镜像字段散布三宿主(app/game.state/canvasShell)。
6. startWorldMarch 的 :283 直写推进(见 B-12)。

## B 类(游戏逻辑内嵌教程分支,主体,~25 簇,代表列举)

- **命令管线双相内嵌**:GameCommandStateSupport.js:30-42 syncEra2Tutorial 在 4 个 handler 各自手工接线(validate 前+execute 后),应为管线级单一中间件。
- **教程校验器手工嵌入每个 handler 的 validate**:TutorialActionValidator.js:253-292 覆盖 ~20 动作语义,被各 handler 分别调用,应为统一管线阶段。
- **动作层 6 文件内联教程推进分支**:AdvanceEraAction.js:77-94、AssignPopulationAction.js:15-26、ClaimEventAction.js:10、BuildingActionService.js:20-46、TalentPolicyService.js:376-391、GameActionRegistry.js。
- **教程态改核心军事数值**:MilitaryService.js:243-252 normalizeMilitaryState 用 getFirstArmyReserveFloor 钳制 soldierCap/soldiers——B1' T2 已把发放记录改到任务奖励台账,阶段窗口残留待后续后端教程删除单清理。
- **建筑解锁内嵌教程绕行**:BuildingActionValidator.js:20-31、BuildingUnlockService.js:10-11。
- **世界生成被教程塑形**:SpawnScoring.js:63-144(出生点必须有 tutorialTarget)、SpawnLifecycleService.js:61、WorldCitySpawner.js:176-178、TerritoryConquestMissions.js:35-53。
- **任务中心双向纠缠**:TaskCenterService.js:17-23,64 与领取后教程推进仍在;B1' T3 已把任务定义里的教程步条件改为真实状态条件。
- **事件系统被教程门禁**:EventService.js:21-22。
- **startWorldMarch 三触点**(owner 点名):WorldExplorerActions.js:130 读 TUTORIAL_STEPS、:157 validateTutorialFormation(即 403 TUTORIAL_BLOCKED 源)、:283 直写推进。
- **前端 hook 阵列多数可否决**(非纯通知):CanvasActionController 40+ 处(canOpenTab 先问再动 modal)。
- **36 处手工 refreshCurrentHighlight**(与 tutorial-guide-refresh-contract 已知债同根),应收敛为单一 ui-changed 订阅。
- **输入盾渗入通用命中测试**:CanvasGameShell.js:1159-1359 + CanvasSurfaceHitTargets.js:53-183 + CanvasLayerRegistry.js:97,112。
- **客户端自造教程步/presenter 复刻服务端步门(双权威)**:CanvasGameApp.js:1204-1217 getEffectiveTutorialState、BuildingPresenter.js:384-473(404-407 复刻后端 validator)、CivilizationPresenter.js:46-107。

## 解耦方向(供 step6 spec 采纳)

1. 后端:命令管线单一 tutorial 中间件(一个 validate 阶段 + 一个 post-commit 订阅者);领域动作发 domain event(buildingBuilt/eraAdvanced/taskClaimed/formationSaved/marchStarted/cityOccupied...),TutorialProgression 订阅推进,消灭 ~15 文件内联 advanceTutorial。
2. 无法事件化的规则分支(兵力 floor、建筑解锁、出生点选址、占领模式、事件门)收敛为单一 **TutorialPolicy 声明式接口**,游戏文件只依赖这一个 seam,不再 import TUTORIAL_STEPS。
3. grants 全改任务奖励且经正规 action 层,禁止直捅 gameState.famousPeople。
4. 前端:hook 阵列→事件总线 + 单一 veto 阶段(CanvasPanelActionRunner 的 descriptor 门 :32-79 是现成模板);36 处 refreshCurrentHighlight 收敛为一个 ui-changed 订阅。
5. 教程模块只发意图(openPanel/switchTab intent),禁直改宿主状态、禁直调渲染。
6. 删客户端步合成 getEffectiveTutorialState 与 presenter 层复刻步门,前端消费服务端统一投影。
7. 死代码候选:WorldExplorerRoutePlanner.js:265-377 invent-city 引擎(调用方已删,见 WorldExplorerActions.js:224 注释)。

## 与 step5 的关系(监督者建议)

独立立项 **step6**:体量(后端 45 + 前端 ~15 文件)和前置依赖(领域事件总线,step5 不建)超出 step5 tranche 粒度;排在 step5 descriptor 路由稳定之后;step5 后续 tranche 应把教程门禁统一走 descriptor 层作为 step6 接缝预备。当前 TUTORIAL_ENABLED 开关是止血,与两种路线兼容。
