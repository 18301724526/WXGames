(function (global) {
  class WorldMapFogMaskContextRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          const host = target.host;
          if (host) {
            host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    createWorldTileFogMaskContext(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      return {
        renderSnapshot: options.renderSnapshot || this.lastWorldTileMapContext?.renderSnapshot || null,
        actors: options.actors || this.lastWorldTileMapContext?.actors || [],
        tileMapView,
        viewport,
        geometry: tileMapView.geometry || viewport.geometry || {},
        frame,
        entries,
      };
    }

    renderWorldTileFogMask(tileMapView = {}, viewport = {}, frame = {}, entries = []) {
      const context = this.createWorldTileFogMaskContext(tileMapView, viewport, frame, entries);
      this.lastWorldFogContext = context;
      if (this.host && this.host !== this) this.host.lastWorldFogContext = context;
      return false;
    }
  }

  global.WorldMapFogMaskContextRenderer = WorldMapFogMaskContextRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapFogMaskContextRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
