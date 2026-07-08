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
    famousPersons: Object.freeze({
      key: 'famousPersons',
      modalKey: 'showFamousPersons',
      band: 'panel',
      renderPriority: 100,
      hitTargetPriority: 100,
      closesOnOutsideClick: true,
      blocksBaseHitTargets: true,
      module: FamousPersonsPanel,
    }),
  });

  function get(panelKey = '') {
    return PANELS[String(panelKey || '')] || null;
  }

  const CanvasPanelRegistry = {
    get,
    has(panelKey = '') {
      return Boolean(get(panelKey));
    },
    keys() {
      return Object.keys(PANELS).filter((key) => Boolean(PANELS[key]?.module));
    },
  };

  global.CanvasPanelRegistry = CanvasPanelRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelRegistry;
})(typeof window !== 'undefined' ? window : globalThis);

