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

  function callPanel(entry, methodName, args) {
    const panel = entry?.module || null;
    const method = panel?.[methodName];
    return typeof method === 'function' ? method.apply(panel, args) : false;
  }

  function callPanelAction(entry, actionName, args) {
    const panel = entry?.module || null;
    const handler = panel?.actions?.[actionName] || panel?.[actionName];
    return typeof handler === 'function' ? handler.apply(panel, args) : false;
  }

  function createEntry(module) {
    const entry = {
      key: 'famousPersons',
      modalKey: 'showFamousPersons',
      band: 'panel',
      renderPriority: 100,
      hitTargetPriority: 100,
      closesOnOutsideClick: true,
      blocksBaseHitTargets: true,
      module,
      isOpen(host, options) {
        return callPanel(entry, 'isOpen', [host, options]);
      },
      open(host, options) {
        return callPanel(entry, 'open', [host, options]);
      },
      close(host, options) {
        return callPanel(entry, 'close', [host, options]);
      },
      actions: Object.freeze({
        changePage(host, action, options) {
          return callPanelAction(entry, 'changePage', [host, action, options]);
        },
        openDetail(host, action, options) {
          return callPanelAction(entry, 'openDetail', [host, action, options]);
        },
        closeDetail(host, action, options) {
          return callPanelAction(entry, 'closeDetail', [host, action, options]);
        },
        showTooltip(host, action, options) {
          return callPanelAction(entry, 'showTooltip', [host, action, options]);
        },
        clearTooltip(host, action, options) {
          return callPanelAction(entry, 'clearTooltip', [host, action, options]);
        },
      }),
      render(renderer, state, options) {
        return callPanel(entry, 'render', [renderer, state, options]);
      },
    };
    return Object.freeze(entry);
  }

  const PANELS = Object.freeze({
    famousPersons: createEntry(FamousPersonsPanel),
  });

  const CanvasPanelRegistry = {
    get(panelKey = '') {
      return PANELS[panelKey] || null;
    },

    has(panelKey = '') {
      return Boolean(this.get(panelKey));
    },

    keys() {
      return Object.keys(PANELS).filter((key) => Boolean(PANELS[key]?.module));
    },
  };

  global.CanvasPanelRegistry = CanvasPanelRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelRegistry;
})(typeof window !== 'undefined' ? window : globalThis);
