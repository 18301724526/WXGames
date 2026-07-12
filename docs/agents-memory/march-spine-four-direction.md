---
name: march-spine-four-direction
description: 行军spine接入+四方向行走+兵种系统。SPINE-1四方向DONE；SPINE-2/3(spine渲染+教程)待做，含单上下文多skeleton渲染器等硬点。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户 2026-07-05：世界行军序列帧→spine(导出野蛮步兵，动画1/2/3/4=四方向)、加兵种系统、教程走主城也用步兵spine、行走改四方向禁抄近道。设计文档 docs/architecture/march-spine-four-direction-design-2026-07-05.md。勘察 workflow=wlyye77q3。

**素材已放规范目录**：`frontend/assets/art/spine/march/barbarian/infantry/barbarian_infantry.{json,atlas,png}`(spine 3.8.99，动画'1'/'2'/'3'/'4'，atlas贴图引用已改名对齐)。规范=`spine/march/<时代>/<兵种>/`。**项目已有 spine-webgl 3.8 运行时**(index.html:178 vendor/spine-3.8)+ SpineWebglPlayer + 教程立绘在用。

**投影映射(数值已核)**：screenX=(q−r)stepX, screenY=(q+r)stepY(Y下)。-r→右上→anim'1'、-q→左上→'2'、+q→右下→'3'、+r→左下→'4'。与用户规格精确一致。

**SPINE-1 四方向 DONE+双部署+WSL验证**(提交 `daafc4a6` design / `534a842a` refactor)：
- shared/worldMarchCore.js **新增** `buildAxisAlignedRoute`(曼哈顿距离，每步一轴，staircase贴对角，每step带`dir`)+`axisStepDir`；**不改** buildLinearMarchRoute(Chebyshev对角，侦察/AI仍用，被test+parity锁)；evaluateLinearMarchRoute 按 options.axisAligned 委派。WorldMarchCoreAdapter 逐字镜像+两端export(parity)。
- 两调用点同切 axisAligned:true：服务器 WorldExplorerRoutePlanner.buildManualRoute + 客户端 WorldMarchRoutePolicy.evaluateMarchTarget(不同步→前后端路线不一致)。MAX_MANUAL_ROUTE_LENGTH 语义变"最大步数(曼哈顿)"，对角可达半径缩小(可接受)。passability天然共存(拐点格逐格判)。**WorldMarchRoutePolicy/Adapter 是 ecs bundle 输入，改后必须 build:ecs-runtime**。
- WSL验证：(-7,25)→(-4,23) 路线 L形5步每步仅一轴。坑：route step 的 `dir` 被 mission DTO 剥离(WorldExplorerMissionNormalizer 白名单)，SPINE-2 要么透传要么客户端从连续step/getCurrentCoord现算。

**SPINE-2a DONE+双部署**(design `ed8ab3b2` / refactor `bcc1be13`)：数据/纯函数层，零视觉变化。
- UnitSpriteManifest：`SPINE_MARCH.barbarian_infantry`(assetBase/json/atlas/directions{1..4→'1'..'4'}/defaultDirection'3')；march 兵种挂 `spine:'barbarian_infantry'`，保留 spearman 2d 帧作离线兜底；`DEFAULT_MARCH_UNIT_KEY`(单源)+`getSpineDescriptor/hasSpine/getDirectionAnimation`。
- WorldMarchProgressSnapshot：actor 加 `facing`（`axisStepDir` 投影当前段 [origin,...route]@progress.segmentIndex）；3 处默认 unitKey 收敛到 manifest 键（惰性解析器）。
- WorldActorCanvasRenderer.renderActors：可选 `worldActorSpineRenderer` 插件(依赖注册表 override 作测试缝，否则宿主链)；spine 单位喂 syncActors、其余走原 2d；无插件=字节等价旧行为。

