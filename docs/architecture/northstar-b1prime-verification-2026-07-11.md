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
