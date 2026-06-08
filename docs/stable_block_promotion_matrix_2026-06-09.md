# 稳定积木晋升矩阵 / Stable Block Promotion Matrix

日期 / Date: 2026-06-09

状态 / Status: active governance document

用途 / Purpose:

这份文档记录已经确认不会轻易改变的产品和架构不变量，并把它们转成模块封装准入标准。后续任何模块从 `candidate` 晋升 `stable` 前，都必须先通过这里的判断。

## 1. 已确认的不变量 / Confirmed Invariants

### 1.1 游戏与平台 / Game And Platform

- 游戏长期形态是实时操作的 Civilization-like 策略经营游戏。
- 核心玩法长期包含城市、资源、建筑、科技、名人、军队、编队、探索、占领、战斗、新手引导和任务系统；后续只会增加，不按删除这些核心领域设计。
- 前端游戏内可见业务 UI 固定为 Canvas-only，不使用 DOM overlay 实现按钮、面板、弹窗、任务或引导。
- H5 和各类小游戏平台共用一套通用前端架构，不维护多套业务 UI。
- 未来原生 App 属于复刻玩法或续作迭代，当前项目应优先沉淀可移植的数据契约、配置契约和领域规则。

### 1.2 世界地图 / World Map

- 世界地图固定为菱形等距 tile 地图 / diamond isometric square-tile map。
- 当前代码中的 `q/r` 属于历史兼容命名；新的 stable contract 应使用 `x/y` 或 `col/row`，并把 `q/r` 作为 compatibility alias。
- 世界拓扑必须支持全方向循环 / full wrapping torus。玩家从任意方向持续移动，最终都能回到原点附近。
- 地图目标规模是超大型，必须给玩家近似无穷无尽的世界感。
- 底层应采用有限超大环绕世界加 chunk/window 流式加载，不允许 stable 底层假设前端持有全世界 tile 数组。
- 世界生成必须可复现。相同 world/season seed 和坐标应稳定生成同一块地形。
- 已揭开的地形必须长期存在。Chunk 卸载不能丢失已探索地形、迷雾历史或玩家已知地标。
- 多人接壤后，已解锁或已物化的地图块必须由后端锁定为权威结果，不能再次随机生成。

### 1.3 后端权威与实时表现 / Server Authority And Real-Time Presentation

- 所有玩家命令必须走后端确认，包括移动、停止、建造、研究、招募、战斗、占领和采集。
- 前端不能提交最终坐标、奖励或战斗结果作为权威事实，只能提交意图命令。
- 后端拥有权威时间线。前端表现追随服务器确认后的时间线。
- 命令失败时，前端显示确认框和失败原因，例如数据异常、网络中断或版本不一致。
- 后端确认前，前端可以显示轻表现，例如命令下达中、等待确认或按钮 pending 状态，但不能让玩法结果生效。
- 玩家离线时世界继续推进，但保护规则由后端判定。
- 两支队伍接触或进入战斗后，大地图时间仍然继续。
- 战斗副本过程可以由前端表现，但最终死亡、伤兵、奖励、占领和消耗必须以后端结算为准。

### 1.4 多人同步与性能 / Multiplayer Sync And Performance

- 多人同区同步目标按重负载设计，默认考虑同一 AOI 区域几百支队伍可见或可同步。
- 同区同步使用 AOI/Interest Region、事件和增量快照，不同步全世界，不按前端渲染帧率逐帧同步。
- 前端渲染帧率和后端同步频率必须解耦。前端通过插值和本地表现达到 30 FPS，较高设备争取 60 FPS。
- 低端机允许表现降级，但玩法结果不能降级。可降级项包括动画密度、远处单位细节、水面动画、特效数量和刷新频率。
- 世界地图上的最小移动单位是军队、编队或队伍。千人级士兵碰撞放到战场副本，不作为世界地图常驻渲染粒度。
- 拖动地图必须优先保帧，不能因为远处生成、同步或动画导致操作卡顿。

### 1.5 阵营交互 / Diplomacy Interaction

- 敌对势力直接拦截或攻击。
- 中立势力进入接触范围时弹提示或请求确认。
- 同盟势力默认不阻挡、不拦截。
- 具体拦截范围、冷却、战斗触发概率和数值不在本矩阵中封死。

