(function (global) {
  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/system/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedWorldTime = (() => {
    if (global.WorldTime) return global.WorldTime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/foundation/WorldTime');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class WorldMapActorHudRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.worldActorRenderer = options.worldActorRenderer || null;
      this.worldMarchHudRenderer = options.worldMarchHudRenderer || null;
    }

    get epochNowMs() {
      return this.host?.epochNowMs;
    }

    getEpochNowMs() {
      return sharedWorldTime?.getEpochNowMs?.(this) ?? Date.now();
    }

    getWorldActorNowMs(options = {}) {
      const optionNow = options.epochNowMs ?? options.nowMs ?? options.serverNowMs;
      const resolvedOptionNow = Number(optionNow);
      return Number.isFinite(resolvedOptionNow) ? resolvedOptionNow : this.getEpochNowMs();
    }

    buildWorldMapActors(tileMapView = {}, renderSnapshot = null, options = {}) {
      return renderSnapshot?.actors || sharedWorldMarchSystem?.buildActors?.({ missions: tileMapView.activeScouts || [] }, {
        nowMs: this.getWorldActorNowMs(options),
      }) || [];
    }

    renderWorldScoutUnits(tileMapView = {}, viewport = {}, options = {}) {
      const actors = this.buildWorldMapActors(tileMapView, null, options);
      return this.renderWorldActors(actors, viewport, tileMapView.geometry || {}, options);
    }

    renderWorldActors(actors = [], viewport = {}, geometry = {}, options = {}) {
      if (!this.worldActorRenderer?.renderActors) return false;
      return this.worldActorRenderer.renderActors(actors, viewport, geometry, options);
    }

    addWorldActorHitTargets(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldActorRenderer?.addActorHitTargets) return false;
      return this.worldActorRenderer.addActorHitTargets(actors, viewport, geometry);
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}, targetPicker = null) {
      if (!this.worldMarchHudRenderer?.renderWorldMarchHud) return false;
      return this.worldMarchHudRenderer.renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame, targetPicker);
    }

    getNearestWorldTileAtPoint(point = {}, tileMapView = {}, viewport = {}) {
      return sharedWorldMarchSystem?.screenPointToNearestTile?.(point, tileMapView, viewport) || null;
    }
  }

  global.WorldMapActorHudRenderer = WorldMapActorHudRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapActorHudRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
