(function (global) {
  class WorldMapHitTargetFacade {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    addHitTarget(...args) {
      return this.host?.addHitTarget?.(...args);
    }

    analyzeAssetAlphaBounds(...args) {
      return this.host?.analyzeAssetAlphaBounds?.(...args);
    }

    getWorldTileScreenCenter(...args) {
      return this.host?.getWorldTileScreenCenter?.(...args);
    }

    getWorldTileSiteLayout(...args) {
      return this.host?.getWorldTileSiteLayout?.(...args);
    }

    getWorldMapHitTargetModel() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapHitTargetModel')
        || this.host?.constructor?.getWorldMapHitTargetModel?.()
        || null;
    }

    getWorldMapLayoutModel() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMapLayoutModel')
        || this.host?.constructor?.getWorldMapLayoutModel?.()
        || null;
    }

    getTileMapGeometry() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('tileMapGeometry')
        || this.host?.constructor?.getTileMapGeometry?.()
        || null;
    }

    getTileMapAssetManifest() {
      return global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('tileMapAssetManifest')
        || this.host?.constructor?.getTileMapAssetManifest?.()
        || {};
    }

    getWorldMarchRoutePolicy() {
      return global.WorldMarchRoutePolicy
        || global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldMarchRoutePolicy')
        || this.host?.constructor?.getWorldMarchRoutePolicy?.()
        || null;
    }

    getGameState() {
      return this.host?.lastGameState
        || this.host?.lastWorldMarchState
        || this.host?.state
        || this.host?.lastGame?.state
        || this.host?.host?.lastGameState
        || this.host?.host?.lastWorldMarchState
        || this.host?.host?.state
        || this.host?.host?.lastGame?.state
        || {};
    }

    evaluateMarchTarget(tile = {}, tileMapView = {}) {
      const policy = this.getWorldMarchRoutePolicy();
      if (!policy?.evaluateMarchTarget) return null;
      return policy.evaluateMarchTarget(this.getGameState(), tile, { tileMapView });
    }

    normalizeTileCoord(tile = {}) {
      const helper = this.getTileMapGeometry();
      if (helper?.normalizeCoord) return helper.normalizeCoord(tile);
      const toInteger = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.floor(number) : fallback;
      };
      const q = toInteger(tile.x !== undefined ? tile.x : tile.q, 0);
      const r = toInteger(tile.y !== undefined ? tile.y : tile.r, 0);
      return {
        x: q,
        y: r,
        q,
        r,
        tileId: `tile_${q}_${r}`,
      };
    }

    registerHitTargets(targets = []) {
      if (!Array.isArray(targets) || !targets.length) return false;
      targets.forEach((target) => this.addHitTarget(target.rect, target.action));
      return true;
    }

    addWorldTileSiteHitTargets(tileMapView = {}, viewport = {}, entries = [], uiState = {}) {
      const hitTargetModel = this.getWorldMapHitTargetModel();
      if (hitTargetModel?.createWorldTileSiteHitTargets) {
        const targets = hitTargetModel.createWorldTileSiteHitTargets(tileMapView, viewport, entries, {
          layoutModel: this.getWorldMapLayoutModel(),
          analyzeAssetAlphaBounds: (assetPath) => this.analyzeAssetAlphaBounds(assetPath),
          tileMapGeometry: this.getTileMapGeometry(),
          tileMapAssetManifest: this.getTileMapAssetManifest(),
          uiState,
        });
        return this.registerHitTargets(targets);
      }
      const geometry = tileMapView.geometry || {};
      const scale = Number(viewport.scale) || 1;
      const tileWidth = (Number(geometry.tileWidth) || 192) * scale;
      const tileHeight = (Number(geometry.tileHeight) || 96) * scale;
      const targets = [];
      entries.filter(({ tile }) => tile?.site).forEach(({ tile, center }) => {
        const layout = this.getWorldTileSiteLayout(tile, viewport, geometry, tileWidth, tileHeight, center);
        if (!layout) return;
        const coord = this.normalizeTileCoord(tile);
        targets.push({
          rect: layout.hitRect,
          action: {
            type: 'openWorldSite',
            siteId: layout.site.id,
            tileId: coord.tileId,
            inputSurface: 'worldMap',
          },
        });
      });
      return this.registerHitTargets(targets);
    }

    addWorldMarchTileHitTargets(tileMapView = {}, viewport = {}, frame = {}) {
      const hitTargetModel = this.getWorldMapHitTargetModel();
      if (hitTargetModel?.createWorldMarchTileHitTargets) {
        const targets = hitTargetModel.createWorldMarchTileHitTargets(tileMapView, viewport, frame, {
          layoutModel: this.getWorldMapLayoutModel(),
          tileMapGeometry: this.getTileMapGeometry(),
          evaluateMarchTarget: (tile, view) => this.evaluateMarchTarget(tile, view),
        });
        return this.registerHitTargets(targets);
      }
      if (!Array.isArray(tileMapView.tiles) || !tileMapView.tiles.length) return false;
      const geometry = tileMapView.geometry || {};
      const targets = [];
      (tileMapView.tiles || []).forEach((tile) => {
        const coord = this.normalizeTileCoord(tile);
        const center = this.getWorldTileScreenCenter(tile, viewport, geometry);
        if (
          center.x < frame.x - 48
          || center.x > frame.x + frame.width + 48
          || center.y < frame.y - 32
          || center.y > frame.y + frame.height + 32
        ) return;
        const tileWidth = (Number(geometry.tileWidth) || 192) * (Number(viewport.scale) || 1) * 0.86;
        const tileHeight = (Number(geometry.tileHeight) || 96) * (Number(viewport.scale) || 1) * 0.86;
        const marchCheck = this.evaluateMarchTarget(tile, tileMapView);
        const marchDisabled = marchCheck?.canMarch === false;
        targets.push({
          rect: {
            x: center.x - tileWidth / 2,
            y: center.y - tileHeight / 2,
            width: tileWidth,
            height: tileHeight,
          },
          action: {
            type: 'selectWorldMarchTarget',
            tileId: coord.tileId,
            targetQ: coord.q,
            targetR: coord.r,
            known: tile.visibility !== 'unknown' && tile.discovered !== false,
            terrain: tile.terrain || '',
            terrainLabel: tile.terrainLabel || tile.terrain || '',
            marchDisabled,
            marchDisabledReason: marchDisabled ? (marchCheck.reason || 'EXPLORE_ROUTE_BLOCKED') : '',
            background: true,
            inputSurface: 'worldMap',
          },
        });
      });
      return this.registerHitTargets(targets);
    }
  }

  global.WorldMapHitTargetFacade = WorldMapHitTargetFacade;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapHitTargetFacade;
})(typeof window !== 'undefined' ? window : globalThis);
