(function (global) {
  // Map-home world site hit-target collection mixin for WorldMapLayerCanvasRenderer.
  function install(WorldMapLayerCanvasRenderer) {
    if (!WorldMapLayerCanvasRenderer?.prototype) return false;
    Object.assign(WorldMapLayerCanvasRenderer.prototype, {
      collectMapHomeWorldSiteHitTargets(state = {}, topBarBottom = 84, options = {}) {
        const layout = this.getWorldMapLayerLayout(state, topBarBottom, { isMapHome: true });
        if (!layout) return false;
        const territoryState = state.territoryState || {};
        const uiState = options.territoryUiState || {};
        const tileMapView = this.resolveWorldTileMapView(territoryState, uiState, {
          ...options,
          worldExplorerState: state.worldExplorerState || {},
        });
        if (!tileMapView?.tiles?.length) return true;
        const offsetX = Number(this.viewportOffsetX) || 0;
        const offsetY = Number(this.viewportOffsetY) || 0;
        const visibleWidth = Number(this.viewportWidth) || Math.max(1, this.width - offsetX * 2);
        const visibleHeight = Number(this.viewportHeight) || Math.max(1, this.height - offsetY * 2);
        const visibleMapY = Math.max(0, topBarBottom ?? 84);
        const visibleMapH = Math.max(160, visibleHeight - 64 - visibleMapY);
        const geometry = tileMapView.geometry || {};
        const scale = Math.max(
          0.38,
          Math.min(0.78, Math.min(visibleWidth / 520, visibleMapH / 420)),
        );
        const viewport = {
          originX: offsetX + visibleWidth * 0.5,
          originY: offsetY + visibleMapY + visibleMapH * 0.42,
          panX: Number(tileMapView.pan?.x) || 0,
          panY: Number(tileMapView.pan?.y) || 0,
          scale,
          seed: tileMapView.seed || 'scout-tile-v1',
          geometry,
          worldOrigin: tileMapView.origin || tileMapView.worldOrigin || { q: 0, r: 0 },
        };
        const frame = {
          x: layout.map.x + 1,
          y: layout.map.y + 1,
          width: layout.map.width - 2,
          height: layout.map.height - 2,
        };
        const visibleEntries = this.getWorldTileRenderEntries(
          tileMapView,
          viewport,
          frame,
          geometry,
        );
        if (options.collectHitTargets !== false) {
          this.addWorldMapDragHitTarget?.(
            layout.map.x,
            layout.map.y,
            layout.map.width,
            layout.map.height,
          );
          this.addWorldMarchTileHitTargets?.(tileMapView, viewport, frame);
          this.addWorldTileSiteHitTargets(tileMapView, viewport, visibleEntries, uiState);
        }
        const lastContext =
          options.worldMapRuntimeContext ||
          this.lastWorldTileMapContext ||
          this.worldMapRenderer?.lastWorldTileMapContext ||
          null;
        const contextActors = this.getWorldMapContextActors(
          state,
          lastContext,
          lastContext?.renderSnapshot || null,
        );
        const actors = this.resolveWorldMapActors(state, contextActors, options);
        this.lastMapHomeWorldHudContext = {
          actors,
          frame,
          viewportOffsetX: Number(this.viewportOffsetX) || 0,
          viewportOffsetY: Number(this.viewportOffsetY) || 0,
          geometry,
          renderSnapshot: lastContext?.renderSnapshot || null,
          tileMapView,
          uiState,
          viewport,
        };
        if (this.host && this.host !== this) {
          this.host.lastMapHomeWorldHudContext = this.lastMapHomeWorldHudContext;
        }
        return true;
      },
    });
    return true;
  }

  const WorldMapHitTargetCollector = { install };
  global.WorldMapHitTargetCollector = WorldMapHitTargetCollector;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapHitTargetCollector;
})(typeof window !== 'undefined' ? window : globalThis);
