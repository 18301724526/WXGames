# Step5 Tranche 1 Verification — 2026-07-11

状态: COMPLETE, STOP FOR REVIEW
分支: `main`
代码截止提交: `7af73bbd2f0912314625fc7ce9a7d183b3fc5d1f`

## 1. 范围结论

已完成:

- Part 0: 修复 Step4 Phase3 real-server evidence 包装层，断言改为从源 evidence 实测字段推导，并加入缺失来源字段即失败的自检。
- Tranche 1 Phase 0: 冻结 Step5 baseline，并记录本段选择的退休子集。
- Tranche 1 Phase 1: 接入 client action trace，trace metadata 不进入 idempotency digest。
- Tranche 1 Phase 2: 新增 `UiRuntimeStateStore` 和字段所有权清单，`activeTab` / `militaryView` / `armyFormationEditor` 收敛到 store-family 路径。
- Tranche 1 Phase 4 单切片: 仅迁移 `buildBuilding` / `upgradeBuilding` 到 action descriptor registry，验证新模式。

未做且未授权:

- Phase 3 / Phase 5 / Phase 6 / Phase 7。
- Phase 4 其余切片，包括 tech / territory / world march 等 action family。
- `resource-node`。
- 冻结的 `button-scheduler` 文件。

## 2. 提交记录

| 范围 | 提交 | 结果 |
| --- | --- | --- |
| Part 0 | `6979828d` | Step4 Phase3 evidence wrapper 改为实测来源字段，重新生成 evidence。 |
| Phase 0 | `37021255` | 新增 `step5-tranche1-phase0-baseline-2026-07-11.json`。 |
| Phase 1 | `10e8fa60` | command envelope / sender / dispatcher 接入 client action trace；digest 合同测试覆盖 trace 差异与 payload 差异。 |
| Phase 2 | `e7c8459b` | 新增 `UiRuntimeStateStore`、`UiRuntimeFieldOwnershipManifest.json`、字段所有权 blocking gate 和 FIRE 测试。 |
| Phase 4 单切片 | `7af73bbd` | 新增 building action descriptor registry，删除 controller 中已迁移的 building 分支，接入 dispatch registry 和 smoke gate。 |

## 3. Part 0 证据

证据文件: `docs/architecture/evidence/step4-phase3-real-server-2026-07-10.json`

实测摘要命令:

```text
node -e "const fs=require('fs'); const e=JSON.parse(fs.readFileSync('docs/architecture/evidence/step4-phase3-real-server-2026-07-10.json','utf8')); console.log(JSON.stringify({schema:e.schema,integrity:e.integrity,workerOwnershipAssertion:e.workerOwnership&&e.workerOwnership.assertion,assertion:e.assertion,assertionSourceKeys:Object.keys(e.assertionSources||{})}, null, 2));"
```

结果摘要:

- schema: `step4-phase3-real-server-evidence-v1`
- integrity 字段来自源 evidence: `stubFree`、`productionServer`、`productionWorker`、`productionRepositories`
- worker ownership 字段来自源 evidence: `workerForceSettleClosed`、`usesCommandExecutionPipeline`、`ownerLocksVerifiedBySourceEvidence`
- assertion source keys: `stubFree`、`productionServer`、`productionWorker`、`productionRepositories`、`workerForceSettleClosed`、`usesCommandExecutionPipeline`、`ownerLocksVerifiedBySourceEvidence`

FIRE 覆盖:

- `scripts/verify-step4-phase3-real-server.test.js`
- 缺少来源字段时失败。
- pipeline 实测字段不满足时失败。

## 4. Phase 0 baseline

baseline 文件: `docs/architecture/step5-tranche1-phase0-baseline-2026-07-11.json`

source commit: `6979828dbdb60c3d57cfbed479ca87d62696f1ac`

关键基线:

- domain-business findings: 544
- mode ownership findings: 242
  - `activeTab`: 42
  - `militaryView`: 67
  - `armyFormationEditor`: 23
- renderer authority findings: 174
  - `authority-write`: 2
- input branch findings: 161
  - `command-handler`: 137
- literal duplicate findings: 12552
  - `action-string`: 441
  - `registry-owned`: 813

选择的 Tranche 1 退休子集:

- UI runtime state: `activeTab` / `militaryView` / `armyFormationEditor`
- Phase 4 垂直切片: `buildBuilding` / `upgradeBuilding`

