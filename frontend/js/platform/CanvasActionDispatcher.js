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

      if (action.type === 'openLogs') {
        const opened = typeof context.openLogs === 'function'
          ? context.openLogs(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeLogs') {
        const closed = typeof context.closeLogs === 'function'
          ? context.closeLogs(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openAdvisor') {
        const opened = typeof context.openAdvisor === 'function'
          ? context.openAdvisor(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeAdvisor') {
        const closed = typeof context.closeAdvisor === 'function'
          ? context.closeAdvisor(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openEvent') {
        const opened = typeof context.openEvent === 'function'
          ? context.openEvent(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeEvent') {
        const closed = typeof context.closeEvent === 'function'
          ? context.closeEvent(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openWorldSite') {
        const opened = typeof context.openWorldSite === 'function'
          ? context.openWorldSite(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeWorldSite') {
        const closed = typeof context.closeWorldSite === 'function'
          ? context.closeWorldSite(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'resetWorldPan') {
        const reset = typeof context.resetWorldPan === 'function'
          ? context.resetWorldPan(action) !== false
          : false;
        if (reset && typeof context.render === 'function') context.render(action);
        return reset;
      }

      if (action.type === 'changeExpeditionSoldiers') {
        const changed = typeof context.changeExpeditionSoldiers === 'function'
          ? context.changeExpeditionSoldiers(action) !== false
          : false;
        if (changed && typeof context.render === 'function') context.render(action);
        return changed;
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
        'openLogs',
        'closeLogs',
        'openAdvisor',
        'closeAdvisor',
        'openEvent',
        'closeEvent',
        'openWorldSite',
        'closeWorldSite',
        'resetWorldPan',
        'changeExpeditionSoldiers',
      ];
    }

    static supportedAsyncActions() {
      return [
        'selectCity',
        'assignJob',
        'buildBuilding',
        'upgradeBuilding',
        'advanceEra',
        'claimEvent',
        'scoutTerritory',
        'claimScout',
      ];
    }

    canHandleAsync(action) {
      return Boolean(action && CanvasActionDispatcher.supportedAsyncActions().includes(action.type));
    }

    async handleAsync(action, context = {}) {
      if (!this.canHandleAsync(action)) return { handled: false };
      if (action.disabled) return { handled: true, success: false, reason: 'disabled' };

      const handler = context[action.type];
      if (typeof handler !== 'function') {
        return { handled: false, reason: 'no_handler' };
      }

      try {
        const result = await handler(action);
        if (result !== false && typeof context.render === 'function') {
          context.render(action);
        }
        return { handled: true, success: result !== false };
      } catch (error) {
        if (this.log) this.log('Async action error:', action.type, error);
        return { handled: true, success: false, error };
      }
    }
  }

  global.CanvasActionDispatcher = CanvasActionDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);
