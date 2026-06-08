(function (global) {
  var WorldMapRuntimePolicy = global.CanvasGameShellWorldMapRuntimePolicy;
  if (typeof module !== 'undefined' && module.exports && !WorldMapRuntimePolicy) {
    WorldMapRuntimePolicy = require('./CanvasGameShellWorldMapRuntimePolicy');
  }

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
      getWorldMapSnapshotRenderOptions(waterTimeMs = this.getFrozenWorldMapWaterTimeMs()) {
        return WorldMapRuntimePolicy.getSnapshotRenderOptions(waterTimeMs, this.getFrozenWorldMapWaterTimeMs());
      },

      getWorldMapLayerPadding() {
        return WorldMapRuntimePolicy.getLayerPadding({
          dragCachePanRange: this.worldMapRenderer?.getWorldTileDragCachePanRange?.()
            || this.renderer?.getWorldTileDragCachePanRange?.()
            || 180,
        });
      },

      getFrozenWorldMapWaterTimeMs() {
        if (
          this.worldMapDragWaterTimeMs === null
          || this.worldMapDragWaterTimeMs === undefined
          || !Number.isFinite(Number(this.worldMapDragWaterTimeMs))
        ) {
          this.worldMapDragWaterTimeMs = this.now();
        }
        return this.worldMapDragWaterTimeMs;
      },

      isWorldMapDragging() {
        return WorldMapRuntimePolicy.isDragging(this.worldMapDragWaterTimeMs);
      },

      isWorldMapDragCoolingDown() {
        return WorldMapRuntimePolicy.isDragCoolingDown(this.worldMapDragCooldownUntil, this.now());
      },

      getWorldMapDragCooldownMs() {
        return WorldMapRuntimePolicy.getDragCooldownMs(220);
      },

      hasPendingWorldMapCompositeCommit() {
        return false;
      },

      getWorldMapPan() {
        const uiState = this.lastGame?.territoryController?.getUiState?.() || this.territoryUiState || {};
        return WorldMapRuntimePolicy.getWorldMapPan(uiState);
      },

      startWorldMapSnapshotDrag() {
        this.worldMapDragWaterTimeMs = this.now();
        return this.worldMapDragWaterTimeMs;
      },

      finishWorldMapSnapshotDrag() {
        this.worldMapDragCooldownUntil = this.now() + this.getWorldMapDragCooldownMs();
        this.worldMapDragWaterTimeMs = null;
        this.worldMapDragFrameActive = false;
        this.worldMapPinchDragging = false;
        if (this.worldMapRuntime) this.worldMapRuntime.waterTimeMs = null;
        const shouldRender = Boolean(this.deferRenderUntilWorldMapDragEnd);
        this.deferRenderUntilWorldMapDragEnd = false;
        return shouldRender ? this.renderActive({ invalidateWorldTileView: false }) : true;
      },

      getWorldMapRuntimeDragOffset() {
        const runtime = this.worldMapRuntimeCoordinator?.getMapRuntime?.() || this.worldMapRuntime;
        return WorldMapRuntimePolicy.getDragOffset(runtime);
      },

      getWorldMapDragTransformLimit() {
        return WorldMapRuntimePolicy.getDragTransformLimit(this.getWorldMapLayerPadding());
      },

      isWorldMapDragTransformNearLimit(offset = this.getWorldMapRuntimeDragOffset()) {
        return WorldMapRuntimePolicy.isDragTransformNearLimit(offset, {
          layerPadding: this.getWorldMapLayerPadding(),
        });
      },

      updateWorldMapDragCompositor() {
        const offset = this.getWorldMapRuntimeDragOffset();
        if (this.isWorldMapDragTransformNearLimit(offset)) {
          if (this.refreshWorldMapLayerFromSnapshot({
            waterTimeMs: this.now(),
            commitCamera: true,
            clearTransform: true,
            preserveOnMiss: true,
          })) return this.getWorldMapRuntimeDragOffset();
        }
        if (this.refreshWorldMapLayerFromSnapshot({
          waterTimeMs: this.now(),
          commitCamera: false,
          clearTransform: false,
          preserveOnMiss: true,
        })) {
          this.clearWorldMapLayerTransform();
          return offset;
        }
        if (
          typeof this.runtime?.ensureLayerCanvas === 'function'
          && !this.getCanvasLayerCanvas?.('worldMap')
        ) {
          this.ensureCanvasLayer?.('worldMap', { padding: this.getWorldMapLayerPadding() });
        }
        this.setCanvasLayerTranslate?.('worldMap', offset.x, offset.y);
        this.setCanvasLayerTranslate?.('worldFog', offset.x, offset.y);
        return offset;
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellWorldMapDragRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
