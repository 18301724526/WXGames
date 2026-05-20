(function (global) {
  class H5CanvasAppShell {
    constructor(options = {}) {
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.mounted = false;
      this.lastGame = null;
    }

    mount(game) {
      if (this.mounted) return false;
      if (!this.runtime || typeof this.runtime.ensureCanvas !== 'function') return false;
      const canvas = this.runtime.ensureCanvas();
      if (!canvas) return false;
      this.mounted = true;
      this.lastGame = game || null;
      if (this.renderer && typeof this.renderer.render === 'function' && game?.state) {
        this.renderer.render(game.state);
      }
      return true;
    }

    static mount(game, options = {}) {
      const RuntimeCtor = options.Runtime || global.H5CanvasRuntime;
      const runtime = options.canvasRuntime
        || (options.runtime?.ensureCanvas ? options.runtime : null)
        || (RuntimeCtor ? new RuntimeCtor(options) : null);
      const shell = new H5CanvasAppShell({ runtime, renderer: options.renderer });
      const mounted = shell.mount(game);
      return mounted ? shell : null;
    }
  }

  global.H5CanvasAppShell = H5CanvasAppShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5CanvasAppShell;
})(typeof window !== 'undefined' ? window : globalThis);
