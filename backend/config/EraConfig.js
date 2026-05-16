const ERA_NAMES = ['原始时代', '农耕时代', '聚落时代', '青铜时代', '古典时代', '中世纪'];

const ERA_BUILDING_UNLOCKS = {
  0: [],
  1: ['farm', 'house'],
  2: ['lumbermill', 'workshop', 'academy'],
  3: ['barracks'],
  4: ['temple'],
};

const ERA_ADVANCEMENT = {
  0: {
    nextEra: 1,
    name: '农耕时代',
    cost: { food: 80 },
    conditions: [{ key: 'food', label: '食物', required: 80 }],
  },
  1: {
    nextEra: 2,
    name: '聚落时代',
    cost: { food: 120, knowledge: 5 },
    conditions: [
      { key: 'food', label: '食物', required: 120 },
      { key: 'knowledge', label: '知识', required: 5 },
    ],
  },
  2: {
    nextEra: 3,
    name: '青铜时代',
    cost: { food: 300, wood: 100, knowledge: 50 },
    conditions: [
      { key: 'food', label: '食物', required: 300 },
      { key: 'wood', label: '木材', required: 100 },
      { key: 'knowledge', label: '知识', required: 50 },
    ],
  },
};

function getEraName(era) {
  return ERA_NAMES[era] || `时代${era}`;
}

function getAdvanceConfig(currentEra) {
  return ERA_ADVANCEMENT[currentEra] || null;
}

module.exports = {
  ERA_NAMES,
  ERA_BUILDING_UNLOCKS,
  ERA_ADVANCEMENT,
  getEraName,
  getAdvanceConfig,
};