## 5. Phase 1 证据

实现内容:

- command envelope 分离 `payload` 与 client action trace metadata。
- dispatcher / sender 传递 `clientActionTrace`。
- idempotency digest 只看 payload，不看 trace metadata。

测试覆盖:

- `CommandEnvelope records client action trace without changing payload digest`
- `CommandIdempotencyStore replays the same payload with different client action trace`
- `CanvasActionDispatcher passes client action trace to command handlers`

## 6. Phase 2 证据

新增核心文件:

- `frontend/js/state/UiRuntimeStateStore.js`
- `frontend/js/state/UiRuntimeFieldOwnershipManifest.json`
- `scripts/check-ui-runtime-field-ownership.js`
- `scripts/check-ui-runtime-field-ownership.test.js`

字段所有权:

- `activeTab` -> `UiRuntimeStateStore`
- `militaryView` -> `UiRuntimeStateStore`
- `armyFormationEditor` -> `UiRuntimeStateStore`
- Modal/Battle/Territory 已有字段继续留在原 store，不被新 store 镜像。

FIRE 覆盖:

- 重复 owner 会失败。
- store 导出的字段与 manifest 不一致会失败。
- `UiRuntimeStateStore` 试图拥有 ECS simulation-like 字段会失败。
- 未批准的 host 字段直读会失败。

当前实测指标:

```text
node scripts/report-frontend-ecs-mode-ownership.js --summary
```

- findings: 219
- `activeTab`: 33
- `militaryView`: 65
- `armyFormationEditor`: 11

## 7. Phase 4 单切片证据

新增核心文件:

- `frontend/js/platform/CanvasActionDescriptorRegistry.js`
- `scripts/check-step5-action-descriptor-coverage.js`
- `scripts/check-step5-action-descriptor-coverage.test.js`

迁移范围:

- `buildBuilding`
- `upgradeBuilding`

descriptor 字段:

- `id`
- `actionType`
- `owner`
- `surface`
- `kind`
- `commandType`
- `payloadBuilder`
- `traceFields`
- `visualStateSource`

阻断规则:

- `buildBuilding` / `upgradeBuilding` descriptor 必须存在且字段完整。
- payload builder 必须输出 `{ buildingId }`。
- `CanvasActionController` 不得重新出现已迁移的 building 分支。
- `CanvasActionDispatchRegistry` 必须通过 descriptor 路由已迁移 action。

FIRE 覆盖:

- descriptor metadata 缺失会失败。
- payload builder 漂移会失败。
- controller 分支回流会失败。
- 未知 CLI 参数会失败。

实测命令:

```text
node scripts/check-step5-action-descriptor-coverage.js
```

结果:

- required actions: `buildBuilding`, `upgradeBuilding`
- required descriptor fields: 9
- violations: 0

当前 report-only 指标:

```text
node scripts/report-frontend-ecs-input-branch.js --summary
```

- findings: 160
- `command-handler`: 135

```text
node scripts/report-frontend-ecs-literal-duplicate.js --summary
```

- findings: 12611
- `action-string`: 439
- `registry-owned`: 835

与 Phase 0 baseline 对比:

- input branch findings: 161 -> 160
- `command-handler`: 137 -> 135
- `action-string`: 441 -> 439
- `registry-owned`: 813 -> 835

## 8. 门禁实测记录

Focused:

```text
node --test frontend/js/platform/CanvasActionControllerCity.test.js frontend/js/platform/CanvasActionDispatcher.test.js scripts/check-step5-action-descriptor-coverage.test.js scripts/check-frontend-command-semantics.test.js scripts/rewrite-frontend-asset-version.test.js
```

结果: 38 tests, 38 pass。

```text
node scripts/check-step5-action-descriptor-coverage.js
```

结果: violations 0。

```text
node scripts/check-command-owner-blocking-map.js
```

结果:

- mapped migrated inventory ids: 125
- expected migrated inventory ids: 125
- frontend command paths: 54
- violations: 0

```text
node scripts/check-step4-debt-catalog.js
```

结果:

- items: 20
- retired: 7
- classified-ui-local: 1
- remaining: 12
- violations: 0
- warnings: 0

Full:

```text
npm run test:architecture
```

结果: exit 0，architecture smoke passed。该命令同轮输出的 report-only 指标:

