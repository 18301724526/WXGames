(function (global) {
  class WorldMapCacheConfigFacade {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get pixelRatio() {
      return this.host?.pixelRatio;
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
