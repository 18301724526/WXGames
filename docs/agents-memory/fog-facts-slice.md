---
name: fog-facts-slice
description: "雾链根治（fog-facts bitecs 切片）：揭示强度每帧由 (facts,nowMs) 现算，烘焙字段全线退役；架构与坑。"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-04 用户确认雾"修了两次才定位到"后授权根治。设计文档 docs/architecture/fog-facts-slice-plan-2026-07-04.md。提交链 `b1feba78`(手术)+`f79ddd14`/`1786746f`(bundle 修正)，refactor 分支+design 分支(WSL) 双部署。

**核心结构**：时间只作参数流动，绝不作字段存储。
- 新 `frontend/js/ecs/system/FogRevealModel.js`＝真 bitecs（FogRevealSource 组件+runRevealSystem+冻结快照投影），nowMs 非有限 THROW；数学单源仍是 shared/worldMarchCore.getRouteRenderRevealSources(mission,nowMs)。
- `renderRevealSources/renderRevealSignature` 烘焙字段全线退役（ProgressSnapshot 停产、BakePolicy/RenderPolicy 删烘焙优先、MaskGenerator 键改 revealSnapshot.signature）；`renderAheadTileId/renderReadyTileIds`（地形线）与 `revealedTileIds`/`visionHistory`（服务器事实）保留。
- FogProjection fail-closed（epochNowMs/依赖缺失 throw）+ actors 永远现算（缓存 visibilityActors 被忽略）+ revealSnapshot 挂 renderer context。
- Shell：8 处 4~5 层 context 回退链收敛为 `getCanonicalWorldTileMapContext()`（注意"刚渲完就地读"的 2 处保留直读渲染器，语义不同）；**雾动画帧=fog-only 重绘**（8fps，只画雾层，不再整栈快照刷）。
- trace：WorldMarchTrace 新 stage `fog:reveal/fog:projection/fog:mask`（URL ?worldMarchTrace=1）。

**关键坑**：
- [[bitecs-ecs-standard]] bitecs 模块**不能裸 script 加载**（EcsCoreBoundary 是 bundle-only）——必须加进 EcsModeRuntimeEntry requires 进 bundle；裸加载会 load-throw（fail-closed 当场抓到，playtest pageErrors 可见）。
- 特征测试写法：给 mission 烘焙 core 现算值可让夹具在手术前后等价（WorldFogVisionModel.test.js）；去重键 last-write-wins 会让 q=1 满强度点被前沿 0.5 采样覆盖（无害怪癖已记录在测试注释）。
- 行为终验使用本地 playtest harness；雾平滑探针 `tmp/fog-smooth-probe3.js` 采集 fog 面 alpha 序列。

**终验结果（2026-07-04）**：探针 `VERDICT: SMOOTH`，20 秒窗口内记录到 25 次连续小步递减，静止观战时雾面会实时跟随行军。另记录一个 harness 行军等待误报：服务器已经完成，工具仍报告 no-progress。