- mode ownership findings: 219
- domain business findings: 542
- renderer authority findings: 174, `authority-write`: 2
- input branch findings: 160, `command-handler`: 135
- literal duplicate findings: 12611, `action-string`: 439, `registry-owned`: 835
- command-owner Step1: contracts mapped 17/17, scanned frontend direct submits 53, inventory drift findings 0

```text
npm test
```

结果:

- test files: 296
- tests: 2382
- pass: 2382
- fail: 0

```text
npm run lint
```

结果: exit 0。

```text
git diff --check
```

结果: exit 0，无输出。

```text
git status --short
```

结果: 无输出。

## 9. 远端同步记录

Phase 4 code commit 已推送:

- `origin/main`: `7af73bbd2f0912314625fc7ce9a7d183b3fc5d1f`
- `private/main`: `7af73bbd2f0912314625fc7ce9a7d183b3fc5d1f`

`private` 推送命令本身超时，但随后用:

```text
git ls-remote private refs/heads/main
```

确认远端引用已落在 `7af73bbd2f0912314625fc7ce9a7d183b3fc5d1f`。

## 10. 停止点

Tranche 1 已完成到 owner 授权边界。下一步必须等待审查和 Tranche 2 授权；不得继续 Phase 3/5/6/7，也不得继续 Phase 4 其他 action family。

## 11. R-D4 漏报更正(A1)

更正:原 Tranche 1 验证文档漏报 R-D4 未完成项。实际未完成项为 `step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md` 仍保留"明显下降"式模糊判据，且当时未在验证结论中申报。

A1 已将 R-D4 判据改为数字目标和复跑命令:

- mode ownership: `activeTab` 42 -> 33、`militaryView` 67 -> 65、`armyFormationEditor` 23 -> 11；测量命令为 `node scripts/report-frontend-ecs-mode-ownership.js --summary`。
- renderer authority: `authority-write` baseline 2，退出目标为 0 或逐项源码级退休证据；测量命令为 `node scripts/report-frontend-ecs-renderer-authority.js --summary`。
- domain-business: baseline 544 total / 17 high / 24 medium；测量命令为 `node scripts/report-domain-business-candidates.js --summary`。
- input branch: `command-handler` 137 -> 135；测量命令为 `node scripts/report-frontend-ecs-input-branch.js --summary`。
- literal duplicate: baseline 12552 total，`action-string` 441 -> 439；测量命令为 `node scripts/report-frontend-ecs-literal-duplicate.js --summary`。

自验命令:

```text
Select-String -Path docs/architecture/step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md -Pattern '明显下降' -SimpleMatch
```

结果:matches 0。

```text
rg -n "42 -> 33|67 -> 65|23 -> 11|137 收敛到 135|12552|441 收敛到 439|authority-write.*2.*0|544.*17 high / 24 medium|node scripts/report-frontend-ecs-mode-ownership.js --summary|node scripts/report-frontend-ecs-input-branch.js --summary|node scripts/report-frontend-ecs-literal-duplicate.js --summary|node scripts/report-frontend-ecs-renderer-authority.js --summary|node scripts/report-domain-business-candidates.js --summary" docs/architecture/step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md
```

结果:命中 spec 第 264/417/418/419/485/486/575/576/577/578/579 行及既有 baseline 命令区。

未做/未达标:无。

## 12. A2 R-D1 边界与 StateWriter 修正

更正范围:

- `step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md` 的 Phase 2 节已写入 R-D1 边界原文。
- `UiRuntimeStateStore.syncOwnerState` 不再直接赋值 `owner.state.currentTab` / `owner.state.militaryView`，改为仅在值变化时经 `StateWriter.commit` 投影。
- `UiRuntimeStateStore` 文件头已声明 WeakMap 是 store 私有槽，`owner.state` 导航字段只是单向兼容投影，不是第二权威。

自验命令:

```text
rg -n "Boundary, to be stated verbatim in the spec and enforced|the ECS layer \(world/fog/|REAL bitecs only|StateWriter-committed stores|Any ECS-simulation field found" docs/architecture/step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md
```

结果:命中 spec 第 397/398/402 行。

```text
node --check frontend/js/state/UiRuntimeStateStore.js
```

结果:exit 0。

```text
node --test frontend/js/state/UiRuntimeStateStore.test.js frontend/js/state/StateWriter.test.js
```

结果:15 tests, 15 pass。

