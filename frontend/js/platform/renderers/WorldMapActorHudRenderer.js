(function (global) {
  const sharedWorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
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
        return require('../../domain/WorldTime');
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

    get lastGameState() {
      return this.host?.lastGameState;
    }

    set lastGameState(value) {
      if (this.host) this.host.lastGameState = value;
    }

    get lastWorldMarchState() {
      return this.host?.lastWorldMarchState;
    }

    set lastWorldMarchState(value) {
      if (this.host) this.host.lastWorldMarchState = value;
    }

    getEpochNowMs() {
      return sharedWorldTime?.getEpochNowMs?.(this) ?? Date.now();
    }

    buildWorldMapActors(tileMapView = {}, renderSnapshot = null) {
      return renderSnapshot?.actors || sharedWorldMarchSystem?.buildActors?.({ missions: tileMapView.activeScouts || [] }, {
        nowMs: this.getEpochNowMs(),
      }) || [];
    }

    renderWorldScoutUnits(tileMapView = {}, viewport = {}) {
      const actors = this.buildWorldMapActors(tileMapView);
      return this.renderWorldActors(actors, viewport, tileMapView.geometry || {});
    }

    renderWorldActors(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldActorRenderer?.renderActors) return false;
      return this.worldActorRenderer.renderActors(actors, viewport, geometry);
    }

    addWorldActorHitTargets(actors = [], viewport = {}, geometry = {}) {
      if (!this.worldActorRenderer?.addActorHitTargets) return false;
      return this.worldActorRenderer.addActorHitTargets(actors, viewport, geometry);
    }

    publishWorldMarchHudState(state = {}) {
      this.lastGameState = state;
      this.lastWorldMarchState = state;
      if (this.host && this.host !== this) {
        this.host.lastGameState = state;
        this.host.lastWorldMarchState = state;
      }
      if (this.worldMarchHudRenderer) {
        this.worldMarchHudRenderer.lastGameState = state;
        this.worldMarchHudRenderer.lastWorldMarchState = state;
      }
      return state;
    }

    renderWorldMarchHud(state = {}, uiState = {}, actors = [], viewport = {}, geometry = {}, frame = {}) {
      if (!this.worldMarchHudRenderer?.renderWorldMarchHud) return false;
      this.publishWorldMarchHudState(state);
      return this.worldMarchHudRenderer.renderWorldMarchHud(state, uiState, actors, viewport, geometry, frame);
    }

    getNearestWorldTileAtPoint(point = {}, tileMapView = {}, viewport = {}) {
      return sharedWorldMarchSystem?.screenPointToNearestTile?.(point, tileMapView, viewport) || null;
    }
  }

  global.WorldMapActorHudRenderer = WorldMapActorHudRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapActorHudRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
