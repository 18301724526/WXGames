(function (global) {
  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../CanvasModalSnapshotAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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

  const PANEL_KEY = 'famousPersons';
  const MODAL_KEY = 'showFamousPersons';

  function getUiStateOwner(host, options = {}) {
    return options.context?.getUiStateOwner?.() || host;
  }

  function openModal(host) {
    return CanvasModalSnapshotAdapter?.openBlockingPanelSnapshot?.(host, MODAL_KEY, true);
  }

  function closeModal(host) {
    return CanvasModalSnapshotAdapter?.closeBlockingPanelSnapshot?.(host, MODAL_KEY);
  }

  function closeCompetingPanels(host) {
    CanvasModalSnapshotAdapter?.closeBlockingPanelsSnapshot?.(host, [MODAL_KEY]);
    host?.closeEventSnapshot?.();
  }

  function resetListState(host) {
    if (!host || typeof host !== 'object') return;
    host.famousPersonsPage = 0;
    host.selectedFamousPersonId = '';
  }

  function clearSelection(host) {
    if (!host || typeof host !== 'object') return;
    host.selectedFamousPersonId = '';
  }

  function clearTooltip(host, options = {}) {
    const game = options.context?.getGameHost?.() || null;
    host?.renderer?.clearFamousSkillTooltip?.();
    if (game && game !== host) game.renderer?.clearFamousSkillTooltip?.();
  }

  const FamousPersonsPanel = {
    key: PANEL_KEY,
    modalKey: MODAL_KEY,

    isOpen(host) {
      return CanvasModalSnapshotAdapter?.isBlockingPanelSnapshotOpen?.(host, MODAL_KEY) === true;
    },

    open(host, options = {}) {
      const owner = getUiStateOwner(host, options);
      openModal(host);
      resetListState(owner);
      closeCompetingPanels(host);
      if (options.clearTooltip !== false) clearTooltip(host, options);
      return true;
    },

    close(host, options = {}) {
      const owner = getUiStateOwner(host, options);
      closeModal(host);
      resetListState(owner);
      if (options.clearTooltip !== false) clearTooltip(host, options);
      return true;
    },

    changePage(host, action = {}, options = {}) {
      const owner = getUiStateOwner(host, options);
      const delta = Number(action.delta) || 0;
      owner.famousPersonsPage = Math.max(0, (Number(owner.famousPersonsPage) || 0) + delta);
      clearSelection(owner);
      clearTooltip(host, options);
      return true;
    },

    openDetail(host, action = {}, options = {}) {
      const owner = getUiStateOwner(host, options);
      owner.selectedFamousPersonId = action.personId || '';
      clearTooltip(host, options);
      return true;
    },

    closeDetail(host, _action = {}, options = {}) {
      const owner = getUiStateOwner(host, options);
      clearSelection(owner);
      clearTooltip(host, options);
      return true;
    },

    render(renderer, state = {}, options = {}) {
      if (FamousPanelCanvasRenderer?.renderFamousPersonsPanel) {
        return FamousPanelCanvasRenderer.renderFamousPersonsPanel(renderer, state, options);
      }
      return renderer?.renderFamousPersonsPanel?.(state, options);
    },
  };

  FamousPersonsPanel.actions = Object.freeze({
    changePage(host, action = {}, options = {}) {
      return FamousPersonsPanel.changePage(host, action, options);
    },
    openDetail(host, action = {}, options = {}) {
      return FamousPersonsPanel.openDetail(host, action, options);
    },
    closeDetail(host, action = {}, options = {}) {
      return FamousPersonsPanel.closeDetail(host, action, options);
    },
    showTooltip(host, action = {}, options = {}) {
      const game = options.context?.getGameHost?.() || null;
      const renderer = host?.renderer || game?.renderer || null;
      if (typeof renderer?.setPinnedFamousSkillTooltip !== 'function') return false;
      renderer.setPinnedFamousSkillTooltip(action);
      return true;
    },
    clearTooltip(host, _action = {}, options = {}) {
      clearTooltip(host, options);
      return true;
    },
  });

  global.FamousPersonsPanel = FamousPersonsPanel;
  if (typeof module !== 'undefined' && module.exports) module.exports = FamousPersonsPanel;
})(typeof window !== 'undefined' ? window : globalThis);
