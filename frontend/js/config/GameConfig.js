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
      farm: { id: 'farm', name: '农田', icon: '🌾', art: 'assets/art/building-farm-cutout.png' },
      house: { id: 'house', name: '民居', icon: '🏠', art: 'assets/art/building-house-cutout.png' },
      workshop: { id: 'workshop', name: '工坊', icon: '⚒️', art: 'assets/art/building-workshop-cutout.png' },
      academy: { id: 'academy', name: '学院', icon: '📚', art: 'assets/art/building-academy-cutout.png' },
      barracks: { id: 'barracks', name: '兵营', icon: '🛡️', art: 'assets/art/building-barracks-cutout.png' },
      temple: { id: 'temple', name: '神庙', icon: '⛪', art: 'assets/art/building-temple-cutout.png' },
    },
  };

  global.GameConfig = GameConfig;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
})(typeof window !== 'undefined' ? window : globalThis);
