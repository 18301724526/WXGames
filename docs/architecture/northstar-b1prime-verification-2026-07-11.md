# Northstar B1' Verification (2026-07-11)

## T1 - 名人发放改任务奖励

### 变更
- 新增 `backend/services/taskCenter/TaskRewardGrantLedger.js`，名人发放台账落到 `gameState.taskRewardGrants.famousPersons.scoutFamousPerson`。
- `TaskRewardClaimer` 直接调用 `FamousPersonService.grantTutorialScoutFamousPerson()`，再记录任务奖励台账。
- `TutorialGrantService.grantScoutFamousPerson()` 保留兼容外壳，只读台账返回兼容结果，不发放、不写 `tutorial.grants.scoutFamousPerson`。
- `TutorialSelectors.getTutorialScoutPersonId()` 改读任务奖励台账，并兼容旧档 `tutorial.grants.scoutFamousPerson`。

### 自验命令

```powershell
node --check backend/services/tutorial/TutorialActionValidator.js; node --check backend/services/taskCenter/TaskRewardGrantLedger.js; node --check backend/services/taskCenter/TaskRewardClaimer.js; node --check backend/services/tutorial/TutorialGrantService.js; node --check backend/services/tutorial/TutorialSelectors.js; node --check backend/services/GameStateNormalizer.js
```

结果: 通过。

```powershell
node --test backend/tests/TaskCenterService.test.js backend/tests/TutorialProgressService.test.js backend/tests/TutorialArchitecture.test.js backend/tests/TutorialSelectorsFormationLocation.test.js backend/tests/GameRoutesTutorial.test.js
```

结果: 55/55 通过。

```powershell
rg -n "gameState\.famousPeople\s*=" backend/services/tutorial backend/services/taskCenter --glob "*.js"
```

结果: 无命中(exit 1, expected)。

```powershell
rg -n "grantScoutFamousPerson|recordFirstArmyGrant|grantTutorialFirstCity|gameState\.famousPeople\s*=" backend/services/tutorial backend/services/taskCenter --glob "*.js"
```

结果: 仅命中保留的 `grantScoutFamousPerson` 兼容外壳、T2 待迁移的 `recordFirstArmyGrant`、B3' 待删除的 `grantTutorialFirstCity`; 未命中 `gameState.famousPeople =`。

```powershell
rg -n "(?:gameState|state)\.famousPeople\s*=" backend frontend shared scripts --glob "*.js"
```

豁免清单:
- `backend/services/FamousPersonService.js`: 名人集合正规归属；任务奖励实际新增写点为 `grantTutorialScoutFamousPerson()` 内的写入。
- `backend/services/GameStateNormalizer.js`: 规范化旧档/当前档，不是发放。
- `backend/services/GameStateMigrationPipeline.js`: 存档迁移，不是发放。
- `backend/services/realtime/WorldWorkerService.js`: worker 结果回写，不是任务奖励发放。
- `backend/services/territory/GarrisonCaptureResolver.js`: 俘虏招降路径，不是教程/任务奖励发放。
- `backend/tests/*` 与 `scripts/verify-step3-phase6-real-server.js`: 测试夹具或验证脚本。

### 交接
- `recordFirstArmyGrant` 仍在 `TutorialGrantService`，按任务单留给 T2。
- `grantTutorialFirstCity` 仍写 `tutorial.grants.firstExploreEmptyCity`，这是非价值发放的旧引导锚点，留给 B3' 后端教程删除单。

## T2 - 首军发放与兵力 floor 改键

### 变更
- `TaskRewardClaimer` 领取首军奖励前写 `gameState.taskRewardGrants.soldiers.firstArmy`，不再调用 `TutorialGrantService.recordFirstArmyGrant()`。
- `TutorialGrantService.recordFirstArmyGrant()` 保留兼容外壳，只转写新台账，不写 `tutorial.grants.firstArmy`。
- `TutorialSelectors.getFirstArmyReserveFloor()` 从任务奖励台账读取首军记录；旧档 `tutorial.grants.firstArmy` 采用双读兼容，读到后迁入内存台账。

### 自验命令

```powershell
node --check backend/services/taskCenter/TaskRewardGrantLedger.js; node --check backend/services/taskCenter/TaskRewardClaimer.js; node --check backend/services/tutorial/TutorialGrantService.js; node --check backend/services/tutorial/TutorialSelectors.js; node --check backend/services/MilitaryService.js
```

结果: 通过。

```powershell
node --test backend/tests/TaskCenterService.test.js backend/tests/MilitaryService.test.js backend/tests/GameRoutesTutorial.test.js backend/tests/TutorialArchitecture.test.js
```

结果: 44/44 通过。

```powershell
rg -n "tutorial\.grants|grants\.firstArmy" backend/services/MilitaryService.js
```

结果: 无命中(exit 1, expected)。

```powershell
rg -n "TutorialGrantService\.recordFirstArmyGrant|recordFirstArmyGrant\(" backend/services backend/tests --glob "*.js"
```

结果: 仅剩 `backend/services/tutorial/TutorialGrantService.js` 兼容外壳定义，无调用方。

### 旧档兼容取舍
- 采用双读兼容，不做存档清理: 新领取只写 `taskRewardGrants.soldiers.firstArmy`; 旧档若仍带 `tutorial.grants.firstArmy`，`getSoldierGrant()` 会读入并迁到内存台账。
- 覆盖测试: `normalizeMilitaryState reads legacy first-army tutorial grants into the task reward ledger`。

