# 当前玩法设计 / Current Gameplay Design

日期 / Date: 2026-06-09

状态 / Status: authoritative

用途 / Purpose:

这份文档是当前玩法口径的唯一权威入口。旧的 v0.x 战斗、领土、科技、事件、任务、tile world、handoff、release notes 和测试用例文档不再作为当前玩法依据。

## 1. 玩法总览 / Gameplay Overview

玩家通过城市经营获得资源，通过建筑和科技推进文明，通过名人和军队形成扩张能力，通过世界地图探索、占领和战斗扩大势力。任务和新手引导负责把所有已开放系统串成可学习流程。

核心循环：

```text
资源生产 -> 建筑/科技/任务 -> 名人/军队/编队 -> 世界探索 -> 占领/战斗 -> 新资源和新目标
```

## 2. 后端权威 / Server Authority

所有玩家命令都必须由后端确认。前端只提交意图，不提交最终结果。

命令包括但不限于：

- 建造、升级、进阶时代
- 分配人口或人才
- 研究科技
- 寻访、接受、遣散或培养名人
- 保存军队编队
- 侦察、行军、停止、返回、占领
- 战斗、领奖、任务完成

失败处理：

- 后端确认失败时，前端显示确认框。
- 确认框展示原因，例如数据异常、网络连接中断、版本不一致、资源不足、目标无效。
- 前端等待确认期间可以显示 pending 状态，但不能让玩法结果生效。

## 3. 城市、资源与建筑 / City, Resource, Building

当前代码事实：

- `backend/config/GameConfig.js` 定义基础资源、人口和离线效率。
- `shared/buildingConfig.json` 通过 `backend/config/BuildingConfig.js` 被读取。
- 建筑成本、升级、维护预览、规模成长和效果计算已经有配置入口。
- `backend/actions/BuildBuildingAction.js` 和 building services 负责后端权威执行。

稳定边界：

- 城市和建筑是长期核心系统。
- 资源、建筑、科技效果最终应配置化。
- 建筑具体数值、开放等级、队列数量、科技影响建造队列的方式暂不封死。

## 4. 科技 / Technology

当前代码事实：

- `backend/config/TechTreeConfig.js` 定义时代科技点、可选限制、科技路线和节点布局。
- `backend/services/TechTreeService.js` 负责研究。
- 前端 presenter/renderer 已有 tech tree view state 和 Canvas 渲染路径。

稳定边界：

- 科技长期影响文明发展方向。
- 科技应通过配置表和 registry 扩展。
- 具体科技树形状、数值、解锁效果仍可调整。

## 5. 名人、人才与编队 / Famous Person, Talent, Formation

当前代码事实：

- famous person、skill generator、talent policy、military formation 已拆到后端服务和前端 presenter/action handler。
- 军队编队是世界地图移动的长期单位。

稳定边界：

- 世界地图上的最小移动单位是军队、编队或队伍。
- 千人级士兵碰撞不作为世界地图常驻粒度，应放入战场副本。
- 名人属性、成长、技能、岗位、方针和派遣规则仍按配置与策略扩展。

## 6. 世界地图 / World Map

世界地图固定为**菱形等距 tile 世界地图**，不是 hex，不是 3D，也不是自由坐标大地图。

稳定规则：

- 新 stable contract 使用 `x/y` 或 `col/row`。
- 当前代码中的 `q/r` 是历史兼容 alias。
- 地图必须支持全方向循环。
- 前端不能假设持有全世界 tile 数组。
- 已揭开的地形必须长期存在，chunk 卸载不能导致黑边或丢失已知地形。
- 世界生成必须可复现。相同 seed 和坐标生成同一块地形。
- 多人接壤后，已解锁或已物化地图以后端保存结果为准。

当前代码事实：

