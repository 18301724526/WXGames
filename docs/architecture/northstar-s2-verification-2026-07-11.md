# 北极星 S2 验证记录(2026-07-11)

## U1|playtest 规范转录投影

实现证据:

- `scripts/playtest-online-tutorial.js` 的默认目标为 `local`，默认地址仅为 `http://127.0.0.1:8080/` 与 `http://127.0.0.1:3000/api`；`remote` 必须显式传入 `--target=remote --game-url=... --api-base=...`。
- 排除字段白名单为独立文件 `scripts/playtest-tutorial-transcript-exclusions.json`，投影实现 `scripts/playtest-tutorial-transcript.js` 在读取报告与证据后先应用该白名单，再生成 `{stepKey, actionType, targetType, panelKey}` 序列。
- 入库样例: `docs/architecture/artifacts/northstar-s2-tutorial-transcript.json`，43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`。

受控环境:

- 后端: 本地 `backend/server.js`，`http://127.0.0.1:3211`，隔离临时 SQLite 与临时已发布配置运行包。
- 前端: 本地 `scripts/local-preview-server.js`，`http://127.0.0.1:8181`，API 代理到上述后端。
- 健康检查: `/api/health` 返回 `configSource=active-release-bundle`、`bundleReady=true`、任务定义可用；`/.wxgame-deploy-status.json` 返回 `status=ready`。
- 双跑共同参数: `PLAYTEST_STRICT_VISUAL=0`、`PLAYTEST_MAX_ACTIONS=120`、`--target=local`、显式 loopback URL、`--transcript=<run-output>`。

双跑证据:

- Run 1: `2026-07-11T09-38-40-769Z`，43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`。
- Run 2: `2026-07-11T09-40-55-855Z`，43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`。
- 空差异命令:

```powershell
git diff --no-index --exit-code -- $env:TEMP\wxgames-s2-u1-local-ready\official-transcript-run1d.json $env:TEMP\wxgames-s2-u1-local-ready\official-transcript-run2.json
```

结果: exit 0，投影 diff 为空。

定向自验:

```powershell
node --check scripts/playtest-online-tutorial.js
node --check scripts/playtest-tutorial-transcript.js
node --check scripts/local-preview-server.js
node --test scripts/playtest-tutorial-transcript.test.js
git diff --check
```

结果: 转录模块 2/2 通过，语法检查与 `git diff --check` 通过；冻结三件套零差异。

### U1 单外交接

- 两次受控运行都在同一真实行为点停止: `famousCardViewed` 下准确命中且输入盾允许 `openArmyFormation(cityId=capital, slot=1)`，但 `armyFormationEditor.open` 仍为 false，步骤未推进。该产品行为不属于 S2，本单未修改产品教程实现。
- 名人详情与关闭按钮的金色像素门槛在本地截图中低于 24；正式转录使用 `PLAYTEST_STRICT_VISUAL=0` 保留 warning 而不让视觉判据中断语义轨迹。本单未调整视觉阈值或高亮实现。

## U2|规则清单机器导出

生成命令:

```powershell
node scripts/generate-tutorial-rule-inventory.js
```

产物: `docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json`。

- `TutorialGuideFlowRegistry.createDefaultRules()` 运行时产物 52 条，源码清单 52 条，ID 集合一致。
- `TutorialGuideEventRegistry.createDefaultHandlers()` 运行时产物 18 条，源码清单 18 条，事件名集合一致。
- Flow 清单逐条包含 `id`、`stepNames`、`kind`、`source`、`location`；事件清单逐条包含 `eventName`、`stepNames`、`kind`、`source`、`location`。
- 工厂来源统计: 手写 34 条、`makeTaskClaimPairRules` 10 条、`makeBuildRule` 4 条、`makeTabOpenRule` 4 条。

重生成零差异:

```powershell
git add -- docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json
node scripts/generate-tutorial-rule-inventory.js
git diff --exit-code -- docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json
```

