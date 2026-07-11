# 北极星 S7 验证记录(2026-07-12)

## E1|query 表最小集

query 表条目数: **2**。

| query 名 | `TutorialHostContext` 宿主实现 | 为什么配置表达不了 |
|---|---|---|
| `isTaskCenterOpen` | `TutorialHostContext.isTaskCenterOpen()` | 同一步键必须在“打开任务中心”和“领取指定任务奖励”之间按模态面状态分支；固定步键加固定 target 只能表达其中一支，target 在重绘期暂时缺失也不能替代业务状态。 |
| `isCommandPanelOpen` | `TutorialHostContext.isCommandPanelOpen(panel)` | 同一步键在指定面板打开前后必须选择不同表现；面板名虽是固定参数，但“当前是否已打开”是 UI 事实，不能由步键和固定 target 推出。 |

门禁:

- `TutorialHostContext.queries(...)` 只接受表内名字，不能借该入口调用任意宿主方法。
- 每个条目同时携带唯一宿主方法与非空 `justification`；单测核验条目数与理由一一对应。

定向验证:

```powershell
node --check frontend/js/tutorial/TutorialEngineQueryTable.js
node --check frontend/js/tutorial/TutorialHostContext.js
node --test frontend/js/tutorial/TutorialEngineQueryTable.test.js
git diff --check
```

结果:语法检查与 `git diff --check` 通过；测试数字原文:

```text
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## E2|StepScript runner 核心

实现:

- 纯引擎目录:`frontend/js/tutorial-engine/`。
- runner 输入:`{ stepKey, config, ctx }`；输出:`tutorial-step-projection/v1` 表现指令与确定性步级 trace。
- runner 不保存游标、上次结果或脚本执行位置；每次从步键、配置和当前 query 事实重新求值。
- `stepKeySource` 是构造参数；合成测试执行 `A -> B -> A`，第三次投影与第一次深等。
- 同一状态连续求值 17 次结果深等；外部修改一次返回投影后，下一次求值仍恢复配置原值。
- 有序 `when -> target` 子句在多个条件同时满足时固定选择第一条。

脚本类型预算: **3**。

| 类型 | 本阶段职责 |
|---|---|
| `highlightActionWait` | 按有序 declarative `when` 子句选择固定 target，输出高亮并等待事件。 |
| `ensureSurfaceThenHighlight` | 输出“确保指定 panel 表面后高亮固定 target”的表现指令。 |
| `waitEventThenNext` | 输出等待具名事件后推进到下一步的指令。 |

纯度门禁:

- `scripts/check-tutorial-engine-purity.js` 已进入 `scripts/run-architecture-smoke.js`。
- 生产文件只允许引擎目录内相对 import；测试文件额外允许 `node:` 内置模块。
- CommonJS `require('../platform/CanvasGameApp')` 与 ESM `import ... from '../platform/CanvasGameApp.js'` 两个合成探针均 FIRE。
- 实际门禁原文:`Tutorial engine purity check passed: 3 file(s), zero imports outside tutorial-engine.`

专项验证:

```powershell
node --test frontend/js/tutorial-engine/StepScriptRunner.test.js scripts/check-tutorial-engine-purity.test.js
node scripts/check-tutorial-engine-purity.js
```

测试数字原文:

```text
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 77.2223
```

完整 smoke:

```powershell
node scripts/run-architecture-smoke.js
```

测试数字与结尾原文:

```text
ℹ tests 1700
ℹ suites 0
ℹ pass 1700
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3832.4776
Tutorial engine purity check passed: 3 file(s), zero imports outside tutorial-engine.
[architecture-smoke] passed
```

freshness 随动:

- `northstar-s3-tutorial-host-surface.json` 仅新增 query 表源文件指纹，总数与分类仍为 `202`、`48/0/0/50/88/16`。
- `northstar-s5-tutorial-hit-target-types.json` 仅新增 query 表源文件指纹、刷新 `TutorialHostContext` 行号和哈希；注册点 `204`、已注册类型 `114`、教程类型 `29`、缺失类型 `0` 均不变。
- `TutorialHostContext.advanceTutorial` 既有命令所有权清单坐标从 `:500` 刷新为 `:513`；分类和迁移目标未变，`inventoryDriftFindings=0`。
