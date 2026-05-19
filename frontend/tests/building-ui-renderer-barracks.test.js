const test = require('node:test');
const assert = require('node:assert/strict');

const UIStatePresenter = require('../js/state/UIStatePresenter');
const BuildingUIRenderer = require('../js/ui/BuildingUIRenderer');

function createRenderer(container, buildingConfig = {}) {
  return new BuildingUIRenderer(container, buildingConfig, { presenter: UIStatePresenter });
}

test('barracks card does not render legacy output or defense-level effect fields', () => {
  const container = { innerHTML: '' };
  const renderer = createRenderer(container, {
    barracks: {
      id: 'barracks',
      name: 'Barracks',
      icon: 'B',
      ui: {
        effectText: [
          { field: 'defenseLevel', label: 'Legacy defense', format: 'number' },
          { field: 'globalOutputBonus', label: 'Legacy output', format: 'percent' },
        ],
      },
    },
  });

  renderer.render({
    unlockedBuildings: ['barracks'],
    buildings: { barracks: { level: 1 } },
    buildingCosts: { barracks: { food: 420, knowledge: 160 } },
    buildingDefinitions: {
      barracks: {
        id: 'barracks',
        name: 'Barracks',
        icon: 'B',
        ui: { effectText: [] },
      },
    },
    buildingEffects: {
      byBuilding: {
        barracks: {
          defenseLevel: 1,
          globalOutputBonus: 0.1,
        },
      },
    },
    military: {
      soldiers: 2,
      soldierCap: 5,
      trainingProgress: 12,
      trainingIntervalSeconds: 30,
      defense: 2,
    },
  }, { completed: true, currentStep: 15 });

  assert.doesNotMatch(container.innerHTML, /Legacy defense/);
  assert.doesNotMatch(container.innerHTML, /Legacy output/);
  assert.match(container.innerHTML, /Barracks/);
});

test('building card hides developer fallback effect and description text', () => {
  const container = { innerHTML: '' };
  const renderer = createRenderer(container, {
    temple: {
      id: 'temple',
      name: 'Temple',
      icon: 'T',
      ui: {
        effectText: [{ field: 'missingEffect', label: 'Missing', format: 'number' }],
      },
    },
  });

  renderer.render({
    unlockedBuildings: ['temple'],
    buildings: { temple: null },
    buildingCosts: { temple: { food: 320, knowledge: 120 } },
    buildingEffects: { byBuilding: { temple: {} } },
  }, { completed: true, currentStep: 15 });

  assert.doesNotMatch(container.innerHTML, /backend/i);
  assert.doesNotMatch(container.innerHTML, /developer/i);
  assert.doesNotMatch(container.innerHTML, /Missing/);
  assert.doesNotMatch(container.innerHTML, /building-effect/);
  assert.doesNotMatch(container.innerHTML, /building-desc/);
});
