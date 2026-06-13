(function (global) {
  const TAB_ORDER = Object.freeze(['military', 'buildings', 'tech', 'events', 'civilization']);
  const PAGE_TAB_IDS = new Set(TAB_ORDER);

  function normalizePageTab(tab) {
    const rawTab = String(tab || '').trim();
    if (rawTab === 'territory') return 'territory';
    return PAGE_TAB_IDS.has(rawTab) ? rawTab : 'military';
  }

  function resolveMapHomeViewState(state = {}, options = {}) {
    const rawRequestedTab = options.requestedTab || options.activeTab || state?.currentTab || 'military';
    const requestedTab = normalizePageTab(rawRequestedTab);
    const normalizedToHome = rawRequestedTab !== requestedTab;
    const canUseMapHome = true;
    const requestedMilitaryView = options.militaryView || state?.militaryView || 'world';
    const forceMapHome = Boolean(options.forceMapHome || options.isMapHome || normalizedToHome);
    const militaryMapRequested = requestedTab === 'military'
      && (forceMapHome || requestedMilitaryView === 'world');
    const shouldUseMapHome = canUseMapHome
      && (forceMapHome || requestedTab === 'territory' || militaryMapRequested);
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
    normalizePageTab,
  });

  global.CanvasGameAppRenderPolicy = CanvasGameAppRenderPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameAppRenderPolicy;
})(typeof window !== 'undefined' ? window : globalThis);
