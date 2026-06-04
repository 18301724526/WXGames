const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingCanvasRenderer = require('./BuildingCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: {
      buildBuildingViewState() {
        return createBuildingView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset() { calls.push(['drawAsset']); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawIconCard() { calls.push(['drawIconCard']); },
    drawLine() {},
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getTransitionFrame() { return null; },
    measureTextWidth(text) { return String(text || '').length * 8; },
    truncateText(text) { return String(text || ''); },
    ...overrides,
  };
  return host;
}

function createBuildingView() {
  return {
    isEmpty: false,
    categoryTabs: [
      { id: 'all', label: 'All', count: 3, active: false },
      { id: 'housing', label: 'Housing', count: 2, active: true },
    ],
    cards: [
      {
        id: 'house',
        name: 'House',
        levelText: 'Lv.1',
        metaText: 'Housing',
        currentEffectText: 'Current',
        nextEffectText: 'Next',
        maintenanceText: 'Maintenance',
        cityImpactText: 'Impact',
        costTitle: 'Cost',
        cost: {
          parts: [
            { resource: 'wood', value: 20, text: '20' },
            { resource: 'iron', value: 4, text: '4' },
            { resource: 'metal', value: 6, text: '6' },
            { resource: 'knowledge', value: 3, text: '3' },
          ],
        },
        button: { action: 'build', label: 'Build', disabled: false },
      },
      {
        id: 'farm',
        name: 'Farm',
        levelText: 'Lv.2',
        cost: { parts: [{ resource: 'food', value: 10, text: '10' }] },
        button: { action: 'upgrade', label: 'Upgrade', disabled: false },
      },
      {
        id: 'mine',
        name: 'Mine',
        levelText: 'Lv.1',
        cost: { parts: [{ resource: 'stone', value: 10, text: '10' }] },
        button: { action: 'build', label: 'Build', disabled: true },
      },
    ],
  };
}

test('BuildingCanvasRenderer owns building cost helpers', () => {
  const renderer = new BuildingCanvasRenderer({ host: createHost() });
  const cost = {
    parts: [
      { resource: 'iron', value: 4, text: '4' },
      { resource: 'metal', value: 6, text: '6' },
    ],
  };

  assert.deepEqual(renderer.buildingCostResourceAliases('iron'), ['iron', 'metal']);
  assert.equal(renderer.formatBuildingCostAmount(12345), '12.3k');
  assert.deepEqual(renderer.getBuildingCostSlot(cost, 'iron'), {
    resource: 'iron',
    value: 10,
    text: '10',
    present: true,
  });
  assert.equal(renderer.getOwnedBuildingResource({ metal: 8 }, 'iron'), 8);
});

test('CanvasGameRenderer exposes building helpers through the building renderer facade', () => {
  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    buildingRendererClass: BuildingCanvasRenderer,
  });

  assert.equal(renderer.resourceIconPath('wood'), 'assets/art/icon-wood-cutout.webp');
  assert.equal(renderer.formatBuildingCostAmount(1000), '1k');
  assert.deepEqual(renderer.getBuildingCostSlot({ parts: [{ resource: 'wood', value: 5 }] }, 'wood'), {
    resource: 'wood',
    value: 5,
    text: '5',
    present: true,
  });
});

test('BuildingCanvasRenderer preserves building panel hit target contract', () => {
  const host = createHost();
  const renderer = new BuildingCanvasRenderer({ host });

  renderer.renderBuildings({ resources: { wood: 30, iron: 1, metal: 1, stone: 20, food: 20 } }, 100, 610, {
    activeBuildingCategory: 'housing',
  });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectBuildingCategory'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'buildBuilding' && target.action.buildingId === 'house'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'upgradeBuilding' && target.action.buildingId === 'farm'), true);

  host.hitTargets.length = 0;
  renderer.renderBuildings({ resources: { wood: 30, iron: 1, metal: 1, stone: 20, food: 20 } }, 100, 250, {
    activeBuildingCategory: 'housing',
  });
  assert.equal(host.hitTargets.some((target) => target.action.type === 'scrollBuildings'), true);
});
