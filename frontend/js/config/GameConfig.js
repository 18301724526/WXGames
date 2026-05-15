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
      farm: { id: 'farm', name: '农田', icon: '🌾', description: '每级提升食物产出', effectText: '食物产出 +50%', maxLevel: 4 },
      house: { id: 'house', name: '民居', icon: '🏠', description: '每级增加人口上限与幸福度', effectText: '人口上限 +3，幸福度 +5', maxLevel: 3 },
      workshop: { id: 'workshop', name: '工坊', icon: '⚒️', description: '提升工匠产出', effectText: '工匠产出提升', maxLevel: 3 },
      academy: { id: 'academy', name: '学院', icon: '📚', description: '提升知识产出', effectText: '知识产出提升', maxLevel: 3 },
      barracks: { id: 'barracks', name: '兵营', icon: '🛡️', description: '提供防御能力', effectText: '防御等级提升', maxLevel: 2 },
      temple: { id: 'temple', name: '神庙', icon: '⛪', description: '提升离线收益', effectText: '离线效率提升', maxLevel: 2 },
    },
  };

  global.GameConfig = GameConfig;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
})(typeof window !== 'undefined' ? window : globalThis);
