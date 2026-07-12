# TaskDefinitionService 失败测试修复报告

## 根因

这是测试隔离问题，不是产品失败路径损坏。

- `backend/tests/TaskDefinitionService.test.js:79` 原先调用 `resetConfigRuntime()` 后，直接在第 82 行调用 `TaskDefinitionService.loadDefinitions()`。
- `backend/services/config/GameplayConfigRuntime.js:159-163` 的 `resetRuntimeConfig()` 不只清空已加载 bundle，也把 `runtimeOptions` 重置为 `{}`。
- `backend/services/config/GameplayConfigRuntime.js:145-147` 的 `ensureInitialized()` 随后使用默认选项重新初始化。
- 工作区默认 active release 确实可用。修复前独立进程输出为：

```text
{"statusSource":"active-release-bundle","bundleReady":true,"releaseId":"20260712T034439712Z-8c12ddfa602e-8988b3e5","definitionSource":"active-release-bundle:20260712T034439712Z-8c12ddfa602e-8988b3e5:task-definitions","taskCount":6}
```

- 因此 `backend/services/TaskDefinitionService.js:49-63` 成功取得 payload 并返回定义，第 60 行的 `TASK_DEFINITIONS_RUNTIME_NOT_READY` 失败分支没有被触发。原失败输出是 `AssertionError [ERR_ASSERTION]: Missing expected exception.`。

## 改动理由

仅修改 `backend/tests/TaskDefinitionService.test.js`：

- 失败路径测试创建独立空临时发布目录。
- 将 `GameplayConfigRuntime` 显式配置到该目录，并使用 production gate，确保 active release 客观不存在。
- 保留原有 `assert.throws` 和错误码断言，不放宽语义。
- `finally` 中恢复后续测试所需的已发布运行时，并删除本测试创建的临时目录。

产品代码无需修改，因为在隔离后的无 bundle 环境中，既有失败路径按预期抛出。

## 验证数字原文

`node --test backend/tests/TaskDefinitionService.test.js`

```text
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 221.1021
```

`npm test`

```text
ℹ tests 2478
ℹ suites 0
ℹ pass 2478
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6774.838
```

## 未做

- 未修改产品代码。
- 未修改或读取监督者署名文档。
- 未运行 playtest。
- 未访问公网或 `47.116.32.216`。
- 未触碰 `3671/8671` 端口或 tracer 相关进程。
- 未批量终止任何 `node` 进程。
- 未改动、清理或提交工作区原有无关变更。
- 未 push。