**SPINE-2b DONE+双部署**(design `57e29f96` / refactor `11e4ec6e`)：真渲染器。
- **WorldActorSpineRenderer(新)**：单 webgl 上下文多骨骼。复用 spine 的 SkeletonRenderer/PolygonBatcher/Shader（命名空间对齐 SpineWebglPlayer——**Matrix4/AssetManager 在 `spine.webgl.` 下**，SkeletonJson/Skeleton/Vector2/AnimationState* 在顶层；测试假件放错会 fail-closed，反证渲染器引用正确）。屏幕空间 y-up 相机 `ortho2d(0,0,w,h)`，`skeleton.y=height-frame.y`（屏 y-down→spine y-up），每 actor 一 Skeleton+AnimationState，facing 变才换动画，自驱 ~30fps 循环每帧 refreshLayerPresentCache。**fail-closed**：任何错→退层、全回 2d。
- CanvasLayerRegistry：新 `worldActorSpine` webgl 层，PHYSICAL_LAYER_ORDER 里插在 worldActor 后（**共享 z999**——合成真序是数组、DOM 回退按文档序破平局；不动 mainHud=1000 硬编码 H5CanvasRuntime:80）。合成器 `compositeStage` 容忍缺失层(`if(!surface)continue`)+按 `_presentCache` 合成。
- 接线：CanvasGameShell 懒拥有(host=shell 拿 ensureCanvasLayer/present)、WorldMapCanvasRenderer 转发、WorldActorCanvasRenderer 解析(registry override→宿主链)。index.html 加脚本。
- **校准旋钮(真机可能要调)**：`SCREEN_HEIGHT_PER_UNIT=190`(屏上骨骼高 px @frame.scale 1.0)；锚点假设骨骼原点在脚(y=0 触地)→`skeleton.y=height-frame.y`；如偏移/缩放不对只调这两处。
- **一次性真机验证残留(GL 像素测不了)**：看行军军队渲染成步兵 spine 且朝向行进方向；不对→删 shell 方法/整个渲染器即回落 2d，零其他改动。**Chrome 扩展当时未连，未能启动烟测；但脚本是纯 IIFE 无 load-throw(测试可 require)、curl 确认已服务。**

**SPINE-2b 接线断链 BUG + 修复**(design `c887927e` / refactor `c0be224a`)：用户真机报"还是老序列完全没变化"。根因(4-追踪器 workflow `we67t0w3c` 定位)：**渲染宿主链在 `H5CanvasGameRenderer` 处终结**——它既无 `getWorldActorSpineRenderer` 也无 `.host/.shell` 回引,`WorldActorCanvasRenderer.getWorldActorSpineRenderer()` 每帧解析成 null → 全回落 2d。实链 `WorldActorCanvasRenderer.host=WorldMapCanvasRenderer → .host=H5CanvasGameRenderer(RendererCtor=global.H5CanvasGameRenderer, CanvasGameShell:584, 三处构造 611/641/720 都没传 host) → 断`。shell 是 spine 渲染器唯一 live owner。修复(抗纠缠链)：①H5CanvasGameRenderer 存 shell 传入的 `getWorldActorSpineRenderer`(沿用它已有的 ensureCanvasLayer/setCanvasLayerVisible 绑定 shell 方法惯用法)；②CanvasGameShell 三处 H5 构造传 `getWorldActorSpineRenderer: this.getWorldActorSpineRenderer?.bind(this)`；③WorldActorCanvasRenderer 用**宿主链 walk**(`.host||.shell` 跳 ≤8 跳,首个非 null,跳过返回 null 的中间 forwarder)取代单跳；④一次性 `[spine-probe]` 诊断(仅浏览器+仅解析成 null 时打宿主链一行,健康即静默)。**坑:传 `host: this` 不行(WorldMapCanvasRenderer 会把 shell 当渲染宿主破坏 ctx/canvas getter),要用专门方法注入/回引。** 次因(非"永不显示")：canRenderActor 在 skeleton 异步加载的亚秒窗口返 false→先 2d,加载完 requestOverlayRenderFrame 重绘翻 spine。教训见 [[render-host-delegation-observability-debt]]（三宿主镜像=难一步定位,这次靠并行追踪+walk+probe 破解）。

