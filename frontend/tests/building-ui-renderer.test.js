const test = require('node:test');
const assert = require('node:assert/strict');

global.FrontendBuildingState = {
  getLevel(buildings, id) {
    return buildings?.[id]?.level || 0;
  },
  getActionLabel(cost, level) {
    if (cost === null) return '已满级';
    return level > 0 ? '升级' : '建造';
  },
};

const BuildingUIRenderer = require('../js/ui/BuildingUIRenderer');

function getCardMarkup(html, id) {
  const start = html.indexOf(`id="card-${id}"`);
  const next = html.indexOf('class="building-card', start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

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

test('民居引导阶段只放行未建造的民居按钮', () => {
  const container = { innerHTML: '' };
  const renderer = new BuildingUIRenderer(container, {
    farm: { id: 'farm', name: '农田', icon: '🌾', ui: { effectText: [] } },
    house: { id: 'house', name: '民居', icon: '🏠', ui: { effectText: [] } },
  });

  renderer.render({
    unlockedBuildings: ['farm', 'house'],
    buildings: { farm: { level: 1 }, house: null },
    buildingCosts: { farm: null, house: { food: 30 } },
    buildingEffects: {},
  }, { completed: false, currentStep: 7 });

  assert.match(getCardMarkup(container.innerHTML, 'farm'), /disabled/);
  assert.doesNotMatch(getCardMarkup(container.innerHTML, 'house'), /disabled/);

  renderer.render({
    unlockedBuildings: ['farm', 'house'],
    buildings: { farm: { level: 1 }, house: { level: 1 } },
    buildingCosts: { farm: null, house: { food: 80 } },
    buildingEffects: {},
  }, { completed: false, currentStep: 8 });

  assert.match(getCardMarkup(container.innerHTML, 'house'), /disabled/);
});