### 交接
- `getFirstArmyReserveFloor()` 仍沿用既有教程阶段窗口决定 floor 何时结束，T2 只迁移 floor 的发放记录键；真实状态条件改键在 T3 处理。

## T3 - 任务条件改真实状态

### 条件对照

| 任务 | 旧条件语义 | 新真实状态条件 |
|---|---|---|
| `main_barracks_supplies` | 城邦时代引导已推进 | `{ type: "eraAtLeast", era: 3 }` |
| `main_first_army` | 兵营引导已推进且兵营存在 | `{ type: "buildingLevel", buildingId: "barracks", count: 1 }` |
| `main_scout_officer` | 首军领取引导已推进 | `{ type: "taskRewardGranted", grantType: "soldiers", grantKey: "firstArmy" }` |

### 变更
- `defaultTaskDefinitions.json` 三处任务条件改为真实游戏状态/任务奖励台账。
- `TaskProgressEvaluator` 删除教程步条件分支，新增 `taskRewardGranted` 条件。
- `TaskDefinitionNormalizer` 删除教程步条件解析，新增 `taskRewardGranted` 的 `grantType/grantKey` 解析与校验。
- `TaskDefinitionTemplateBuilder` 增加 `condition.grantType`、`condition.grantKey`，保证模板导出再导入不丢条件。
- 更新 `tutorial-coupling-inventory-2026-07-11.md` 中已过期的任务中心旧条件记录。

### 自验命令

```powershell
node --check backend/services/taskCenter/TaskProgressEvaluator.js; node --check backend/services/taskDefinitions/TaskDefinitionNormalizer.js; node --check backend/services/taskDefinitions/TaskDefinitionTemplateBuilder.js
```

结果: 通过。

```powershell
node --test backend/tests/TaskDefinitionService.test.js backend/tests/TaskCenterService.test.js backend/tests/TaskCenterArchitecture.test.js backend/tests/GameRoutesTutorial.test.js
```

结果: 41/41 通过。

```powershell
rg -n "tutorialStepAtLeast" . --glob "!docs/architecture/northstar-b1prime-order-2026-07-11.md" --glob "!docs/architecture/tutorial-engine-northstar-roadmap-2026-07-11.md" --glob "!docs/architecture/northstar-b1prime-verification-2026-07-11.md" --glob "!node_modules/**"
```

结果: 无命中(exit 1, expected)。

豁免清单:
- `docs/architecture/northstar-b1prime-order-2026-07-11.md`: 本任务单原文。
- `docs/architecture/tutorial-engine-northstar-roadmap-2026-07-11.md`: 北极星路线图原文。
- `docs/architecture/northstar-b1prime-verification-2026-07-11.md`: 本验证文档内保留 grep 命令本身。
- `node_modules/**`: 第三方依赖目录。

### 契约测试
- 新条件类型满足/不满足/边界: `TaskProgressEvaluator evaluates task reward grant conditions`。
- 旧档不回退: `legacy first-army tutorial grant keeps the scout-officer task claimable for old saves`。
- 模板往返: `TaskDefinitionService can preview its template without doubling formula rewards`。

## T4 - 收尾验证
### 变更
- 补齐 `GameStateRepository` 对 `gameState.taskRewardGrants` 的持久化: 新库建表列、老库 `005-task-reward-grants-column` 迁移、读取解析、upsert 写入。
- 新增 `GameStateRepository persists task reward grants with the game state`，覆盖 `soldiers.firstArmy` 与 `famousPersons.scoutFamousPerson` 台账跨保存读取。

### 自验命令

```powershell
node --check backend/repositories/GameStateRepository.js
```

结果: 通过。

```powershell
node --test backend/tests/GameStateRepository.test.js backend/tests/TaskCenterService.test.js backend/tests/GameRoutesTutorial.test.js backend/tests/MilitaryService.test.js
```

结果: 82/82 通过。

```powershell
npm test
```

结果: 297 个测试文件，2391/2391 通过。

```powershell
node scripts/run-architecture-smoke.js
```

结果: 通过；末尾 `git diff --check` 通过。

### 真实本地服务领取流程
- 服务入口: `backend/server.js`。
- 临时运行目录: `C:\Users\18301\AppData\Local\Temp\wxgames-b1prime-t4-real-server-78I2mz`。
- 临时 config release: `20260711T002200594Z-6e10c57c7c30-43ce0d6e`，snapshotHash `6e10c57c7c30`。
- 登录: `test1`，HTTP 200。
- 领取链路: `main_barracks_supplies` HTTP 200 -> `main_first_army` HTTP 200 -> `main_scout_officer` HTTP 200。
- 最终 SQLite 读回: `food=260`、`knowledge=80`、`barracks.level=1`、`military.soldiers=1000`、`famousPeople.length=1`。
- `taskProgress.claimed` 键: `main_barracks_supplies`、`main_first_army`、`main_scout_officer`。
- `taskRewardGrants.soldiers.firstArmy`: `{ soldiers: 1000, grantedAt: '2026-07-11T00:22:01.613Z' }`。
- `taskRewardGrants.famousPersons.scoutFamousPerson`: `{ personId: 'fp_tutorial_scout_1st7bw9', grantedAt: '2026-07-11T00:22:01.639Z' }`。
- `tutorial.grants` 未重新承载本次两个奖励台账；仅保留既有 `firstExploreEmptyCity` 引导记录。

### 未做清单
- 未删除 `TutorialGrantService` 文件本体。
- 未触碰前端教程终态整改。
- 未预做路线图 S2 及后续步骤。