- `backend/services/WorldMapService.js` 提供 seed、tile reveal、scout reveal、terrain generation 和 client world map 输出。
- `frontend/js/domain/TileMapGeometry.js`、`WorldMarchGeometry.js` 和 renderer layout 使用 `(q-r, q+r)` 等距投影。
- `WorldMapRenderSnapshot`、`WorldMapEntitySnapshot`、`WorldMapPerformanceBudget` 已经把大地图结构推向 compact snapshot。

待硬化：

- `TileCoord`
- `WorldTopology`
- `WorldChunkAddress`
- `WorldInterestWindow`
- `WorldRevealStore`

## 7. 探索、行军、占领 / Exploration, March, Conquest

当前代码事实：

- `GameActionRegistry` 已统一注册 `startExplore`、`startWorldMarch`、`stopWorldMarch`、`returnWorldMarch`、`claimExplore`、`startConquest`、`claimConquest` 等动作。
- `WorldExplorerService` 和 split modules 负责探索任务、路线、进度和 DTO。
- 前端 `WorldMarchProgressSnapshot`、`WorldMarchGeometry`、`WorldMarchSystem` 负责进度和表现兼容。

稳定规则：

- 前端不提交最终坐标。
- 停止移动应提交停止意图，后端根据服务器时间线计算当前位置。
- 玩家离线时世界继续推进，保护规则由后端负责。
- 前端表现按后端确认后的时间线插值。

## 8. 阵营交互 / Diplomacy Interaction

长期规则：

- 敌对势力直接拦截或攻击。
- 中立势力弹提示或请求确认。
- 同盟势力不阻挡、不拦截。

暂不封死：

- 接触范围
- 拦截冷却
- 战斗触发概率
- 中立提示文本和二次确认流程

## 9. 战斗 / Battle

当前代码事实：

- 当前后端战斗内核是 `attribute-auto-battle-v2`。
- 已有速度排序、条件释放、冷却、状态系统、结构化战报和战场 Canvas 表现。
- 当前实现仍是自动战斗/回合式底座，不是最终实时碰撞战斗。

长期规则：

- 战斗结果必须以后端为准，防止作弊。
- 前端可以表现战斗过程，但死亡、伤兵、奖励、占领和消耗以后端结算确认。
- 世界地图上队伍接触后，大地图时间仍继续。

暂不封死：

- 战斗副本是否实时碰撞。
- 单场士兵数量上限。
- 技能释放、士气、补给、连续作战和地形影响。

## 10. 任务和新手引导 / Task And Tutorial

当前代码事实：

- `backend/config/defaultTaskDefinitions.json` 是默认任务定义。
- `TaskDefinitionService` 支持 JSON/xlsx payload 导入、预览、保存、回滚和模板 workbook。
- `TutorialFlowConfig` 定义 tutorial step 和客户端 gate。
- 前端 `TutorialGuideStepPolicy`、`TutorialGuideTargetResolver`、`TutorialGuidePhaseHighlights`、`TutorialGuideUiStateCoordinator` 已拆分。

稳定边界：

- 新手引导和任务系统长期存在。
- 任务和引导数据应配置化，支持策划表格工作流。
- Excel/table source -> validation tool -> JSON/registry 是长期目标。

暂不封死：

- 任务文案。
- 奖励数值。
- 引导步骤数量。
- 顾问台词和分支节奏。

## 11. 配置和热更新 / Config And Hot Update

长期规则：

- 建筑、科技、兵种、名人、任务、资源、地图生成和奖励等配置必须有版本号。
- 配置更新自动提升小版本。
- 大版本手动定义。
- 客户端自动提示当前版本和实际版本差异。
- 随机结果以后端为准，包括探索奖励、战斗结果、名人出现、资源生成和地图物化。

## 12. 当前不封死的玩法 / Flexible Gameplay

以下内容不得晋升为 stable 实现：

- 具体战斗公式和战斗副本模拟。
- 地图生成公式、资源分布和地形概率。
- 建筑队列数量和科技影响细节。
- 名人池、品质、成长公式和技能池。
- 赛季重开保留资产清单。
- 多人是局域网还是公网网游。
