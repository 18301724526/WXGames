const ERA_NAMES = ['原始时代', '农耕时代', '聚落时代', '城邦时代', '古典时代', '中世纪'];

const ERA_DESCRIPTIONS = [
  '原始时代：口耳相传，等待迈入农耕时代。',
  '农耕时代：农田与民居让族人第一次稳定下来。',
  '聚落时代：伐木场与工匠分工让资源生产变得多样。',
  '远方传来了陌生的鼓声。你的聚落已经太大，不可能再隐藏于森林之中。其他部落的猎人在边界游荡，眼神不再友善。建造兵营，训练守卫，让你的城邦在黑暗中亮起第一盏防御的灯火。',
  '古典时代：更复杂的制度、信仰与外部冲突正在成形。',
  '中世纪：更大的版图与更深的组织能力仍在等待实现。',
];

const ERA_BUILDING_UNLOCKS = {
  0: [],
  1: ['farm', 'house'],
  2: ['lumbermill'],
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
    name: '城邦时代',
    cost: { food: 500, wood: 200, knowledge: 100 },
    conditions: [
      { key: 'food', label: '食物', required: 500 },
      { key: 'wood', label: '木材', required: 200 },
      { key: 'knowledge', label: '知识', required: 100 },
    ],
  },
};

function getEraName(era) {
  return ERA_NAMES[era] || `时代${era}`;
}

function getEraDescription(era) {
  return ERA_DESCRIPTIONS[era] || `${getEraName(era)}：新的时代仍在规划中。`;
}

function getAdvanceConfig(currentEra) {
  return ERA_ADVANCEMENT[currentEra] || null;
}

module.exports = {
  ERA_NAMES,
  ERA_DESCRIPTIONS,
  ERA_BUILDING_UNLOCKS,
  ERA_ADVANCEMENT,
  getEraName,
  getEraDescription,
  getAdvanceConfig,
};
