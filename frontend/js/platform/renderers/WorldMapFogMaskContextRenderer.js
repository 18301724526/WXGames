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

    getWorldTileKey(tile = {}) {
      return `${Number(tile.q) || 0},${Number(tile.r) || 0}`;
    }

    getWorldTileFogRevealEntries(entries = []) {
      if (!Array.isArray(entries) || entries.length <= 1) return entries || [];
      const keySet = new Set(entries.map(({ tile }) => this.getWorldTileKey(tile)));
      const offsets = [
        { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 },
        { q: -1, r: 0 }, { q: 1, r: 0 },
        { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
      ];
      const innerEntries = entries.filter(({ tile }) => {
        const q = Number(tile?.q) || 0;
        const r = Number(tile?.r) || 0;
        return offsets.every((offset) => keySet.has(`${q + offset.q},${r + offset.r}`));
      });
      return innerEntries.length ? innerEntries : entries;
    }

    createWorldTileFogMaskContext(tileMapView = {}, viewport = {}, frame = {}, entries = [], options = {}) {
      return {
        renderSnapshot: options.renderSnapshot || this.lastWorldTileMapContext?.renderSnapshot || null,
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
