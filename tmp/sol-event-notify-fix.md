# 事件动作稳定后教程刷新止血方案

## 结论

已将双席机械验证通过的止血方案正式化：`handle_openEvent`、`handle_claimEvent`、`handle_closeEvent` 在事件 snapshot 与 controller 状态稳定后、`afterHandled` 之前，统一调用一次教程高亮刷新。

刷新入口集中为 `CanvasActionController.notifyTutorialAfterEventAction()`，内部调用：

```javascript
game?.getTutorialController?.()?.refreshCurrentHighlight?.()
```

## 证据基线

- `tmp/verify-xhigh-V3a.md`：`openEvent` 从原现场 244 次重复降为 1 次，随后出现 `claimEvent`，最终到达 `finalStep: 13`、`finalStepName: "specialEventClaimed"`。
- `tmp/verify-xhigh-V3b.md`：独立复验同样只有 1 次 `openEvent`，`claimEvent` 成功，最终到达 step 13。
- 两席新停点一致：`stepName: "specialEventClaimed"`、`highlight: null`，属于后续 claim 路径缺口，不是本次 `openEvent` 重复卡死复发。
- 根因沿用 `tmp/xhigh-openevent-answer.md`：`ModalStore` 同步发布 `modal.changed` 早于 renderer snapshot 与 `EventController.activeEventId` 稳定；相同 payload 被去重后不会再次发事件，因此旧高亮无法自愈。

## 实现

- `frontend/js/platform/CanvasActionController.js:256`：新增集中方法 `notifyTutorialAfterEventAction()`，避免三个 handler 散落重复调用。
- `handle_openEvent`：`openEventSnapshot` 与 `controller.open(eventId)` 完成后刷新，再执行 `afterHandled`。
- `handle_closeEvent`：`closeEventSnapshot` 与 `controller.close()` 完成后刷新，再执行 `afterHandled`。
- `handle_claimEvent`：领取成功并完成状态同步、snapshot/controller 关闭后刷新，再执行 `afterHandled`；失败结果不刷新。
- 领取转发分支改为真正等待 `forwardCanvasAction` 完成，避免生产默认 `awaitAsync=false` 时过早刷新。
- `TutorialEventBusRetirement.contract.test.js` 保留全局禁止直接刷新规则，仅允许 `CanvasActionController.js` 恰好 1 处集中调用；新增第二处或删除该调用都会失败。

## 特征测试

新增 `frontend/js/platform/CanvasActionControllerEventTutorialRefresh.test.js`：

1. `handle_openEvent` 刷新恰好一次，刷新时 `getActiveEventId()` 已返回目标事件。
2. 连续两次相同 payload 的 `openEvent` 仅产生 1 次 `modal.changed`，但每次 handler 完成后仍各刷新一次，覆盖去重自愈。
3. `handle_claimEvent` 状态稳定后刷新恰好一次，且刷新先于 `afterHandled` 重绘。
4. 生产默认异步模式下，转发结果未完成前不刷新；状态更新完成后才刷新一次。
5. `handle_closeEvent` 在活动事件清空后刷新恰好一次。

相关测试原文：

```text
ℹ tests 36
ℹ suites 0
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

全部教程测试原文：

```text
ℹ tests 210
ℹ suites 0
ℹ pass 210
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`npm test` 全量原文：

```text
[test] Running 310 all test files
ℹ tests 2493
ℹ suites 0
ℹ pass 2493
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

附加检查：

```text
node --check frontend/js/platform/CanvasActionController.js：通过
node --check frontend/js/platform/CanvasActionControllerEventTutorialRefresh.test.js：通过
git diff --check：通过
```

## 同形嫌疑

以下入口同样存在“修改 modal/surface 状态后直接 `afterHandled`”的静态形态，仅记录为嫌疑，未复现、未裁定、未修改：

- `handle_openTaskCenter` / `handle_closeTaskCenter`
- `handle_openResourceDetails` / `handle_closeResourceDetails`
- `handle_openCommandPanel` / `handle_closeCommandPanel`
- `handle_openSettings` / `handle_closeSettings`
- `handle_openAdvisor` / `handle_closeAdvisor`
- `handle_openGuidebook` / `handle_closeGuidebook`

## 未做

- 未做 R09/R10 `orderedTargetFlow` 迁移；正式长期修法归 S9a。
- 未处理 step 13 `highlight: null` 的 claim 后续路径缺口；归后续任务。
- 未运行任何 `playtest`。
- 未访问公网，未 push。