### 1.6 配置、版本与赛季 / Config, Version, Season

- 玩法数据必须配置化，长期目标是 Excel 或表格源数据经过校验工具转换为 JSON/registry。
- 建筑、科技、兵种、名人、任务、资源、地图生成和奖励等配置必须有版本号。
- 配置更新和普通迭代应自动提升小版本号，并自动提示客户端当前版本和实际版本。
- 手动提升版本只用于大版本，例如 `0.2` 到 `0.3`。
- 配置热更新允许刷新客户端同步后生效，不能要求玩家手动判断是否更新。
- 随机结果必须以后端为准，包括探索奖励、战斗结果、名人出现、资源生成和地图物化。
- 世界可以重开，但账号必须保留。皮肤、成就必须保留；货币、称号、历史战绩、长期资产等通过后续 `CarryoverPolicy` 决定，暂不封死清单。

## 2. 封装等级 / Encapsulation Levels

### 2.1 可以晋升 stable 的模块类型

这些模块封的是长期不变量，功能开发应通过公开接口、registry、adapter、pipeline 或新文件扩展。

| 模块类型 / Block Type | 可封内容 / Stable Surface | 禁止封死 / Do Not Freeze |
| --- | --- | --- |
| `CanvasDomBoundary` | Canvas-only 规则、DOM UI 禁令、平台宿主边界 | 具体页面视觉风格 |
| `TileCoord` / `TileMapGeometry` | 菱形等距投影、坐标转换、tile id、`q/r` 兼容 alias | hex 语义、具体地图生成 |
| `WorldTopology` | 全方向环绕、坐标归一化、最短环绕距离 | 地图大小具体数值 |
| `WorldChunkAddress` | chunk id、chunk 坐标、chunk 覆盖范围 | chunk 尺寸最终数值 |
| `WorldInterestWindow` | 视野窗口、预加载窗口、AOI 范围描述 | 具体预取半径 |
| `WorldRevealStore` | 已揭开地形、迷雾历史、已物化 chunk 缓存契约 | 地图生成算法 |
| `WorldMapRenderSnapshot` | 当前窗口、已揭开地形、可见 actor、渲染输入形状 | 全世界 tile 数组 |
| `WorldMapPerformanceBudget` | 大地图结构预算、快照大小、索引约束 | 单一设备 FPS 硬编码 |
| `CommandAuthorityContract` | 所有命令后端确认、失败原因、pending 状态 | 具体命令数值规则 |
| `ServerTimelineSnapshot` | 后端权威时间线、前端插值输入 | 服务器 tick 间隔 |
| `AoiSyncSnapshot` | 同区事件、增量快照、兴趣区域同步 | 联机模式是局域网还是网游 |
| `DiplomacyInteractionPolicy` | 敌对、中立、同盟的基础交互类别 | 拦截数值、冷却、概率 |
| `PerformanceTierPolicy` | 低端机表现降级等级、玩法不降级原则 | 具体特效资产 |
| `ConfigVersionRegistry` | 配置版本、小版本自动提升、客户端更新提示 | 大版本路线图 |
| `DataConfigRegistry` | 表格到 JSON/registry、schema 校验、运行时只读 | 具体数值内容 |
| `WorldSeasonCarryoverPolicy` | 账号与赛季世界分离、保留项由策略决定 | 未来所有保留清单 |

### 2.2 只能封接口的模块类型

这些领域确定会长期存在，但具体设计仍会变化。当前只能封接口、协议和扩展点，不能封实现细节。

| 领域 / Domain | 可以封 / Freeze Interface | 暂不封 / Keep Flexible |
| --- | --- | --- |
| 实时时间模型 | `TimeSource`、`ProgressPolicy`、服务器时间线输入 | tick 间隔、实时和准实时取舍 |
| 多人同步 | command/event/snapshot/AOI 协议 | 局域网、网游、服务器拓扑 |
| 地图生成 | seed、坐标、后端物化、chunk cache 契约 | 资源分布、地形算法、难度曲线 |
| 战斗系统 | 进入战场副本、结算回写、后端确认 | 实时碰撞、回合制、技能细节 |
| 建造系统 | 建造命令、队列接口、科技影响扩展点 | 队列数量、加成公式、建筑数值 |
| 科技系统 | 配置 schema、unlock/effect registry | 科技树形状和具体效果 |
| 名人系统 | 配置 schema、获得/派遣/成长接口 | 名人池、品质、成长公式 |
| 任务和引导 | 任务配置、阶段 gate、目标 resolver 接口 | 文案、步骤、奖励节奏 |
| 赛季重开 | 账号保留、赛季世界分离、carryover hook | 具体保留资产清单 |

