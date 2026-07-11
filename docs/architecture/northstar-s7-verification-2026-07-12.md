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

## E3|本段配置

配置文件:`frontend/js/tutorial-config/TaskPanelStepScripts.js`。

- 步键数:**10**。
- 唯一规则 ID 数:**14**；`final-tech-open` 同时服务于 `famousSeekCompleted` 与 `finalTechOpened`，规则 ID 出现总数为 **15**。
- 配置只含冻结字面数据:`type`、E1 query 名、`ruleId`、`target`、`messageKey`、`eventName`、`panel` 与 query 参数；零内联谓词、零函数。

对应关系:

| S2 规则 ID | 配置项 |
|---|---|
| `first-era-open-task-center` | `eraAdvancedTo1.clauses[0]` |
| `first-era-claim-supplies` | `eraAdvancedTo1.clauses[1]` |
| `era2-open-civilization` | `era2AdvanceReady` |
| `era2-open-events` | `eraAdvancedTo2` |
| `lumbermill-open-task-center` | `lumbermillBuilt.clauses[0]` |
| `lumbermill-claim-task` | `lumbermillBuilt.clauses[1]` |
| `era3-open-civilization` | `era3AdvanceReady` |
| `barracks-open-task-center` | `era3Advanced.clauses[0]` |
| `barracks-claim-supplies` | `era3Advanced.clauses[1]` |
| `first-army-open-task-center` | `barracksBuilt.clauses[0]` |
| `first-army-claim` | `barracksBuilt.clauses[1]` |
| `scout-officer-open-task-center` | `firstArmyClaimed.clauses[0]` |
| `scout-officer-claim` | `firstArmyClaimed.clauses[1]` |
| `final-tech-open` | `famousSeekCompleted`、`finalTechOpened` |

纯度门禁:

- `scripts/check-tutorial-step-config-purity.js` 已进入 `scripts/run-architecture-smoke.js`。
- 递归核验全部对象与数组均冻结，任何函数、内联 `predicate`、未知字段或表外 query 均 FIRE。
- 规则 ID 集合必须与本段 14 条 S2 规则精确一致。
- 实际门禁原文:`Tutorial StepScript config purity check passed: 10 step key(s), 14 rule id(s), zero functions.`

专项验证:

```powershell
node --check frontend/js/tutorial-config/TaskPanelStepScripts.js
node --check scripts/check-tutorial-step-config-purity.js
node --test frontend/js/tutorial-config/TaskPanelStepScripts.test.js scripts/check-tutorial-step-config-purity.test.js
node scripts/check-tutorial-step-config-purity.js
git diff --check
```

测试数字原文:

```text
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 51.0973
```

完整 smoke 测试数字与结尾原文:

```text
ℹ tests 1706
ℹ suites 0
ℹ pass 1706
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4312.1244
[architecture-smoke] passed
```

## E4|分治接线与核销

分治边界:

```text
TutorialHostContext.refreshCurrentHighlight
├─ 非配置步键 -> 剩余 FlowRegistry
└─ 10 个配置步键
   ├─ StepScriptRunner 从当前步键与 query 事实重新求值
   ├─ 记录该步 count/first/last trace
   ├─ advisor/reward overlay 开启 -> 保持旧全局规则优先
   ├─ projection 有 instruction -> ctx.requestAction 回落宿主表现方法
   └─ projection 为空 -> 剩余 FlowRegistry
```

- runner 有匹配指令但实际 target 暂不可用时，不尝试后续旧规则；这与旧注册表“首个 matches 命中即停止”的行为一致。
- 配置步键的空投影回落只用于保留本段范围外的同键 residual:`era2-advance`、`era2-open-forest-event`、`era2-claim-forest-event`、`era3-advance`、`final-tech-soft-guide`。
- 全局 `advisor-open`、`reward-reveal-open` 仍高于本段表现指令，避免在遮挡层下绘制不可点击高亮。
- `ctx.requestAction` 本阶段允许调用 `showHighlight`、`prepareCommandPanelGuide`、`hideTutorialHighlight` 等遗留宿主方法；descriptor 置换留待后续任务。
- trace 为 `tutorial-step-script-trace/v1`，按步键累计 `count`、`first`、`last`，不会因后续步骤增加而丢弃早期记录。

