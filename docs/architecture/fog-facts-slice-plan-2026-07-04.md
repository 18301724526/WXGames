# 雾链根治：fog-facts 切片（2026-07-04）

## 背景（为什么"隔很久跳一下"修了两轮）

雾揭示强度是 `f(行军事实, nowMs)` 的纯时间函数（单源：`shared/worldMarchCore.js getRouteRenderRevealSources(mission, nowMs)`，健康）。
病灶全在上游/下游：

1. **时间被烘焙成数据**：`WorldMarchProgressSnapshot` 在 `buildActorFromMission`/`normalizeMissionProgress` 用
   `options.nowMs ?? Date.now()` 现算 `renderRevealSources/Signature` 后**写到 actor/mission row 上**（不带计算时刻），
   随 `renderSnapshot.march/actors` 进 tile-map context 缓存 → 缓存里的 reveal 永远停在烘焙那一刻。
2. **消费端优先信烘焙值**：`WorldFogVisionModel.getMissionRevealSources` 三级回退
   （actor 烘焙 → mission row 烘焙 → 从 `mission.nowMs` 重算），第三级从**数据对象里读时钟**，
   且没有任何生产者写 mission.nowMs ⇒ 恒返回 `[]`（死代码）。
3. **多路径多时钟**：雾只有一个绘制函数但被 3 种 context 来源喂；CanvasGameShell 内 8 处 4~5 层 `||`
   回退链摸"最后的 context"；pipeline 的 `resolveEpochNowMs` 在调用方不带 epochNowMs 时落到裸
   `Date.now()`，与 shell 的 `getWorldEpochNowMs`（服务器对时）同帧双时钟。
4. **误导性注释/死短路**：`FogProjection.buildVisibilitySnapshot` 的嵌入短路对平台链路是死分支
   （全仓无生产者往 context 挂 visibilitySnapshot）；Shell:2542 注释说 "baked visibilitySnapshot" 不精确，
   真烘焙是 `renderSnapshot.march/actors` 与缓存 `tileMapView.tiles`。

## 原则

- **时间只作参数流动，绝不作字段存储**。绝对时间戳事实（startedAt/completesAt/revealedTileIds）除外。
- **纯 memo 合法，时间烘焙非法**：同输入同输出的签名缓存全部保留
  （VisibilityModel.signature、VisualSnapshot.signature、MaskGenerator contextKey/maskKey、uploadedMaskKey）。
- **事实分三类**，各自单源：
  - 持久探索记忆：服务器 `visionHistory/visionHistorySources` + `revealedTileIds`（时间无关，保持不动）；
  - 每帧可见性等级：`WorldMapVisibilityModel`（已是真 bitecs：FogVisibility 组件 + runVisibilitySystem，保持）；
  - **每帧揭示强度：本切片新建 FogRevealModel（bitecs），从 (missions, nowMs) 现算**。

## 手术清单

### A. 新建 `frontend/js/ecs/system/FogRevealModel.js`（真 bitecs，照 WorldClock/VisibilityModel 模板）
- 组件 `FogRevealSource = defineComponent({ q: f32, r: f32, strength: f32, kind: ui8, missionIndex: ui16 })`
- `createRevealWorld()` → `{world, byKey, order}` 纯句柄；`runRevealSystem(revealWorld, missions, nowMs)`：
  nowMs 非有限 **throw**（fail-closed）；每帧重建实体，数据源=WorldMarchCore.getRouteRenderRevealSources。
- `getRevealSnapshot(revealWorld)`：冻结 SoA + missionIds 映射 + 纯签名。
- 落位：`ecs/system/`（index.html 裸加载目录），不进 bundle 也可（视 FogProjection require 情况定，
  FogProjection 在 bundle 内经 globalThis 懒解析 → 挂 global 即可）。

### B. 删烘焙（producers 停产 + consumers 现算）
- `WorldMarchProgressSnapshot`：L269/270、L333/334→353/354、L401/402 全删（actor/mission row 不再携带
  renderRevealSources/Signature）；L471 快照签名改用现算 signature（快照本就带 nowMs+timeBucket）。
- `WorldFogVisionModel`：`getMissionRevealSources(mission, actor)` → `(mission, nowMs)`，
  只走 WorldMarchCore 现算；nowMs 非有限 throw。`collectSources/collectRouteHistorySources` 全链
  透传 `options.nowMs`。**getFogEntries 由 3 遍降 1 遍**（entries 算一次下传）。
