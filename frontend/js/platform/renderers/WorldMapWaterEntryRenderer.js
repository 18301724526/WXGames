(function (global) {
  class WorldMapWaterEntryRenderer {
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

    renderWorldTileWaterEntries(tileMapView = {}, viewport = {}, entries = [], waterTimeMs = null) {
      let rendered = false;
      entries.forEach(({ tile, center, drawRect }) => {
        if (!tile?.water?.kind || !tile.water?.asset) return;
        if (this.drawWorldTileWater(tile, center, drawRect, viewport, { drawDryTemplate: false, waterTimeMs })) {
          rendered = true;
        }
      });
      return rendered;
    }
  }

  global.WorldMapWaterEntryRenderer = WorldMapWaterEntryRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapWaterEntryRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
