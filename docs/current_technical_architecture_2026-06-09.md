# 当前技术架构 / Current Technical Architecture

日期 / Date: 2026-06-09

状态 / Status: authoritative

用途 / Purpose:

这份文档是当前技术架构的唯一权威入口。旧的架构计划、Canvas 迁移计划、runtime handoff、tile map handoff 和历史实现步骤文档不再作为当前技术判断依据。

## 1. 架构原则 / Architecture Principles

- Canvas-only: 游戏内可见业务 UI 只能走 Canvas 渲染和 Canvas hitTargets。
- Backend-authoritative: 前端提交意图，后端拥有状态、时间线和结果。
- Modular blocks: 候选模块先有 tests 和 extension path，再晋升 stable。
- Stable blocks are closed: stable 内部不因功能迭代随意修改。
- Data-driven gameplay: 配置数据通过 schema、version 和 registry 管理。
- Large-map first: 地图、渲染、同步和快照不能按小地图全量数组设计。

## 2. 分层 / Layers

```text
backend config/domain/calculators
  -> backend services/actions/repositories
  -> backend API DTO
  -> frontend domain snapshots
  -> frontend state presenters
  -> frontend platform shell/runtime/action handlers
  -> frontend renderers
```

方向必须单向。Renderer 不拥有权威玩法状态；前端 runtime 不决定战斗、奖励、最终坐标或资源结果。

## 3. 前端技术边界 / Frontend Boundary

当前代码事实：

- `frontend/js/domain`: pure rules, snapshots, time, geometry, performance budgets。
- `frontend/js/state`: presenters and normalizers。
- `frontend/js/platform`: Canvas shell, app runtime, action handlers, command service, feature registries。
- `frontend/js/platform/renderers`: drawing, layout, cache, hit targets, visual composition。
- `frontend/js/config`: feature flags, assets, tile assets, unit sprite manifest。

Canvas-only 规则由文档、脚本和架构测试共同守护。`scripts/verify-refactor-plan-doc.js` 会扫描 Canvas 业务层是否引入 DOM UI API。

## 4. 世界地图技术边界 / World Map Technical Boundary

Stable 目标使用 diamond isometric square-tile 语言，而不是 hex/axial 语言。

长期 stable contract:

- `TileCoord`: `x/y` 或 `col/row` stable 坐标，`q/r` compatibility alias。
- `WorldTopology`: full wrapping torus、坐标归一化、最短环绕距离。
- `WorldChunkAddress`: chunk id、chunk 坐标、chunk 覆盖范围。
- `WorldInterestWindow`: 当前视野、预加载窗口、AOI 描述。
- `WorldRevealStore`: 已揭开地形和已物化 chunk 的持久契约。
- `WorldMapRenderSnapshot`: 当前窗口、已揭开地形、可见 actor 的 renderer input。

当前代码事实：

- `TileCoord` 已提供 `x/y` stable coordinates、`q/r` compatibility aliases 和 deterministic `tileId`。
- `WorldTopology` 已提供 full wrapping torus、坐标归一化、最短环绕 delta/distance。
- `TileMapGeometry` 已接入 stable coordinate semantics，并继续承担 diamond isometric projection 兼容 facade。
- `WorldMapRenderSnapshot`、`WorldMapEntitySnapshot`、`WorldMapVisibilityModel`、`WorldMapPerformanceBudget` 已有 compact snapshot 和性能预算。
- `WorldMapCanvasRenderer` 已拆成 layout/cache/static/water/site/military/tile-map/actor/HUD 等候选模块。
- `WorldMapRuntime` 已拆出 bake、camera、input、render policy 和 render pipeline。

待硬化：

- 让下游 world map presenter/runtime/renderer 逐步消费 `TileCoord` and `WorldTopology`，减少各自重复坐标 math。
- 把全量 tile array 假设改成 chunk/window/reveal model。

## 5. 后端权威和实时同步 / Authority And Realtime Sync

稳定目标：

- `CommandAuthorityContract`: 所有玩家命令走后端确认，失败原因结构化返回。
- `ServerTimelineSnapshot`: 后端权威时间线，前端按确认时间线插值。
- `AoiSyncSnapshot`: 同区域事件和增量快照，不同步全世界。
- 前端渲染帧率和服务端同步频率解耦。

当前代码事实：

- `backend/actions/GameActionRegistry.js` 统一注册游戏动作。
- `backend/services/VersionService.js` 已有部署 ID、git commit 和源码 hash。
- `WorldExplorerDtoMapper` 是当前世界探索 DTO 边界。
- `GameStateMigrationPipeline` 是存档迁移边界。

待硬化：

- 所有移动、停止、战斗、占领命令统一收口到 authority contract。
- 停止移动不接受前端最终坐标，由后端根据服务器时间线计算。
- AOI 同步按几百支队伍目标设计。

## 6. 配置和数据 / Config And Data

稳定目标：

- Excel/table source -> validation tool -> JSON/registry。
- 配置必须有 version。
- 小版本自动提升。
- 大版本人工确认。
- 运行时模块读取 registry，不直接硬编码可配置玩法数据。

当前代码事实：

- `TaskDefinitionService` 已支持 JSON/xlsx 导入、预览、保存、回滚和模板 workbook。
- 建筑、科技、战斗、任务、教程已有配置模块或 JSON。
- `AssetKeyRegistry` 和 preload manifest 已经把资源 key 作为候选稳定边界。

待硬化：

- 把配置 schema/version guard 纳入 `npm run test:architecture`。
- 建筑、科技、兵种、名人、任务、资源、地图生成、奖励统一进入可校验 registry。
- 版本提示和配置版本差异走统一更新通道。

## 7. Stable Block Guard

当前新增：

- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`
- `scripts/check-stable-blocks.js`

`scripts/check-stable-blocks.js` 负责：

- 校验 manifest 结构。
- 校验责任索引中 `stable` 条目已登记到 manifest。
- 检测 stable 文件改动。
- 要求通过 `ALLOW_STABLE_BLOCK_REOPEN=1` 和 `STABLE_BLOCK_REOPEN_REASON` 显式声明 bug/performance/security/contract/governance reopen。

下一步：

- 逐步把成熟 candidate 加入 manifest。
- 加 dependency direction checks。
- 加 stable 文件禁止被 feature work 误改的 CI/本地门禁。

## 8. 官方文档集 / Official Docs

当前官方文档只保留：

- `docs/current_product_design_2026-06-09.md`
- `docs/current_gameplay_design_2026-06-09.md`
- `docs/current_technical_architecture_2026-06-09.md`
- `docs/long_term_architecture_refactor_plan_2026-06-08.md`
- `docs/architecture_module_responsibility_index_2026-06-08.md`
- `docs/stable_block_promotion_matrix_2026-06-09.md`
- `docs/stable_block_manifest_2026-06-09.json`

旧的 v0.x、handoff、release notes、xlsx 测试用例、早期任务计划和早期设计稿不再作为当前权威资料。

## 9. 回归 / Regression

架构改动必须运行：

```powershell
npm.cmd run test:architecture
```

该命令包含：

- registered syntax checks
- focused architecture tests
- stable block manifest guard
- official document guard
- `git diff --check`
