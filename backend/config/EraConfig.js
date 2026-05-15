const ERA_NAMES = ['原始时代', '农耕时代', '青铜时代', '古典时代', '中世纪'];

const ERA_BUILDING_UNLOCKS = {
  0: [],
  1: ['farm', 'house'],
  2: ['workshop', 'academy'],
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
    name: '青铜时代',
    cost: { food: 200, knowledge: 60 },
    conditions: [
      { key: 'food', label: '食物', required: 200 },
      { key: 'knowledge', label: '知识', required: 60 },
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
