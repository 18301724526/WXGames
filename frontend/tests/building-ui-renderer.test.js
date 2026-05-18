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

global.UIStatePresenter = require('../js/state/UIStatePresenter');
const BuildingUIRenderer = require('../js/ui/BuildingUIRenderer');

function getCardMarkup(html, id) {
  const start = html.indexOf(`id="card-${id}"`);
  const next = html.indexOf('class="building-card', start + 1);
  return html.slice(start, next === -1 ? html.length : next);
}

function createPatchableCard() {
  const children = {
    '[data-building-level]': { textContent: '' },
    '[data-building-effect]': { innerHTML: '', hidden: true },
    '[data-building-military]': { innerHTML: '', hidden: true },
    '[data-building-desc]': { textContent: '', hidden: true },
    '[data-building-button]': { dataset: {}, disabled: false },
    '[data-building-cost]': { innerHTML: '' },
    '[data-building-label]': { textContent: '' },
  };
  return {
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      },
    },
    querySelector(selector) {
      return children[selector] || null;
    },
    children,
  };
}

function createPatchableContainer() {
  return {
    dataset: {},
    cards: new Map(),
    innerHTML: '',
    querySelector(selector) {
      const match = selector.match(/^\[data-building-id="(.+)"\]$/);
      if (!match) return null;
      return this.cards.get(match[1]) || null;
    },
    querySelectorAll() {
      return [...this.cards.values()];
    },
  };
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

  assert.equal(text, '');
});

test('木材成本会用资源贴图显示在建筑按钮中', () => {
  const renderer = new BuildingUIRenderer(null, {});
  const html = renderer.formatCost({ food: 50, wood: 15 });

  assert.match(html, /cost-item cost-food/);
  assert.match(html, /cost-item cost-wood/);
  assert.match(html, /<span class="cost-value">50<\/span>/);
  assert.match(html, /<span class="cost-value">15<\/span>/);
  assert.doesNotMatch(html, /🌾|🪵|📚/);
});

test('优先使用服务端下发的建筑定义渲染卡片', () => {
  const container = { innerHTML: '' };
  const renderer = new BuildingUIRenderer(container, {
    barracks: { id: 'barracks', name: '旧兵营', icon: 'X', ui: { effectText: [] } },
  });

  renderer.render({
    unlockedBuildings: ['barracks'],
    buildingDefinitions: {
      barracks: {
        id: 'barracks',
        name: '兵营',
        icon: '🛡️',
        art: 'assets/art/building-barracks-cutout.png',
        ui: { effectText: [{ field: 'defenseLevel', label: '防御等级', format: 'number' }] },
      },
    },
    buildings: { barracks: null },
    buildingCosts: { barracks: { food: 260, knowledge: 80 } },
    buildingEffects: { byBuilding: { barracks: { defenseLevel: 0 } } },
  }, { completed: true, currentStep: 15 });

  assert.match(container.innerHTML, /兵营/);
  assert.doesNotMatch(container.innerHTML, /旧兵营/);
  assert.match(container.innerHTML, /assets\/art\/building-barracks-cutout\.png/);
  assert.match(container.innerHTML, /cost-item cost-food/);
  assert.match(container.innerHTML, /cost-item cost-knowledge/);
  assert.match(container.innerHTML, /<span class="cost-value">260<\/span>/);
  assert.match(container.innerHTML, /<span class="cost-value">80<\/span>/);
  assert.doesNotMatch(container.innerHTML, /🌾 260 📚 80/);
});

test('民居引导阶段只放行未建造的民居按钮，民居建成等待阶段恢复普通操作', () => {
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

  assert.doesNotMatch(getCardMarkup(container.innerHTML, 'house'), /引导中锁定/);
  assert.doesNotMatch(getCardMarkup(container.innerHTML, 'house'), /disabled/);
});

test('兵营卡片显示服务端下发的士兵训练状态', () => {
  const container = { innerHTML: '' };
  const renderer = new BuildingUIRenderer(container, {
    barracks: { id: 'barracks', name: '兵营', icon: '🛡️', ui: { effectText: [] } },
  });

  renderer.render({
    unlockedBuildings: ['barracks'],
    buildings: { barracks: { level: 1 } },
    buildingCosts: { barracks: { food: 420, knowledge: 160 } },
    buildingEffects: {},
    military: {
      soldiers: 2,
      soldierCap: 5,
      trainingProgress: 12,
      trainingIntervalSeconds: 30,
      defense: 2,
    },
  }, { completed: true, currentStep: 15 });

  assert.match(container.innerHTML, /士兵 2\/5 · 防御 2/);
  assert.match(container.innerHTML, /下一名 12\/30秒/);
});

test('相同建筑结构在心跳更新时不会整块重绘图标区域', () => {
  const container = createPatchableContainer();
  const renderer = new BuildingUIRenderer(container, {
    barracks: { id: 'barracks', name: '兵营', icon: '🛡️', art: 'assets/art/building-barracks-cutout.png', ui: { effectText: [] } },
  });
  let fullRenderCount = 0;

  renderer.renderFull = (state, tutorial, ids) => {
    fullRenderCount += 1;
    ids.forEach((id) => {
      if (!container.cards.has(id)) container.cards.set(id, createPatchableCard());
    });
  };

  const state = {
    unlockedBuildings: ['barracks'],
    buildings: { barracks: { level: 1 } },
    buildingCosts: { barracks: { food: 420, knowledge: 160 } },
    buildingEffects: {},
    military: {
      soldiers: 2,
      soldierCap: 5,
      trainingProgress: 12,
      trainingIntervalSeconds: 30,
      defense: 2,
    },
  };

  renderer.render(state, { completed: true, currentStep: 15 });
  state.military.trainingProgress = 13;
  renderer.render(state, { completed: true, currentStep: 15 });

  const card = container.cards.get('barracks');
  assert.equal(fullRenderCount, 1);
  assert.equal(card.children['[data-building-military]'].innerHTML, '士兵 2/5 · 防御 2<br>下一名 13/30秒');
});
