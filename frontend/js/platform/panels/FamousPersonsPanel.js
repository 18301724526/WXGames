(function (global) {
  const FamousPanelCanvasRenderer = (() => {
    if (global.FamousPanelCanvasRenderer) return global.FamousPanelCanvasRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../renderers/FamousPanelCanvasRenderer');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const CLOSEABLE_PANELS = [
    'showSettings',
    'showLogs',
    'showResourceDetails',
    'showCitySwitcher',
    'showSubcityList',
    'showCityManagement',
    'showAdvisor',
    'showTaskCenter',
    'showGuidebook',
    'showFamousPersons',
    'armyFormationEditor',
    'techDetailOpen',
    'activeCommandPanel',
  ];

  function getOwner(host, options = {}) {
    return options.context?.getUiStateOwner?.() || host;
  }

  function getGame(host, options = {}) {
    return options.context?.getGameHost?.() || host?.getCanvasGameHost?.() || host?.lastGame || host;
  }

  function getSurfaceHost(host, options = {}) {
    return options.context?.getPanelSurfaceManager?.()?.getSurfaceHost?.()
      || host?.canvasShell
      || host?.lastGame?.canvasShell
      || null;
  }

  function setField(target, key, value) {
    if (target && typeof target === 'object' && key in target) target[key] = value;
  }

  function uniqueTargets(targets = []) {
    return targets.filter((target, index) => target && targets.indexOf(target) === index);
  }

  function syncFamousState(host, owner, open, options = {}) {
    const game = getGame(host, options);
    const surfaceHost = getSurfaceHost(host, options);
    uniqueTargets([host, owner, game, surfaceHost]).forEach((target) => {
      setField(target, 'showFamousPersons', open);
      setField(target, 'famousPersonsPage', 0);
      setField(target, 'selectedFamousPersonId', '');
    });
  }

  function closeCompetingPanels(host, owner, options = {}) {
    const keep = new Set(['showFamousPersons']);
    const surfaceHost = getSurfaceHost(host, options);
    uniqueTargets([host, owner, surfaceHost]).forEach((target) => {
      CLOSEABLE_PANELS.forEach((key) => {
        if (keep.has(key) || !(key in target)) return;
        target[key] = key === 'activeCommandPanel' ? '' : false;
      });
      if ('activeEventId' in target) target.activeEventId = null;
    });
  }

  function clearTooltip(host, options = {}) {
    const game = getGame(host, options);
    host?.renderer?.clearFamousSkillTooltip?.();
    if (game && game !== host) game.renderer?.clearFamousSkillTooltip?.();
  }

  const FamousPersonsPanel = {
    key: 'famousPersons',
    modalKey: 'showFamousPersons',

    isOpen(host, options = {}) {
      const owner = getOwner(host, options);
      return Boolean(owner?.showFamousPersons || host?.showFamousPersons);
    },

    open(host, options = {}) {
      const owner = getOwner(host, options);
      syncFamousState(host, owner, true, options);
      closeCompetingPanels(host, owner, options);
      if (options.clearTooltip !== false) clearTooltip(host, options);
      return true;
    },

    close(host, options = {}) {
      const owner = getOwner(host, options);
      syncFamousState(host, owner, false, options);
      if (options.clearTooltip !== false) clearTooltip(host, options);
      return true;
    },

    actions: {
      changePage(host, action = {}, options = {}) {
        const owner = getOwner(host, options);
        const surfaceHost = getSurfaceHost(host, options);
        owner.famousPersonsPage = Math.max(0, (Number(owner.famousPersonsPage) || 0) + (Number(action.delta) || 0));
        owner.selectedFamousPersonId = '';
        uniqueTargets([host, surfaceHost]).forEach((target) => {
          if (target !== owner && 'famousPersonsPage' in target) target.famousPersonsPage = owner.famousPersonsPage;
          if (target !== owner && 'selectedFamousPersonId' in target) target.selectedFamousPersonId = '';
        });
        clearTooltip(host, options);
        return true;
      },

      openDetail(host, action = {}, options = {}) {
        const owner = getOwner(host, options);
        const surfaceHost = getSurfaceHost(host, options);
        owner.selectedFamousPersonId = action.personId || '';
        uniqueTargets([host, surfaceHost]).forEach((target) => {
          if (target !== owner && 'selectedFamousPersonId' in target) target.selectedFamousPersonId = owner.selectedFamousPersonId;
        });
        clearTooltip(host, options);
        return true;
      },

      closeDetail(host, _action = {}, options = {}) {
        const owner = getOwner(host, options);
        const surfaceHost = getSurfaceHost(host, options);
        owner.selectedFamousPersonId = '';
        uniqueTargets([host, surfaceHost]).forEach((target) => {
          if (target !== owner && 'selectedFamousPersonId' in target) target.selectedFamousPersonId = '';
        });
        clearTooltip(host, options);
        return true;
      },

      showTooltip(host, action = {}, options = {}) {
        const game = getGame(host, options);
        const renderer = host?.renderer || game?.renderer || null;
        if (typeof renderer?.setPinnedFamousSkillTooltip === 'function') {
          renderer.setPinnedFamousSkillTooltip(action);
          return true;
        }
        return false;
      },

      clearTooltip(host, _action = {}, options = {}) {
        clearTooltip(host, options);
        return true;
      },
    },

    render(renderer, state = {}, options = {}) {
      const renderOptions = { ...options, skipPanelBackgroundHitTarget: true };
      if (FamousPanelCanvasRenderer?.renderFamousPersonsPanel) {
        return FamousPanelCanvasRenderer.renderFamousPersonsPanel(renderer, state, renderOptions);
      }
      return renderer?.renderFamousPersonsPanel?.(state, renderOptions);
    },
  };

  global.FamousPersonsPanel = FamousPersonsPanel;
  if (typeof module !== 'undefined' && module.exports) module.exports = FamousPersonsPanel;
})(typeof window !== 'undefined' ? window : globalThis);
