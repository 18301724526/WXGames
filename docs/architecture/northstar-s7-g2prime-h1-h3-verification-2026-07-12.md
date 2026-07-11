# 北极星 S7-G2' H1-H3 验证记录（2026-07-12）

## H3｜`ensureHouseGuideVisible` 定性

### 读证结论

- `ensureHouseGuideVisible` 只有 `TutorialGuideEventRegistry.cityEntered` 一个生产调用者。
- `cityEntered` 的唯一生产触发点是 `CanvasGameApp.enterCity`；触发前已打开 `showCityManagement`、选定 `buildings`，并关闭 `showSubcityList`、`activeCommandPanel` 与事件面板。
- `TutorialHostContext.markCityEntered` 没有生产调用者，仅测试直接调用。因此不存在需要该方法守备的另一条入城路径。

### 裁定

删除 `ensureHouseGuideVisible` 及 `cityEntered` 中的调用。入城入口负责准备表面，教程事件只负责推进步骤并刷新纯投影；架构测试反向锁定该装饰方法不得回流。

### 验证

专项测试：

```text
ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 198.1149
```

仅应用 H1-H3 差异的本地隔离副本运行 `node scripts/run-architecture-smoke.js`：

```text
ℹ tests 1720
ℹ suites 0
ℹ pass 1720
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4420.8984
inventory drift findings: 0
[architecture-smoke] passed
```
