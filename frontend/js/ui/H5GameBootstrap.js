(function (global) {
  class H5GameBootstrap {
    constructor(options = {}) {
      this.doc = options.document || null;
      this.runtime = options.runtime || global;
      this.started = false;
    }

    start(game) {
      if (!game || this.started) return false;
      this.started = true;
      if (this.runtime) this.runtime.Game = game;
      if (typeof game.init === 'function') game.init();
      return true;
    }

    mount(game) {
      if (!game) return false;
      if (this.runtime) this.runtime.Game = game;
      if (!this.doc || typeof this.doc.addEventListener !== 'function') {
        return this.start(game);
      }
      if (this.doc.readyState && this.doc.readyState !== 'loading') {
        return this.start(game);
      }
      this.doc.addEventListener('DOMContentLoaded', () => this.start(game), { once: true });
      return true;
    }

    static mount(game, options = {}) {
      return new H5GameBootstrap(options).mount(game);
    }
  }

  global.H5GameBootstrap = H5GameBootstrap;
  if (typeof module !== 'undefined' && module.exports) module.exports = H5GameBootstrap;
})(typeof window !== 'undefined' ? window : globalThis);