```text
node scripts/check-ui-runtime-field-ownership.js
```

结果:stores 4, fields 32, violations 0, warnings 0, passed。

```text
node scripts/check-frontend-single-source-redline.js
```

结果:files scanned 881, production files scanned 240, violations 0, passed。

```text
rg -n "owner\.state\.(currentTab|militaryView)\s*=" frontend scripts --glob '!frontend/js/state/StateWriter.js'
```

结果:matches 0。

```text
git diff --check -- docs/architecture/step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md frontend/js/state/UiRuntimeStateStore.js frontend/js/state/UiRuntimeStateStore.test.js
```

结果:exit 0。

未做/未达标:无。

## 13. A3 R-D2 绕行扫描覆盖全清单

更正范围:

- `BYPASS_SCAN_STORES` 已覆盖 `UiRuntimeStateStore`、`ModalStore`、`BattleStore`、`TerritoryUiStateStore`。
- 未扩展 `fieldAccessPattern` 或其它扫描正则形态；动态键写法仍留给后续 S3。
- `scripts/check-ui-runtime-field-ownership.test.js` 已加入 Modal/Battle/Territory 三类 store 的合成绕行 FIRE 测试。

存量白名单债(declared):

- 扩展扫描后首次实跑发现 ModalStore 存量违规 23 条，集中在 4 个文件:`frontend/js/config/LocaleTextRegistry.js`、`frontend/js/controllers/EventController.js`、`frontend/js/platform/renderers/OverlayCanvasRenderer.js`、`frontend/js/state/presenters/ShellPresenter.js`。
- A3 不做跨模块重构；上述 4 个文件已加入 `ModalStore.approvedCompatibilityFiles`。烧毁计划:后续 ModalStore/事件面收敛时逐文件移除兼容访问，删除对应白名单。

自验命令:

```text
node --test scripts/check-ui-runtime-field-ownership.test.js
```

结果:6 tests, 6 pass。

```text
node scripts/check-ui-runtime-field-ownership.js
```

结果:stores 4, fields 32, bypass scan stores `UiRuntimeStateStore, ModalStore, BattleStore, TerritoryUiStateStore`, violations 0, warnings 0, passed。

合成探针 FIRE:

```text
node scripts/check-ui-runtime-field-ownership.js
```

临时探针存在时结果:violations 3, FAILED。

- `frontend/js/platform/A3ModalBypassProbe.js:2` reads/writes `showLogs` outside `ModalStore`: `return host.showLogs;`
- `frontend/js/platform/A3BattleBypassProbe.js:2` reads/writes `entityBattle` outside `BattleStore`: `return game.entityBattle;`
- `frontend/js/platform/A3TerritoryBypassProbe.js:2` reads/writes `worldPanX` outside `TerritoryUiStateStore`: `return owner.worldPanX;`

探针还原后:

```text
git status --short -- frontend/js/platform/A3ModalBypassProbe.js frontend/js/platform/A3BattleBypassProbe.js frontend/js/platform/A3TerritoryBypassProbe.js
```

结果:无输出。

```text
node scripts/check-ui-runtime-field-ownership.js
```

结果:violations 0, warnings 0, passed。

```text
git diff --check -- scripts/check-ui-runtime-field-ownership.js scripts/check-ui-runtime-field-ownership.test.js frontend/js/state/UiRuntimeFieldOwnershipManifest.json
```

结果:exit 0。

未做/未达标:未重构 4 个 ModalStore 白名单文件；已按 A3 判据 declared 为存量债并写明烧毁计划。

## 14. B1 引导开关可逆语义

更正范围:

- `TutorialState.createInitialTutorialState` 不再因 `{ enabled: 0 }` 创建 completed/disabled 存档。
- `TutorialState.normalizeTutorialState` 不再因 `{ enabled: 0 }` 把活动教程存档改写成 completed/disabled。
- `TutorialProgressService.test.js` 加入 off/on 往返测试:中途以 `tutorialEnabled: 0` normalize，再以 `tutorialEnabled: 1` normalize，`currentStep`、`phaseCompleted`、`grants` 逐字节一致，并可继续 `manualAdvance`。

自验命令:

```text
node --check backend/services/tutorial/TutorialState.js
```

结果:exit 0。

```text
node --test backend/tests/TutorialProgressService.test.js
```

结果:23 tests, 23 pass。

