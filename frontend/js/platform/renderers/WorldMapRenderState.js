(function (global) {
  function createWorldMapRenderState(initial = {}) {
    return {
      lastWorldTileMapContext: initial.lastWorldTileMapContext || null,
      lastMapHomeWorldHudContext: initial.lastMapHomeWorldHudContext || null,
      lastWorldActorOverlayDiag: initial.lastWorldActorOverlayDiag || null,
      lastWorldActorOverlayDiagLogAt: initial.lastWorldActorOverlayDiagLogAt,
      lastWorldMapLayerRenderResult: initial.lastWorldMapLayerRenderResult || null,
      worldActorOverlayTargetCtx: initial.worldActorOverlayTargetCtx || null,
      worldTileWaterTimeOverride: initial.worldTileWaterTimeOverride ?? null,
    };
  }

  const api = {
    createWorldMapRenderState,
  };

  global.WorldMapRenderState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
