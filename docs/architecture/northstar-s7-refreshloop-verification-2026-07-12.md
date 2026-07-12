# 北极星 S7-REFRESHLOOP 验证记录（2026-07-12）

## 结论

- G1-G3 已消除 `intro-enter-city-2` 的同步刷新回边停滞；本地隔离真机流程已生成 `-after` 快照，确认步骤从 enter 状态继续推进。
- 后续运行停在不同位置：step 8 `buildBuilding(farm)`。该卡点不属于本单的高亮刷新回边问题，本单未继续诊断或修改产品代码。
- 按监督结论停止 G4 双跑，不再等待。未取得全程双跑、64 基线 diff 空或完整 E5 收官结果，不将本次验证表述为 G4 全判据通过。

## G1｜堵住同步 `state.changed` 回边

提交：`306dbf65 fix(tutorial): coalesce state refresh back-edge`

- 根因是同一状态宿主可存在多个 `TutorialHostContext`，实例字段 `highlightRefreshActive` 不能覆盖跨 context 的同步订阅回边。
- 刷新事务改为按共享状态宿主归一，通过 `WeakMap` 在 context 之间共享 active 状态。
- `TutorialGuideEventRegistry` 的 `state.changed` / `modal.changed` 订阅统一走 `requestHighlightRefresh`；刷新事务内的同步 `state.changed` 回刷被合并并记录 `tutorial-highlight-refresh-reentry`，不再递归进入渲染链。
- 特征测试覆盖跨 context 同步回边并断言有限终止。

## G2｜移除渲染期派生状态提交

提交：`f0b445e6 refactor(render): keep navigation projection pure`

- 删除 `CanvasGameShell.getActiveTab()` 渲染取值期间的 `StateWriter.commit`。
- `renderReadOnly()` 只对本次投影使用局部派生 state，不再向状态宿主提交 `currentTab` / `militaryView`，因此渲染路径不再同步发出 `state.changed`。
- 测试锁定 `getActiveTab()` 与 `renderReadOnly()` 的只读行为。

## G3｜渲染期刷新 fail-loud 守卫

提交：`fda8fa73 guard(tutorial): drop refreshes during rendering`

- `renderGuideHighlightFrame`、`renderActive`、`renderReadOnly` 进入共享 `TutorialRenderPhaseGuard`。
- 渲染期调用 `requestHighlightRefresh()` 或 `refreshCurrentHighlight()` 时直接 drop，并记录 `tutorial-render-refresh-dropped`，trace schema 为 `tutorial-render-refresh-drop-trace/v1`。
- 特征测试覆盖渲染期直接刷新与事件总线刷新，断言 drop、trace 可观测且渲染事务正常退出。

## G4｜本地隔离验证与停止点

真机确认：

- `intro-enter-city-2` 已从 step 0 推进到 step 2，结果为 `city entered and tutorial advanced`。
- `wait-intro-entering-3` 随后完成。
- `-after` 快照已生成，原 `intro-enter-city-2` 停滞已消除。
- 首轮相关产物：`tmp/playtest-s7-refreshloop-g4/h4-local-isolated-2026-07-11T23-57-02-848Z/run-1`。
- 后续新卡点位于 step 8 `buildBuilding(farm)`；按范围裁定不在本单解决。

停止声明：

- 双跑已按要求终止，不再运行或等待。
- 未取得完整双跑通关、投影与 64 基线 diff 空等 G4 全量证据。
- H1 `5b206ec2` 与 H2 `9128b74b` 均未参与本次同步 commit 回边修复；H1 保留为尾随刷新独立防御，H2 保留为 pending advance 超时看门狗独立防御。

## 本地测试记录

`npm test`：

```text
ℹ tests 2478
ℹ suites 0
ℹ pass 2478
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4980.7652
```

架构测试本体：

```text
ℹ tests 1725
ℹ suites 0
ℹ pass 1725
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4386.0806
```

完整 `npm run test:architecture` 最终被并行 H4 改动造成的 freshness 失配拦截：

```text
Tutorial host surface inventory is stale:
docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json
```

该 H4 产物不归本单所有，本单未修改。以上验证全部使用本地隔离进程，未使用 `--target=remote`、公网或 `47.116.32.216`。
