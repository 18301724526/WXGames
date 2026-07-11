# 北极星 S7 验证记录(2026-07-12)

## E1|query 表最小集

query 表条目数: **2**。

| query 名 | `TutorialHostContext` 宿主实现 | 为什么配置表达不了 |
|---|---|---|
| `isTaskCenterOpen` | `TutorialHostContext.isTaskCenterOpen()` | 同一步键必须在“打开任务中心”和“领取指定任务奖励”之间按模态面状态分支；固定步键加固定 target 只能表达其中一支，target 在重绘期暂时缺失也不能替代业务状态。 |
| `isCommandPanelOpen` | `TutorialHostContext.isCommandPanelOpen(panel)` | 同一步键在指定面板打开前后必须选择不同表现；面板名虽是固定参数，但“当前是否已打开”是 UI 事实，不能由步键和固定 target 推出。 |

门禁:

- `TutorialHostContext.queries(...)` 只接受表内名字，不能借该入口调用任意宿主方法。
- 每个条目同时携带唯一宿主方法与非空 `justification`；单测核验条目数与理由一一对应。

定向验证:

```powershell
node --check frontend/js/tutorial/TutorialEngineQueryTable.js
node --check frontend/js/tutorial/TutorialHostContext.js
node --test frontend/js/tutorial/TutorialEngineQueryTable.test.js
git diff --check
```

结果:语法检查与 `git diff --check` 通过；测试数字原文:

```text
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```
