# 渲染期 modal.changed defer 消融报告

## Diff

- `frontend/js/tutorial/TutorialHostContext.js`
  - `requestHighlightRefresh()` 的渲染期分支删除 `modal.changed` 专用的 `highlightRefreshPending = true` 与 `scheduleTrailingHighlightRefresh()`。
  - 分支现在只执行 `recordRenderRefreshDrop(this, eventName)` 并返回 `false`。
  - `scheduleTrailingHighlightRefresh()`、`refreshCurrentHighlight()` transaction 重入排程、`trailing-self-drop` 均未改动。
- `frontend/js/tutorial/TutorialHostContextStepScript.test.js`
  - 生产代码 diff：删除 4 行。
  - 测试 diff：新增非渲染直刷、step6 open→claim 防线，并重定向既有 trailing 收敛测试；该文件统计为 `+98/-21`。

## 断言逻辑

1. 渲染期 `modal.changed`
   - `requestHighlightRefresh()` 返回 `false`。
   - `refreshCurrentHighlight()` 调用计数为 `0`。
   - `scheduleTrailingHighlightRefresh()` 调用计数为 `0`。
   - 微任务队列长度为 `0`。
   - `highlightRefreshPending === false`，`highlightRefreshTrailingScheduled === false`。
   - drop trace 精确记录 `eventName: 'modal.changed'` 与 `renderPhase: 'renderCanvasSurface'`。
2. 非渲染期 `modal.changed`
   - `requestHighlightRefresh()` 返回 `true`。
   - legacy refresh 直刷计数为 `1`。
   - trailing 排程计数为 `0`，pending 保持 `false`。
3. step6 语义防线
   - `eraAdvancedTo1` 初次投影命中 `first-era-open-task-center`，目标为 `openTaskCenter`。
   - 使用 `CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(canvasShell, 'showTaskCenter', true)` 模拟动作完成。
   - `TutorialHostContext.isTaskCenterOpen()` 从真实 `canvasShell` 模态快照返回 `true`。
   - 非渲染期 `requestHighlightRefresh('modal.changed')` 立即重投影，命中 `first-era-claim-supplies`，目标为 `claimTaskReward:main_first_supplies`。
   - 因此 claim 切换依赖 `isTaskCenterOpen` 查询修复与动作完成后的正常刷新，不依赖渲染期 defer。
4. 有界 trailing 回归保护
   - primary transaction 内重入仍只排一个 trailing。
   - trailing transaction 内再次重入记录 `phase: 'trailing'`，不重复排程。
   - trailing 结束时残余 pending 记录 `trailing-self-drop` 并收敛。

## 既有断言调整理由

1. 原 `render-phase modal change schedules exactly one trailing refresh`
   - 将“微任务 `1`、pending `true`、执行微任务后 refresh `1`”改为“排程 `0`、微任务 `0`、pending `false`、refresh `0`”。
   - 理由：这些旧断言就是本次被消融的 defer 行为；新裁定要求渲染期纯丢弃。
   - 新增返回值与 drop trace 断言，证明事件被记录后丢弃，而非静默漏测。
2. 原 `render-phase modal reentry during a trailing refresh is dropped without rescheduling`
   - 将 trailing 内第二次触发改为非渲染 transaction 重入，测试名同步改为 transaction 语义。
   - 理由：渲染期事件现在应在入口直接丢弃，不能再制造 pending；该用例的保留价值是验证未改动的 transaction trailing 与 `trailing-self-drop` 收敛路径。
   - 期望轨迹新增 `{ phase: 'trailing', trailingScheduled: false }`。
   - 理由：非渲染事件会进入 `refreshCurrentHighlight()` 的 transaction 重入分支并记录 trailing，随后才由 finally 记录 `trailing-self-drop`。

除上述两处外，未改动既有断言。

## 测试数字原文

定向测试：

```text
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 95.9491
```

教程相关文件：

```text
ℹ tests 83
ℹ suites 0
ℹ pass 83
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 265.401
```

`npm test` 全量：

```text
ℹ tests 2483
ℹ suites 0
ℹ pass 2483
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6587.4979
```

## 未做

- 渲染期 modal 写去重的纯度债未动，留给 S9 案。
- 未修改 `scheduleTrailingHighlightRefresh()`、transaction 重入、`trailing-self-drop`、`scripted-step-idle`。
- 未修改 `subscribeToBus` 遗留兼容、`isTaskCenterOpen`、单实例结构及其余修复层。
- 未修改监督者文档与 `tmp/wedge-stack.jsonl`。
- 未运行 playtest。
- 未访问公网。
- 未 push。
- 未纳入或回退工作区原有无关改动。
