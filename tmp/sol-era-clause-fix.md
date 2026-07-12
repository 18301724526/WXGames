# 时代进阶双阶段脚本修复报告

## 结论

`era2AdvanceReady` 与 `era3AdvanceReady` 已从单条“打开 civilization 面板”配置改为 `highlightActionWait` 双 clause：

1. `QUERY_DEFINITIONS:isCommandPanelOpen('civilization') === false`：高亮 `openCommandPanel`，保留原有打开面板引导。
2. `QUERY_DEFINITIONS:isCommandPanelOpen('civilization') === true`：高亮 `advanceEra`，等待 `eraAdvanced`。

面板打开后不再产生空 projection，也不会让玩家或 harness 再次点击具有 toggle 语义的 `openCommandPanel`。

## 裁决依据

- `tmp/audit-panel-K.md`（70 分）与 `tmp/audit-panel-G.md`（65 分）对配置缺口及 toggle 死路的机制判断一致。
- `docs/architecture/northstar-s8-adjudication-2026-07-13.md` 批准 S8 草稿方案并固定脚本类型、query 预算。
- `docs/architecture/northstar-s8-coverage-draft-2026-07-12.md` 的 R08、R12 均将时代进阶定义为 `highlightActionWait`、target=`advanceEra`、event=`eraAdvanced`，并复用 `isCommandPanelOpen(civilization)`。

上述监督者文档均只读，未修改。

## 实现

### 配置

- `era2AdvanceReady`
  - `era2-open-civilization`：面板关闭时投影 `openCommandPanel`。
  - `era2-advance`：面板打开时投影 `advanceEra`，`eventName: 'eraAdvanced'`。
- `era3AdvanceReady`
  - `era3-open-civilization`：面板关闭时投影 `openCommandPanel`。
  - `era3-advance`：面板打开时投影 `advanceEra`，`eventName: 'eraAdvanced'`。

未新增脚本类型，仍使用 S8 已批准的 `highlightActionWait`；未新增 query，仍使用 `isCommandPanelOpen`。

### 最小执行器改动

现有 `highlightActionWait` 已支持有序 clause，但 `TutorialHostContext.renderStepScriptHighlight()` 只分发 `openTaskCenter` 和 `claimTaskReward:*`，无法渲染草稿 R08/R12 要求的 `openCommandPanel`、`advanceEra`。

因此仅在该现有类型的目标分发中补齐两条旧注册表已有语义：

- `openCommandPanel`：执行 `prepareCommandPanelGuide(panel)`，再高亮允许动作 `{ type: 'openCommandPanel', panel }`。
- `advanceEra`：高亮允许动作 `{ type: 'advanceEra' }`。

没有修改 `StepScriptTypeRegistry`，没有新增类型、query、事件或推进规则。

## 测试调整

- 配置特征测试覆盖 era2/era3 各自的面板关闭与打开状态：前者投影 `openCommandPanel`，后者投影 `advanceEra`，并检查 ruleId、messageKey、eventName 与 panel。
- `TutorialGuideController.test.js` 中上一单适配的 era2/era3 “面板打开后 idle、零调用”断言，改为断言成功渲染 `{ type: 'advanceEra' }`。
- 这不是引入新的教程行为，而是把旧 `TutorialGuideFlowRegistry` 中 R08/R12 的 `advanceEra` 高亮语义经由新 StepScript 引擎恢复。
- StepScript 上下文测试改为断言打开 civilization 后稳定重复投影 `era2-advance`，不进入旧注册表、不重复准备面板、不记录 `scripted-step-idle`。
- 目标覆盖测试将 `advanceEra` 纳入显式 panel 决策表。

## Diff 摘要

- `frontend/js/tutorial-config/TaskPanelStepScripts.js`：era2/era3 双阶段 clause 配置。
- `frontend/js/tutorial/TutorialHostContext.js`：现有 `highlightActionWait` 最小目标分发补齐。
- `frontend/js/tutorial-config/TaskPanelStepScripts.test.js`：四种 projection 特征测试及单阶段面板回归保护。
- `frontend/js/tutorial/TutorialGuideController.test.js`：era2/era3 旧 idle 断言改为 `advanceEra` 高亮。
- `frontend/js/tutorial/TutorialHostContextStepScript.test.js`：新 projection 稳定性与无旧路径回退断言。
- `frontend/js/tutorial/TutorialGuideTargetResolver.test.js`：`advanceEra` 显式目标覆盖决策。

## 验证原文

教程文件：

```text
ℹ tests 86
ℹ suites 0
ℹ pass 86
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 261.0362
```

`npm test`：

```text
[test] Running 309 all test files
ℹ tests 2486
ℹ suites 0
ℹ pass 2486
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5452.3491
```

两项命令均在当前暂存索引导出的独立副本中执行，退出码均为 0。

## 未做

- 未运行 playtest。
- 未联网。
- 未 push。
- 未修改监督者文档。
- 未引入 S8 批准范围之外的新脚本类型、query、事件或推进规则。
