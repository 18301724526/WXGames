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

  function getMountedGame(host) {
    return host?.lastGame && host.lastGame !== host ? host.lastGame : null;
  }

  function getUiStateOwner(host) {
    return getMountedGame(host) || host;
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

  function clearTooltip(host) {
    host?.renderer?.clearFamousSkillTooltip?.();
  }

  const FamousPersonsPanel = {
    key: PANEL_KEY,
    modalKey: MODAL_KEY,

    open(host, options = {}) {
      const owner = getUiStateOwner(host);
      openModal(host);
      resetListState(owner);
      closeCompetingPanels(host);
      if (options.clearTooltip !== false) clearTooltip(host);
      return true;
    },

    close(host, options = {}) {
      const owner = getUiStateOwner(host);
      closeModal(host);
      resetListState(owner);
      if (options.clearTooltip !== false) clearTooltip(host);
      return true;
    },

    changePage(host, action = {}) {
      const owner = getUiStateOwner(host);
      const delta = Number(action.delta) || 0;
      owner.famousPersonsPage = Math.max(0, (Number(owner.famousPersonsPage) || 0) + delta);
      clearSelection(owner);
      clearTooltip(host);
      return true;
    },

    openDetail(host, action = {}) {
      const owner = getUiStateOwner(host);
      owner.selectedFamousPersonId = action.personId || '';
      clearTooltip(host);
      return true;
    },

    closeDetail(host) {
      const owner = getUiStateOwner(host);
      clearSelection(owner);
      clearTooltip(host);
      return true;
    },

    render(renderer, state = {}, options = {}) {
      if (FamousPanelCanvasRenderer?.renderFamousPersonsPanel) {
        return FamousPanelCanvasRenderer.renderFamousPersonsPanel(renderer, state, options);
      }
      return renderer?.renderFamousPersonsPanel?.(state, options);
    },
  };

  global.FamousPersonsPanel = FamousPersonsPanel;
  if (typeof module !== 'undefined' && module.exports) module.exports = FamousPersonsPanel;
})(typeof window !== 'undefined' ? window : globalThis);
