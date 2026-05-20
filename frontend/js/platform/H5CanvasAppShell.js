(function (global) {
  class H5CanvasAppShell {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.presenter = options.presenter || null;
      this.previewEnabled = Boolean(options.previewEnabled);
      this.mounted = false;
      this.lastGame = null;
      this.resizeDisposer = null;
    }

    createRenderer(canvas) {
      if (this.renderer || !canvas) return this.renderer;
      const RendererCtor = global.H5CanvasGameRenderer;
      if (!RendererCtor) return null;
      this.renderer = new RendererCtor({
        canvas,
        presenter: this.presenter,
        pixelRatio: this.runtime?.pixelRatio,
        width: this.runtime?.width,
        height: this.runtime?.height,
        h5Runtime: this.runtime,
      });
      return this.renderer;
    }

    mount(game) {
      if (this.mounted) return false;
      if (!this.runtime || typeof this.runtime.ensureCanvas !== 'function') return false;
      const canvas = this.runtime.ensureCanvas();
      if (!canvas) return false;
      this.createRenderer(canvas);
      this.mounted = true;
      this.lastGame = game || null;
      if (this.runtime?.onResize && !this.resizeDisposer) {
        this.resizeDisposer = this.runtime.onResize((size) => this.handleResize(size));
      }
      this.renderReadOnly(game?.state, game?.state?.currentTab || 'resources');
      return true;
    }

    handleResize(size) {
      if (!this.renderer) return;
      this.renderer.width = size.width;
      this.renderer.height = size.height;
      this.renderer.pixelRatio = size.pixelRatio;
      this.renderReadOnly(this.lastGame?.state, this.lastGame?.state?.currentTab || 'resources');
    }

    renderReadOnly(state, activeTab = 'resources') {
      if (!this.previewEnabled || !this.renderer || !state) return false;
      this.renderer.render(state, { activeTab });
      return true;
    }

    static mount(game, options = {}) {
      const RuntimeCtor = options.Runtime || global.H5CanvasRuntime;
      const runtime = options.canvasRuntime
        || (options.runtime?.ensureCanvas ? options.runtime : null)
        || (RuntimeCtor ? new RuntimeCtor(options) : null);
      const shell = new H5CanvasAppShell({
        runtime,
        renderer: options.renderer,
        presenter: options.presenter,
        previewEnabled: options.previewEnabled,
      });
      const mounted = shell.mount(game);
      return mounted ? shell : null;
    }
  }

  global.H5CanvasAppShell = H5CanvasAppShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasAppShell;
})(typeof window !== 'undefined' ? window : globalThis);
