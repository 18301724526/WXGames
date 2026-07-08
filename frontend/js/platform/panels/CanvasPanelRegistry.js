(function (global) {
  const FamousPersonsPanel = (() => {
    if (global.FamousPersonsPanel) return global.FamousPersonsPanel;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./FamousPersonsPanel');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const PANELS = Object.freeze({
    famousPersons: FamousPersonsPanel,
  });

  const CanvasPanelRegistry = {
    get(panelKey = '') {
      return PANELS[panelKey] || null;
    },

    has(panelKey = '') {
      return Boolean(this.get(panelKey));
    },

    keys() {
      return Object.keys(PANELS).filter((key) => Boolean(PANELS[key]));
    },
  };

  global.CanvasPanelRegistry = CanvasPanelRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelRegistry;
})(typeof window !== 'undefined' ? window : globalThis);
