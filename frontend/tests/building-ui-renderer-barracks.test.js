const test = require('node:test');
const assert = require('node:assert/strict');

global.FrontendBuildingState = {
  getLevel(buildings, id) {
    return buildings?.[id]?.level || 0;
  },
  getActionLabel(cost, level) {
    if (cost === null) return 'max';
    return level > 0 ? 'upgrade' : 'build';
  },
};

const BuildingUIRenderer = require('../js/ui/BuildingUIRenderer');

test('barracks card does not render legacy output or defense-level effect fields', () => {
  const container = { innerHTML: '' };
  const renderer = new BuildingUIRenderer(container, {
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