结果: exit 0；重生成前后 SHA-256 均为 `27F501FA57DEF51D562187E2307A135425DB3C1CB7196E996746A3EC10EDAB9D`。

人工抽查 3 条:

- `era2-open-events`: 清单为 `stepNames=[eraAdvancedTo2]`、`kind=highlight:openCommandPanel`、`source=factory:makeTabOpenRule`、`TutorialGuideFlowRegistry.js:489`；源码该行确为 `makeTabOpenRule({`，参数中的 `id` 与步骤一致。
- `barracks-open-task-center`: 清单为 `stepNames=[era3Advanced]`、`kind=highlight:openTaskCenter`、`source=factory:makeTaskClaimPairRules`、`TutorialGuideFlowRegistry.js:554`；源码该行确为 `...makeTaskClaimPairRules({`，`openId` 与步骤一致。
- `scout-open-formation`: 清单为 `stepNames=[famousCardViewed]`、`kind=highlight:openArmyFormation`、`source=handwritten`、`TutorialGuideFlowRegistry.js:652`；源码该对象的 `id`、匹配步骤和高亮动作逐项一致。

定向自验:

```powershell
node --check scripts/generate-tutorial-rule-inventory.js
node --test scripts/generate-tutorial-rule-inventory.test.js
git diff --check
```

结果: 2/2 通过；监督者署名文档、产品 Registry 与冻结三件套零差异。

## U3|教程测试打标与收尾

枚举命令:

```powershell
node scripts/generate-tutorial-test-inventory.js
```

生成器对 `npm test` 的三个目录 `backend/tests`、`frontend/js`、`shared` 枚举全部 `.test.js`，逐文件构建本地 import/require 闭包；闭包源码中存在匹配 `/tutorial/i` 的 Identifier token 时纳入。以下 11 个 ECS 测试被机械排除:其闭包唯一教程标识符只是视觉资源键 `tutorial_intro_soldier`，不验证教程行为。完整排除路径写在机器清单的 `excludedIncidental` 字段。

产物: `docs/architecture/artifacts/northstar-s2-tutorial-test-inventory.json`。

- `npm test` 文件宇宙: 297。
- 教程相关文件: 143。
- `可复用`: 95。
- `退役候选`: 47，全部位于 backend，供 B3' declared 退役。
- `反特征`: 1，即 `frontend/js/tutorial/TutorialGuideArchitecture.test.js`。
- 产物 SHA-256: `C490AE54AA8A3744C3BBE930589BE7348B0077671E2FE40523F7F3E9E5BD22A0`。

重生成零差异:

```powershell
git add -- docs/architecture/artifacts/northstar-s2-tutorial-test-inventory.json
node scripts/generate-tutorial-test-inventory.js
git diff --exit-code -- docs/architecture/artifacts/northstar-s2-tutorial-test-inventory.json
```

结果: exit 0；重生成前后 SHA-256 相同。

测试零改动证据:

```powershell
git diff --diff-filter=M --name-only 1da45f9f -- '*.test.js'
```

结果: 空；U3 未修改任何既有测试文件，也未新增测试文件。

全量门禁:

```powershell
npm test
node scripts/run-architecture-smoke.js
```

结果:

- `npm test`: 297 个测试文件，2391/2391 通过，0 fail。
- `node scripts/run-architecture-smoke.js`: exit 0，最终输出 `[architecture-smoke] passed`，内含 `git diff --check` 通过。

## 未做

- 未修改 `TutorialGuideFlowRegistry`、`TutorialGuideEventRegistry`、`TutorialGuideController` 或任何产品教程实现。
- 未做 S3 的 ctx 适配、动态键扫描扩展、事件总线、target/action 表、引擎迁移或后端教程删除。
- 未修改任何既有测试；反特征测试本轮只打标，不改写。
- 未修改监督者署名的裁决、清查、路线图、任务单。
- 未修改冻结三件套。
- 未修复 U1 发现的 `openArmyFormation(slot=1)` 实际点击后编辑器未打开问题；未调整名人高亮像素阈值。
