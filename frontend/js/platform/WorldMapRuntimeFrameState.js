(function (global) {
  function createWorldMapRuntimeFrameState(initial = {}) {
    return {
      lastRenderAt: Number(initial.lastRenderAt) || 0,
      lastLayout: initial.lastLayout || null,
      hasBakedMapLayer: Boolean(initial.hasBakedMapLayer),
      mapBakeDirty: initial.mapBakeDirty !== false,
      bakedLayerState: initial.bakedLayerState || null,
      lastMapDataSignature: initial.lastMapDataSignature || '',
      lastTileMapContext: initial.lastTileMapContext || null,
    };
  }

  function applyWorldMapRuntimeFramePatch(frameState = null, patch = {}) {
    if (!frameState || !patch || typeof patch !== 'object') return frameState;
    if (Object.prototype.hasOwnProperty.call(patch, 'lastRenderAt')) {
      frameState.lastRenderAt = Number(patch.lastRenderAt) || 0;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lastLayout')) {
      frameState.lastLayout = patch.lastLayout || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'hasBakedMapLayer')) {
      frameState.hasBakedMapLayer = Boolean(patch.hasBakedMapLayer);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'mapBakeDirty')) {
      frameState.mapBakeDirty = Boolean(patch.mapBakeDirty);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'bakedLayerState')) {
      frameState.bakedLayerState = patch.bakedLayerState || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lastMapDataSignature')) {
      frameState.lastMapDataSignature = patch.lastMapDataSignature || '';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lastTileMapContext')) {
      frameState.lastTileMapContext = patch.lastTileMapContext || null;
    }
    return frameState;
  }

  const api = {
    applyWorldMapRuntimeFramePatch,
    createWorldMapRuntimeFrameState,
  };

  global.WorldMapRuntimeFrameState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