```text
rg -n "createCompletedTutorialState\(\{.*disabled: true|isTutorialEnabled\(options\).*false|enabled: 0|force-disable|disabled by feature flag" backend/services/tutorial/TutorialState.js backend/tests/TutorialProgressService.test.js
```

结果:无命中。

```text
git diff --check -- backend/services/tutorial/TutorialState.js backend/tests/TutorialProgressService.test.js
```

结果:exit 0。

未做/未达标:无。

## 15. B2 引导开关单源 + 单解析器

更正范围:

- 后端唯一权威源登记在 `backend/config/GameConfig.js` 的 `features.tutorialEnabled: 1`。
- `backend/services/ClientGameStateAssembler.js` 将 `tutorialEnabled` 投影进客户端快照。
- 前端删除 `FEATURES.TUTORIAL_ENABLED` 配置源，只读服务端下发的 `state.tutorialEnabled`。
- 开关解析收敛到 `shared/featureFlags.js` 的 `parseFeatureFlagValue`；前端 `FeatureFlags.parseFlagValue` 仅保留为共享函数导出别名。
- 后端命令教程校验/推进走运行时门，关闭时不拦截、不推进、不把动作结果里的 tutorial 写回为推进态。

自验命令:

```text
node --check shared/featureFlags.js
node --check frontend/js/config/FeatureFlags.js
node --check frontend/js/debug/ClientOperationLog.js
node --check frontend/js/debug/WorldMarchTrace.js
node --check backend/application/commands/GameCommandStateSupport.js
node --check backend/services/ClientGameStateAssembler.js
```

结果:全部 exit 0。

```text
node --test frontend/js/config/FeatureFlags.test.js backend/tests/TutorialFeatureFlagProjection.test.js frontend/js/ui/H5GameHostSync.test.js
```

结果:6 tests, 6 pass。

```text
node scripts/check-frontend-script-manifest.js
```

结果:`[frontend-script-manifest] passed: 233 local scripts, 1 stylesheets`。

```text
node --test scripts/check-frontend-script-manifest.test.js
```

结果:4 tests, 4 pass。

```text
rg -n "function parseFeatureFlagValue|function parseFlagValue|const parseFlagValue|parseFlagValue\s*=" backend frontend shared scripts --glob "*.js"
```

结果:仅 `shared/featureFlags.js:4` 命中解析函数定义。

```text
rg -n "tutorialEnabled: 1|features\s*=|TUTORIAL_ENABLED" backend/config/GameConfig.js frontend/js/config/GameConfig.js frontend/js/config/FeatureFlags.js frontend/app.js frontend/js/platform/CanvasGameShell.js backend/services/ClientGameStateAssembler.js backend/application/commands/GameCommandStateSupport.js
```

结果:仅 `backend/config/GameConfig.js:28-29` 命中权威配置点。

```text
rg -n "TUTORIAL_ENABLED|FEATURES\.TUTORIAL_ENABLED|this\.config\?\.FEATURES\?\.TUTORIAL_ENABLED|config\?\.FEATURES\?\.TUTORIAL_ENABLED" frontend backend shared scripts --glob "*.js"
```

结果:无命中。

```text
rg -n "tutorialEnabled: parseFeatureFlagValue|GameConfig\.features\?\.tutorialEnabled|state\?\.tutorialEnabled|state\.tutorialEnabled" backend/services/ClientGameStateAssembler.js backend/application/commands/GameCommandStateSupport.js frontend/app.js frontend/js/platform/CanvasGameShell.js frontend/js/ecs/projection/GameState.js
```

结果:命中客户端投影、后端运行时门和前端投影消费点。

```text
git diff --check
```

结果:exit 0。

未做/未达标:无。

## 16. B3 引导运行时字段归属登记 + 禁直写

更正范围:

- 新增 `frontend/js/state/TutorialRuntimeStore.js`，登记 `TUTORIAL_ENABLED`、`tutorialIntro`、`tutorialAdvisorDialogue`、`tutorialHighlight` 的 owner。
- `UiRuntimeFieldOwnershipManifest.json` 新增 `TutorialRuntimeStore`，绕行扫描集合同步包含该 store。
- `frontend/app.js` 删除 `disableTutorialRuntime` 和 `getDisabledTutorialState`，关闭时只通过 `isTutorialEnabled()` 在 `applyApiState` / `applyState` / intro 创建入口短路。
- `frontend/app.js` 不再直写 `state.tutorial`，也不再清理 `canvasShell.tutorialIntro` / `canvasShell.tutorialAdvisorDialogue` / `canvasShell.tutorialHighlight`。

