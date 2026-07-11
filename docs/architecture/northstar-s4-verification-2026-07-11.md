# 北极星 S4 验证记录(2026-07-11)

## X0|host-surface 清单时点收尾

- 重生成 `docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json` 后，逐调用点由 393 收缩到 205。
- 分类变化：`effects=124→47`、`waitFor=0→0`、`requestAction=0→0`、`resolveTarget=60→55`、`queries=193→87`、`next=16→16`。
- `scripts/generate-tutorial-host-surface-inventory.js --check` 会以内存重生成结果逐字节核对仓库产物；`scripts/run-architecture-smoke.js` 已将该检查设为常驻门禁。

验证命令：

```powershell
node scripts/generate-tutorial-host-surface-inventory.js --check
node --test scripts/generate-tutorial-host-surface-inventory.test.js
node scripts/run-architecture-smoke.js
```

结果：生成器检查、4 条生成器测试、architecture smoke 全部通过。

全程教程结果：`stopReason=tutorial-completed`、`finalStepName=completed`、62 个动作、64 条投影、0 verification failure、`tutorialHostContextWitness.count=0`。

投影 transcript 与仓库 64 条基线的 SHA-256 均为：

```text
16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F
```

`git diff --no-index --exit-code` 返回 0，逐字节 diff 为空；基线未重录、未修改。

## X1|双漏斗 change-notify + 薄总线

- 新增 `frontend/js/state/ChangeEventBus.js`，仅支持精确事件名的 `emit/subscribe`；退订幂等，无第三方依赖，无通配符分发。
- 单测覆盖订阅、退订、多订阅者，以及异常订阅者不阻断后续订阅者且异常不逃逸到发布方。
- `ModalStore.openModal/closeModal` 发布 `modal.changed`，携带 `source/operation/subtype/token/payload`。
- `StateWriter.commit` 发布 `state.changed`，携带 `source/operation/owner/previous/next/meta`。
- 原调用点、返回值和状态写入顺序保持不变；未割接任何 `onXxx` 调用点。

验证结果：

- 总线与双漏斗定向测试 23/23 通过。
- `TUTORIAL_WITNESS_ASSERT_ZERO=1 npm test`：298 个测试文件，exit 0。
- `node scripts/run-architecture-smoke.js`：exit 0。
- 全程教程：`stopReason=tutorial-completed`、`finalStepName=completed`、62 个动作、64 条投影、0 verification failure、`tutorialHostContextWitness.count=0`。
- X1 transcript 与仓库基线 SHA-256 同为 `16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F`，逐字节 diff 为空。

## X2|18 事件必备字段契约

- 新增生成器 `scripts/generate-tutorial-event-contracts.js`，从 `TutorialGuideEventRegistry.createDefaultHandlers` 静态提取 18 个事件及 handler 内 `payload` 字段，产物为 `docs/architecture/artifacts/northstar-s4-tutorial-event-contracts.json`。
- `tabClicked` 规范字段为 `tabId`（兼容别名 `panelId/tab`）；`buildingAction` 为 `buildingId/action`；另抽查 `famousPersonDetailOpened→personId`。
- `eraAdvanced/taskRewardClaimed/tutorialStateChanged/armyFormationSaved/exploreStarted` 均声明 `result` 为“服务端命令结果对象”。
- `exclusions` 明文列出 `canOpenTab`：否决式询问，不上事件总线；唯一 veto seam 为 `CanvasPanelActionRunner descriptor hooks`，钩子现名为 `tutorialCanOpenTab/tutorialVetoFeedback`。
- `TutorialGuideEventRegistry.subscribeToBus` 提供加法式消费者入口；端到端测试通过总线发布 `taskRewardClaimed` 命令结果，由真实 EventRegistry handler 调用 `syncFromResult` 完成 `TutorialHostContext` 状态同步。
- 生成器 `--check` 已接入 architecture smoke；S3 host-surface 派生产物同步重生成，调用点仍为 205。

验证结果：

- X2 定向契约与端到端测试 5/5 通过。
- `TUTORIAL_WITNESS_ASSERT_ZERO=1 npm test`：299 个测试文件，1681/1681 通过。
- `node scripts/run-architecture-smoke.js`：exit 0。
- 未修改任何既有 `onXxx` 调用点，未动 S5 映射表与 S7 规则迁移。
