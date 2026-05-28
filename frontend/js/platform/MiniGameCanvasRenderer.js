(function (global) {
  var CanvasGameRendererBase = global.CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameRendererBase) {
    CanvasGameRendererBase = require('./CanvasGameRenderer');
  }

  class MiniGameCanvasRenderer extends CanvasGameRendererBase {
    constructor(options = {}) {
      const runtime = options.runtime;
      const systemInfo = runtime?.getSystemInfo?.() || {};
      const pixelRatio = systemInfo.pixelRatio || options.pixelRatio || 1;
      const width = systemInfo.windowWidth || options.width || 390;
      const height = systemInfo.windowHeight || options.height || 844;
      const canvas = options.canvas || runtime?.createCanvas?.();
      const ctx = canvas?.getContext?.('2d');

      super({
        ctx,
        canvas,
        presenter: options.presenter || null,
        pixelRatio,
        width,
        height,
        maxContentWidth: options.maxContentWidth,
        edgePadding: options.edgePadding,
        bottomSafeArea: options.bottomSafeArea,
      });

      this.runtime = runtime;
      if (canvas) {
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
      }
    }

    createImage(src) {
      if (this.runtime?.host && typeof this.runtime.host.createImage === 'function') {
        return this.runtime.host.createImage();
      }
      if (typeof global.Image === 'function') {
        return new global.Image();
      }
      return null;
    }

    static getAssetRequestPath(assetPath) {
      return assetPath;
    }
  }

  global.MiniGameCanvasRenderer = MiniGameCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = MiniGameCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
