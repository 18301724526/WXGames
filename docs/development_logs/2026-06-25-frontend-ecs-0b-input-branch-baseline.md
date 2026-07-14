# Frontend ECS Input Branch Report

Mode: report-only. Historical findings do not fail the architecture gate.

## Summary

| Dimension | Key | Findings |
| --- | --- | ---: |
| Surface | action-dispatch | 11 |
| Surface | command-handler | 125 |
| Surface | input-branch | 14 |
| Branch Kind | action | 130 |
| Branch Kind | mode | 2 |
| Branch Kind | panel | 9 |
| Branch Kind | runtime-route | 9 |

## Findings

| File | Line | Surface | Branch Kind | Symbols | Action Type | Evidence | Note |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 149 | input-branch | action | action.type |  | `type: action.type \|\| '',` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 202 | input-branch | action | action.type |  | `return allowedSet.has(action.type);` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 233 | input-branch | action | action.type | worldMapDrag | `action.type === 'worldMapDrag' \|\|` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 234 | input-branch | action | action.type | openWorldSite | `action.type === 'openWorldSite' \|\|` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 235 | input-branch | action | action.type | selectWorldActor | `action.type === 'selectWorldActor' \|\|` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 236 | input-branch | action | action.type | selectWorldMarchTarget | `(action.type === 'selectWorldMarchTarget' && action.background)` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 246 | input-branch | action | action.type | blockCanvasModal | `if (action.disabled \|\| action.type === 'blockCanvasModal') return false;` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 249 | input-branch | action | action.type | worldMapDrag | `action.type === 'worldMapDrag' \|\|` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputActionMap.js | 250 | input-branch | action | action.type | selectWorldMarchTarget | `(action.type === 'selectWorldMarchTarget' && action.background)` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputIntent.js | 100 | input-branch | runtime-route | worldMapRuntime |  | `source: options.source \|\| 'worldMapRuntime',` | world-map runtime route branch |
| frontend/js/ecs/input/WorldMapInputIntent.js | 112 | input-branch | action | action.type |  | `if (!action \|\| typeof action !== 'object' \|\| !action.type) return null;` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputIntent.js | 113 | input-branch | action | action.type |  | `const summary = { type: String(action.type).slice(0, 80) };` | action dispatch branch |
| frontend/js/ecs/input/WorldMapInputIntent.js | 293 | input-branch | runtime-route | worldMapRuntime |  | `source: copyString(options.source, 80) \|\| 'worldMapRuntime',` | world-map runtime route branch |
| frontend/js/ecs/input/WorldMapInputIntent.js | 336 | input-branch | runtime-route | worldMapRuntime |  | `source: copyString(intent.source, 80) \|\| 'worldMapRuntime',` | world-map runtime route branch |
| frontend/js/platform/CanvasActionController.js | 276 | command-handler | panel | activeEventId |  | `if (!keep.has('activeEventId')) this.host?.closeEventSnapshot?.();` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 284 | command-handler | panel | activeEventId |  | `if (!keep.has('activeEventId')) target.closeEventSnapshot?.();` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 313 | command-handler | action | action.type | switchTab | `if (action.type !== 'switchTab') this.render(action);` | action dispatch branch |
| frontend/js/platform/CanvasActionController.js | 425 | command-handler | action | action.type |  | `switch (action.type) {` | action dispatch branch |
| frontend/js/platform/CanvasActionController.js | 426 | command-handler | action |  | switchTab | `case 'switchTab': return this.handle_switchTab;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 427 | command-handler | action |  | openResourceDetails | `case 'openResourceDetails': return this.handle_openResourceDetails;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 428 | command-handler | action |  | closeResourceDetails | `case 'closeResourceDetails': return this.handle_closeResourceDetails;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 429 | command-handler | action |  | openCommandPanel | `case 'openCommandPanel': return this.handle_openCommandPanel;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 430 | command-handler | action |  | closeCommandPanel | `case 'closeCommandPanel': return this.handle_closeCommandPanel;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 431 | command-handler | action |  | closeRewardReveal | `case 'closeRewardReveal': return this.handle_closeRewardReveal;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 432 | command-handler | action |  | openCitySwitcher | `case 'openCitySwitcher': return this.handle_openCitySwitcher;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 433 | command-handler | action |  | closeCitySwitcher | `case 'closeCitySwitcher': return this.handle_closeCitySwitcher;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 434 | command-handler | action |  | openSubcityList | `case 'openSubcityList': return this.handle_openSubcityList;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 435 | command-handler | action |  | closeSubcityList | `case 'closeSubcityList': return this.handle_closeSubcityList;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 436 | command-handler | action |  | openArmyFormation | `case 'openArmyFormation': return this.handle_openArmyFormation;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 437 | command-handler | action |  | closeArmyFormationEditor | `case 'closeArmyFormationEditor': return this.handle_closeArmyFormationEditor;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 438 | command-handler | action |  | toggleArmyFormationMember | `case 'toggleArmyFormationMember': return this.handle_toggleArmyFormationMember;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 439 | command-handler | action |  | changeArmyFormationPage | `case 'changeArmyFormationPage': return this.handle_changeArmyFormationPage;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 440 | command-handler | action |  | changeArmyFormationSoldiers | `case 'changeArmyFormationSoldiers': return this.handle_changeArmyFormationSoldiers;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 441 | command-handler | action |  | requestArmyFormationSoldierInput | `case 'requestArmyFormationSoldierInput': return this.handle_requestArmyFormationSoldierInput;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 442 | command-handler | action |  | autoReplenishArmyFormation | `case 'autoReplenishArmyFormation': return this.handle_autoReplenishArmyFormation;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 443 | command-handler | action |  | saveArmyFormation | `case 'saveArmyFormation': return this.handle_saveArmyFormation;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 444 | command-handler | action |  | openSettings | `case 'openSettings': return this.handle_openSettings;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 445 | command-handler | action |  | closeSettings | `case 'closeSettings': return this.handle_closeSettings;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 446 | command-handler | action |  | requestResetGame | `case 'requestResetGame': return this.handle_requestResetGame;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 447 | command-handler | action |  | downloadClientOperationLog | `case 'downloadClientOperationLog': return this.handle_downloadClientOperationLog;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 448 | command-handler | action |  | closeConfirmDialog | `case 'closeConfirmDialog': return this.handle_closeConfirmDialog;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 449 | command-handler | action |  | confirmResetGame | `case 'confirmResetGame': return this.handle_confirmResetGame;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 450 | command-handler | action |  | confirmWorldMarchDeployment | `case 'confirmWorldMarchDeployment': return this.handle_confirmWorldMarchDeployment;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 451 | command-handler | action |  | openLogs | `case 'openLogs': return this.handle_openLogs;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 452 | command-handler | action |  | closeLogs | `case 'closeLogs': return this.handle_closeLogs;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 453 | command-handler | action |  | clearLogs | `case 'clearLogs': return this.handle_clearLogs;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 454 | command-handler | action |  | requestLoginUsername | `case 'requestLoginUsername': return this.handle_requestLoginUsername;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 455 | command-handler | action |  | requestLoginPassword | `case 'requestLoginPassword': return this.handle_requestLoginPassword;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 456 | command-handler | action |  | toggleRememberPassword | `case 'toggleRememberPassword': return this.handle_toggleRememberPassword;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 457 | command-handler | action |  | submitLogin | `case 'submitLogin': return this.handle_submitLogin;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 458 | command-handler | action |  | resetGame | `case 'resetGame': return this.handle_resetGame;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 459 | command-handler | action |  | logout | `case 'logout': return this.handle_logout;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 460 | command-handler | action |  | requestNamingInput | `case 'requestNamingInput': return this.handle_requestNamingInput;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 461 | command-handler | action |  | closeNaming | `case 'closeNaming': return this.handle_closeNaming;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 462 | command-handler | action |  | submitNaming | `case 'submitNaming': return this.handle_submitNaming;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 463 | command-handler | action |  | blockCanvasModal | `case 'blockCanvasModal': return this.handle_blockCanvasModal;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 464 | command-handler | action |  | openCityManagement | `case 'openCityManagement': return this.handle_openCityManagement;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 465 | command-handler | action |  | closeCityManagement | `case 'closeCityManagement': return this.handle_closeCityManagement;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 466 | command-handler | action |  | switchCityManagementTab | `case 'switchCityManagementTab': return this.handle_switchCityManagementTab;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 467 | command-handler | action |  | openEvent | `case 'openEvent': return this.handle_openEvent;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 468 | command-handler | action |  | closeEvent | `case 'closeEvent': return this.handle_closeEvent;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 469 | command-handler | action |  | openTaskCenter | `case 'openTaskCenter': return this.handle_openTaskCenter;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 470 | command-handler | action |  | closeTaskCenter | `case 'closeTaskCenter': return this.handle_closeTaskCenter;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 471 | command-handler | action |  | switchTaskCenterTab | `case 'switchTaskCenterTab': return this.handle_switchTaskCenterTab;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 472 | command-handler | action |  | selectCity | `case 'selectCity': return this.handle_selectCity;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 473 | command-handler | action |  | jumpToSubcity | `case 'jumpToSubcity': return this.handle_jumpToSubcity;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 474 | command-handler | action |  | enterCity | `case 'enterCity': return this.handle_enterCity;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 475 | command-handler | action |  | assignJob | `case 'assignJob': return this.handle_assignJob;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 476 | command-handler | action |  | advanceEra | `case 'advanceEra': return this.handle_advanceEra;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 477 | command-handler | action |  | research | `case 'research': return this.handle_research;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 478 | command-handler | action |  | selectTechNode | `case 'selectTechNode': return this.handle_selectTechNode;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 479 | command-handler | action |  | closeTechDetail | `case 'closeTechDetail': return this.handle_closeTechDetail;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 480 | command-handler | action |  | claimEvent | `case 'claimEvent': return this.handle_claimEvent;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 481 | command-handler | action |  | resolveCapture | `case 'resolveCapture': return this.handle_resolveCapture;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 482 | command-handler | action |  | claimTaskReward | `case 'claimTaskReward': return this.handle_claimTaskReward;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 483 | command-handler | action |  | scrollBuildings | `case 'scrollBuildings': return this.handle_scrollBuildings;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 484 | command-handler | action |  | selectBuildingCategory | `case 'selectBuildingCategory': return this.handle_selectBuildingCategory;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 485 | command-handler | action |  | seekFamousPerson | `case 'seekFamousPerson': return this.handle_seekFamousPerson;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 486 | command-handler | action |  | acceptFamousPerson | `case 'acceptFamousPerson': return this.handle_acceptFamousPerson;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 487 | command-handler | action |  | dismissFamousPersonCandidate | `case 'dismissFamousPersonCandidate': return this.handle_dismissFamousPersonCandidate;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 488 | command-handler | action |  | assignFamousAttributePoint | `case 'assignFamousAttributePoint': return this.handle_assignFamousAttributePoint;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 489 | command-handler | action |  | selectWorldMarchTarget | `case 'selectWorldMarchTarget': return this.handle_selectWorldMarchTarget;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 490 | command-handler | action |  | openWorldMarchFormationPicker | `case 'openWorldMarchFormationPicker': return this.handle_openWorldMarchFormationPicker;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 491 | command-handler | action |  | closeWorldMarchHud | `case 'closeWorldMarchHud': return this.handle_closeWorldMarchHud;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 492 | command-handler | action |  | selectWorldActor | `case 'selectWorldActor': return this.handle_selectWorldActor;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 493 | command-handler | action |  | openWorldTargetPicker | `case 'openWorldTargetPicker': return this.handle_openWorldTargetPicker;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 494 | command-handler | action |  | chooseWorldTarget | `case 'chooseWorldTarget': return this.handle_chooseWorldTarget;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 495 | command-handler | action |  | closeWorldTargetPicker | `case 'closeWorldTargetPicker': return this.handle_closeWorldTargetPicker;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 496 | command-handler | action |  | startWorldMarch | `case 'startWorldMarch': return this.handle_startWorldMarch;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 497 | command-handler | action |  | returnWorldMarch | `case 'returnWorldMarch': return this.handle_returnWorldMarch;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 498 | command-handler | action |  | stopWorldMarch | `case 'stopWorldMarch': return this.handle_stopWorldMarch;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 499 | command-handler | action |  | switchMilitaryView | `case 'switchMilitaryView': return this.handle_switchMilitaryView;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 500 | command-handler | action |  | veteranCampWithdraw | `case 'veteranCampWithdraw': return this.handle_veteranCampWithdraw;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 501 | command-handler | action |  | veteranCampUpgrade | `case 'veteranCampUpgrade': return this.handle_veteranCampUpgrade;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 502 | command-handler | action |  | openWorldSite | `case 'openWorldSite': return this.handle_openWorldSite;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 503 | command-handler | action |  | closeWorldSite | `case 'closeWorldSite': return this.handle_closeWorldSite;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 504 | command-handler | action |  | resetWorldPan | `case 'resetWorldPan': return this.handle_resetWorldPan;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 505 | command-handler | action |  | worldMapDrag | `case 'worldMapDrag': return this.handle_worldMapDrag;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 506 | command-handler | action |  | changeExpeditionSoldiers | `case 'changeExpeditionSoldiers': return this.handle_changeExpeditionSoldiers;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 507 | command-handler | action |  | changeExpeditionLeader | `case 'changeExpeditionLeader': return this.handle_changeExpeditionLeader;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 508 | command-handler | action |  | territoryAction | `case 'territoryAction': return this.handle_territoryAction;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 509 | command-handler | action |  | openExpedition | `case 'openExpedition': return this.handle_openExpedition;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 510 | command-handler | action |  | closeExpedition | `case 'closeExpedition': return this.handle_closeExpedition;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 511 | command-handler | action |  | conquer | `case 'conquer': return this.handle_conquer;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 512 | command-handler | action |  | launchExpedition | `case 'launchExpedition': return this.handle_launchExpedition;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 513 | command-handler | action |  | claimConquest | `case 'claimConquest': return this.handle_claimConquest;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 514 | command-handler | action |  | enterBattleScene | `case 'enterBattleScene': return this.handle_enterBattleScene;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 515 | command-handler | action |  | closeBattleScene | `case 'closeBattleScene': return this.handle_closeBattleScene;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 516 | command-handler | action |  | skipBattleScene | `case 'skipBattleScene': return this.handle_skipBattleScene;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 517 | command-handler | action |  | entityBattleSelectGeneral | `case 'entityBattleSelectGeneral': return this.handle_entityBattleSelectGeneral;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 518 | command-handler | action |  | entityBattleOrder | `case 'entityBattleOrder': return this.handle_entityBattleOrder;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 519 | command-handler | action |  | entityBattleMaster | `case 'entityBattleMaster': return this.handle_entityBattleMaster;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 520 | command-handler | action |  | entityBattleSkill | `case 'entityBattleSkill': return this.handle_entityBattleSkill;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 521 | command-handler | action |  | entityBattleAuto | `case 'entityBattleAuto': return this.handle_entityBattleAuto;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 522 | command-handler | action |  | entityBattleDone | `case 'entityBattleDone': return this.handle_entityBattleDone;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 523 | command-handler | action |  | entityBattleClose | `case 'entityBattleClose': return this.handle_entityBattleClose;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 524 | command-handler | action |  | entityBattleZoom | `case 'entityBattleZoom': return this.handle_entityBattleZoom;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 525 | command-handler | action |  | entityBattleDrag | `case 'entityBattleDrag': return this.handle_entityBattleDrag;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 526 | command-handler | action |  | manageCity | `case 'manageCity': return this.handle_manageCity;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 527 | command-handler | action |  | renameCity | `case 'renameCity': return this.handle_renameCity;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 528 | command-handler | action |  | techTreeDrag | `case 'techTreeDrag': return this.handle_techTreeDrag;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 529 | command-handler | action |  | techTreeZoom | `case 'techTreeZoom': return this.handle_techTreeZoom;` | command/action routing branch |
| frontend/js/platform/CanvasActionController.js | 547 | command-handler | action | action.type |  | `commandType: action.type \|\| '',` | action dispatch branch |
| frontend/js/platform/CanvasActionController.js | 548 | command-handler | action | action.type |  | `commandKey: ClientCommandSemantics?.getCommandKey?.(action) \|\| action.type \|\| '',` | action dispatch branch |
| frontend/js/platform/CanvasActionController.js | 661 | command-handler | runtime-route | worldMapRuntime |  | `\|\| this.host?.worldMapRuntime` | world-map runtime route branch |
| frontend/js/platform/CanvasActionController.js | 662 | command-handler | runtime-route | worldMapRuntime |  | `\|\| this.getGameHost()?.worldMapRuntime;` | world-map runtime route branch |
| frontend/js/platform/CanvasActionController.js | 693 | command-handler | runtime-route | worldMapRuntime |  | `\|\| this.host?.worldMapRuntime` | world-map runtime route branch |
| frontend/js/platform/CanvasActionController.js | 694 | command-handler | runtime-route | worldMapRuntime |  | `\|\| game?.worldMapRuntime;` | world-map runtime route branch |
| frontend/js/platform/CanvasActionController.js | 731 | command-handler | runtime-route | worldMapRuntime |  | `if (target.worldMapRuntime) target.worldMapRuntime.waterTimeMs = null;` | world-map runtime route branch |
| frontend/js/platform/CanvasActionController.js | 1372 | command-handler | panel | rewardReveal |  | `if (result?.rewardReveal) {` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 1373 | command-handler | panel | rewardReveal, showRewardReveal |  | `if (!this.host.showRewardReveal?.(result.rewardReveal)) this.host.openRewardRevealSnapshot?.(result.rewardReveal);` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 1400 | command-handler | panel | rewardReveal |  | `if (result?.rewardReveal) this.host.openRewardRevealSnapshot?.(result.rewardReveal);` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 1526 | command-handler | mode | activeTab |  | `: (nextView?.activeTab \|\| requestedNextTab);` | mode-dependent input branch |
| frontend/js/platform/CanvasActionController.js | 1590 | command-handler | panel | showSubcityList |  | `this.closePanels(CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this.host, 'showSubcityList') ? ['showSubcityList'] : []);` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 1607 | command-handler | panel | showFloatingText |  | `if (typeof this.host?.showFloatingText === 'function') this.host.showFloatingText(message);` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 1608 | command-handler | panel | showFloatingText |  | `else if (typeof game?.showFloatingText === 'function') game.showFloatingText(message);` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 1619 | command-handler | mode | armyFormationEditor |  | `if (this.host && typeof this.host === 'object') this.host.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };` | mode-dependent input branch |
| frontend/js/platform/CanvasActionController.js | 1720 | command-handler | panel | showFloatingText |  | `this.host?.showFloatingText?.(result?.message \|\| result?.error \|\| t('opsLog.exportFailed'), { color: '#ffb86b' });` | panel/modal input branch |
| frontend/js/platform/CanvasActionController.js | 2041 | command-handler | runtime-route | handleDrag |  | `if (!this.techTreeInteraction?.handleDrag?.(action)) return false;` | world-map runtime route branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 353 | action-dispatch | action | action.type | switchTab | `if (action.type === 'switchTab') return typeof context.switchTab === 'function';` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 358 | action-dispatch | action | action.type |  | `if (FINISH_ACTIONS[action.type] \|\| RENDER_ACTIONS[action.type]) {` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 359 | action-dispatch | action | action.type |  | `return typeof context[action.type] === 'function';` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 372 | action-dispatch | action | action.type |  | `&& getSupportedActions().includes(action.type)` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 404 | action-dispatch | action | dispatch |  | `const result = CanvasActionDescriptorRegistry.dispatch(action, context);` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 410 | action-dispatch | action | dispatch |  | `static dispatch(action = {}, context = {}, options = {}) {` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 412 | action-dispatch | action | action.type | switchTab | `if (action.type === 'switchTab') return this.dispatchSwitchTab(action, context);` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 418 | action-dispatch | action | action.type |  | `const finishAction = FINISH_ACTIONS[action.type];` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 421 | action-dispatch | action | action.type |  | `const result = COERCE_BOOLEAN_FINISH_ACTIONS.has(action.type) ? rawResult !== false : rawResult;` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatchRegistry.js | 427 | action-dispatch | action | action.type |  | `const renderAction = RENDER_ACTIONS[action.type];` | action dispatch branch |
| frontend/js/platform/CanvasActionDispatcher.js | 127 | action-dispatch | action | dispatch |  | `return this.registry.dispatch(tracedAction, context, {` | action dispatch branch |
