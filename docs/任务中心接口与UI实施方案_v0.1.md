# 任务中心接口与 UI 实施方案 v0.1

创建时间：2026-05-22 15:39:04 +08:00

## 目标

把前期主线任务从单条引导条扩展为常驻任务中心，并保持现有 Canvas 单套代码继续工作。任务中心入口放在右下角底部页签上方，点击后打开任务列表，列表包含每日任务、主线任务、赛季任务、挑战任务四个标签。

第一阶段只迁移和包装现有主线引导任务，确保原有强引导、奖励弹窗、前往目标和领取奖励流程不被破坏。每日、赛季、挑战先保留接口和空状态，后续可以直接补任务数据。

## 接口约定

### GET /api/game/tasks

返回当前玩家任务中心数据：

```json
{
  "taskCenter": {
    "visible": true,
    "activeTab": "main",
    "tabs": [
      { "id": "daily", "label": "每日任务", "badge": 0 },
      { "id": "main", "label": "主线任务", "badge": 1 },
      { "id": "season", "label": "赛季任务", "badge": 0 },
      { "id": "challenge", "label": "挑战任务", "badge": 0 }
    ],
    "categories": {
      "daily": { "tasks": [], "emptyText": "暂无每日任务" },
      "main": { "tasks": [] },
      "season": { "tasks": [], "emptyText": "暂无赛季任务" },
      "challenge": { "tasks": [], "emptyText": "暂无挑战任务" }
    },
    "summary": { "claimableCount": 0, "activeCount": 0 }
  }
}
```

### POST /api/game/tasks/claim

请求体：

```json
{ "taskId": "barracks_supplies", "category": "main" }
```

主线任务先复用现有 `GuideTaskService.claimReward`，返回结构兼容原有 action 结果，并附带最新 `taskCenter`、`guideTasks`、`softGuide`、`eraProgress`。

## 前端约定

- `GameAPI.getTasks()` 拉取任务中心。
- `GameAPI.claimTaskReward(taskId, category)` 领取任务奖励。
- `GameStateManager.sync()` 保存 `taskCenter`，缺省时由 `guideTasks` 兜底。
- `UIStatePresenter.buildTaskCenterViewState()` 统一整理四个标签、角标、空状态和主线任务兜底。
- `CanvasGameRenderer` 渲染右下角任务入口和任务面板，命中动作包括 `openTaskCenter`、`closeTaskCenter`、`switchTaskCenterTab`、`claimTaskReward`、`goToGuideTaskTarget`。
- `CanvasGameShell` 保存面板开关和当前标签，领取后展示现有奖励弹窗并刷新状态。

## 分步实施

1. 文档初始化：记录接口、UI、测试和提交节奏。
2. 后端任务中心：新增服务和接口，状态返回附带 `taskCenter`。
3. 前端 API 与状态：新增任务接口调用和状态归一化。
4. Presenter：抽象任务中心视图状态，兼容旧 `guideTasks`。
5. Canvas UI：右下角任务入口、四标签任务面板、列表按钮和空状态。
6. Shell 交互与版本：接入点击、领取、刷新、版本号推进，全量测试后推送双远端。

## 提交与测试记录

| 时间戳 | 提交 | 内容 | 测试 |
| --- | --- | --- | --- |
| 2026-05-22 15:39:04 +08:00 | `bb1181d` | 初始化任务中心实施文档 | `git diff --check` |
| 2026-05-22 15:48:04 +08:00 | 待回填 | 新增后端任务中心服务、状态快照、获取接口和领取接口 | `node --test backend\tests\task-center-service.test.js backend\tests\guide-task.test.js backend\tests\guide-task-newbie-flow.test.js` |
