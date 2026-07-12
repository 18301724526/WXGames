# scripted-step idle 死循环修复报告

## diff 摘要

- `frontend/js/tutorial/TutorialHostContext.js`
  - `refreshCurrentHighlight()` 对有 StepScript 且 projection 无 instruction 的情况，不再调用 `refreshLegacyHighlight()`，改为记录 trace 后直接 `return false`。
  - `isLegacyOverlayActive()` 为真时仍回落旧引擎；无 StepScript 的步骤仍走旧引擎。
  - StepScript trace 的最后一次评估增加 `outcome: 'scripted-step-idle'`，并通过 `TutorialHostContextTrace.log('scripted-step-idle', ...)` 写同口径观测事件。
- `frontend/js/tutorial/TutorialHostContextStepScript.test.js`
  - 增加空 projection 静默断言与连续 3 次刷新收敛断言。
  - 保留 overlay 回落和无脚本步骤旧引擎回归保护。
- `frontend/js/tutorial/TutorialGuideController.test.js`
  - 将 3 处依赖“空 projection 回落旧引擎”的旧断言改为新语义；已有事件迁移的 `events`、`tech` 场景改从事件入口推进。

## 测试断言逻辑

1. 有脚本步骤且 projection 为空：`refreshCurrentHighlight()` 返回 `false`；`refreshLegacyHighlight()` 调用计数为 `0`；modal 写入计数为 `0`；宿主 action 调用数组为空；StepScript trace 和外部 trace 均包含 `scripted-step-idle`。
2. 收敛回归：先生成 `ensureSurfaceThenHighlight`，再把 `civilization` 面板置为已满足状态，连续刷新 3 次；每次返回 `false`，面板值不变，legacy 调用、modal 写入、事件发出均为 `0`，action 调用总数不增加。
3. 无脚本步骤：继续调用 `refreshLegacyHighlight()`，调用计数保持 `1`。
4. overlay 回归：advisor/reward overlay 激活时仍允许脚本评估后回落旧引擎。

## 测试数字原文

`node --test frontend/js/tutorial/TutorialHostContextStepScript.test.js`

```text
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 92.7393
```

教程相关测试集合：

```text
ℹ tests 80
ℹ suites 0
ℹ pass 80
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 276.3706
```

`npm test`

```text
ℹ tests 2480
ℹ suites 0
ℹ pass 2480
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6538.0015
```

## 未做

- playtest 动态终验未做。
- advisor/reward overlay 回落未动。
- S9c 全量退役未动。
- `docs` 与监督者署名文档未改。
- 未访问公网。
- 未 push。
