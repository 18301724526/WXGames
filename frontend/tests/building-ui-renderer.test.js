const test = require('node:test');
const assert = require('node:assert/strict');

global.FrontendBuildingState = {
  getLevel(buildings, id) {
    return buildings?.[id]?.level || 0;
  },
};

const BuildingUIRenderer = require('../js/ui/BuildingUIRenderer');

test('根据配置模板渲染建筑效果文案', () => {
  const config = {
    id: 'farm',
    ui: {
      effectText: [{ field: 'foodOutputBonus', label: '食物产出', format: 'percent' }],
    },
  };
  const renderer = new BuildingUIRenderer(null, { farm: config });

  const text = renderer.getEffectText(config, {
    byBuilding: {
      farm: { foodOutputBonus: 1 },
    },
  });

  assert.equal(text, '食物产出 +100%');
});

test('缺少模板或数值时回退到默认文案', () => {
  const config = { id: 'temple', ui: { effectText: [{ field: 'offlineEfficiencyBonus', label: '离线收益', format: 'percent' }] } };
  const renderer = new BuildingUIRenderer(null, { temple: config });

  const text = renderer.getEffectText(config, { byBuilding: { temple: {} } });

  assert.equal(text, '效果由后端计算');
});

test('木材成本会显示在建筑按钮文案中', () => {
  const renderer = new BuildingUIRenderer(null, {});
  assert.equal(renderer.formatCost({ food: 50, wood: 15 }), '🌾 50 🪵 15');
});