逐规则核销:

| S2 规则 ID | 配置归属 | FlowRegistry 删除 |
|---|---|---|
| `first-era-open-task-center` | `eraAdvancedTo1.clauses[0]` | 是 |
| `first-era-claim-supplies` | `eraAdvancedTo1.clauses[1]` | 是 |
| `era2-open-civilization` | `era2AdvanceReady` | 是 |
| `era2-open-events` | `eraAdvancedTo2` | 是 |
| `lumbermill-open-task-center` | `lumbermillBuilt.clauses[0]` | 是 |
| `lumbermill-claim-task` | `lumbermillBuilt.clauses[1]` | 是 |
| `era3-open-civilization` | `era3AdvanceReady` | 是 |
| `barracks-open-task-center` | `era3Advanced.clauses[0]` | 是 |
| `barracks-claim-supplies` | `era3Advanced.clauses[1]` | 是 |
| `first-army-open-task-center` | `barracksBuilt.clauses[0]` | 是 |
| `first-army-claim` | `barracksBuilt.clauses[1]` | 是 |
| `scout-officer-open-task-center` | `firstArmyClaimed.clauses[0]` | 是 |
| `scout-officer-claim` | `firstArmyClaimed.clauses[1]` | 是 |
| `final-tech-open` | `famousSeekCompleted`、`finalTechOpened` | 是 |

结构化核对结果:`oldFlowRules=52`、`newFlowRules=38`、`removedCount=14`；删除集合与上表逐字一致。`makeTaskClaimPairRules`、`makeTabOpenRule` 及迁移后无调用的任务领取渲染 helper 同步删除，旧注册表类和其余规则保留。

freshness:

- S2 规则清单已重生成并进入 smoke 的 `--check` 门禁:`flowRules=38`、`eventHandlers=18`。
- 本次 S2 重生成还如实收敛了任务开始前已存在的 EventRegistry 清单漂移:18 条 handler 行号与源文件 SHA-256 刷新，`tutorialStateChanged.stepNames` 从空补为 `famousSeekCompleted`；E4 未修改 EventRegistry 源码，handler 数仍为 18。
- S3 宿主表已 fresh:`total=199`，分类为 `48/0/0/48/87/16`；减少量来自已删除旧工厂/helper 的 2 条 resolveTarget 与 1 条 query 静态表面。
- S4 事件契约已 fresh:`events=18`。
- S5 hit-target 生成器新增冻结 StepScript 配置 `target` 字段解析，避免迁移后漏记 target；结果为 `tutorialConfigFiles=1`、`tutorialReferenceSites=52`、`tutorialTypes=29`、`missingTypes=0`。
- `TutorialHostContext.advanceTutorial` 命令所有权证据坐标刷新为 `:595`，`inventoryDriftFindings=0`。

专项验证:

```powershell
node --test frontend/js/tutorial/TutorialHostContextStepScript.test.js frontend/js/tutorial/TutorialGuideController.test.js frontend/js/tutorial/TutorialGuideArchitecture.test.js frontend/js/tutorial/TutorialGuideTargetResolver.test.js scripts/generate-tutorial-rule-inventory.test.js scripts/generate-tutorial-hit-target-types.test.js scripts/check-command-owner-blocking-map.test.js scripts/report-command-owner-step1.test.js
```

测试数字原文:

```text
ℹ tests 56
ℹ suites 0
ℹ pass 56
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 501.2588
```

完整 smoke 测试数字与结尾原文:

```text
ℹ tests 1713
ℹ suites 0
ℹ pass 1713
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3965.5273
[architecture-smoke] passed
```