**SPINE-3 教程走主城(待做，纪律性推迟)**：独立贝塞尔演出，SPINE-2不会自动带上。**故意等 SPINE-2 真机确认步兵渲染正确后再做**——SPINE-3 复用同一 spine 渲染方式，先验证再复制(带校准值)。改 TutorialCanvasRenderer.renderTutorialIntroUnit:259(用 `tutorial_intro_soldier`，已有 spine 描述)，stock SpineWebglPlayer 即可(单单位 screen-space，仿 advisor 层)；勿强塞 world 渲染器(z 序会被教程层遮挡)。

**SPINE-2b 校准(接线通后真机)**(design `809b38f7` / refactor `131995fd`)：spine 出来了但①锚点偏②尺寸大③动画 3/4 反。
- **坐标空间坑(关键)**：worldMap/worldActor/worldFog 层的 draw surface 被 **drag-cache pan padding=200px** 撑大(`getWorldMapLayerPadding`→`WorldMapRuntimePolicy.getLayerPadding`=200),actor 的 `point`(getActorScreenPoint)算在**含 padding 的层坐标系**里(setTransform(pixelRatio) 无平移、clip frame.x=padding 证实),合成器 `compositeStage` 再按 `sourceX=(padding-translateX)` 裁掉。我原 worldActorSpine 层 padding=0 + 用 host 视口尺寸 → 骨骼偏约 200px。**修法=spine 层镜像 worldActor**：`ensureCanvasLayer(padding=getWorldMapLayerPadding())` + 相机/gl.viewport/Y翻转全用 **surface 实际 backing 尺寸**(`canvas.width/height`,runtime 已尺寸到 padded；未尺寸时回退 `(host+2*pad)*ratio`)+ skeleton.x=point.x、skeleton.y=cssH-point.y(root=脚底直接压路线)。**并把 worldActorSpine 加进 CanvasGameShell pan translate(:2262)/clear(:2068)**,拖拽跟随。任何新世界 webgl 层都要这样镜像 padding+translate,否则偏 200px。
- **动画反**：导出把两个下行走互换——动画 '4'=右下、'3'=左下。`UnitSpriteManifest.directions` 映射 facing '3'(+q 右下)→'4'、facing '4'(+r 左下)→'3'(1/2 不变)。
- **尺寸**：`SCREEN_HEIGHT_PER_UNIT` 190→90(配 2d ~86px)。旋钮仍在渲染器顶部,真机再调只动这一个数。

**SPINE-1 漏改第三个路线计算点→行军回弹(单源违背)**(design `254d1433` / refactor `8b0bd015`)：用户真机报"行军先算旧逻辑再替换新逻辑,疯狂反复回弹",WSL 无网络延迟仍回弹=纯逻辑双路径。根因：SPINE-1 把**服务器**(WorldExplorerRoutePlanner.buildManualRoute)+**客户端预览**(WorldMarchRoutePolicy.evaluateMarchTarget)切成格轴,但**漏了第三个点——客户端乐观 builder `MarchCommandBuilder.buildLinearRoute`**,它仍自造**对角线**走法(`stepQ=sign(remainingQ);stepR=sign(remainingR)` 每步同走 q+r)。点击行军瞬间客户端乐观画对角线→服务器返回阶梯→路线签名永不一致→MarchReconciler(比 `getRouteSignature` q:r)每次 sync 都修正=回弹。SPINE-1 前两端都对角=匹配无回弹,我改了两处漏一处才暴露。修法=**删掉重复走法,委托 `WorldMarchCore.evaluateLinearMarchRoute` 并逐字对齐服务器 options**(`axisAligned+maxLength=MAX_MANUAL_ROUTE_LENGTH(16)+width/height=1024+wrapping:true`)→乐观==预览==服务器,真单源。**教训:改共享算法必须 grep 全部调用点**(`Math.sign(remaining`/`stepQ`/`stepR` 全仓扫,确认无第二实现);路线三点=服务器 planner+客户端预览 policy+客户端乐观 builder,少一个就回弹。

相关：[[world-march-passability]]、[[zero-dom-single-canvas]]、[[p0-combat-in-world]]、[[render-host-delegation-observability-debt]]、[[playtest-march-wait-server-truth]]、[[march-settlement-architecture]]。
