(function (global) {
  class CanvasActionDispatcher {
    constructor(options = {}) {
      this.log = typeof options.log === 'function' ? options.log : null;
    }

    canHandle(action) {
      return Boolean(action && action.type === 'switchTab');
    }

    handle(action, context = {}) {
      if (!this.canHandle(action)) return false;
      if (action.disabled) return true;

      if (typeof context.resetForTabSwitch === 'function') context.resetForTabSwitch(action);

      let switched = false;
      if (typeof context.switchTab === 'function') {
        switched = context.switchTab(action.tab, action) !== false;
      }

      if (switched && typeof context.render === 'function') context.render(action);
      return switched;
    }

    static supportedActions() {
      return ['switchTab'];
    }
  }

  global.CanvasActionDispatcher = CanvasActionDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);
