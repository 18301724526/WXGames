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
- `backend/services/worldMap/WorldMapTopology.js` 已提供后端同口径 topology metadata、canonical tile id、display tile id、wrapped delta/distance 和 generation coordinate。
- `WorldMapService` 仍保留前端兼容的 display `q/r`，但 tile 已写入 `worldQ/worldR/canonicalId`；upsert/normalize 按 canonical id 合并，避免环绕边缘生成重复世界格。
- `WorldMapService` 默认使用服务器共享 `DEFAULT_WORLD_SEED`；旧的 `world-${playerId}` 派生 seed 在 normalize 时迁移到共享世界 seed，避免每个账号生成不同世界。
- `TileMapGeometry` 已接入 stable coordinate semantics，并继续承担 diamond isometric projection 兼容 facade。
- `WorldChunkAddress` 已提供 candidate chunk addressing contract: chunk size, chunk id, tile-to-chunk mapping, chunk bounds, and wrapped tile-rect expansion.
- `WorldInterestWindow` 已提供 candidate visible/preload/AOI window contract, including topology summary, wrapped chunk lists, and wrapped tile membership checks.
- `WorldRevealStore` 已提供 candidate revealed-terrain persistence contract, storing revealed tile records and materialized chunk ids without renderer payloads or full `worldMap` arrays.
- `WorldMapRenderSnapshot`、`WorldMapEntitySnapshot`、`WorldMapVisibilityModel`、`WorldMapPerformanceBudget` 已有 compact snapshot 和性能预算。
- `WorldMapCanvasRenderer` 已拆成 layout/cache/static/water/site/military/tile-map/actor/HUD 等候选模块。
- `WorldMapRuntime` 已拆出 bake、camera、input、render policy 和 render pipeline。

待硬化：

- 让下游 world map presenter/runtime/renderer 逐步消费 `TileCoord`, `WorldTopology`, `WorldChunkAddress`, `WorldInterestWindow`, and `WorldRevealStore`，减少各自重复坐标 math。
- 把全量 tile array 假设改成 chunk/window/reveal model，并保持已揭开地形可持久查询。
- 后端 canonical topology 仍是 `candidate`，需要前端 presenter/runtime/renderer 和后续多人 AOI 消费后再评估 stable promotion。
- 这些大地图契约仍是 `candidate`，不得在下游消费者证明 extension surface 前晋升 `stable`。

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
- `CommandAuthorityContract` is the candidate backend-authoritative command envelope for accepted/rejected intent results.
- `ServerTimelineSnapshot` is the candidate server-owned movement timeline and frontend interpolation boundary.
- `AoiSyncSnapshot` is the candidate bounded AOI delta/snapshot boundary.
- `backend/services/VersionService.js` ignores local SQLite/log/playtest runtime artifacts when computing `deploymentId`, so local persistence writes do not trigger false update reloads during active sessions.
- World-march stop commands are now intent-only and derive the stop tile from the server timeline instead of frontend final coordinates.
- Territory scout/conquest/claim actions attach the same command authority envelope.
- `backend/services/WorldAiExplorerService.js` 是候选 AI 探索服务：AI reveal 写入服务器地图但保持 `visibility: hidden`，客户端输出、玩家路线选择、领地侦察和 AOI snapshot 都过滤 hidden tile。
- AI 与玩家 reveal frontier 相遇后，服务端按有界上限同步 AI 已解锁地形给玩家；同步时保留 canonical identity，并将 display `q/r` 投影到玩家附近，避免环绕边缘 tile 在当前前端坐标系里跳到远处。

待硬化：

