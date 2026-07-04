# 行军 spine + 四方向 + 兵种系统设计（2026-07-05）

## 目标（用户）
① 世界行军序列帧→spine（导出的野蛮步兵 spine，动画 1/2/3/4=四方向）；② 加兵种系统（初始=野蛮时代步兵，资源路径 spine/march/时代/兵种）；③ 教程开头走主城也用这步兵 spine；④ 行走只能走左上/左下/右上/右下四方向，不再对角抄近道。证据 workflow=wlyye77q3。

## 已完成
素材放入规范目录 `frontend/assets/art/spine/march/barbarian/infantry/barbarian_infantry.{json,atlas,png}`（spine 3.8.99，动画 '1'/'2'/'3'/'4'，atlas 贴图引用已改名对齐）。规范：`spine/march/<时代>/<兵种>/<兵种>.{json,atlas,png}`。项目已有 spine-webgl 3.8 运行时（index.html:178）+ SpineWebglPlayer + 教程立绘在用。

## 关键投影映射（数值已核）
`TileMapGeometry.projectTile`: screenX=(q−r)·stepX, screenY=(q+r)·stepY（Y 向下）。格轴单步：
- **-r → 右上 → anim '1'**
- **-q → 左上 → anim '2'**
- **+q → 右下 → anim '3'**
- **+r → 左下 → anim '4'**
与用户"1234=右上/左上/右下/左下"精确一致。

## 切片（按风险从低到高）

### SPINE-1：四方向格轴行走（先做，纯逻辑可独立部署）
- `shared/worldMarchCore.js` **新增** `buildAxisAlignedRoute(origin,target,options)`（**不改** buildLinearMarchRoute——被 test+parity 锁死，侦察/AI 仍要 Chebyshev）：distance=曼哈顿 |dq|+|dr|，每步只动一个轴，每 step 附 `dir`（1/2/3/4，按上表）。步序：先走 q 后走 r（或按剩余量大的先，二选一，前后端镜像必须一致）。
- `evaluateLinearMarchRoute` 按 `options.axisAligned` 委派 axis/linear builder（复用 blocked/too-far 包络）。
- `WorldMarchCoreAdapter.js` inline 镜像同步新增 + 加进两端 export 列表（parity 测试 Object.keys 相等断言）。
- 两个调用点同步切 `axisAligned:true`：服务器 `WorldExplorerRoutePlanner.js:43` buildManualRoute、客户端 `WorldMarchRoutePolicy.js:68` evaluateMarchTarget（不同步→客户端预览对角、服务器 L 形，行军被拒/错乱）。
- **MAX_MANUAL_ROUTE_LENGTH 决策**：保持 16，语义=最大步数（曼哈顿）。对角目标步数翻倍→可达半径缩小（可接受；嫌短再 bump 单源常量）。
- passability 天然共存（canTraverse 逐格判，轴向多访问拐点格，反堵对角掠水角漏洞）。
- 路线虚线/雾足迹自动变 L 形（连各 step 屏幕中心，无需改渲染）。
- 测试：worldMarchCore.test.js 加 L 形路线+dir 用例；adapter parity 加 deepEqual(axis fn)+export key。LF 归一。

### SPINE-1b：方向透传到 actor（SPINE-2 前置）
`WorldMarchProgressSnapshot` 的 buildActorFromProgress/Mission 把当前段 `dir`（从 route step 或 getCurrentCoord 的 fromTileId/toTileId 现算）透传进 `actor.current`（或 actor.dir），供渲染层选 spine 动画。

### SPINE-2：兵种系统 + 世界行军 spine 渲染（最难）
- **兵种数据模型**（单源）：`UnitSpriteManifest.js` 加 `barbarian_infantry` 条目（era + spine 三件套路径 + type:'spine'）；把散落四处的默认 unitKey（Snapshot 262/342/389 + WorldActorCanvasRenderer 101）收敛为经 manifest 解析，玩家行军默认指向 barbarian_infantry。P0 纯前端渲染映射，**不进存档**（后端无兵种字段，改 normalizer 牵动 DTO/迁移）。
- **新 webgl 世界层** `worldActorSpine`（CanvasLayerRegistry：contextType:'webgl', cameraSpace:'world-dynamic'），插入 PHYSICAL_LAYER_ORDER 于 worldActor 与 mainHud 之间。
- **新单上下文多 skeleton 渲染器**（关键难点，G1）：**不能一单位一 SpineWebglPlayer**（每个建独立 WebGL context，浏览器上限 ~8-16 会崩）。写一个渲染器：单 WebGL context + 单 SkeletonRenderer/batcher/shader，缓存每个 actorId 的 Skeleton+AnimationState，每帧 update(delta)+set skeleton.x/y（同 MVP 相机换算世界屏幕坐标）+按 dir setAnimation(0, name, true)+逐个 draw，复用 initCanvas 已连的 spine.webgl 原语。
- **present 约束**（G2）：绘制毕在同任务 onFrame 调 `runtime.refreshLayerPresentCache('worldActorSpine')` 快照进 2d _presentCache，compositeStage 折入唯一可见画布。漏掉→spine 层空白。
- **回退**：actor 无 spine 资产→走旧 2d 序列帧 drawActorUnit 分支（按 manifest type 分流）；不注册 worldActorSpine 层→退回全序列帧。
- 预载：CanvasPreloadAssetManifest 加 spine 资源。
- 方向瞬切（defaultMix=0）先接受（与"按朝向即时切"一致），转向平滑作后续可选。

### SPINE-3：教程开头走主城 spine
教程 intro 是**独立贝塞尔曲线演出**（TutorialIntroOverlay 状态机，非真实世界行军），SPINE-2 不会自动带上。单独改 `TutorialCanvasRenderer.renderTutorialIntroUnit`（现调 SharedTutorialIntroUnitRenderer.renderUnit）接步兵 spine：坐标用 renderTutorialIntroMarch 已算的 route.x/y，朝向恒向右（选一个横向 anim），scale=1+scaleProgress·0.12，step==='city'/'enter' 切 idle/停帧。单单位用 stock SpineWebglPlayer 即可（screen-space overlay，与教程立绘同范式）。

## 门禁与验证
每片全门禁+LF+双部署；SPINE-1 WSL 验证行军走 L 形不抄近道；SPINE-2/3 需浏览器看 spine（探针验数据+人工看画面）。可回退每片独立。