### 2.3 暂不允许 stable 的模块类型

- 超过 500 行且仍包含多个职责的 facade。
- 仍把 `q/r` 当成 stable 公共语义而不是兼容 alias 的地图模块。
- 假设前端持有全世界地图数组的模块。
- 接受前端提交最终坐标、奖励或战斗结果的模块。
- 在 renderer、presenter 或 action handler 内直接写死玩法数值和随机结果的模块。
- 直接依赖 DOM UI 的 Canvas 业务模块。
- 没有 focused tests、性能约束或 extension path 的模块。

## 3. Stable 晋升检查 / Promotion Checklist

模块晋升 `stable` 前必须满足：

1. 责任单一，有清晰 owner file 或 owner folder。
2. 公开输入输出契约明确，且不暴露临时内部状态。
3. 有 focused tests 覆盖正常路径、边界路径和兼容路径。
4. 有性能约束，尤其不能全量复制超大型地图、全量同步世界或在拖动路径做重计算。
5. 有 extension path，未来功能通过 registry、strategy、pipeline、adapter、config 或新文件接入。
6. 遵守后端权威，不信任前端提交的最终结果。
7. 遵守 Canvas-only，不引入 DOM UI。
8. 遵守地图不变量：diamond isometric tile、full wrapping topology、chunk/window、reveal persistence。
9. 遵守配置不变量：versioned config、schema validation、runtime registry。
10. 在 `architecture_module_responsibility_index_2026-06-08.md` 记录状态变化、公开 API、扩展方式和回归命令。

## 4. 第一批晋升建议 / First Promotion Candidates

### 4.1 可优先硬化

- `FeatureFlags`
- `AssetKeyRegistry`
- `GameStateMigrationPipeline`
- `WorldExplorerDtoMapper`
- `WorldMapPerformanceBudget`
- `WorldMapRenderSnapshot`
- `WorldMapEntitySnapshot`
- `WorldMapVisibilityModel`
- `WorldMapRuntimeBakePolicy`
- `WorldMapRuntimeRenderPolicy`

### 4.2 先改名或补契约再晋升

- `WorldMarchGeometry`: 先把 stable contract 从 `q/r` 语义改为 `x/y` 或 `col/row`，保留 `q/r` alias。
- `TileMapGeometry`: 先明确 diamond isometric square-tile contract，并加入 full wrapping 入口或与 `WorldTopology` 组合。
- `WorldMapRuntimeCameraPolicy`: 先补 full wrapping camera/drag contract，避免封死无限平面假设。
- `WorldMapInputActionMap`: 先补 AOI/window 和 server-authoritative command semantics。

### 4.3 暂不晋升

- `CanvasGameRendererPageFacades`
- `CanvasGameAppRenderingRuntime`
- `WorldMapCanvasRenderer`
- `TutorialGuideController`
- 具体 battle/building/tech/famous/task renderer 或 handler 组合

这些模块可以继续作为 candidate facade 或 feature layer，直到拆出更窄的 owner modules。

## 5. 后续硬化任务 / Next Hardening Tasks

1. Add a stable block manifest and architecture guard script that can detect stable file edits.
2. Add dependency direction checks for domain, state, platform, renderer, config, and backend boundaries.
3. Add `TileCoord` and `WorldTopology` contracts before promoting map geometry modules.
4. Add `WorldChunkAddress`, `WorldInterestWindow`, and `WorldRevealStore` before promoting large-map rendering contracts.
5. Add `CommandAuthorityContract`, `ServerTimelineSnapshot`, and `AoiSyncSnapshot` before hardening realtime multiplayer paths.
6. Add config schema/version tooling before promoting gameplay data registries.