- 所有移动、停止、战斗、占领命令统一收口到 authority contract。
- 停止移动不接受前端最终坐标，由后端根据服务器时间线计算。
- AOI 同步按几百支队伍目标设计。
- AI 探索同步当前是服务端状态闭环，不是多人 transport；后续需要接入真正 AOI delta delivery、压力测试和前端 chunk/window/reveal store。
- Realtime authority modules remain `candidate`; do not promote them before multiplayer transport and downstream presenters consume the contract without churn.
- Combat internals and occupation result calculation still need deeper contract hardening behind the authority envelope.
- AOI sync still needs stress checks for hundreds of teams and transport-level delta delivery.

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
- `ConfigRegistryContract` 已作为 P11-006 phase 1 candidate：统一 registry metadata、schemaVersion、version、stable content hash、entry id 校验、版本比较和 bump recommendation。
- `TaskDefinitionNormalizer`, `BuildingConfig`, `GameConfig`, `EraConfig`, `TutorialFlowConfig`, `BattleConfig`, and `TechTreeConfig` 已暴露 registry metadata/validation，并已纳入 `npm run test:architecture`。
- `ServerRandomAuthorityContract` 已作为 P11-006 phase 2 candidate：统一后端权威 random roll envelope、bounded unit roll、chance roll、deterministic test injection。
- `TerritoryScoutResults` 已消费 `ServerRandomAuthorityContract`，侦察 outcome 和生成地点 template roll 默认不再直接依赖 `Math.random`。
- `FamousPersonRandomAuthority` 已作为 P11-006 phase 3 candidate：名士候选生成默认消费后端权威 random source，并在候选人 `source.randomAuthority` 写入紧凑审计 metadata。
- `DefenderLeaderRandomAuthority` 已作为 P11-006 phase 4 candidate：守军首领生成默认消费后端权威 random source，并在首领 `source.randomAuthority` 写入紧凑审计 metadata。
- `WorldMapGenerationAuthority` 已作为 P11-006 phase 5 candidate：世界地图地形、水域、河流和侦察揭示分支走 server-owned deterministic seeded-hash authority，`WorldMapService` 写入紧凑 `generationAuthority` metadata。
- `SkillGeneratorRandomAuthority` 已作为 P11-006 phase 6 candidate：技能/ability-kit 生成默认消费后端权威 random source，并在默认生成结果写入紧凑 `randomAuthority` metadata。
- `TalentPolicyService.createCustomPolicyId()` 已从业务 `Math.random` 迁移到 backend `crypto.randomBytes()`；业务代码 `Math.random` 扫描当前为 clean。
- 战斗经验/奖励当前是 `BattleReports.createExperienceSummary()` 中的确定性公式逻辑，不是随机权威迁移对象；未来引入掉落/概率奖励时再接入 random authority。

待硬化：

- 新增配置域必须统一进入可校验 registry；当前核心后端配置域已经接入 registry contract。
- 版本提示和配置版本差异走统一更新通道。
- 未来新增的掉落、概率奖励、更多生成结果继续收束到后端权威 random authority adapter/service。

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

## 9. 浏览器视觉验收 / Browser Visual Acceptance

涉及真实玩家输入、Canvas 像素、教程高亮、按钮可见性、线上部署路径或浏览器兼容风险的改动，不能只用单元测试结论判断玩家是否看得见、点得到。

当前严格验收工具：

- `scripts/playtest-online-tutorial.js`
- `npm.cmd run playtest:online-tutorial`

该工具必须保留以下证据和检查：

- 每个关键动作的 before/after full screenshot。
- 点击目标裁剪图、精确目标裁剪图、教程高亮裁剪图。
- PNG 像素检查：目标可见比例、目标亮度/颜色复杂度、黄色高亮边框像素。
- 中心点 hitTarget 检查：点击中心必须命中预期 action。
- 教程遮罩检查：被引导 action 不得被 tutorial shield 阻挡。
- API/结果检查：涉及后端 action 的步骤必须看到成功回包或预期状态变化。
- Authority 检查：世界行军、征服、征服领取等步骤必须看到 server-owned authority envelope。
- 人工抽查：至少打开关键步骤截图，确认高亮、按钮和玩家反馈肉眼可见。

线上严格引导验收命令：

```powershell
$env:PLAYTEST_GAME_URL='http://47.116.32.216/wxgame/'
$env:PLAYTEST_API_BASE='http://47.116.32.216:3000/api'
$env:PLAYTEST_USERNAME='codexqa'
$env:PLAYTEST_PASSWORD='123456'
$env:PLAYTEST_RESET_ACCOUNT='1'
$env:PLAYTEST_MAX_ACTIONS='160'
$env:PLAYTEST_OUTPUT_DIR='.local-logs/online-tutorial-strict'
npm.cmd run playtest:online-tutorial
```

当修改只触达纯 domain/calculator/schema 且不影响真实输入或 Canvas 可见性时，仍以代码层回归为主；当修改触达教程、Canvas hitTargets、遮罩、高亮、线上资源加载或部署路径时，必须跑上述截图验收。

## 10. 回归 / Regression

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
