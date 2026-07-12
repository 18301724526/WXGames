# TutorialHostContext 尾随刷新收敛修复报告

## 改动 diff 摘要

- `frontend/js/tutorial/TutorialHostContext.js`
  - 渲染期收到 `modal.changed` 时显式设置 `highlightRefreshPending`，保留首次尾随刷新的既有语义。
  - `scheduleTrailingHighlightRefresh()` 的尾随刷新执行结束后，不再因刷新自身产生的 pending 继续排微任务。
  - 尾随执行期间新产生的 pending 会被直接清除，并按既有刷新重入 trace 口径记录 `phase: 'trailing-self-drop'`。
  - trace 归一化支持 `trailing-self-drop`，原有 `primary` 和 `trailing` 语义不变。
- `frontend/js/tutorial/TutorialHostContextStepScript.test.js`
  - 新增渲染期 `modal.changed` 恰好执行一次尾随刷新的特征测试。
  - 将原先允许第二次尾随刷新的回归测试改为尾随自触发直接丢弃的收敛测试。

## 两个特征测试的断言逻辑

### 渲染期首次尾随刷新

- 用可控 `TutorialRenderPhaseGuard` 模拟 `renderCanvasSurface` 期间发出 `modal.changed`。
- 用内存数组接管 `queueMicrotask`，不依赖超时。
- 事件发出后断言：同步刷新次数为 `0`、微任务数为 `1`、pending 为 true。
- 手动执行唯一微任务后断言：刷新次数恰好为 `1`、微任务数为 `0`、pending 和 scheduled 均已清除。

### 尾随执行期间的渲染期重入

- 第一次同步刷新产生一个正常尾随微任务。
- 执行该尾随微任务时，在刷新内部模拟渲染期 `modal.changed`。
- 断言总刷新次数固定为 `2`，最大同步深度为 `1`，微任务队列为空，不产生第二次尾随。
- 断言 pending、trailing、scheduled 全部清除。
- 断言 trace 依次为正常的 `primary` 调度和 `trailing-self-drop` 记录。

## 验证数字原文

`node --test frontend/js/tutorial/TutorialHostContextStepScript.test.js`

```text
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 89.9611
```

`npm test`

```text
ℹ tests 2479
ℹ suites 0
ℹ pass 2479
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6758.8094
```

## 未做

- 未做 playtest 动态验证。
- 未处理刷新内部触发渲染的纯度债。
- 未修改渲染或面板代码。
- 未修改 `subscribeToBus`、`isTaskCenterOpen` 等本日其他修复。
- 未读取或修改监督者署名文档。
- 未访问公网。
- 未触碰现有端口或实验进程。
- 未改动、清理或提交工作区原有无关变更。
- 未 push。
