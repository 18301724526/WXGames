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
- 世界生成必须可复现。相同全服 seed、坐标和生成算法版本生成同一块基础地形。
- 基础地图随机但固定：重置账号、重新复活或从不同方向探索到同一坐标时，基础地形、水体和过渡地形必须一致。
- 多人接壤后，已解锁或已物化地图以后端保存结果为准；物化只是提交/缓存全服确定性结果和动态内容，不能让首个探索玩家改变基础地形。

当前代码事实：

- `backend/services/WorldMapService.js` 提供共享服务器 seed、tile reveal、scout reveal、terrain generation、canonical tile identity 和 client world map 输出。
- `backend/services/WorldAiExplorerService.js` 已提供候选 AI 探索闭环：AI 自己揭开服务器地形，未接壤前不暴露给玩家；接壤后由服务端同步 AI 已解锁地形给玩家。
- `frontend/js/ecs/foundation/TileMapGeometry.js`、`WorldMarchGeometry.js` 和 renderer layout 使用 `(q-r, q+r)` 等距投影。
- `WorldMapRenderSnapshot`、`WorldMapEntitySnapshot`、`WorldMapPerformanceBudget` 已经把大地图结构推向 compact snapshot。

待硬化：

- 前端 presenter/runtime/renderer 消费后端 canonical tile identity。
- `TileCoord`
- `WorldTopology`
- `WorldChunkAddress`
- `WorldInterestWindow`
- `WorldRevealStore`

## 7. 探索、行军、占领 / Exploration, March, Conquest

当前代码事实：

- `GameActionRegistry` currently registers world exploration through `startWorldMarch`, `returnWorldMarch`, `stopWorldMarch`, `startConquest`, and `claimConquest`; retired scout-report actions are not registered.
- `WorldExplorerService` and split modules own world-march mission planning, route progress, discovery, and DTO mapping.
- 前端 `WorldMarchProgressSnapshot`, `WorldActorProjection`, `WorldMarchGeometry`, and `WorldMarchSystem` own progress facts, visible actor projection, geometry, and rendering-facing march state.

Implemented: March Formation Strength

- The formation panel is now a standing-troop editor, not a temporary expedition soldier input. It separates selected members, confirmed per-member soldier assignments, and an unconfirmed replenishment draft.
- Each selected hero has troop controls under the portrait: a slider hit area and a numeric input hit area. Manual input and auto replenish only change the draft; confirm replenishment promotes the draft into the formation save payload.
- First-version cap is config-driven by `formationMemberSoldierCap: 1000` per member. Hero level, command, tech, building, and troop-type growth must extend that config contract instead of hardcoding UI limits.
- Formation troops are standing troops assigned to the formation and do not count against city reserve capacity. After assigning reserve soldiers into a formation, the city can recruit new reserve soldiers up to `soldierCap` again.
- Saving a formation with higher assigned troops deducts the delta from the current city reserve and charges no resources; recruitment resources (`recruitmentCostPerSoldier`) are charged only when barracks training adds soldiers to the reserve. If reserve soldiers are insufficient, the backend rejects the save.
- Saving a formation with lower assigned troops does not return soldiers to city reserve. It refunds configured resources through `soldierRefundRatio` as the interim stand-in for the future veterans-camp (老兵营地) drain-refund feature; battle losses do not refund resources.
- Reallocating the same total troop count inside one formation does not deduct soldiers and does not refund resources.
- Starting a world march freezes the saved standing formation into `mission.formationSnapshot` with `soldiersCommitted` and `soldiersRemaining`; AI, battle, and raid systems must consume that snapshot, not live city reserve soldiers.
- A formation away from home is backend-locked from editing while an active or unsettled idle march snapshot exists. Returning home settles surviving snapshot troops back into the saved formation.

Stable rules:

- Frontend does not submit final coordinates.
- Stop movement submits an intent; backend derives the current tile from the server timeline.
- Player logout does not cancel an already-started server-side world action.
- Frontend rendering interpolates only from backend-confirmed timeline facts.

## 8. 阵营交互 / Diplomacy Interaction

长期规则：

- 敌对势力直接拦截或攻击。
- 中立势力弹提示或请求确认。
- 同盟势力不阻挡、不拦截。

已确认待实现设计：共享世界 AI / Confirmed Pending Design: Shared World AI

- AI 世界状态是全服共享权威，不是每个玩家存档中的私有野地状态。
- 第一版 AI 必须主动攻击玩家，包括城市、已占领据点和正在大地图行军的部队。
- AI 只对当前在线玩家发起新的攻击。若玩家在 AI 攻击已开始后下线，本轮攻击继续结算完成；结算后该玩家不再被后续 AI 行为选为目标，直到重新在线。
- AI 运行范围只覆盖玩家已生成、已可见或近期活跃过的附近世界区域；无玩家生成的地图区域不凭空运行 AI。
- 山贼营寨、部落、遗迹守军和城邦都应作为 AI faction/site 的具体策略类型接入统一 AI，不做孤立的 `BanditService`。
- AI 袭扰必须造成实际压力：城市/据点袭扰扣除资源和城市预备兵或驻防兵；行军袭扰扣除 `formationSnapshot.soldiersRemaining`。
- AI 战斗和袭扰结果以后端结算为准，并生成玩家可读的 incident/report。
- AI 不能绕过世界地图、行军、城市、军队和战斗的服务边界直接改前端 DTO。

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
- 随机结果以后端为准，包括探索奖励、战斗结果、名人出现、资源生成和地图动态载荷；基础地形使用全服 seed + 坐标 + 生成算法版本的确定性结果，不属于玩家上下文随机结果。

## 12. 当前不封死的玩法 / Flexible Gameplay

以下内容不得晋升为 stable 实现：

- 具体战斗公式和战斗副本模拟。
- 地图生成公式、资源分布和地形概率。
- 建筑队列数量和科技影响细节。
- 名人池、品质、成长公式和技能池。
- 赛季重开保留资产清单。
- 多人是局域网还是公网网游。