自验命令:

```text
node --check frontend/app.js
node --check frontend/js/state/TutorialRuntimeStore.js
node --check scripts/check-ui-runtime-field-ownership.js
```

结果:全部 exit 0。

```text
node --test scripts/check-ui-runtime-field-ownership.test.js frontend/js/ui/H5GameHostSync.test.js
```

结果:8 tests, 8 pass。

```text
node scripts/check-ui-runtime-field-ownership.js
```

结果:stores 5, fields 36, bypass scan stores `UiRuntimeStateStore, ModalStore, BattleStore, TerritoryUiStateStore, TutorialRuntimeStore`, violations 0, warnings 0, passed。

```text
rg -n "disableTutorialRuntime" frontend backend shared scripts --glob "*.js"
```

结果:无命中。

```text
rg -n "state\.tutorial\s*=|canvasShell\.tutorial(Intro|AdvisorDialogue|Highlight)\s*=|this\.tutorial(Intro|AdvisorDialogue|Highlight)\s*=\s*null" frontend/app.js
```

结果:无命中。

合成探针 FIRE:

```text
node scripts/check-ui-runtime-field-ownership.js
```

临时 `frontend/js/platform/B3TutorialBypassProbe.js` 存在时结果:violations 1, FAILED。

- `frontend/js/platform/B3TutorialBypassProbe.js:2` reads/writes `tutorialHighlight` outside `TutorialRuntimeStore`: `return shell.tutorialHighlight;`

探针还原后:

```text
git status --short -- frontend/js/platform/B3TutorialBypassProbe.js
```

结果:无输出。

```text
node scripts/check-ui-runtime-field-ownership.js
```

结果:violations 0, warnings 0, passed。

```text
git diff --check
```

结果:exit 0。

未做/未达标:未重构既有 tutorial runtime 兼容访问；已通过 `TutorialRuntimeStore.approvedCompatibilityFiles` 登记为过渡期兼容面，后续 S3/S9c 按路线图收敛或删除。

## 17. B4 还原被迁就测试 + 全量验证

更正范围:

- `backend/tests/GameStateServiceSplit.test.js` 还原为默认教程开启语义，不再改名、注入 `tutorialEnabled: 1` 或绕到 `getClientGameStateFromNormalized`。
- `backend/tests/CommandRouteMigration.test.js` 删除被迁就的 `currentEra = 1`。
- `backend/tests/GameRoutesTutorial.test.js` 与 `scripts/command-owner-step1/inventories.js` 的未提交 WIP 已还原，未进入 B4 提交。
- `FeatureFlags.resolve` 未知键契约选择恢复透传兼容；仅已知 `DEFAULTS` 键走共享布尔解析。
- `scripts/rewrite-frontend-asset-version.test.js` 的 fixture 补齐 `shared/featureFlags.js`，使架构 smoke 的 manifest guard 覆盖新必需共享脚本。

自验命令:

```text
git diff 92a81298 -- backend/tests/CommandRouteMigration.test.js backend/tests/GameStateServiceSplit.test.js
```

结果:无输出，两个点名测试文件相对 `92a81298` diff 归零。

```text
git diff -- backend/tests/CommandRouteMigration.test.js backend/tests/GameRoutesTutorial.test.js backend/tests/GameStateServiceSplit.test.js scripts/command-owner-step1/inventories.js
```

结果:无输出。

```text
node --check frontend/js/config/FeatureFlags.js
```

结果:exit 0。

```text
node --test frontend/js/config/FeatureFlags.test.js
```

结果:4 tests, 4 pass。

```text
node --test backend/tests/GameStateServiceSplit.test.js backend/tests/CommandRouteMigration.test.js backend/tests/GameRoutesTutorial.test.js
```

结果:35 tests, 35 pass。

```text
node --test scripts/rewrite-frontend-asset-version.test.js
```

结果:5 tests, 5 pass。

```text
git diff --check
```

结果:exit 0。

全量验证:

```text
npm test
```

结果:297 all test files, 2387 tests, 2387 pass, exit 0。

```text
node scripts/run-architecture-smoke.js
```

结果:exit 0，`[architecture-smoke] passed`。

未做/未达标:无。
