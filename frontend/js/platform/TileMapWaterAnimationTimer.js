// TileMapWaterAnimationTimer -- SHAPE-B (stateful plain class) owner of the tile-map
// water animation interval handle, extracted from CanvasGameApp (god-file
// re-decomposition slice 7).
//
// The class owns ONLY the timer lifecycle (arm guard, interval handle, clear); the
// per-frame orchestration stays a host callback (CanvasGameApp.tickTileMapWaterAnimation)
// passed in at construction, because that logic is render-stack specific --
// CanvasGameShell keeps its own divergent water-timer implementation. Arming interval
// and cadence resolve through the host (CanvasGameAppRenderScheduler.setIntervalForHost
// + host.getWorldTileWaterAnimationFrameMs()).
(function (global) {
  var CanvasGameAppRenderScheduler = global.CanvasGameAppRenderScheduler;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppRenderScheduler) {
    CanvasGameAppRenderScheduler = require('./CanvasGameAppRenderScheduler');
  }

  class TileMapWaterAnimationTimer {
    constructor({ host, tick } = {}) {
      this.host = host || null;
      this.tick = typeof tick === 'function' ? tick : null;
      this.timer = null;
    }

    isActive() {
      return Boolean(this.timer);
    }

    start() {
      if (this.timer) return false;
      this.timer = CanvasGameAppRenderScheduler.setIntervalForHost(
        this.host,
        () => this.tick?.(),
        this.host.getWorldTileWaterAnimationFrameMs(),
      );
      return Boolean(this.timer);
    }

    stop() {
      if (!this.timer) return;
      CanvasGameAppRenderScheduler.clearIntervalForHost(this.host, this.timer);
      this.timer = null;
    }
  }

  global.TileMapWaterAnimationTimer = TileMapWaterAnimationTimer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TileMapWaterAnimationTimer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
