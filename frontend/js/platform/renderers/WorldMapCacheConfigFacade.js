(function (global) {
  class WorldMapCacheConfigFacade {
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

    getWorldTileStaticChunkSize() {
      return 1024;
    }

    getWorldTileStaticChunkCacheLimit() {
      return 32;
    }

    getWorldTileStaticChunkCacheScale() {
      return 1;
    }

    getWorldTileDragCachePanRange() {
      return 180;
    }

    getWorldTileStaticCacheScale() {
      return Math.max(1, Number(this.pixelRatio) || 1);
    }

    getWorldTileStaticCachePixelBudget() {
      return 16000000;
    }
  }

  global.WorldMapCacheConfigFacade = WorldMapCacheConfigFacade;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapCacheConfigFacade;
})(typeof window !== 'undefined' ? window : globalThis);