- `FogProjection`：删 `buildVisibilitySnapshot` 的嵌入短路（死分支）；`resolveEpochNowMs` 非有限 throw；
  **不再接受 input.visibilityActors/renderSnapshot.actors 作为 reveal 事实来源**——actors 一律
  `WorldMarchSystem.buildActors(worldExplorerState, {nowMs})` 现算（几何 context 与事实来源解耦）。
- `WorldFogMaskGenerator`：缓存键里 actor 的烘焙 reveal 字段改为 revealSnapshot.signature（现算、纯）。
- `WorldMapRuntimeBakePolicy.summarizeRenderReveal`：删"mission 自带 signature 优先"分支（活路径本就现算）。
- `WorldMapRuntimeRenderPolicy.getMissionTraceParts`：删 baked 回退。
- `computeMarchState`（shared+adapter 镜像）**保留**：唯一消费者是后端校验器，按需现算不落地，合法派生视图。
- `visionHistory` 线**保持不动**（服务器持久事实），特征测试保护。

### C. 路径收敛（本切片范围）
- CanvasGameShell 8 处 context 回退链收敛为单一 `getCanonicalWorldTileMapContext()`
  （委托 runtime.getLastTileMapContext 规范链）。
- 雾动画帧（8fps）由"整栈快照刷"降为 **fog-only 重绘**（renderWorldFogLayer + 同任务 presentLayer，
  满足 H5CanvasRuntime webgl _presentCache 同任务约束）——因为事实已与 context 解耦，不再需要重建 context。
- 雾的 nowMs 单源：`options.epochNowMs`（测试注入）?? `getWorldEpochNowMs()`（WorldClock 链），非有限 throw。
- **不在本切片**：runtime 自调度 rAF 退役、App 影子副本删除（属 P3 Axis A 灭 extends）、pipeline 内并入雾段。

### D. fail-closed + trace（照行军链标准）
- 模块加载期依赖缺失 throw（带修复指令）；运行期 nowMs/核心依赖缺失 throw，禁静默空数组。
- trace 挂 `WorldMarchTrace`（现有单例，URL 开关）新增 stage：
  `fog:reveal`（missions in / sources out / signature）、`fog:projection`（signature+epochNowMs）、
  `fog:mask`（contextKey/maskKey 命中/重建）、`fog:present`。全部可选链，不炸主链。

## 风险与对策（来自缺口批评者）
1. visionHistory 漏建模 → 不动 + 特征测试锁定。
2. webgl 同任务 present → fog-only 重绘复用 renderWorldFogLayer（内含 presentLayer）。
3. fail-closed 击穿清单 → 先统一注入（fog 内自解析 WorldClock），后关兜底；顺序不可反。
4. 双活副本/bundle → FogProjection/VisualSnapshot 改动必须 `npm run build:ecs-runtime`（主 repo）；
   FogRevealModel 挂 global 由裸脚本目录加载，进 index.html 清单。
5. bake 签名是行军期隐式刷新驱动 → 保留 summarizeRenderReveal 现算路径（只删 baked 优先分支），
   删除顺序：先立独立雾动画帧（已在线上），后动签名。
6. 性能 → 雾节拍保持 8fps；fog-only 重绘比现状（整栈）更便宜；getFogEntries 3→1 遍再降分配。
7. 乐观→服务器 mission 换挡 → 特征测试：同 route/startedAt 不同 missionId，reveal sources 等值。
8. 时钟回跳 → strength 由 getMissionProgress 钳制 [0,1]，回跳最多前沿回缩一格内；测试记录该行为。

## 验收
- 全部既有测试 + 新特征/验收测试绿；npm run lint；architecture-smoke（新文件进 CHECK_FILES/TEST_FILES）；
  bundle freshness；LF/prettier。
- 行为终验（一次性）：WSL 行军中雾以 8fps 连续揭示（探针 alpha 序列小步递减）、拖动/静止一致、
  教程链回归 playtest。
- 结构验收：全仓 grep `renderRevealSources` 生产点=0（除 shared 纯函数+computeMarchState 派生视图）；
  `mission.nowMs` 读点=0；雾链任意一段失败都在 throw/trace 一步定位。
