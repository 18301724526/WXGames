(function (global) {
  const GameConfig = {
    API_BASE: '/api',
    SYNC_INTERVAL_MS: 2000,
    TUTORIAL_WAIT_SYNC_INTERVAL_MS: 500,
    TUTORIAL_START_DELAY_MS: 2000,
    TUTORIAL_COMPLETE_DELAY_MS: 1000,
    TABS: {
      resources: 'resources',
      buildings: 'buildings',
      tech: 'tech',
      events: 'events',
      civilization: 'civilization',
    },
  };

  global.GameConfig = GameConfig;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
})(typeof window !== 'undefined' ? window : globalThis);
