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
