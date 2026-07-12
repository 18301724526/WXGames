# TutorialHostContext 单实例结构修复报告

## ctx=2 驱动边定位结论

- 正式构造顺序成立：`frontend/app.js` 在 `CanvasGameShell.mount()` 前创建 `TutorialGuideController`；`TutorialIntroOverlay` 只在后续 `ensureTutorialIntroOverlay()` 中创建。因此 overlay 可以从装配层惰性取得已经存在的控制器，不需要自建 host。
- `TutorialHostContext` 构造器创建 `TutorialGuideTargetResolver` 时传入 `{ host: this }`；resolver 只需引用该能力面，不需要从 `game` 再造 host。
- T7 运行时证据中的直接驱动边为：渲染期 `modal.changed` 进入 `ctx=2.requestHighlightRefresh('modal.changed')`，设置 `ctx=2.highlightRefreshPending`，再调用 `ctx=2.scheduleTrailingHighlightRefresh()`。
- `scheduleTrailingHighlightRefresh()` 创建的 `run` 闭包捕获原实例 `this`；微任务执行时调用 `ctx=2.refreshCurrentHighlight()`。`ctx=2` 的私有镜像停在 `farmPrepReserved`，`hasStepScript=false`，因此进入 `refreshLegacyHighlight()`；legacy 面板变更再次触发渲染/modal 刷新，形成自持 trailing 链。
- `ctx=1` 同期读取 `era2AdvanceReady` 并走 StepScript。两个实例交替修改同一面板，闭合为 modal 风暴 livelock；T7 原始 `divergence witness` 为 `789`。
- `subscribeToBus:false` 只能阻止辅助实例新增总线订阅，不能消除已经存在的实例、私有 state、直接刷新入口和实例闭包。结构修复必须删除辅助 host 实例本身。

## diff 摘要

- `frontend/js/tutorial/TutorialIntroOverlay.js`
  - 删除内部 `new TutorialHostContext`。
  - 辅助对象只保留 `resolveContext`，`context` getter 每次取得权威控制器。
- `frontend/js/tutorial/TutorialGuideTargetResolver.js`
  - 删除兜底 `new TutorialHostContext`。
  - 辅助对象只保留 `resolveHost`，`host` getter 每次取得注入的控制器能力面。
- `frontend/app.js`
  - overlay 装配改为 `resolveContext: () => this.tutorialController`。
- `frontend/tools/tutorial-intro-overlay-preview.js`
  - 预览入口显式创建唯一 `TutorialGuideController`，overlay 惰性引用该控制器。
- `frontend/js/tutorial/TutorialHostContext.js`
  - 保留 `subscribeToBus` 构造选项，增加历史兼容注释；辅助实例的两处 `subscribeToBus:false` 传参随实例删除。
- 测试
  - 更新 overlay/resolver 夹具，显式注入唯一控制器。
  - 新增 `TutorialSingleHostContext.test.js`，覆盖完整 guide 辅助对象创建和单镜像断言。

## 测试断言逻辑

1. 实例普查：用 `CountingTutorialHostContext` 替换控制器基类，创建 controller、intro overlay、target resolver 并实际调用 overlay 与 resolver，断言构造次数严格为 `1`。
2. 镜像单源：命令结果把教程步更新为 `era2AdvanceReady` 后，controller、`introOverlay.context`、`targetResolver.host` 三路 `getCurrentStep()` 完全一致，且两辅助路径引用同一个 controller。
3. witness：在三路读取前后读取 `TutorialHostContext.getDivergenceWitness().count`，断言增量为 `0`。
4. 无超时：特征测试使用同步调用和受控 timer 夹具，不用超时等待作为通过条件。
5. 架构边界：`TutorialGuideArchitecture.test.js` 继续断言除 `TutorialHostContext.js` 外，教程生产代码没有直接 `game/canvasShell` 访问。

## 测试数字原文

`node --test frontend/js/tutorial/TutorialIntroOverlay.test.js frontend/js/tutorial/TutorialGuideTargetResolver.test.js frontend/js/tutorial/TutorialSingleHostContext.test.js frontend/js/tutorial/TutorialGuideArchitecture.test.js`

```text
ℹ tests 20
ℹ suites 0
ℹ pass 20
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 112.9916
```

`node --test frontend/js/tutorial/*.test.js`

```text
ℹ tests 69
ℹ suites 0
ℹ pass 69
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 244.5678
```

`node --test frontend/js/tutorial/*.test.js frontend/js/tutorial-config/*.test.js`

```text
ℹ tests 74
ℹ suites 0
ℹ pass 74
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 273.5381
```

教程平台刷新边界测试：

```text
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 117.0847
```

`npm test`

```text
ℹ tests 2481
ℹ suites 0
ℹ pass 2481
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6593.639
```

附加校验：`node --check` 与 `git diff --check` 通过。产品代码静态普查没有 `new TutorialHostContext`；`subscribeToBus:false` 没有剩余使用方，直接实例化只存在于测试夹具。

## 未做

- 未运行 playtest。
- 未访问公网。
- 未 spawn 子任务。
- 未修改监督者文档 `tmp/wedge-experiment-T7.md`。
- 未修改或回退工作区内既有无关改动。
- 未 push。
