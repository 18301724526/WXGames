(function (global) {
  const TAB_ORDER = Object.freeze(['resources', 'buildings', 'tech', 'events', 'civilization', 'military']);

  function resolveMapHomeViewState(state = {}, options = {}) {
    const requestedTab = options.requestedTab || options.activeTab || state?.currentTab || 'resources';
    const canUseMapHome = true;
    const requestedMilitaryView = options.militaryView || state?.militaryView || 'army';
    const militaryMapRequested = requestedTab === 'military'
      && (options.forceMapHome || options.isMapHome || requestedMilitaryView === 'world');
    const shouldUseMapHome = canUseMapHome
      && options.allowDefaultMapHome !== false
      && (options.forceMapHome || requestedTab === 'resources' || requestedTab === 'territory' || militaryMapRequested);
    return {
      activeTab: shouldUseMapHome ? 'military' : (requestedTab === 'territory' ? 'military' : requestedTab),
      requestedTab,
      militaryView: shouldUseMapHome ? 'world' : requestedMilitaryView,
      isMapHome: Boolean(shouldUseMapHome),
      canUseMapHome,
    };
  }

  function getTabOrder() {
    return TAB_ORDER.slice();
  }

  function getPreferredMilitaryView(tabId) {
    if (tabId === 'territory') return 'world';
    return null;
  }

  const CanvasGameAppRenderPolicy = Object.freeze({
    TAB_ORDER,
    resolveMapHomeViewState,
    getTabOrder,
    getPreferredMilitaryView,
  });

  global.CanvasGameAppRenderPolicy = CanvasGameAppRenderPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameAppRenderPolicy;
})(typeof window !== 'undefined' ? window : globalThis);
