# Frontend ECS 0A Mode/Bridge Inventory - 2026-06-25

## Scope

This is Batch 0A only. It inventories mode booleans and bridge/prototype surfaces before any frontend ECS migration starts.

No runtime behavior was migrated. No ECS dependency was introduced.

## Machine Baselines

| Baseline                | Path                                                                          | Command                                                         |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Mode ownership baseline | `docs/development_logs/2026-06-25-frontend-ecs-0a-mode-ownership-baseline.md` | `node scripts/report-frontend-ecs-mode-ownership.js --markdown` |
| Bridge shrink baseline  | `docs/development_logs/2026-06-25-frontend-ecs-0a-bridge-shrink-baseline.md`  | `node scripts/report-frontend-ecs-bridge-shrink.js --markdown`  |

## Mode Summary

The report-only guard scanned 213 production frontend files under `frontend/js`, excluding `vendor` and test files.

| Metric                     | Value |
| -------------------------- | ----: |
| Total findings             |   960 |
| Symbols detected           |    25 |
| Source-of-truth candidates |    15 |
| Mirror candidates          |    70 |
| Adapter references         |   427 |
| Consumer references        |   204 |
| Unknown writes/references  |   254 |

| Symbol                   | Findings | Source-of-truth | Mirror | Adapter | Consumer | Unknown | Writes |
| ------------------------ | -------: | --------------: | -----: | ------: | -------: | ------: | -----: |
| `activeTab`              |      215 |               1 |      1 |     132 |       72 |       9 |     11 |
| `militaryView`           |      106 |               1 |      4 |      70 |       13 |      18 |     23 |
| `activeEventId`          |       74 |               1 |     11 |      17 |       11 |      34 |     49 |
| `entityBattle`           |       73 |               0 |      2 |      19 |       50 |       2 |      4 |
| `naming`                 |       55 |               1 |      6 |      30 |       12 |       6 |     13 |
| `armyFormationEditor`    |       47 |               1 |      6 |      19 |        4 |      17 |     25 |
| `showCityManagement`     |       46 |               1 |      7 |      15 |        1 |      22 |     32 |
| `showFamousPersons`      |       43 |               1 |      6 |      13 |        5 |      18 |     26 |
| `showSubcityList`        |       37 |               1 |      5 |      13 |        2 |      16 |     23 |
| `showTaskCenter`         |       37 |               1 |      5 |      14 |        4 |      13 |     20 |
| `showAdvisor`            |       29 |               0 |      5 |      10 |        4 |      10 |     17 |
| `rewardReveal`           |       27 |               1 |      1 |      14 |        3 |       8 |     10 |
| `showCitySwitcher`       |       24 |               1 |      1 |       7 |        3 |      12 |     14 |
| `techDetailOpen`         |       24 |               2 |      5 |       6 |        2 |       9 |     16 |
| `showFpsOverlay`         |       20 |               0 |      0 |       9 |       10 |       1 |      1 |
| `showResourceDetails`    |       20 |               1 |      1 |       7 |        3 |       8 |     10 |
| `showGuidebook`          |       19 |               1 |      1 |       7 |        3 |       7 |      9 |
| `confirmDialog`          |       16 |               0 |      1 |       9 |        3 |       3 |      4 |
| `showSettings`           |       13 |               0 |      1 |       5 |        3 |       4 |      5 |
| `showLogs`               |       12 |               0 |      1 |       5 |        1 |       5 |      6 |
| `showActionResult`       |        9 |               0 |      0 |       9 |        0 |       0 |      0 |
| `showFamousSkillTooltip` |        6 |               0 |      0 |       2 |        4 |       0 |      0 |
| `showModal`              |        6 |               0 |      0 |       2 |        4 |       0 |      0 |
| `showCraftsman`          |        1 |               0 |      0 |       1 |        0 |       0 |      0 |
| `showKeyboard`           |        1 |               0 |      0 |       0 |        1 |       0 |      0 |

## Mode Owner Hotspots

These rows are the human review entry points. The complete file/line table is in the mode ownership baseline.

