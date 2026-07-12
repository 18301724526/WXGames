# Shell 教程控制器结构修复报告

## 结论

- `CanvasGameApp` 新增显式选项 `tutorialControllerEnabled`，默认 `true`；为 `false` 时从构造阶段完全不创建 `TutorialGuideController`。
- `CanvasGameShell` 调用 `super(...)` 时传入 `tutorialControllerEnabled: false`，因此 Shell 不再拥有教程控制器及其 `state.changed` / `modal.changed` 总线订阅。
- Shell 需要教程状态或能力时，通过 `getCanvasGameHost()` 惰性取得主游戏实例的权威控制器；页面内控制器构造次数和订阅宿主均收敛为 1。

## Shell 依赖清单与处置

1. `CanvasGameShell.buildRenderOptions()`
   - 依赖：渲染选项需要教程状态投影。
   - 原路径：读取 `lastGame.tutorialController.state`。
   - 处置：改为 `getTutorialController()?.state`，仍以主游戏实例为权威来源。

2. `CanvasGameShell.getTabLocks()`
   - 依赖：调用教程控制器的 `canOpenTab()` 计算标签锁定状态。
   - 原路径：读取并以 `lastGame.tutorialController` 为调用接收者。
   - 处置：先通过 `getTutorialController()` 惰性取得主控制器，再以该控制器为接收者调用 `canOpenTab()`。

3. `CanvasGameShell` 继承自 `CanvasGameApp` 的教程相关方法
   - 依赖：基类中的状态同步、教程步定义读取、教程渲染投影、建筑/时代/探索/任务/命名成功后的同步等路径原先直接读取 `this.tutorialController`。
   - 处置：`CanvasGameApp` 新增可覆写的 `getTutorialController()`，10 处运行时读取统一改走该方法；Shell 覆写后经 `getCanvasGameHost()` / `lastGame` 委托主实例。

4. `ArmyFormationEditorController.save()`
   - 依赖：保存编队后会从通用 `host` 读取教程控制器并执行 `sync()`；该 `host` 可能是 Shell。
   - 处置：优先调用 `host.getTutorialController()`，并保留 `host.tutorialController` 作为兼容回退。

5. `CanvasPanelActionContextAdapter.getTutorialController()`
   - 依赖：面板动作上下文需要取得教程控制器。
   - 现状：已有逻辑优先读取主游戏 `game.tutorialController`，不依赖 Shell 自有控制器。
   - 处置：无需修改。

## V1 step0 风险解释

V1 的“创建后再断开并清空”会同时产生两个结果：虽然第二组总线订阅被移除，但 Shell 的继承字段也被永久清空。此后任何落到 `CanvasGameApp` 基类教程方法或从通用宿主读取 `tutorialController` 的早期调用，都无法取得主游戏控制器，因而可能在 step0 丢失同步或权限判断。

本次修复从构造源头禁止 Shell 创建第二实例，同时保留挂载后的惰性委托。静态依赖面已逐处处理；未将 V1 的异常归因于一个未经运行时证据确认的唯一调用栈。

## 回归测试

`TutorialSingleHostContext.test.js` 新增真实主游戏实例与 Shell 挂载测试，断言：

- `TutorialGuideController` 构造恰好 1 次。
- 总线订阅宿主只有主游戏控制器，且其 `game` 指向主游戏实例。
- `shell.tutorialController === null`，Shell 惰性解析结果等于主游戏控制器。
- 模拟 farm 已建成后，教程推进到 `era2AdvanceReady`。
- `activeCommandPanel` 中 `buildings` 只发生 1 次关闭，没有重新打开振荡。
- `state.changed` 页面求值同步返回，`failed === 0`，且 Shell 渲染求值被执行。

教程文件测试原文：

```text
ℹ tests 80
ℹ suites 0
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 270.2664
```

`npm test` 全量测试原文：

```text
[test] Running 309 all test files
ℹ tests 2487
ℹ suites 0
ℹ pass 2487
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5855.0093
```

两项命令退出码均为 0。

## Diff 摘要

- `frontend/js/platform/CanvasGameApp.js`：增加构造开关和可覆写的惰性控制器解析入口，教程运行时读取统一改走该入口。
- `frontend/js/platform/CanvasGameShell.js`：禁止构造 Shell 控制器，教程投影和标签锁委托主实例。
- `frontend/js/platform/ArmyFormationEditorController.js`：通用宿主路径兼容惰性控制器解析。
- `frontend/js/tutorial/TutorialSingleHostContext.test.js`：增加单控制器、单订阅、farm 推进和无面板振荡的集成回归。

## 未做

- `step10 openCommandPanel` 不打开的新 bug 另案处理。
- `P3 Axis A` 全量继承解除另案处理。
- 未运行 playtest。
- 未修改监督者文档 `tmp/ultra-exam-answer.md`、`tmp/verify-ultra-V2.md`。
- 未联网。
- 未 push。
