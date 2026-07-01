(function (global) {
  'use strict';

  // state/TerritoryUiStateStore.js -- the single live owner router for territory UI state.
  //
  // The store holds no copy of its own. It resolves the mounted game as the owner,
  // normalizes the owner's `territoryUiState` object in place, and points shell /
  // TerritoryController mirrors at that same object. After `ensure(...)`, writes to
  // game.territoryUiState, shell.territoryUiState, or territoryController.uiState
  // are writes to one object, not three drifting facts.

  const DEFAULT_TERRITORY_UI_STATE = Object.freeze({
    selectedSiteId: '',
    worldMarchTarget: null,
    selectedWorldActorId: '',
    selectedWorldMissionId: '',
    worldPanX: 0,
    worldPanY: 0,
    expeditionConfigSiteId: '',
    expeditionTroopType: '',
    expeditionLeader: '',
    expeditionSoldiers: '',
  });

  function isObject(value) {
    return Boolean(value && typeof value === 'object');
  }

  function createInitialState(overrides = {}) {
    return {
      ...DEFAULT_TERRITORY_UI_STATE,
      ...(isObject(overrides) ? overrides : {}),
    };
  }

  function normalizeState(uiState = {}) {
    Object.entries(DEFAULT_TERRITORY_UI_STATE).forEach(([key, value]) => {
      if (!Object.prototype.hasOwnProperty.call(uiState, key)) uiState[key] = value;
    });
    return uiState;
  }

  function getOwner(host = null) {
    if (!isObject(host)) return null;
    return isObject(host.lastGame) && host.lastGame !== host ? host.lastGame : host;
  }

  function getShell(owner = null, host = null) {
    if (isObject(owner?.canvasShell)) return owner.canvasShell;
    if (host && host !== owner && isObject(host)) return host;
    return null;
  }

  function getController(owner = null, host = null) {
    return owner?.territoryController || host?.territoryController || null;
  }

  function ensure(host = null) {
    const owner = getOwner(host);
    if (!owner) return createInitialState();
    if (!isObject(owner.territoryUiState)) {
      owner.territoryUiState = createInitialState();
    } else {
      normalizeState(owner.territoryUiState);
    }
    const uiState = owner.territoryUiState;
    const shell = getShell(owner, host);
    if (shell && shell.territoryUiState !== uiState) shell.territoryUiState = uiState;
    const controller = getController(owner, host);
    if (isObject(controller) && controller.uiState !== uiState) controller.uiState = uiState;
    return uiState;
  }

  function resolve(host = null, overrideUiState = null) {
    if (isObject(overrideUiState)) return normalizeState(overrideUiState);
    return ensure(host);
  }

  function patch(host = null, patchValues = {}) {
    const uiState = ensure(host);
    if (!isObject(patchValues)) return uiState;
    Object.assign(uiState, patchValues);
    return uiState;
  }

  function clearWorldSelection(host = null, options = {}) {
    const clearMarch = options.clearWorldMarchTarget !== false;
    return patch(host, {
      selectedSiteId: '',
      ...(clearMarch
        ? {
            worldMarchTarget: null,
            selectedWorldActorId: '',
            selectedWorldMissionId: '',
          }
        : {}),
      expeditionConfigSiteId: '',
      expeditionSoldiers: '',
      expeditionTroopType: '',
      expeditionLeader: '',
    });
  }

  const api = Object.freeze({
    DEFAULT_TERRITORY_UI_STATE,
    createInitialState,
    normalizeState,
    getOwner,
    ensure,
    resolve,
    patch,
    clearWorldSelection,
  });

  global.TerritoryUiStateStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