| Symbol                | File                                                      | Line | Role            | Access     | Evidence                                                                  | Note                                          |
| --------------------- | --------------------------------------------------------- | ---: | --------------- | ---------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| `activeTab`           | `frontend/js/platform/CanvasGameApp.js`                   |   91 | source-of-truth | read-write | `this.activeTab = initialHome.activeTab;`                                 | Legacy app-level owner candidate              |
| `militaryView`        | `frontend/js/platform/CanvasGameApp.js`                   |   92 | source-of-truth | read-write | `this.militaryView = initialHome.militaryView;`                           | Legacy app-level owner candidate              |
| `showResourceDetails` | `frontend/js/platform/CanvasGameApp.js`                   |   99 | source-of-truth | write      | `this.showResourceDetails = false;`                                       | Legacy panel owner candidate                  |
| `showCitySwitcher`    | `frontend/js/platform/CanvasGameApp.js`                   |  100 | source-of-truth | write      | `this.showCitySwitcher = false;`                                          | Legacy panel owner candidate                  |
| `showSubcityList`     | `frontend/js/platform/CanvasGameApp.js`                   |  101 | source-of-truth | write      | `this.showSubcityList = false;`                                           | Legacy panel owner candidate                  |
| `showCityManagement`  | `frontend/js/platform/CanvasGameApp.js`                   |  102 | source-of-truth | write      | `this.showCityManagement = false;`                                        | Legacy panel owner candidate                  |
| `showTaskCenter`      | `frontend/js/platform/CanvasGameApp.js`                   |  104 | source-of-truth | write      | `this.showTaskCenter = false;`                                            | Legacy modal/panel owner candidate            |
| `showGuidebook`       | `frontend/js/platform/CanvasGameApp.js`                   |  106 | source-of-truth | write      | `this.showGuidebook = false;`                                             | Legacy modal/panel owner candidate            |
| `showFamousPersons`   | `frontend/js/platform/CanvasGameApp.js`                   |  108 | source-of-truth | write      | `this.showFamousPersons = false;`                                         | Legacy modal/panel owner candidate            |
| `armyFormationEditor` | `frontend/js/platform/CanvasGameApp.js`                   |  111 | source-of-truth | write      | `this.armyFormationEditor = { open: false, ... };`                        | Formation editor legacy owner candidate       |
| `rewardReveal`        | `frontend/js/platform/CanvasGameApp.js`                   |  113 | source-of-truth | write      | `this.rewardReveal = null;`                                               | Reward modal legacy owner candidate           |
| `techDetailOpen`      | `frontend/js/platform/CanvasGameApp.js`                   |  129 | source-of-truth | write      | `this.techDetailOpen = false;`                                            | Tech detail panel legacy owner candidate      |
| `activeEventId`       | `frontend/js/platform/CanvasGameShell.js`                 |  168 | mirror          | write      | `this.activeEventId = null;`                                              | Shell mirror / modal candidate                |
| `confirmDialog`       | `frontend/js/platform/CanvasGameShell.js`                 |  203 | mirror          | write      | `this.confirmDialog = null;`                                              | Shell system-modal candidate                  |
| `armyFormationEditor` | `frontend/js/platform/CanvasGameAppCommands.js`           |  216 | unknown         | write      | `this.armyFormationEditor = next;`                                        | Command bridge writes formation editor state  |
| `armyFormationEditor` | `frontend/js/platform/CanvasGameAppCommands.js`           |  218 | mirror          | write      | `this.canvasShell.armyFormationEditor = { ...this.armyFormationEditor };` | App-to-shell mirror sync                      |
| `activeEventId`       | `frontend/js/platform/CanvasCityActionHandlers.js`        |   75 | unknown         | write      | `this.host.activeEventId = action.eventId;`                               | Action handler writes modal/event state       |
| `showTaskCenter`      | `frontend/js/platform/CanvasCityActionHandlers.js`        |  106 | unknown         | write      | `this.host.showTaskCenter = true;`                                        | Action handler opens task center directly     |
| `activeEventId`       | `frontend/js/tutorial/TutorialGuideUiStateCoordinator.js` |  151 | adapter         | write      | `game.activeEventId = null;`                                              | Tutorial directly mutates legacy state        |
| `showCityManagement`  | `frontend/js/tutorial/TutorialGuideUiStateCoordinator.js` |  168 | adapter         | write      | `game.showCityManagement = true;`                                         | Tutorial directly opens city-management state |

## Bridge Summary

The bridge report-only guard scanned the same 213 production frontend files.

| Metric                             | Value |
| ---------------------------------- | ----: |
| Bridge candidates                  |    39 |
| Object.assign prototype installers |    21 |
| Direct prototype assignments       |     1 |
| Facade/bridge file surfaces        |    17 |
| Branch tokens inside candidates    |  1911 |

## Bridge Hotspots

The complete bridge table, including fields and methods, is in the bridge shrink baseline.

