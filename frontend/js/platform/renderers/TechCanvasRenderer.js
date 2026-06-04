(function (global) {
  class TechCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    render(state = {}, startY = 210, panelHeight = 250, options = {}) {
      if (!this.host || typeof this.host.renderTechInternal !== 'function') {
        return false;
      }
      return this.host.renderTechInternal(state, startY, panelHeight, options);
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = TechCanvasRenderer;
  else global.TechCanvasRenderer = TechCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
