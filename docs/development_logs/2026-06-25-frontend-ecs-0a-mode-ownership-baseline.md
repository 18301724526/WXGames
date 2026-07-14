# Frontend ECS Mode Ownership Report

Mode: report-only. Historical findings do not fail the architecture gate.

## Summary

| Symbol | Findings | Source-of-truth | Mirror | Adapter | Consumer | Unknown | Writes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `activeEventId` | 7 | 0 | 0 | 0 | 4 | 3 | 3 |
| `activeTab` | 32 | 9 | 0 | 22 | 0 | 1 | 10 |
| `armyFormationEditor` | 11 | 2 | 2 | 6 | 0 | 1 | 5 |
| `entityBattle` | 15 | 0 | 0 | 15 | 0 | 0 | 2 |
| `militaryView` | 60 | 11 | 0 | 40 | 8 | 1 | 12 |
| `showCityManagement` | 8 | 0 | 0 | 3 | 5 | 0 | 0 |
| `showCitySwitcher` | 10 | 0 | 0 | 3 | 7 | 0 | 0 |
| `showFamousPersons` | 8 | 0 | 0 | 3 | 5 | 0 | 0 |
| `showLogs` | 6 | 0 | 0 | 1 | 5 | 0 | 0 |
| `showResourceDetails` | 10 | 0 | 0 | 3 | 7 | 0 | 0 |
| `showSettings` | 7 | 0 | 0 | 1 | 6 | 0 | 0 |
| `showSubcityList` | 9 | 0 | 0 | 3 | 6 | 0 | 0 |
| `showTaskCenter` | 10 | 0 | 0 | 3 | 7 | 0 | 0 |

## Findings