| Bridge                                                      | File                                                           | Line | Installer/Surface                 | Fields                                        | Methods                                      | Branch Count | Role    | Retirement Target                               | Note                               |
| ----------------------------------------------------------- | -------------------------------------------------------------- | ---: | --------------------------------- | --------------------------------------------- | -------------------------------------------- | -----------: | ------- | ----------------------------------------------- | ---------------------------------- |
| `CanvasActionController.prototype`                          | `frontend/js/platform/CanvasCityActionHandlers.js`             |   20 | Object.assign prototype installer | city/modal/panel fields                       | city, event, task, tech handlers             |           73 | bridge  | ECS city/modal systems                          | Prototype augmentation surface     |
| `CanvasGameApp.prototype`                                   | `frontend/js/platform/CanvasGameAppCommands.js`                |   41 | Object.assign prototype installer | app, formation, modal, world march fields     | command and formation methods                |           84 | bridge  | ECS command intent and formation systems        | Prototype augmentation surface     |
| `CanvasGameApp.prototype`                                   | `frontend/js/platform/CanvasGameAppRenderingRuntime.js`        |   36 | Object.assign prototype installer | render, panel, map-home, transition fields    | render scheduling and view switching methods |          108 | bridge  | ECS snapshot/mode systems plus renderer adapter | Large runtime bridge               |
| `CanvasGameApp.prototype`                                   | `frontend/js/platform/CanvasGameAppStateSync.js`               |   28 | Object.assign prototype installer | state, heartbeat, active tab, tutorial fields | sync/apply state methods                     |           63 | bridge  | ECS network/snapshot ingestion systems          | State sync bridge                  |
| `CanvasGameShell.prototype`                                 | `frontend/js/platform/CanvasGameShellCommands.js`              |   20 | Object.assign prototype installer | shell panel, formation, command fields        | shell command forwarding methods             |           55 | bridge  | ECS shell bridge and command adapter            | Shell mirror surface               |
| `CanvasGameShell.prototype`                                 | `frontend/js/platform/CanvasGameShellRendering.js`             |   31 | Object.assign prototype installer | renderer, map, modal, tutorial fields         | render orchestration methods                 |           64 | bridge  | ECS snapshot systems and platform adapter       | Shell render bridge                |
| `CanvasActionController.prototype`                          | `frontend/js/platform/CanvasShellActionHandlers.js`            |   20 | Object.assign prototype installer | shell modal/panel fields                      | shell action handlers                        |           66 | bridge  | ECS modal/panel systems                         | Shell action bridge                |
| `CanvasActionController.prototype`                          | `frontend/js/platform/CanvasTerritoryActionHandlers.js`        |  204 | Object.assign prototype installer | world-map command and drag fields             | territory/world march handlers               |          132 | bridge  | ECS world-map/input/command systems             | High-risk world-map bridge         |
| `CanvasTerritoryActionHandlers`                             | `frontend/js/platform/CanvasTerritoryActionHandlers.js`        |    1 | facade/bridge file surface        | territory/world-map fields                    | territory helper and handler surface         |          173 | adapter | ECS world-map/input/command systems             | Largest branch count               |
| `WorldMapRendererHostBridge`                                | `frontend/js/platform/renderers/WorldMapRendererHostBridge.js` |    1 | facade/bridge file surface        | renderer                                      | proxy get/set methods                        |           11 | adapter | Renderer snapshot adapter                       | Renderer-host compatibility bridge |
| `UIStatePresenterDelegates`                                 | `frontend/js/state/UIStatePresenterDelegates.js`               |    1 | facade/bridge file surface        | none                                          | presenter delegate installers                |            6 | adapter | ECS snapshot composition systems                | Presenter compatibility surface    |
| `TutorialGuideController.prototype.refreshCurrentHighlight` | `frontend/js/tutorial/TutorialGuidePhaseHighlights.js`         |   16 | direct prototype assignment       | flow registry                                 | highlight refresh                            |            3 | bridge  | ECS tutorial focus system                       | Direct prototype patch             |

## Deterministic Conclusions

- The current frontend still has no single mode owner. Mode/panel state is split across app fields, shell mirrors, action handlers, tutorial coordinators, presenters, and renderers.
- The most important old-owner cluster is `CanvasGameApp` plus `CanvasGameShell` mirror fields.
- The largest bridge risk is not only renderer facades. Prototype installation in action, rendering, sync, and shell modules is a stronger partial-adoption risk.
- `activeTab`, `militaryView`, `activeEventId`, `armyFormationEditor`, and task/city/famous panel booleans are the first state facts that need Batch 3/5 ownership sealing.
- Report-only guards now provide a reproducible baseline. Future work can distinguish historical debt from new violations.

## 0A Acceptance State

State: `Ready for Migration Owner Review`.

Not completed yet, because migration owner review and sign-off are still pending.
