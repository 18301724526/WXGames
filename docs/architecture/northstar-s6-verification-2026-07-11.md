# 北极星 S6 验证记录(2026-07-11)

## Z1|收端接线

- `TutorialGuideEventRegistry` 直接订阅 S4 契约的 18 个事件名，保留 `tutorial.event` 包装主题作为过渡兼容入口。
- 载荷按契约校验；`eraAdvanced/taskRewardClaimed/tutorialStateChanged/armyFormationSaved/exploreStarted` 的 `result` 必须为对象。
- `TutorialHostContext` 在生产环境接入 `ChangeEventBus`；`state.changed` 与 `modal.changed` 两个写入漏斗均驱动 `refreshCurrentHighlight()`。
- 双通道去重口径：同一宿主、同一事件名、同一载荷、同一事件循环内，只有跨 `direct/bus` 通道的重复分发被折叠；同通道重复不吞。
- S3/S4/S5 派生清单按当前源码重生成；command-owner 清单仅把既有 `advanceTutorial` 调用点从 `TutorialHostContext.js:473` 机械同步到实测 `:496`，`inventoryDriftFindings=0`。

去重与订阅链契约测试原文：

```text
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

教程目录定向测试原文：

```text
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

全程投影使用 S2b Run 2：

```text
stopReason=tutorial-completed
finalStepName=completed
rows=64
tutorialHostContextWitness.count=0
```

仓库基线与 Z1 重投影 SHA-256 均为：

```text
16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F
```

`git diff --no-index --exit-code` 返回 0，投影逐字节 diff 为空；未触发 L2，未重录基线。`node scripts/run-architecture-smoke.js` 最终输出 `[architecture-smoke] passed`。

## Z2|割接批一：CanvasActionController

- 当前源码实测 `CanvasActionController.js` 有 11 个 `onXxx` 调用表达式；全部改为 `ChangeEventBus.emit`。任务单“39 触点”是该文件教程耦合面旧统计，不冒充当前 `onXxx` 实数。
- `militaryViewSwitched/cityManagementOpened/tutorialStateChanged/commandPanelOpened/advisorClosed` 均按 S4 载荷契约发布；`ChangeEventBus.emit` 增加订阅者结果数组，使原异步允许/拒绝与错误处理顺序可继续等待真实消费者结果。
- 删除该文件 17 处非冻结 poke，原行号为 `812/814/851/858/864/1090/1114/1128/1153/1267/1385/1422/1529/1627/1629/1645/1870`；每处均有同名 `frontend/js/platform/CanvasActionController.js:<line>` 特征测试，经 `StateWriter.commit` 或 `ModalStore.openModal/closeModal` 真实漏斗断言订阅刷新。
- 非冻结 poke 期望计数与实数：`33→16`。冻结 `CanvasPanelActionRunner*` 3 处 declared 残留未修改、未计入。
- Z2 结束后：`CanvasActionController.js onXxx=0`，`CanvasActionController.js refreshCurrentHighlight=0`，command-owner `inventoryDriftFindings=0`，Step4 debt catalog `violations=0`。

定向测试原文：

```text
ℹ tests 78
ℹ suites 0
ℹ pass 78
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

全程投影使用 S2b Run 2，重投影 64 条；仓库基线与 Z2 重投影 SHA-256 均为：

```text
16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F
```

`git diff --no-index --exit-code` 返回 0，投影逐字节 diff 为空；未触发 L2，未重录基线。`node scripts/run-architecture-smoke.js` 最终输出 `[architecture-smoke] passed`。

## Z3|割接批二：CanvasGameApp

- 当前源码实测 `CanvasGameApp.js` 有 6 个教程事件调用，分别为 `eraAdvanced/exploreStarted/taskRewardClaimed/cityEntered/armyFormationOpened/tabClicked`；全部改为 `ChangeEventBus.emit`。`frontend/app.js` 当前实测为 0 个 `onXxx` 调用，任务单“24/9 触点”是旧统计，不冒充当前实数。
- 删除 `CanvasGameApp.js` 7 处非冻结 poke，原行号为 `1382/3031/3083/3085/3144/3198/3430`；每处均有同名 `frontend/js/platform/CanvasGameApp.js:<line>` 特征测试，经 `StateWriter.commit` 或 `ModalStore.openModal/updateModalPayload/closeModal` 真实漏斗断言订阅刷新。
- `ModalStore.updateModalPayload` 补齐 `modal.changed` 发布，使模态载荷更新与打开、关闭共用同一刷新漏斗。
- 非冻结 poke 期望计数与实数：`16→9`。冻结 `CanvasPanelActionRunner*` 3 处 declared 残留未修改、未计入。
- Z3 结束后：`CanvasGameApp.js onXxx=0`、`CanvasGameApp.js refreshCurrentHighlight=0`、`CanvasGameApp.js scheduleTutorialHighlightRefresh=0`、`frontend/app.js onXxx=0`、`frontend/app.js refreshCurrentHighlight=0`，command-owner `inventoryDriftFindings=0`，Step4 debt catalog `violations=0`。
- S5 命中目标类型派生清单因 `CanvasGameApp.js` 内容哈希变化按生成器机械重建，`--check` 通过；清单语义计数保持 `registrationSites=204/tutorialReferenceSites=39/missingTypes=0`。

定向测试原文：

```text
ℹ tests 79
ℹ suites 0
ℹ pass 79
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

全程投影使用 S2b Run 2，重投影 64 条；仓库基线与 Z3 重投影 SHA-256 均为：

```text
16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F
```

`git diff --no-index --exit-code` 返回 0，投影逐字节 diff 为空；未触发 L2，未重录基线。受控运行记录的 `tutorialHostContextWitness.count=0`。`node scripts/run-architecture-smoke.js` 最终输出 `[architecture-smoke] passed`。
