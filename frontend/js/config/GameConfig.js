(function (global) {
  const GameConfig = {
    API_BASE: '/api',
    DEPLOY_STATUS_PATH: '.wxgame-deploy-status.json',
    SYNC_INTERVAL_MS: 2000,
    HEARTBEAT_INTERVAL_MS: 1000,
    UPDATE_CHECK_INTERVAL_MS: 5000,
    TUTORIAL_WAIT_SYNC_INTERVAL_MS: 500,
    TUTORIAL_START_DELAY_MS: 2000,
    TUTORIAL_COMPLETE_DELAY_MS: 1000,
    FEATURES: {
      FOG_OF_WAR_ENABLED: true,
      DEBUG_OVERLAYS_ENABLED: false,
    },
    TABS: {
      resources: 'resources',
      buildings: 'buildings',
      tech: 'tech',
      events: 'events',
      civilization: 'civilization',
      military: 'military',
    },
  };

  global.GameConfig = GameConfig;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
})(typeof window !== 'undefined' ? window : globalThis);
