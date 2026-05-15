(function (global) {
  const GameConfig = {
    API_BASE: '/api',
    SYNC_INTERVAL_MS: 2000,
    TUTORIAL_START_DELAY_MS: 2000,
    TUTORIAL_COMPLETE_DELAY_MS: 1000,
    TABS: {
      resources: 'resources',
      buildings: 'buildings',
      tech: 'tech',
      events: 'events',
      civilization: 'civilization',
    },
    ERAS: ['原始时代', '农耕时代', '青铜时代', '古典时代', '中世纪'],
    BUILDINGS: {
      farm: { id: 'farm', name: '农田', icon: '🌾' },
      house: { id: 'house', name: '民居', icon: '🏠' },
      workshop: { id: 'workshop', name: '工坊', icon: '⚒️' },
      academy: { id: 'academy', name: '学院', icon: '📚' },
      barracks: { id: 'barracks', name: '兵营', icon: '🛡️' },
      temple: { id: 'temple', name: '神庙', icon: '⛪' },
    },
  };

  global.GameConfig = GameConfig;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
})(typeof window !== 'undefined' ? window : globalThis);
