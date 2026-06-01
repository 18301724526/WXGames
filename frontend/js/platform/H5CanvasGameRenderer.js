(function (global) {
  var CanvasGameRendererBase = global.CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameRendererBase) {
    CanvasGameRendererBase = require('./CanvasGameRenderer');
  }

  class H5CanvasGameRenderer extends CanvasGameRendererBase {
    constructor(options = {}) {
      var canvas = options.canvas || null;
      var ctx = canvas ? (canvas.getContext ? canvas.getContext('2d') : null) : (options.ctx || null);
      var pixelRatio = options.pixelRatio
        || (typeof global.devicePixelRatio === 'number' ? global.devicePixelRatio : 1);
      var width = options.width || (canvas ? Math.floor(canvas.clientWidth || 390) : 390);
      var height = options.height || (canvas ? Math.floor(canvas.clientHeight || 844) : 844);

      super({
        ctx,
        canvas,
        presenter: options.presenter || null,
        pixelRatio,
        width,
        height,
        assetCache: options.assetCache,
        assetMetricsCache: options.assetMetricsCache,
        showFpsOverlay: options.showFpsOverlay,
        maxContentWidth: options.maxContentWidth || 480,
        edgePadding: options.edgePadding || 12,
        bottomSafeArea: options.bottomSafeArea || 12,
      });

      this.h5Runtime = options.h5Runtime || null;
    }

    createImage(src) {
      if (typeof global.Image === 'function') {
        return new global.Image();
      }
      return null;
    }
  }

  global.H5CanvasGameRenderer = H5CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
