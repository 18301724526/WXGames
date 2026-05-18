const test = require('node:test');
const assert = require('node:assert/strict');

const UIStatePresenter = require('../js/state/UIStatePresenter');

test('resource view state is renderer-neutral and formats resource display', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 2,
    resources: {
      food: 12.8,
      knowledge: 5.2,
      wood: 30.9,
      foodOutputPerSecond: 1.5,
      foodConsumptionPerSecond: 0.25,
      foodNetPerSecond: 1.25,
      knowledgePerSecond: 0.4,
      woodPerSecond: 0,
    },
    happiness: 92,
    gameDay: 7,
  });

  assert.equal(view.hasWood, true);
  assert.equal(view.text.foodValue, 12);
  assert.equal(view.text.knowledgeValue, 5);
  assert.equal(view.text.woodValue, 30);
  assert.equal(view.text.foodRate, '+1.25/s');
  assert.equal(view.text.foodConsumptionRate, '-0.25/s');
  assert.equal(view.text.knowledgeRate, '+0.4/s');
  assert.equal(view.text.woodRate, '+0/s');
  assert.equal(view.text.happinessValue, 92);
  assert.deepEqual(view.visibility, { woodCard: true, woodDetailCard: true });
  assert.equal(view.classState.foodNetRate['is-positive'], true);
  assert.equal(view.classState.foodNetRate['is-negative'], false);
});

test('resource view state compacts large resource amounts', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 2,
    resources: {
      food: 1120,
      knowledge: 1200000,
      wood: 3450000000,
      foodOutputPerSecond: 1250,
      foodConsumptionPerSecond: 1100,
      foodNetPerSecond: 150,
      knowledgePerSecond: 0,
      woodPerSecond: 1000000000000,
    },
  });

  assert.equal(UIStatePresenter.formatResourceAmount(999), 999);
  assert.equal(UIStatePresenter.formatResourceAmount(1000), '1k');
  assert.equal(UIStatePresenter.formatResourceAmount(1250), '1.2k');
  assert.equal(view.text.foodValue, '1.1k');
  assert.equal(view.text.knowledgeValue, '1.2M');
  assert.equal(view.text.woodValue, '3.4G');
  assert.equal(view.text.foodOutputRate, '+1.2k/s');
  assert.equal(view.text.foodConsumptionRate, '-1.1k/s');
  assert.equal(view.text.woodRate, '+1T/s');
});

test('resource view state hides wood before settlement era', () => {
  const view = UIStatePresenter.buildResourceViewState({
    currentEra: 1,
    resources: {
      food: 4,
      knowledge: 2,
      wood: 99,
      foodPerSecond: -0.5,
    },
  });

  assert.equal(view.hasWood, false);
  assert.equal(view.text.woodValue, 0);
  assert.equal(view.text.woodRate, '+0/s');
  assert.deepEqual(view.visibility, { woodCard: false, woodDetailCard: false });
  assert.equal(view.classState.foodNetRate['is-positive'], false);
  assert.equal(view.classState.foodNetRate['is-negative'], true);
});

test('building view state is renderer-neutral and formats compact costs', () => {
  const view = UIStatePresenter.buildBuildingViewState({
    unlockedBuildings: ['farm'],
    buildings: { farm: { level: 1 } },
    buildingCosts: { farm: { food: 1250, wood: 1000000 } },
    buildingEffects: {
      byBuilding: {
        farm: { foodOutputBonus: 1 },
      },
    },
  }, { completed: true, currentStep: 15 }, {
    farm: {
      id: 'farm',
      name: 'Farm',
      icon: 'F',
      ui: {
        effectText: [{ field: 'foodOutputBonus', label: 'Food output', format: 'percent' }],
      },
    },
  });

  assert.equal(view.isEmpty, false);
  assert.equal(view.cards[0].id, 'farm');
  assert.equal(view.cards[0].levelText, '等级 1');
  assert.equal(view.cards[0].effectText, 'Food output +100%');
  assert.deepEqual(view.cards[0].cost.parts.map((part) => [part.resource, part.text]), [
    ['food', '1.2k'],
    ['wood', '1M'],
  ]);
  assert.equal(view.cards[0].button.action, 'upgrade');
});

test('population view state formats jobs and button availability', () => {
  const view = UIStatePresenter.buildPopulationViewState({
    currentEra: 2,
    population: {
      total: 6,
      maxPop: 8,
      unassigned: 1,
      farmers: 3,
      scholars: 2,
      craftsmen: 1,
    },
  });

  assert.equal(view.text.totalPop, 6);
  assert.equal(view.text.maxPop, 8);
  assert.equal(view.text.unassignedPop, 1);
  assert.equal(view.showCraftsman, true);
  assert.deepEqual(
    view.jobs.map((job) => [job.id, job.count, job.visible, job.canIncrease, job.canDecrease]),
    [
      ['farmer', 3, true, true, true],
      ['scholar', 2, true, true, true],
      ['craftsman', 1, true, true, true],
    ],
  );
});

test('population view state locks increase buttons without unassigned people', () => {
  const view = UIStatePresenter.buildPopulationViewState({
    currentEra: 1,
    population: {
      total: 3,
      max: 3,
      unassigned: 0,
      farmers: 3,
      scholars: 0,
      craftsmen: 0,
    },
  });

  assert.equal(view.text.maxPop, 3);
  assert.equal(view.showCraftsman, false);
  assert.deepEqual(
    view.jobs.map((job) => [job.id, job.visible, job.canIncrease, job.canDecrease]),
    [
      ['farmer', true, false, true],
      ['scholar', true, false, false],
      ['craftsman', false, false, false],
    ],
  );
});

test('population view state allows decreasing craftsmen without unassigned people', () => {
  const view = UIStatePresenter.buildPopulationViewState({
    currentEra: 2,
    population: {
      total: 4,
      max: 4,
      unassigned: 0,
      farmers: 2,
      scholars: 1,
      craftsmen: 1,
    },
  });

  const craftsman = view.jobs.find((job) => job.id === 'craftsman');

  assert.equal(craftsman.count, 1);
  assert.equal(craftsman.canIncrease, false);
  assert.equal(craftsman.canDecrease, true);
  assert.equal(view.text.craftsmanCount, 1);
});
