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
| 2026-05-22 15:48:04 +08:00 | `99be29e` | 新增后端任务中心服务、状态快照、获取接口和领取接口 | `node --test backend\tests\task-center-service.test.js backend\tests\guide-task.test.js backend\tests\guide-task-newbie-flow.test.js` |
| 2026-05-22 15:53:35 +08:00 | `9e050fd` | 接入前端任务中心 API、接口状态归一化和运行时状态保存 | `node --test frontend\tests\game-api.test.js frontend\tests\frontend-game-state.test.js frontend\tests\game-state-manager.test.js` |
| 2026-05-22 15:55:46 +08:00 | `5b519dd` | 新增任务中心 Presenter 视图模型，兼容新 `taskCenter` 和旧 `guideTasks` | `node --test frontend\tests\ui-state-presenter.test.js` |
| 2026-05-22 16:04:50 +08:00 | `022c256` | 新增 Canvas 任务入口、任务中心弹层、四分类标签、列表操作和跨端交互接入 | `node --test frontend\tests\canvas-action-dispatcher.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\h5-canvas-runtime.test.js frontend\tests\minigame-platform.test.js` |
| 2026-05-22 16:08:00 +08:00 | 本提交 | 推进版本号到 `0.1.50`，更新版本测试并执行全量回归 | `npm.cmd test` |
| 2026-05-22 17:35:15 +08:00 | 本提交 | 调整主线领奖强引导：完成任务后先引导右下角任务图标，打开任务面板后再移动到主线领取按钮；版本推进到 `0.1.53` | `node --test backend\tests\guide-task.test.js backend\tests\task-center-service.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\h5-canvas-runtime.test.js frontend\tests\minigame-platform.test.js frontend\tests\ui-state-presenter.test.js frontend\tests\app-tutorial-targets.test.js frontend\tests\version-number.test.js frontend\tests\stage5-version.test.js`; `npm.cmd test` |
| 2026-05-22 18:13:42 +08:00 | 本提交 | 修复任务图标打开面板后未继续高亮主线领取的问题：主线可领取时强制回到主线标签；补接口侧在线资源进度和五资源顶栏紧凑显示；版本推进到 `0.1.54` | `node --test frontend\tests\shared-canvas-renderer.test.js frontend\tests\ui-state-presenter.test.js backend\tests\resource-tick.test.js frontend\tests\h5-canvas-runtime.test.js frontend\tests\minigame-platform.test.js`; `npm.cmd test` |
| 2026-05-22 18:44:28 +08:00 | 本提交 | 修复领奖后旧领取按钮高亮残留：领奖成功后按最新强引导移动到下一目标，软引导会清理旧高亮；放大顶栏资源图标到可读尺寸；版本推进到 `0.1.55` | `node --test frontend\tests\app-tutorial-targets.test.js frontend\tests\minigame-platform.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\h5-canvas-runtime.test.js frontend\tests\canvas-action-dispatcher.test.js`; `npm.cmd test` |
| 2026-05-22 18:55:10 +08:00 | 本提交 | 继续修复任务领奖后引导停留在领取按钮：领奖后的主线任务统一返回强引导，H5 Canvas Shell 会关闭任务面板并按最新目标重定位高亮；资源栏图标放大到 `30px`，强引导高亮保持持续可见；版本推进到 `0.1.56` | `node --test backend\tests\guide-task-newbie-flow.test.js backend\tests\guide-task.test.js frontend\tests\h5-canvas-runtime.test.js frontend\tests\minigame-platform.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\app-tutorial-targets.test.js frontend\tests\version-number.test.js frontend\tests\stage5-version.test.js`; `npm.cmd test` |
| 2026-05-22 19:28:42 +08:00 | 本提交 | 抽出 `CanvasGuideController`：引导目标映射、任务领奖跳转、建筑列表可见性和侦察视图切换只保留一份共享 Canvas 规则，入口文件只做运行时/渲染适配；版本推进到 `0.1.57`。 | `node --test frontend\tests\canvas-action-dispatcher.test.js frontend\tests\shared-canvas-renderer.test.js frontend\tests\minigame-platform.test.js frontend\tests\h5-canvas-runtime.test.js frontend\tests\app-tutorial-targets.test.js`; `npm.cmd test` |