| Symbol | File | Line | Role | Access | Evidence | Note |
| --- | --- | ---: | --- | --- | --- | --- |
| `activeEventId` | frontend/js/controllers/EventController.js | 11 | unknown | write | `this.activeEventId = null;` | write outside known owner/mirror path |
| `activeEventId` | frontend/js/controllers/EventController.js | 17 | unknown | write | `this.activeEventId = eventId;` | write outside known owner/mirror path |
| `activeEventId` | frontend/js/controllers/EventController.js | 22 | unknown | write | `this.activeEventId = null;` | write outside known owner/mirror path |
| `activeEventId` | frontend/js/controllers/EventController.js | 26 | consumer | read | `return Boolean(this.activeEventId);` | mode/panel state reference |
| `activeEventId` | frontend/js/controllers/EventController.js | 35 | consumer | read | `if (!this.activeEventId) return false;` | mode/panel state reference |
| `activeEventId` | frontend/js/controllers/EventController.js | 37 | consumer | read | `const eventData = (state.eventQueue \|\| []).find((item) => item.id === this.activeEventId);` | mode/panel state reference |
| `activeEventId` | frontend/js/controllers/EventController.js | 43 | consumer | read | `const result = await this.api.claimEvent(this.activeEventId, option.id);` | mode/panel state reference |
| `militaryView` | frontend/js/debug/CodexWorldMapDiag.js | 72 | consumer | read | `militaryView: state?.militaryView \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/debug/WorldMarchTrace.js | 248 | consumer | read | `militaryView: state.militaryView \|\| '',` | mode/panel state reference |
| `showSettings` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2120 | consumer | read | `showSettings: false,` | show* modal/panel flag candidate |
| `showLogs` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2121 | consumer | read | `showLogs: false,` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2122 | consumer | read | `showResourceDetails: false,` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2123 | consumer | read | `showCitySwitcher: false,` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2124 | consumer | read | `showSubcityList: false,` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2125 | consumer | read | `showCityManagement: false,` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2126 | consumer | read | `showTaskCenter: false,` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/ecs/runtime/EcsModeRuntimeBundle.js | 2127 | consumer | read | `showFamousPersons: false,` | show* modal/panel flag candidate |
| `showSettings` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 34 | consumer | read | `showSettings: false,` | show* modal/panel flag candidate |
| `showLogs` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 35 | consumer | read | `showLogs: false,` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 36 | consumer | read | `showResourceDetails: false,` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 37 | consumer | read | `showCitySwitcher: false,` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 38 | consumer | read | `showSubcityList: false,` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 39 | consumer | read | `showCityManagement: false,` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 40 | consumer | read | `showTaskCenter: false,` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/ecs/snapshot/RendererSnapshotBoundary.js | 41 | consumer | read | `showFamousPersons: false,` | show* modal/panel flag candidate |
| `armyFormationEditor` | frontend/js/platform/CanvasActionController.js | 1619 | unknown | write | `if (this.host && typeof this.host === 'object') this.host.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };` | write outside known owner/mirror path |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 194 | adapter | read | `&& (state?.currentTab \|\| host.activeTab) === 'military'` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 195 | adapter | read | `&& (state?.militaryView \|\| host.militaryView) === 'world');` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 340 | adapter | read | `militaryView: options.militaryView \|\| this.state.militaryView \|\| 'army',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 346 | adapter | read | `militaryView: options.militaryView \|\| this.state.militaryView \|\| 'army',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 349 | adapter | read | `militaryView: options.militaryView \|\| this.state.militaryView \|\| 'army',` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 351 | source-of-truth | read-write | `this.activeTab = initialHome.activeTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 352 | source-of-truth | read-write | `this.militaryView = initialHome.militaryView;` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 647 | adapter | read | `getRequestedTab: (state = this.state) => state?.currentTab \|\| this.activeTab \|\| 'resources',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 648 | adapter | read | `getMilitaryView: (state = this.state) => state?.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 678 | adapter | read | `requestedTab: this.state?.currentTab \|\| this.activeTab \|\| 'resources',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 679 | adapter | read | `militaryView: this.state?.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameApp.js | 820 | adapter | read | `if (this.entityBattle) return false;` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 896 | adapter | read | `const localMilitaryView = this.state?.militaryView \|\| this.militaryView \|\| nextState.militaryView \|\| 'army';` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 920 | source-of-truth | read-write | `this.activeTab = this.state.currentTab \|\| homeView.activeTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 921 | source-of-truth | read-write | `this.militaryView = this.state.militaryView \|\| homeView.militaryView;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 942 | adapter | read | `militaryView: this.state?.militaryView \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1015 | adapter | read | `const localMilitaryView = this.state?.militaryView \|\| this.militaryView \|\| 'army';` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1058 | source-of-truth | read-write | `this.activeTab = this.state.currentTab \|\| syncedHomeView.activeTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1059 | source-of-truth | read-write | `this.militaryView = this.state.militaryView \|\| syncedHomeView.militaryView;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1088 | adapter | read | `militaryView: this.state?.militaryView \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1286 | adapter | read | `militaryView: this.state?.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1291 | source-of-truth | write | `this.activeTab = resolvedActiveTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1299 | source-of-truth | read-write | `this.militaryView = homeView.militaryView;` | legacy owner candidate |
| `showResourceDetails` | frontend/js/platform/CanvasGameApp.js | 1371 | adapter | read | `showResourceDetails: panel.showResourceDetails,` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/CanvasGameApp.js | 1372 | adapter | read | `showCitySwitcher: panel.showCitySwitcher,` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/CanvasGameApp.js | 1373 | adapter | read | `showSubcityList: panel.showSubcityList,` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/platform/CanvasGameApp.js | 1374 | adapter | read | `showCityManagement: panel.showCityManagement,` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/CanvasGameApp.js | 1376 | adapter | read | `showTaskCenter: panel.showTaskCenter,` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/platform/CanvasGameApp.js | 1378 | adapter | read | `showFamousPersons: panel.showFamousPersons,` | show* modal/panel flag candidate |
| `armyFormationEditor` | frontend/js/platform/CanvasGameApp.js | 1382 | adapter | read | `armyFormationEditor: this.armyFormationEditor,` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameApp.js | 1401 | adapter | read | `...(this.entityBattle ? { entityBattle: this.entityBattle } : (snapshotEntityBattle ? { entityBattle: snapshotEntityBattle } : {})),` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1423 | adapter | read | `militaryView: state.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `showResourceDetails` | frontend/js/platform/CanvasGameApp.js | 1445 | adapter | read | `showResourceDetails: panel.showResourceDetails,` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/CanvasGameApp.js | 1446 | adapter | read | `showCitySwitcher: panel.showCitySwitcher,` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/CanvasGameApp.js | 1447 | adapter | read | `showSubcityList: panel.showSubcityList,` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/platform/CanvasGameApp.js | 1448 | adapter | read | `showCityManagement: panel.showCityManagement,` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/CanvasGameApp.js | 1450 | adapter | read | `showTaskCenter: panel.showTaskCenter,` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/platform/CanvasGameApp.js | 1452 | adapter | read | `showFamousPersons: panel.showFamousPersons,` | show* modal/panel flag candidate |
| `armyFormationEditor` | frontend/js/platform/CanvasGameApp.js | 1456 | adapter | read | `armyFormationEditor: this.armyFormationEditor,` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameApp.js | 1472 | adapter | read | `...(this.entityBattle ? { entityBattle: this.entityBattle } : (snapshotEntityBattle ? { entityBattle: snapshotEntityBattle } : {})),` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1640 | adapter | read | `militaryView: state.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1730 | adapter | read | `return this.activeTab \|\| this.state?.currentTab \|\| 'resources';` | mode/panel state reference |
| `armyFormationEditor` | frontend/js/platform/CanvasGameApp.js | 1860 | source-of-truth | write | `this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1883 | source-of-truth | read-write | `this.activeTab = homeView.activeTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1884 | source-of-truth | read-write | `this.militaryView = homeView.militaryView;` | legacy owner candidate |
| `armyFormationEditor` | frontend/js/platform/CanvasGameApp.js | 1902 | source-of-truth | write | `this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1938 | source-of-truth | read-write | `this.activeTab = navigation?.activeTab \|\| tab \|\| 'resources';` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1941 | adapter | read | `requestedTab: this.activeTab,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1942 | adapter | read | `militaryView: preferredMilitaryView \|\| this.state?.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1945 | source-of-truth | read-write | `this.activeTab = homeView.activeTab;` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1949 | adapter | read | `currentTab: this.activeTab,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1958 | source-of-truth | read-write | `this.militaryView = this.state.militaryView \|\| homeView.militaryView;` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1966 | adapter | read | `this.startPageTransition(previousTab, this.activeTab, { fromBuildingOffset: previousBuildingOffset });` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1978 | source-of-truth | write | `this.militaryView = allowed.includes(view) ? view : 'army';` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1979 | adapter | read | `this.mapHomeActive = this.militaryView === 'world' && this.resolveMapHomeViewState(this.state, {` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1980 | adapter | read | `requestedTab: this.state?.currentTab \|\| this.activeTab,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1981 | adapter | read | `militaryView: this.militaryView,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1984 | adapter | read | `StateWriter.commit(this, (prev) => ({ ...prev, militaryView: this.militaryView }), { source: 'switchMilitaryView' });` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 1992 | adapter | read | `requestedTab: this.state?.currentTab \|\| this.activeTab,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1993 | adapter | read | `militaryView: this.state?.militaryView \|\| this.militaryView,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 1996 | source-of-truth | write | `this.militaryView = 'world';` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 2002 | source-of-truth | write | `this.militaryView = view.activeView;` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 2026 | source-of-truth | read-write | `this.activeTab = homeView.activeTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 2027 | source-of-truth | read-write | `this.militaryView = homeView.militaryView;` | legacy owner candidate |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 2857 | source-of-truth | read-write | `this.activeTab = homeView.activeTab;` | legacy owner candidate |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 2858 | source-of-truth | read-write | `this.militaryView = homeView.militaryView;` | legacy owner candidate |
| `entityBattle` | frontend/js/platform/CanvasGameApp.js | 3123 | adapter | read | `if (routedInputRoute ? routedInputRoute === 'entity-battle' : (typeof this.isModeEntityBattleActive === 'function' ? this.isModeEntityBattleActive() : this.entityBattle?.visible)) {` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 3126 | adapter | read | `if (routedInputRoute ? routedInputRoute === 'tech-tree' : (typeof this.canRouteModeTechTree === 'function' ? this.canRouteModeTechTree() : this.activeTab === 'tech')) {` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 3133 | adapter | read | `} else if (this.activeTab !== 'military' \|\| this.militaryView !== 'world') return false;` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 3133 | adapter | read | `} else if (this.activeTab !== 'military' \|\| this.militaryView !== 'world') return false;` | mode/panel state reference |
| `armyFormationEditor` | frontend/js/platform/CanvasGameApp.js | 3165 | adapter | read | `\|\| this.armyFormationEditor?.open` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameApp.js | 3172 | adapter | read | `\|\| this.entityBattle?.visible` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameApp.js | 3179 | adapter | read | `if (routedInputRoute ? routedInputRoute === 'entity-battle' : (typeof this.isModeEntityBattleActive === 'function' ? this.isModeEntityBattleActive() : this.entityBattle?.visible)) {` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 3186 | adapter | read | `} else if (this.activeTab !== 'tech' \|\| this.hasBlockingOverlayOpen()) return false;` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 3198 | adapter | read | `} else if (this.activeTab !== 'military' \|\| this.militaryView !== 'world') return false;` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 3198 | adapter | read | `} else if (this.activeTab !== 'military' \|\| this.militaryView !== 'world') return false;` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 3211 | adapter | read | `this.renderCanvasSurface(this.state?.currentTab \|\| this.activeTab);` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameApp.js | 3254 | adapter | read | `currentTab: this.state?.currentTab \|\| this.activeTab \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameApp.js | 3255 | adapter | read | `militaryView: this.state?.militaryView \|\| this.militaryView \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameAppRenderPolicy.js | 7 | adapter | read | `const requestedMilitaryView = options.militaryView \|\| state?.militaryView \|\| 'army';` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 297 | adapter | read | `&& (state?.currentTab \|\| host.activeTab) === 'military'` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 298 | adapter | read | `&& (state?.militaryView \|\| host.militaryView) === 'world');` | mode/panel state reference |
| `armyFormationEditor` | frontend/js/platform/CanvasGameShell.js | 915 | adapter | read | `\|\| this.armyFormationEditor?.open` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameShell.js | 928 | adapter | read | `return Boolean((this.entityBattle \|\| this.lastGame?.entityBattle)?.visible);` | mode/panel state reference |
| `armyFormationEditor` | frontend/js/platform/CanvasGameShell.js | 992 | adapter | read | `\|\| this.armyFormationEditor?.open` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 1045 | adapter | read | `currentTab: this.lastGame?.state?.currentTab \|\| this.lastGame?.activeTab \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 1046 | adapter | read | `militaryView: this.lastGame?.state?.militaryView \|\| this.lastGame?.militaryView \|\| '',` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 1189 | adapter | read | `currentTab: this.lastGame?.state?.currentTab \|\| this.lastGame?.activeTab \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 1190 | adapter | read | `militaryView: this.lastGame?.state?.militaryView \|\| this.lastGame?.militaryView \|\| '',` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 1197 | adapter | read | `currentTab: this.lastGame?.state?.currentTab \|\| this.lastGame?.activeTab \|\| '',` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 1198 | adapter | read | `militaryView: this.lastGame?.state?.militaryView \|\| this.lastGame?.militaryView \|\| '',` | mode/panel state reference |
| `armyFormationEditor` | frontend/js/platform/CanvasGameShell.js | 1470 | mirror | write | `this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };` | legacy mirror candidate |
| `armyFormationEditor` | frontend/js/platform/CanvasGameShell.js | 1502 | mirror | write | `this.armyFormationEditor = { open: false, cityId: '', slot: 1, memberIds: [], soldierAssignments: {}, soldierDraftAssignments: {}, page: 0, saving: false };` | legacy mirror candidate |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 1513 | unknown | read-write | `if (game && 'activeTab' in game) game.activeTab = homeView.activeTab;` | write outside known owner/mirror path |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 1514 | unknown | read-write | `if (game && 'militaryView' in game) game.militaryView = homeView.militaryView;` | write outside known owner/mirror path |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2056 | adapter | read | `militaryView: state.militaryView \|\| this.lastGame?.militaryView,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2063 | adapter | read | `if (homeView.militaryView && state.militaryView !== homeView.militaryView) state = writeOwnedStateField(this, state, 'militaryView', homeView.militaryView, 'shellFrame:renderWorldMapLayer');` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 2166 | adapter | read | `\|\| this.lastGame?.activeTab` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2169 | adapter | read | `getMilitaryView: (state = this.lastGame?.state \|\| {}) => state.militaryView \|\| this.lastGame?.militaryView,` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 2206 | adapter | read | `\|\| this.lastGame?.activeTab` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2209 | adapter | read | `militaryView: state.militaryView \|\| this.lastGame?.militaryView,` | mode/panel state reference |
| `activeTab` | frontend/js/platform/CanvasGameShell.js | 2418 | adapter | read | `\|\| this.lastGame?.activeTab` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2423 | adapter | read | `militaryView: state.militaryView \|\| this.lastGame?.militaryView,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2442 | adapter | read | `const requestedMilitaryView = options.militaryView \|\| state?.militaryView \|\| 'army';` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2491 | adapter | read | `militaryView: state.militaryView \|\| this.lastGame?.militaryView,` | mode/panel state reference |
| `showSettings` | frontend/js/platform/CanvasGameShell.js | 2530 | adapter | read | `showSettings: panel.showSettings,` | show* modal/panel flag candidate |
| `showLogs` | frontend/js/platform/CanvasGameShell.js | 2531 | adapter | read | `showLogs: panel.showLogs,` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/platform/CanvasGameShell.js | 2532 | adapter | read | `showResourceDetails: panel.showResourceDetails,` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/CanvasGameShell.js | 2533 | adapter | read | `showCitySwitcher: panel.showCitySwitcher,` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/CanvasGameShell.js | 2534 | adapter | read | `showSubcityList: panel.showSubcityList,` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/platform/CanvasGameShell.js | 2535 | adapter | read | `showCityManagement: panel.showCityManagement,` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/CanvasGameShell.js | 2537 | adapter | read | `showTaskCenter: panel.showTaskCenter,` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/platform/CanvasGameShell.js | 2539 | adapter | read | `showFamousPersons: panel.showFamousPersons,` | show* modal/panel flag candidate |
| `armyFormationEditor` | frontend/js/platform/CanvasGameShell.js | 2543 | adapter | read | `armyFormationEditor: this.armyFormationEditor,` | mode/panel state reference |
| `entityBattle` | frontend/js/platform/CanvasGameShell.js | 2565 | adapter | read | `...((this.lastGame?.entityBattle \|\| this.entityBattle) ? { entityBattle: this.lastGame?.entityBattle \|\| this.entityBattle } : (snapshotEntityBattle ? { entityBattle: snapshotEntityBattle } : {})),` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2649 | adapter | read | `militaryView: state.militaryView \|\| this.lastGame?.militaryView,` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasGameShell.js | 2656 | adapter | read | `const needsMilitaryUpdate = Boolean(resolvedMilitaryView) && state.militaryView !== resolvedMilitaryView;` | mode/panel state reference |
| `showSettings` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 25 | consumer | read | `showSettings: 'modal:settings',` | show* modal/panel flag candidate |
| `showLogs` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 26 | consumer | read | `showLogs: 'modal:logs',` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 27 | consumer | read | `showResourceDetails: 'modal:resourceDetails',` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 28 | consumer | read | `showCitySwitcher: 'modal:citySwitcher',` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 29 | consumer | read | `showSubcityList: 'modal:subcityList',` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 30 | consumer | read | `showCityManagement: 'modal:cityManagement',` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 31 | consumer | read | `showTaskCenter: 'modal:taskCenter',` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/platform/CanvasModalSnapshotAdapter.js | 32 | consumer | read | `showFamousPersons: 'modal:famousPersons',` | show* modal/panel flag candidate |
| `militaryView` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 93 | consumer | read | `getStateHost(host)?.state?.militaryView \|\|` | mode/panel state reference |
| `militaryView` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 94 | consumer | read | `host?.state?.militaryView \|\|` | mode/panel state reference |
| `showSettings` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 348 | consumer | read | `showSettings: isOpen('modal:settings'),` | show* modal/panel flag candidate |
| `showLogs` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 349 | consumer | read | `showLogs: isOpen('modal:logs'),` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 350 | consumer | read | `showResourceDetails: isOpen('modal:resourceDetails'),` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 351 | consumer | read | `showCitySwitcher: isOpen('modal:citySwitcher'),` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 352 | consumer | read | `showSubcityList: isOpen('modal:subcityList'),` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 353 | consumer | read | `showCityManagement: isOpen('modal:cityManagement'),` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 354 | consumer | read | `showTaskCenter: isOpen('modal:taskCenter'),` | show* modal/panel flag candidate |
| `showFamousPersons` | frontend/js/platform/CanvasModeOwnershipRuntime.js | 355 | consumer | read | `showFamousPersons: isOpen('modal:famousPersons'),` | show* modal/panel flag candidate |
| `militaryView` | frontend/js/platform/WorldMapRuntimeCoordinator.js | 50 | consumer | read | `UiRuntimeStateStore?.getNavigation?.(this.host)?.militaryView \|\| state?.militaryView` | mode/panel state reference |
| `militaryView` | frontend/js/platform/WorldMapRuntimeCoordinator.js | 62 | consumer | read | `const requestedMilitaryView = viewOptions.militaryView \|\| state?.militaryView \|\| 'army';` | mode/panel state reference |
| `showResourceDetails` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 272 | consumer | read | `if (options.showResourceDetails) this.renderResourceDetailsPanel(state);` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 273 | consumer | read | `if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 274 | consumer | read | `if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 309 | consumer | read | `if (options.showSubcityList) this.renderSubcityListPanel(state, options);` | show* modal/panel flag candidate |
| `showCityManagement` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 310 | consumer | read | `if (options.showCityManagement) this.renderCityManagementPanel(state, options);` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 311 | consumer | read | `if (options.showResourceDetails) this.renderResourceDetailsPanel(state);` | show* modal/panel flag candidate |
| `showSettings` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 312 | consumer | read | `if (options.showSettings) this.renderSettingsPanel();` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 313 | consumer | read | `if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/renderers/CanvasFrameRenderer.js | 314 | consumer | read | `if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);` | show* modal/panel flag candidate |
| `showResourceDetails` | frontend/js/platform/renderers/HudOverlayCanvasRenderer.js | 165 | consumer | read | `if (options.showResourceDetails) {` | show* modal/panel flag candidate |
| `showSettings` | frontend/js/platform/renderers/HudOverlayCanvasRenderer.js | 168 | consumer | read | `if (options.showSettings) {` | show* modal/panel flag candidate |
| `showLogs` | frontend/js/platform/renderers/HudOverlayCanvasRenderer.js | 171 | consumer | read | `if (options.showLogs) {` | show* modal/panel flag candidate |
| `showCitySwitcher` | frontend/js/platform/renderers/HudOverlayCanvasRenderer.js | 174 | consumer | read | `if (options.showCitySwitcher) {` | show* modal/panel flag candidate |
| `showTaskCenter` | frontend/js/platform/renderers/HudOverlayCanvasRenderer.js | 177 | consumer | read | `if (options.showTaskCenter) {` | show* modal/panel flag candidate |
| `showSubcityList` | frontend/js/platform/renderers/MapCommandCanvasRenderer.js | 427 | consumer | read | `active: Boolean(options.showSubcityList),` | show* modal/panel flag candidate |
| `militaryView` | frontend/js/platform/renderers/MapCommandCanvasRenderer.js | 483 | consumer | read | `? { ...state, militaryView: state.militaryView === 'world' ? 'army' : (state.militaryView \|\| 'army') }` | renderer consumes mode/panel state |
| `showFamousPersons` | frontend/js/platform/renderers/TabBarCanvasRenderer.js | 85 | consumer | read | `const isActive = isActionTab ? Boolean(options.showFamousPersons) : id === visualActiveTab;` | show* modal/panel flag candidate |
| `militaryView` | frontend/js/platform/renderers/WorldMapLayerCanvasRenderer.js | 382 | consumer | read | `const activeView = ['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army';` | renderer consumes mode/panel state |
| `entityBattle` | frontend/js/state/BattleStore.js | 64 | adapter | write | `state.entityBattle = session && typeof session === 'object' ? session : null;` | mode/panel state reference |
| `entityBattle` | frontend/js/state/BattleStore.js | 65 | adapter | read | `return state.entityBattle;` | mode/panel state reference |
| `entityBattle` | frontend/js/state/BattleStore.js | 69 | adapter | write | `state.entityBattle = null;` | mode/panel state reference |
| `entityBattle` | frontend/js/state/BattleStore.js | 80 | adapter | read | `return state.entityBattle;` | mode/panel state reference |
| `entityBattle` | frontend/js/state/BattleStore.js | 86 | adapter | read | `Boolean(state.entityBattle?.visible),` | mode/panel state reference |
| `entityBattle` | frontend/js/state/BattleStore.js | 94 | adapter | read | `entityBattle: state.entityBattle,` | mode/panel state reference |
| `entityBattle` | frontend/js/state/BattleStore.js | 102 | adapter | read | `entityBattle: state.entityBattle,` | mode/panel state reference |
| `militaryView` | frontend/js/state/UiRuntimeStateStore.js | 115 | adapter | read | `if (owner.state.militaryView !== runtimeState.militaryView) {` | mode/panel state reference |
| `militaryView` | frontend/js/state/UiRuntimeStateStore.js | 139 | adapter | read | `\|\| sourceOwner.state?.militaryView` | mode/panel state reference |
| `militaryView` | frontend/js/state/UiRuntimeStateStore.js | 141 | adapter | read | `\|\| sourceHost.state?.militaryView` | mode/panel state reference |
| `militaryView` | frontend/js/state/presenters/MilitaryPresenter.js | 83 | adapter | read | `const requestedView = ['army', 'world', 'veteranCamp'].includes(state.militaryView) ? state.militaryView : 'army';` | mode/panel state reference |
| `militaryView` | frontend/js/state/presenters/ShellPresenter.js | 122 | adapter | read | `: (['army', 'scout', 'world', 'veteranCamp'].includes(state.militaryView) ? state.militaryView : 'army');` | mode/panel state reference |
