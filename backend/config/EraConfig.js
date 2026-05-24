const ERA_NAMES = ['原始时代', '农耕时代', '聚落时代', '城邦时代', '边境时代', '古典时代'];

const ERA_DESCRIPTIONS = [
  '原始时代：口耳相传，等待迈入农耕时代。',
  '农耕时代：农田与民居让族人第一次稳定下来。',
  '聚落时代：伐木场与工匠分工让资源生产变得多样。',
  '远方传来了陌生的鼓声。你的聚落已经太大，不可能再隐藏于森林之中。其他部落的猎人在边界游荡，眼神不再友善。建造兵营，训练守卫，让你的城邦在黑暗中亮起第一盏防御的灯火。',
  '边境时代：边界不再安静，瞭望台与士兵共同守住城邦的第一圈安全线。',
  '古典时代：真正的战争、制度与远征仍在后续版本中展开。',
];

const ERA_BUILDING_UNLOCKS = {
  0: [],
  1: ['farm', 'house'],
  2: ['lumbermill'],
  3: ['barracks'],
  4: ['watchtower'],
  5: [],
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
  3: {
    nextEra: 4,
    name: '边境时代',
    cost: { food: 900, wood: 500, knowledge: 260 },
    conditions: [
      { key: 'food', label: '食物', required: 900 },
      { key: 'wood', label: '木材', required: 500 },
      { key: 'knowledge', label: '知识', required: 260 },
      { key: 'soldiers', label: '士兵', required: 300, source: 'military' },
    ],
  },
  4: {
    nextEra: 5,
    name: '古典时代',
    cost: { food: 1400, wood: 900, knowledge: 520 },
    conditions: [
      { key: 'food', label: '食物', required: 1400 },
      { key: 'wood', label: '木材', required: 900 },
      { key: 'knowledge', label: '知识', required: 520 },
      { key: 'soldiers', label: '士兵', required: 600, source: 'military' },
      { key: 'watchtower', label: '瞭望台', required: 1, source: 'building' },
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
