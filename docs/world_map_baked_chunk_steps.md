# 大地图烘焙分块落地步骤

## 当前重绘链路

当前大地图仍然带有页面式渲染遗留：

1. `CanvasGameRenderer.renderWorldMapLayer()` 每次都会 `beginFrame()`、`setHitTargets([])`、`clearAll()` 清画布。
2. `renderWorldTileMap()` 会重新计算 viewport、可见 tile、hitTargets。
3. 如果 `snapshotOnly` 命中，会 `drawImage` 已有缓存；如果没命中或缓存失效，会继续走侦察路线、水面层、静态地形层、据点、地形装饰等绘制。
4. 水面动画仍有 timer，水层 cache key 包含水动画帧，所以每 125ms 有机会触发 map layer 刷新。
5. 松手本身不应该要求地图重绘。旧逻辑里松手后可能刷新，是为了恢复完整画面、刷新 hitTargets、恢复水面动画、处理拖动期间延迟的 HUD/state render。

结论：只有 HUD 或状态变化可能需要刷新页面层；大地图静态底图不应该因为松手或 camera/pan 变化重画。

## 目标架构

大地图拆为两类变化：

- Camera/pan 变化：只改变观察位置，不改变地图内容。
- Map data dirty：探索新增、地形变化、据点状态变化、路线变化、资源或水面帧资源变化。

只有 map data dirty 才允许重新烘焙地图 chunk。拖动和松手都不是 dirty。

## 烘焙内容

按地图数据烘焙为大纹理或分块纹理：

- 静态地形：草地、山地、海岸、河流底图、海洋底图。
- 静态地点：据点底座、固定图标、固定装饰。
- 静态路线：已确认不需要每帧变化的路线段。
- 水面动画：不实时重画河流海洋。按 chunk 预烘焙 4 或 8 个固定动画帧，timer 只切帧或换源；拖动期间可以冻结当前水面帧。

## 拖动帧规则

拖动时禁止进入完整 `renderWorldTileMap()`：

1. H5：移动已经烘焙好的 `worldMap` canvas layer，使用 compositor transform。
2. 小程序：从离屏 baked chunk/snapshot `drawImage`，不重新算 tile、水面、路线。
3. hitTargets 不依赖 render 生成，点击时用 camera + tile/site 坐标数学反算；过渡阶段可用已有 hitTargets 加 camera offset。
4. 如果拖动接近当前已加载 chunk 覆盖边界，只加载或合成相邻 chunk；这不是因为松手重烘焙，也不是 camera dirty。

## Dirty chunk 流程

1. 服务端同步或本地行为产生地图数据变化。
2. runtime 比较 map data signature，标记对应 chunk dirty。
3. 后台重新烘焙 dirty chunk。
4. 当前屏幕如果命中 dirty chunk，下一帧替换该 chunk；没有命中则延后。
5. camera/pan 变化不改变 signature，不触发 dirty，不清 chunk cache。

## 双端落地顺序

1. 建立 runtime 层的 baked camera、map data signature、dirty 标记。
2. H5 拖动切到 `worldMap` canvas transform，不在 move 中走地图重绘。
3. 小程序拖动切到 snapshot/chunk `drawImage`，不在 move 中走 tile 绘制。
4. 水面 timer 不再触发完整地图层重绘；拖动期间冻结，后续改为切换预烘焙水面帧。
5. hitTargets 从 render 依赖迁移到 camera + tile/site 反算。
6. 将当前 viewport cache 升级为稳定 chunk cache，按 dirty chunk 更新。

## 验收标准

- 单指或双指拖动 move 不调用完整 `renderWorldTileMap()`。
- 松手不因为 camera/pan 改变重新烘焙地图。
- 连续短划不会触发松手补绘队列。
- 水面在拖动中不消失，不通过实时重画水层维持动画。
- 地图探索或据点变化后，只 dirty 对应 chunk。
- H5 和小程序共用 runtime camera/dirty 规则，只在提交方式上不同。

## 对象池定位

对象池是第二层优化：

- 可以池化 visible entries、layout rect、hitTarget、路线点数组。
- 用来减少 GC 尖峰。
- 不能替代架构调整。只要拖动仍在清屏、算 tile、draw layer，对象池无法保证 60 帧。
