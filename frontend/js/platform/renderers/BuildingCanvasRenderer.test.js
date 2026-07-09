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

const BUILDING_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawIconCard',
  'drawLine',
  'drawPanel',
  'drawText',
  'getLayout',
  'getTransitionFrame',
  'measureTextWidth',
  'truncateText',
  'withSlideClip',
  'withSuppressedHitTargets',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: createHost().presenter,
    addHitTarget(_rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawAsset(assetPath) {
      calls.push([label, 'drawAsset', assetPath]);
      return false;
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawIconCard() {
      calls.push([label, 'drawIconCard']);
    },
    drawLine() {
      calls.push([label, 'drawLine']);
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    getTransitionFrame(transition) {
      calls.push([label, 'getTransitionFrame', transition?.fromOffset, transition?.toOffset]);
      return { direction: 1, eased: 0.5 };
    },
    measureTextWidth(text) {
      calls.push([label, 'measureTextWidth', text]);
      return String(text || '').length * 8;
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
    withSlideClip(_x, _y, _width, _height, _offsetX, callback) {
      calls.push([label, 'withSlideClip', typeof callback]);
      return callback?.();
    },
    withSuppressedHitTargets(callback) {
      calls.push([label, 'withSuppressedHitTargets', typeof callback]);
      return callback?.();
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

function renderBuildingSentinelPath(renderer) {
  renderer.renderBuildings({ resources: { wood: 30, iron: 1, metal: 1, stone: 20, food: 20 } }, 100, 250, {
    activeBuildingCategory: 'housing',
    offset: 1,
    buildingTransition: { fromOffset: 0, toOffset: 1 },
  });
}

test('BuildingCanvasRenderer reads host ctx and presenter dynamically after proxy removal', () => {
  const firstCtx = { id: 'first-ctx' };
  const secondCtx = { id: 'second-ctx' };
  const firstPresenter = { id: 'first-presenter' };
  const secondPresenter = { id: 'second-presenter' };
  const host = createHost({ ctx: firstCtx, presenter: firstPresenter });
  const renderer = new BuildingCanvasRenderer({ host });

  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.presenter, firstPresenter);

  host.ctx = secondCtx;
  host.presenter = secondPresenter;

  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.presenter, secondPresenter);
});

test('BuildingCanvasRenderer no longer forwards unknown host properties through proxy', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new BuildingCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('BuildingCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new BuildingCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderBuildingSentinelPath(renderer);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), BUILDING_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
  assert.equal(calls.some((call) => call[0] === 'explicit' && call[1] === 'withSlideClip' && call[2] === 'function'), true);
  assert.equal(calls.some((call) => call[0] === 'explicit' && call[1] === 'withSuppressedHitTargets' && call[2] === 'function'), true);
});

test('BuildingCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new BuildingCanvasRenderer({ host: fallbackHost });

  renderBuildingSentinelPath(renderer);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), BUILDING_DRAWING_METHODS);
  assert.equal(calls.some((call) => call[0] === 'fallback' && call[1] === 'withSlideClip' && call[2] === 'function'), true);
  assert.equal(calls.some((call) => call[0] === 'fallback' && call[1] === 'withSuppressedHitTargets' && call[2] === 'function'), true);
});

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

test('BuildingCanvasRenderer falls back to shared presenter when injected presenter is split out', () => {
  const host = createHost({ presenter: {} });
  const renderer = new BuildingCanvasRenderer({ host });
  const state = {
    resources: { wood: 30, iron: 8, metal: 8, stone: 20, food: 20, knowledge: 10 },
    unlockedBuildings: ['house'],
    buildings: {},
    buildingDefinitions: {
      house: {
        id: 'house',
        name: 'House',
        category: 'livelihood',
        ui: {
          effectText: [{ field: 'populationCapBonus', label: 'Pop' }],
        },
        effects: {
          perLevel: { populationCapBonus: 1 },
        },
      },
    },
    buildingCosts: {
      house: { wood: 20, knowledge: 3 },
    },
  };

  renderer.renderBuildings(state, 100, 610, { activeBuildingCategory: 'all' });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'buildBuilding' && target.action.buildingId === 'house'), true);
});

test('BuildingCanvasRenderer locks non-house cards during tutorial house guide', () => {
  const host = createHost({ presenter: {} });
  const renderer = new BuildingCanvasRenderer({ host });
  const state = {
    resources: { food: 130, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    unlockedBuildings: ['house', 'farm'],
    buildings: {},
    tutorial: { completed: false, currentStep: 'cityEntered' },
    buildingDefinitions: {
      house: { id: 'house', name: 'House', category: 'livelihood', effects: { perLevel: { populationCap: 3 } } },
      farm: { id: 'farm', name: 'Farm', category: 'agriculture', effects: { perLevel: { foodOutputMultiplier: 0.5 } } },
    },
    buildingCosts: {
      house: {},
      farm: { food: 0 },
    },
  };

  renderer.renderBuildings(state, 100, 610, { activeBuildingCategory: 'all' });

  const houseTarget = host.hitTargets.find((target) => target.action.type === 'buildBuilding' && target.action.buildingId === 'house');
  const farmTarget = host.hitTargets.find((target) => target.action.type === 'buildBuilding' && target.action.buildingId === 'farm');
  assert.equal(houseTarget.action.visualDisabled, false);
  assert.equal(farmTarget.action.visualDisabled, true);
  assert.equal(farmTarget.action.disabled, undefined);
});

test('CanvasGameRenderer renders building panel through split renderer facade without presenter method', () => {
  const renderer = new CanvasGameRenderer({
    ctx: createHost().ctx,
    presenter: {},
    width: 390,
    height: 844,
    buildingRendererClass: BuildingCanvasRenderer,
  });
  Object.assign(renderer, {
    createGradient() { return '#123'; },
    drawAsset() { return false; },
    drawButton() {},
    drawIconCard() {},
    drawLine() {},
    drawPanel() {},
    drawText() {},
    getTransitionFrame() { return null; },
    measureTextWidth(text) { return String(text || '').length * 8; },
    truncateText(text) { return String(text || ''); },
  });

  renderer.renderBuildings({
    resources: { wood: 30, iron: 8, metal: 8, stone: 20, food: 20, knowledge: 10 },
    unlockedBuildings: ['house'],
    buildings: {},
    buildingDefinitions: {
      house: {
        id: 'house',
        name: 'House',
        category: 'livelihood',
        ui: {
          effectText: [{ field: 'populationCapBonus', label: 'Pop' }],
        },
        effects: {
          perLevel: { populationCapBonus: 1 },
        },
      },
    },
    buildingCosts: {
      house: { wood: 20, knowledge: 3 },
    },
  }, 100, 610, { activeBuildingCategory: 'all' });

  assert.equal(renderer.hitTargets.some((target) => target.action.type === 'buildBuilding' && target.action.buildingId === 'house'), true);
});
