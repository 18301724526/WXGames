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

  function getPreferredMilitaryView(tabId, guide = {}) {
    if (tabId === 'territory') return 'world';
    if (tabId !== 'military') return null;
    const target = guide.target || '';
    const message = String(guide.message || '');
    if (target === 'scout-action-first') return 'scout';
    if (target === 'tab-territory') return 'world';
    if (target !== 'tab-military') return null;
    if (/侦察|探索|渚﹀療|鎺㈢储/.test(message)) return 'scout';
    if (/领土|疆域|世界|占领|棰嗗湡|鐤嗗煙|涓栫晫|鍗犻/.test(message)) return 'world';
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
