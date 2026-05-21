(function (global) {
  class CanvasActionDispatcher {
    constructor(options = {}) {
      this.log = typeof options.log === 'function' ? options.log : null;
    }

    canHandle(action) {
      return Boolean(action && CanvasActionDispatcher.supportedActions().includes(action.type));
    }

    handle(action, context = {}) {
      if (!this.canHandle(action)) return false;
      if (action.disabled) return true;

      if (action.type === 'switchTab') {
        if (typeof context.resetForTabSwitch === 'function') context.resetForTabSwitch(action);

        let switched = false;
        if (typeof context.switchTab === 'function') {
          switched = context.switchTab(action.tab, action) !== false;
        }

        if (switched && typeof context.render === 'function') context.render(action);
        return switched;
      }

      if (action.type === 'openResourceDetails') {
        const opened = typeof context.openResourceDetails === 'function'
          ? context.openResourceDetails(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeResourceDetails') {
        const closed = typeof context.closeResourceDetails === 'function'
          ? context.closeResourceDetails(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openCitySwitcher') {
        const opened = typeof context.openCitySwitcher === 'function'
          ? context.openCitySwitcher(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeCitySwitcher') {
        const closed = typeof context.closeCitySwitcher === 'function'
          ? context.closeCitySwitcher(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openSettings') {
        const opened = typeof context.openSettings === 'function'
          ? context.openSettings(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeSettings') {
        const closed = typeof context.closeSettings === 'function'
          ? context.closeSettings(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      return false;
    }

    static supportedActions() {
      return [
        'switchTab',
        'openResourceDetails',
        'closeResourceDetails',
        'openCitySwitcher',
        'closeCitySwitcher',
        'openSettings',
        'closeSettings',
      ];
    }
  }

  global.CanvasActionDispatcher = CanvasActionDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);
