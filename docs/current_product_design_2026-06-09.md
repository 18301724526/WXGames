# 当前产品设计 / Current Product Design

日期 / Date: 2026-06-09

状态 / Status: authoritative

用途 / Purpose:

这份文档是当前产品方向的唯一权威入口。早期路线图、v0.x 设计稿、交接文档、release notes 和阶段性任务文档不再作为产品判断依据。

## 1. 产品定位 / Product Positioning

本项目是**实时操作的 Civilization-like 策略经营游戏**。玩家从早期聚落出发，逐步经营城市、调配资源、发展科技、招募或培养名人、组织军队和编队，在菱形等距 tile 世界地图上探索、占领、战斗，并通过任务和引导学习完整系统。

长期体验目标：

- 文明发展不是线性关卡，而是持续运营的世界。
- 玩家操作要跟手，世界地图拖动至少保持 30 FPS，高端设备争取 60 FPS。
- 世界地图要给出超大型、近似无穷无尽的探索感。
- 玩家账号长期存在，世界可以重开。
- 防作弊优先于前端自由表现，所有权威结果以后端为准。

## 2. 平台原则 / Platform Principles

- 游戏内可见业务 UI 固定为 Canvas-only。
- 不使用 DOM overlay 实现按钮、面板、弹窗、任务、新手引导或 HUD。
- H5 和各类小游戏平台共用一套业务 UI 和渲染体系。
- 未来原生 App 属于复刻玩法或续作迭代，当前项目沉淀可迁移的领域数据、配置和接口。

## 3. 长期保留的核心领域 / Long-Term Scopes

以下系统是长期存在的核心产品域，后续只增加或扩展，不按删除设计：

- 城市 / cities
- 资源 / resources
- 建筑 / buildings
- 科技 / technology
- 名人 / famous persons
- 军队与编队 / armies and formations
- 世界探索 / world exploration
- 占领与势力交互 / conquest and diplomacy
- 战斗 / battle
- 新手引导 / tutorial
- 任务系统 / task center
- 配置和版本管理 / config and versioning

这些领域可以固定边界，但具体数值、公式、战斗表现、科技效果、建筑队列、赛季保留清单仍允许迭代。

## 4. 世界与赛季 / World And Season

- 账号长期保留。
- 皮肤和成就长期保留。
- 货币、称号、历史战绩、收藏、长期资产等通过后续 `WorldSeasonCarryoverPolicy` 决定。
- 世界可以重开，但不能抹掉玩家愿意长期经营的账号沉淀。
- 配置和游戏迭代必须有版本提示。小版本由工具自动提升，大版本才手动确定，例如 `0.2` 到 `0.3`。

## 5. 性能目标 / Performance Target

- 用户拖动地图、点击按钮、下达命令时必须优先保持流畅。
- 低端机允许降低表现，不降低玩法结果。
- 允许降级：动画密度、远处单位细节、水面动画、特效数量、非关键对象刷新频率。
- 不允许降级：后端结算、资源收益、战斗结果、命令合法性、探索和占领结果。

## 6. 更新体验 / Update Experience

客户端应自动感知当前版本和实际版本差异，并提示玩家刷新同步。玩家不需要手动判断是否要更新。配置热更新、源码迭代和部署变化都应纳入版本检测。

当前代码事实：

- `backend/services/VersionService.js` 会生成版本、部署 ID、git commit 和源码 hash。
- 前端已有 update checker/runtime adapter 路径。
- 后续应把配置版本、客户端提示和自动小版本提升纳入稳定配置管线。

## 7. 设计边界 / Design Boundaries

已固定：

- Canvas-only。
- 后端权威。
- 菱形等距 tile 世界地图。
- 全方向循环世界。
- 账号与赛季世界分离。
- 配置数据长期走表格或 JSON registry。

未固定：

- 服务器 tick 间隔。
- 局域网联机还是公网网游。
- 战斗副本最终是实时碰撞还是抽象模拟。
- 地图生成公式、资源分布和难度曲线。
- 建筑队列数量、科技影响细节、赛季保留清单。
