# 世界行军系统设计说明

## 设计意图

世界侦察/行军属于大地图玩法，不属于底部军事页。用户在大地图上选择目的地，系统把点击位置映射到最近 tile，再通过 canvas HUD 发起行军。军事编队仍然是主城内部的军事能力，行军只引用编队结果，不复制编队编辑逻辑。

本轮实现遵守三条边界：

- 领域状态不写进 renderer：`WorldMarchSystem` 只计算路线进度、当前位置、剩余时间、停止落点和 actor view model。
- 动态单位不写进 tile renderer：`WorldActorCanvasRenderer` 只绘制移动单位和绿色目的地箭头，并生成单位点击 hit target。
- HUD 不做业务提交：`WorldMarchHudCanvasRenderer` 只绘制目标 HUD、编队选择、单位命令，实际动作由 `CanvasActionController` 转交 API。

资源身份也明确分离：`tutorial_intro_soldier.move` 和 `scout_squad_default.move` 是两个 manifest key。当前可以指向同一批序列帧，后续替换侦察编队兵种时不影响新手引导入城动画。

## 实际操作流程

1. 用户点击大地图任意 tile 区域。
2. `WorldMapRuntime` 命中 `selectWorldMarchTarget`，保存 `territoryUiState.worldMarchTarget`。
3. 大地图渲染目标 HUD，显示目的地坐标和“行军”按钮。
4. 点击“行军”后打开 canvas 编队选择 HUD。
5. 用户选择一个非空编队，触发 `startWorldMarch`。
6. 前端调用 `/api/game/action`，后端以 `mode: manual` 创建持久化行军任务。
7. 大地图把任务转成 world actor，绘制移动单位和绿色箭头。
8. 点击移动单位后显示单位 HUD，可选择“回城”或“停止”。

“停止”按当前段进度在前端计算建议 tile：靠近下一格则停下一格，靠近上一格则回退上一格。后端接收目标 tile 后截断/重定向任务。当前后端仍复用 `WorldExplorerService` 的 mission 数据结构，后续可以迁移到独立 `WorldMarchService`，前端 action 名无需变化。

新手侦察引导也走同一条路径：编队保存后直接保持在 9:16 大地图首页，引导玩家点击地图目标，再点击“行军”，再选择第一支编队。旧的“打开军事面板 -> 切世界页 -> 点随机探索”入口已经从引导和空闲 HUD 中移除，避免两个流程同时存在。

## 实现方案

- `frontend/js/domain/WorldMarchSystem.js`
  - 纯函数领域层。
  - 输入任务和时间，输出 actor、当前位置、剩余秒数、停止 tile。
  - 提供 screen point 到 nearest tile 的映射工具。

- `frontend/js/platform/renderers/WorldActorCanvasRenderer.js`
  - 绘制世界单位、绿色箭头、单位 hit target。
  - 使用 `scout_squad_default.move` 资源 key。

- `frontend/js/platform/renderers/WorldMarchHudCanvasRenderer.js`
  - 绘制目标 HUD、编队选择 HUD、单位命令 HUD。
  - 不直接调用 API。

- `frontend/js/platform/renderers/WorldMapCanvasRenderer.js`
  - 只负责组合 tile、actor、HUD。
  - 保留旧 `activeScouts` 兼容读取，但把动态单位绘制委托出去。

- `frontend/js/tutorial/TutorialGuideController.js`
  - 教程只发出 canvas action 高亮，不直接提交业务。
  - `selectWorldMarchTarget` 推进到目标已选 step，`openWorldMarchFormationPicker` 和 `startWorldMarch` 继续完成出征链路。
  - 引导期间由 canvas 输入盾拦截非目标区域，地图拖动不会穿透。

- `backend/services/worldExplorer/WorldExplorerActions.js`
  - 新增 `startWorldMarch`、`returnWorldMarch`、`stopWorldMarch`。
  - 现阶段复用 manual explore mission 作为持久化行军任务。

## 测试覆盖

- `frontend/js/domain/WorldMarchSystem.test.js` 覆盖进度、剩余时间、停止落点和屏幕点到 tile 的映射。
- `frontend/js/platform/renderers/WorldActorCanvasRenderer.test.js` 覆盖 actor 绘制和单位命中区域。
- `frontend/js/platform/renderers/WorldMarchHudCanvasRenderer.test.js` 覆盖目标 HUD、编队选择和单位命令。
- `frontend/js/tutorial/TutorialGuideController.test.js` 覆盖教程从保存编队到地图行军、等待归队、领取归队奖励。
- `frontend/js/platform/interactions/TechTreeInteractionModel.test.js` 中补充了 action controller 点击目标后推进教程并刷新高亮的连接测试。
- `backend/tests/WorldExplorerService.test.js` 覆盖后端行军开始、回城、停止等 mission 行为。

## 约束

- 不允许 DOM UI。所有 HUD、按钮、命中区域都走 canvas。
- 底部地图 dock 不再暴露“军事”入口。
- 主城入城后的军事/编队编辑功能保留。
- 后续新增兵种时只新增 manifest key 和 actor 类型，不修改教程资源身份。
