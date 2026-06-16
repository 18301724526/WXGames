# 初始引导锚点权威修复方案（2026-06-16）

## 背景

重置已有账号后，初始引导的“点击首都”高亮偶发偏移；刷新网页后恢复正常。截图表现为高亮框落在首都上方的格子或引导单位附近，而不是首都建筑本身。

该问题不符合“新建账号数据错误”的特征，因为刷新会重建前端内存态后恢复。更符合客户端 reset 生命周期中旧地图热区、旧 runtime context、旧 picking cache 被新引导视觉复用的特征。

## 成熟方案判断

该修复方案符合头部游戏/Canvas 前端常见工程标准：

1. 状态权威：视觉引导目标必须由当前账号状态、当前地图视口、当前相机投影派生。
2. 分层职责：`hitTargets` 是输入层产物，不能反向成为视觉高亮的权威坐标。
3. 生命周期显式失效：账号 reset 属于世界状态切换，必须清理地图 runtime 的输入、bake、picking、上一帧 context。
4. 性能可控：初始引导只解析一个 `siteId`，优先复用当前帧 `worldMapRuntimeContext`，不在帧循环中全图重算。
5. 失败策略可预期：当前帧锚点不可用时延后一帧/不显示高亮，不展示旧热区。

## 实现边界

- `TutorialCanvasRenderer`：初始引导的 `city/march` 目标改为当前帧首都锚点优先；不再用旧 `openWorldSite` hit target 作为视觉 fallback。
- `WorldMapSiteOverlayRenderer`：支持从 `worldMapRuntimeContext` 直接解析站点锚点，并按 layer-to-HUD offset 转换到主 HUD 坐标。
- `WorldMapRuntime`：新增 reset 生命周期清理接口，清除旧 hit target、base hit target、last tile context、picking snapshot、baked layer state。
- `CanvasTerritoryActionHandlers`/`auth.js`：账号 reset 成功后、应用新状态前，显式清理世界地图 runtime 与相关 renderer 临时态。

## 验收标准

- 重置已有账号后，初始“点击首都”高亮必须落在当前首都锚点。
- 刷新前后表现一致。
- 旧账号/旧帧的 `openWorldSite` hit target 不得驱动新账号引导高亮。
- reset 后世界地图 runtime 不保留旧 picking snapshot 或旧 baked map layer。
- 聚焦单元测试覆盖上述行为。
## Implementation Addendum

This fix is a mature, review-ready approach because it follows the same authority boundaries used by large canvas/game clients:

1. The tutorial visual target is derived from the current account state and the current world-map frame context.
2. `hitTargets` remain input-layer artifacts. They may preserve tap continuity during snapshot frames, but they are not allowed to become visual anchor authority.
3. Account reset is treated as a world-state lifecycle boundary. Runtime hit targets, baked layers, picking snapshots, and last frame contexts are invalidated explicitly.
4. Performance stays bounded. The tutorial resolves one `siteId` anchor from the already-published frame context, with the existing state-derived projection only as a no-context fallback.
5. Failure is deterministic. If no current anchor can be resolved, the tutorial waits/skips the spotlight for that frame instead of displaying an old map target.

## Technical Review Addendum

Decision: approved as the mature implementation path.

Rationale:

- This matches common engine/UI projection practice: derive overlay position from the live world object, camera/viewport, and UI coordinate space. Unity exposes this as world-to-screen plus screen-to-UI-space conversion, and Unreal exposes world-location-to-widget-position conversion. The local implementation follows the same pattern in the canvas runtime instead of promoting an old input rectangle to visual truth.
- Authority is explicit. Account state and the current `worldMapRuntimeContext` decide where the capital is; renderer hit targets stay as input artifacts only.
- Lifecycle invalidation is explicit. Account reset is a world-state replacement event, so stale map bake state, picking snapshots, hit targets, drag offsets, and last-frame contexts are cleared before the new account state can render tutorial overlays.
- The stale-context branch fails closed. If a runtime context is present but no longer describes the current account's site tile, the tutorial returns no anchor for that frame. It does not fallback to a guessed or old highlight position.
- Performance remains bounded. The hot path resolves one tutorial `siteId`, reuses the frame context already produced by the map renderer, and does not introduce full-map rescans in the frame loop.
- Maintainability improves because projection, reset invalidation, and tutorial target resolution each live at their existing ownership boundaries.

Review constraints:

- Do not use `openWorldSite` or other world-map hit targets as the visual source for tutorial spotlight anchors.
- Do not add a state-derived fallback when a runtime context exists but mismatches current account state.
- Do not make account reset depend on a later user input or browser refresh to clear renderer/runtime state.
- Keep any future anchor expansion context-driven: world/entity state -> frame projection -> HUD coordinate conversion.

Implementation steps:

- `WorldMapSiteOverlayRenderer.getWorldSiteCanvasAnchor()` first tries `options.worldMapRuntimeContext` and converts padded world-layer coordinates back to the main HUD coordinate space.
- `TutorialCanvasRenderer` resolves intro city and march targets from `getWorldSiteCanvasAnchor()` before any input target lookup. It does not fall back to stale `openWorldSite` hit targets.
- `WorldMapRuntime.resetWorldState()` clears runtime input, picking, bake, render queue, drag, and last-frame state.
- `CanvasTerritoryActionHandlers.resetWorldMapCamera()` invokes runtime reset for `accountReset` before centering the camera, and clears renderer transient world-map contexts/caches.
- Focused unit tests cover stale hit-target rejection, runtime-context anchor conversion, runtime reset invalidation, and account reset call ordering.

## Strong Tutorial Highlight Regression Addendum

The account-reset bug can also surface when `tutorialIntro` and the strong `tutorialHighlight` system render in adjacent frames. The intro spotlight may resolve the correct live capital anchor, while a cached strong-guide rectangle can immediately draw an old `openWorldSite` position over it.

Additional rule:

- World-site strong tutorial highlights must carry a lightweight locator and refresh their rectangle from the current world-map anchor before each HUD render.
- If a world-site anchor source exists but the current frame context cannot resolve the site, the highlight is cleared for that frame instead of falling back to stale hit targets.
- `openWorldSite` hit targets remain input compatibility only; they are not visual authority for either intro spotlight or strong tutorial highlight.
