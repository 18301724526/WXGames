// WorldTileMapCacheCoordinator -- plain class composed by CanvasGameRenderer (god-file
// re-decomposition slice 13). Owns the operations over the host's WorldMapCacheState
// container: the worldTile*Cache/assetsChangedHandler accessor bodies, the
// setAssetsChangedHandler/handleAssetsChanged/invalidateWorldTileCaches/
// invalidateWorldTileViewCache fallbacks, and the resolveWorldTileMapView cached-view
// reuse guard + getWorldTileMapFallbackSignature cache key are verbatim relocations
// from CanvasGameRenderer. Sub-renderer forward-probes (assetRenderer) live INSIDE this
// coordinator, resolved through the host, so the renderer keeps 1-line delegators and
// no call site changes. The container itself stays created by the renderer constructor
// (options.worldMapCacheState override preserved) and is reached via host.
(function (global) {
  class WorldTileMapCacheCoordinator {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get worldMapCacheState() {
      return this.host?.worldMapCacheState || null;
    }

    get presenter() {
      return this.host?.presenter || null;
    }

    // Backing for the renderer's worldMapCacheState accessor pairs (verbatim bodies).
    get worldTileFastDragActive() {
      return Boolean(this.worldMapCacheState.worldTileFastDragActive);
    }
    set worldTileFastDragActive(value) {
      this.worldMapCacheState.worldTileFastDragActive = Boolean(value);
    }
    get worldTileStaticCache() {
      return this.worldMapCacheState.worldTileStaticCache || null;
    }
    set worldTileStaticCache(value) {
      this.worldMapCacheState.worldTileStaticCache = value || null;
    }
    get worldTileStaticCacheKey() {
      return this.worldMapCacheState.worldTileStaticCacheKey || '';
    }
    set worldTileStaticCacheKey(value) {
      this.worldMapCacheState.worldTileStaticCacheKey = String(value || '');
    }
    get worldTileStaticCacheLayoutKind() {
      return this.worldMapCacheState.worldTileStaticCacheLayoutKind || '';
    }
    set worldTileStaticCacheLayoutKind(value) {
      this.worldMapCacheState.worldTileStaticCacheLayoutKind = String(value || '');
    }
    get worldTileStaticCacheLayout() {
      return this.worldMapCacheState.worldTileStaticCacheLayout || null;
    }
    set worldTileStaticCacheLayout(value) {
      this.worldMapCacheState.worldTileStaticCacheLayout = value || null;
    }
    get worldTileStaticChunkCaches() {
      return this.worldMapCacheState.worldTileStaticChunkCaches;
    }
    get worldTileStaticChunkCacheTick() {
      return Number(this.worldMapCacheState.worldTileStaticChunkCacheTick) || 0;
    }
    set worldTileStaticChunkCacheTick(value) {
      this.worldMapCacheState.worldTileStaticChunkCacheTick = Number(value) || 0;
    }
    get worldTileWaterLayerCache() {
      return this.worldMapCacheState.worldTileWaterLayerCache || null;
    }
    set worldTileWaterLayerCache(value) {
      this.worldMapCacheState.worldTileWaterLayerCache = value || null;
    }
    get worldTileWaterLayerCacheKey() {
      return this.worldMapCacheState.worldTileWaterLayerCacheKey || '';
    }
    set worldTileWaterLayerCacheKey(value) {
      this.worldMapCacheState.worldTileWaterLayerCacheKey = String(value || '');
    }
    get worldTileWaterFrameCaches() {
      return this.worldMapCacheState.worldTileWaterFrameCaches;
    }
    get worldTileWaterChunkCaches() {
      return this.worldMapCacheState.worldTileWaterChunkCaches;
    }
    get worldTileWaterChunkCacheTick() {
      return Number(this.worldMapCacheState.worldTileWaterChunkCacheTick) || 0;
    }
    set worldTileWaterChunkCacheTick(value) {
      this.worldMapCacheState.worldTileWaterChunkCacheTick = Number(value) || 0;
    }
    get worldTileMaskCache() {
      return this.worldMapCacheState.worldTileMaskCache;
    }
    get worldTileMaskMetricsCache() {
      return this.worldMapCacheState.worldTileMaskMetricsCache;
    }
    get worldTileDryCompositeCache() {
      return this.worldMapCacheState.worldTileDryCompositeCache;
    }
    get worldTileFastDragComposite() {
      return this.worldMapCacheState.worldTileFastDragComposite || null;
    }
    set worldTileFastDragComposite(value) {
      this.worldMapCacheState.worldTileFastDragComposite = value || null;
    }
    get worldTileFastDragCompositeCache() {
      return this.worldMapCacheState.worldTileFastDragCompositeCache || null;
    }
    set worldTileFastDragCompositeCache(value) {
      this.worldMapCacheState.worldTileFastDragCompositeCache = value || null;
    }
    get worldTileCompositeCanvas() {
      return this.worldMapCacheState.worldTileCompositeCanvas || null;
    }
    set worldTileCompositeCanvas(value) {
      this.worldMapCacheState.worldTileCompositeCanvas = value || null;
    }
    get worldTileCompositeCtx() {
      return this.worldMapCacheState.worldTileCompositeCtx || null;
    }
    set worldTileCompositeCtx(value) {
      this.worldMapCacheState.worldTileCompositeCtx = value || null;
    }
    get worldTileWaterCanvas() {
      return this.worldMapCacheState.worldTileWaterCanvas || null;
    }
    set worldTileWaterCanvas(value) {
      this.worldMapCacheState.worldTileWaterCanvas = value || null;
    }
    get worldTileWaterCtx() {
      return this.worldMapCacheState.worldTileWaterCtx || null;
    }
    set worldTileWaterCtx(value) {
      this.worldMapCacheState.worldTileWaterCtx = value || null;
    }
    get worldTileViewCache() {
      return this.worldMapCacheState.worldTileViewCache || null;
    }
    set worldTileViewCache(value) {
      this.worldMapCacheState.worldTileViewCache = value || null;
    }
    get worldTileVisibleEntriesCache() {
      return this.worldMapCacheState.worldTileVisibleEntriesCache || null;
    }
    set worldTileVisibleEntriesCache(value) {
      this.worldMapCacheState.worldTileVisibleEntriesCache = value || null;
    }
    get worldTileLocalEntriesCache() {
      return this.worldMapCacheState.worldTileLocalEntriesCache || null;
    }
    set worldTileLocalEntriesCache(value) {
      this.worldMapCacheState.worldTileLocalEntriesCache = value || null;
    }
    get assetsChangedHandler() {
      return this.worldMapCacheState.assetsChangedHandler || null;
    }
    set assetsChangedHandler(value) {
      this.worldMapCacheState.assetsChangedHandler = typeof value === 'function' ? value : null;
    }
    get worldTileCachePrewarmTask() {
      return this.worldMapCacheState.worldTileCachePrewarmTask || null;
    }
    set worldTileCachePrewarmTask(value) {
      this.worldMapCacheState.worldTileCachePrewarmTask = value || null;
    }

    setAssetsChangedHandler(...args) {
      const renderer = this.host?.assetRenderer;
      if (typeof renderer?.setAssetsChangedHandler === 'function') {
        return renderer.setAssetsChangedHandler(...args);
      }
      this.assetsChangedHandler = typeof args[0] === 'function' ? args[0] : null;
      return undefined;
    }

    handleAssetsChanged(...args) {
      const renderer = this.host?.assetRenderer;
      if (typeof renderer?.handleAssetsChanged === 'function') {
        return renderer.handleAssetsChanged(...args);
      }
      // Dispatch through the host so renderer-level invalidateWorldTileCaches stays the
      // entry point (verbatim: the original body called this.invalidateWorldTileCaches).
      this.host.invalidateWorldTileCaches();
      if (this.assetsChangedHandler) this.assetsChangedHandler();
      return undefined;
    }

    invalidateWorldTileCaches(...args) {
      const renderer = this.host?.assetRenderer;
      if (typeof renderer?.invalidateWorldTileCaches === 'function') {
        return renderer.invalidateWorldTileCaches(...args);
      }
      // Dispatch through the host so renderer-level invalidateWorldTileViewCache stays
      // the entry point (verbatim: the original body called this.invalidateWorldTileViewCache).
      this.host.invalidateWorldTileViewCache();
      return undefined;
    }

    invalidateWorldTileViewCache(...args) {
      const renderer = this.host?.assetRenderer;
      if (typeof renderer?.invalidateWorldTileViewCache === 'function') {
        return renderer.invalidateWorldTileViewCache(...args);
      }
      this.worldTileViewCache = null;
      this.worldTileVisibleEntriesCache = null;
      this.worldTileLocalEntriesCache = null;
      return undefined;
    }

    getWorldTileMapFallbackSignature(territoryState = {}, worldExplorerState = {}) {
      const worldMap = territoryState.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const territories = Array.isArray(territoryState.territories)
        ? territoryState.territories
        : [];
      const explorerMissions = [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []),
        ...(Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []),
      ].filter(Boolean);
      return JSON.stringify({
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        tiles: tiles.map((tile) => ({
          id: tile.id,
          q: tile.q,
          r: tile.r,
          terrain: tile.terrain,
          visibility: tile.visibility || '',
          discovered: tile.discovered !== false,
          visible: tile.visible !== false,
          siteId: tile.siteId || null,
        })),
        territories: territories.map((site) => ({
          id: site.id,
          x: site.x ?? site.q,
          y: site.y ?? site.r,
          status: site.status,
          owner: site.owner,
          type: site.type,
          art: site.art,
          name: site.cityName || site.naturalName,
        })),
        explorerMissions: explorerMissions.map((mission) => ({
          id: mission.id,
          status: mission.status,
          position: mission.position || null,
          revealedTileIds: mission.revealedTileIds || [],
          plannedTiles: (mission.plannedTiles || []).map((tile) => ({
            id: tile.id,
            q: tile.q,
            r: tile.r,
            terrain: tile.terrain,
            visibility: tile.visibility || '',
            siteId: tile.siteId || null,
          })),
          plannedSites: (mission.plannedSites || []).map((site) => ({
            tileId: site.tileId || '',
            q: site.q,
            r: site.r,
            siteId: site.siteId || site.site?.id || null,
            materialized: Boolean(site.materialized),
            site: site.site
              ? {
                  id: site.site.id,
                  x: site.site.x,
                  y: site.site.y,
                  status: site.site.status,
                  owner: site.site.owner,
                  type: site.site.type,
                  art: site.site.art,
                  name: site.site.cityName || site.site.naturalName,
                }
              : null,
          })),
        })),
      });
    }

    resolveWorldTileMapView(territoryState = {}, uiState = {}, options = {}) {
      if (!this.presenter?.buildWorldTileMapViewState) return null;
      const panX = Number(uiState.worldPanX) || 0;
      const panY = Number(uiState.worldPanY) || 0;
      const worldExplorerState = options.worldExplorerState || {};
      const viewOptions = {
        panX,
        panY,
        worldExplorerState,
        epochNowMs: options.epochNowMs,
        serverNowMs: options.serverNowMs,
      };
      // Dispatch through the host so renderer-level getWorldTileMapFallbackSignature stays
      // the entry point (verbatim: the original body called this.getWorldTileMapFallbackSignature).
      const currentSignature =
        typeof this.presenter.getWorldTileMapSignature === 'function'
          ? String(
              this.presenter.getWorldTileMapSignature(
                territoryState,
                worldExplorerState,
                viewOptions,
              ) ?? '',
            )
          : this.host.getWorldTileMapFallbackSignature(territoryState, worldExplorerState);
      const cached = this.worldTileViewCache;
      const canReuse = Boolean(
        options.reuseCachedWorldTileView &&
        cached &&
        cached.territoryState === territoryState &&
        cached.signature === currentSignature,
      );
      if (canReuse) {
        cached.view.pan = { x: panX, y: panY };
        return cached.view;
      }
      const view = this.presenter.buildWorldTileMapViewState(territoryState, viewOptions);
      this.worldTileViewCache = {
        territoryState,
        worldExplorerState,
        signature: currentSignature || view?.signature || '',
        view,
      };
      return view;
    }
  }

  global.WorldTileMapCacheCoordinator = WorldTileMapCacheCoordinator;
  if (typeof module !== 'undefined' && module.exports)
    module.exports = WorldTileMapCacheCoordinator;
})(typeof window !== 'undefined' ? window : globalThis);
