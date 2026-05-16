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
    ERAS: ['原始时代', '农耕时代', '聚落时代', '青铜时代', '古典时代', '中世纪'],
    BUILDINGS: {
      farm: {
        id: 'farm',
        name: '农田',
        icon: '🌾',
        art: 'assets/art/building-farm-cutout.png',
        ui: { effectText: [{ field: 'foodOutputBonus', label: '食物产出', format: 'percent' }] },
      },
      house: {
        id: 'house',
        name: '民居',
        icon: '🏠',
        art: 'assets/art/building-house-cutout.png',
        ui: {
          effectText: [
            { field: 'populationCapBonus', label: '人口上限', format: 'number' },
            { field: 'happinessBonus', label: '幸福度', format: 'number' },
          ],
        },
      },
      workshop: {
        id: 'workshop',
        name: '工坊',
        icon: '⚒️',
        art: 'assets/art/building-workshop-cutout.png',
        ui: { effectText: [{ field: 'craftsmanOutputBonus', label: '工匠产出', format: 'percent' }] },
      },
      academy: {
        id: 'academy',
        name: '学院',
        icon: '📚',
        art: 'assets/art/building-academy-cutout.png',
        ui: { effectText: [{ field: 'knowledgeOutputBonus', label: '知识产出', format: 'percent' }] },
      },
      lumbermill: {
        id: 'lumbermill',
        name: '伐木场',
        icon: '🪵',
        ui: { effectText: [{ field: 'woodOutputBase', label: '基础木材', format: 'number' }] },
      },
      barracks: {
        id: 'barracks',
        name: '兵营',
        icon: '🛡️',
        art: 'assets/art/building-barracks-cutout.png',
        ui: {
          effectText: [
            { field: 'defenseLevel', label: '防御等级', format: 'number' },
            { field: 'globalOutputBonus', label: '全产出', format: 'percent' },
          ],
        },
      },
      temple: {
        id: 'temple',
        name: '神庙',
        icon: '⛪',
        art: 'assets/art/building-temple-cutout.png',
        ui: {
          effectText: [
            { field: 'happinessBonus', label: '幸福度', format: 'number' },
            { field: 'offlineEfficiencyBonus', label: '离线收益', format: 'percent' },
          ],
        },
      },
    },
  };

  global.GameConfig = GameConfig;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameConfig;
})(typeof window !== 'undefined' ? window : globalThis);
