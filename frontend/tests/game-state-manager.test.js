const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GameStateManager = require('../js/state/GameStateManager');

test('game state manager uses injected building state helper', () => {
  const calls = [];
  const manager = new GameStateManager({}, {
    buildingState: {
      getLevel(buildings, id) {
        calls.push({ buildings, id });
        return id === 'lumbermill' ? 2 : 0;
      },
    },
  });

  const state = manager.sync({
    currentEra: 2,
    currentEraName: '聚落时代',
    resources: { food: 10, knowledge: 5, wood: 3 },
    buildings: { lumbermill: { level: 1 } },
    population: { max: 4 },
  });

  assert.equal(state.workshopCount, 0);
  assert.equal(state.lumbermillCount, 2);
  assert.deepEqual(calls.map((call) => call.id), ['workshop', 'lumbermill']);
});

test('game state manager source does not read global building state', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'state', 'GameStateManager.js'), 'utf8');

  assert.match(source, /this\.buildingState\.getLevel/);
  assert.doesNotMatch(source, /global\.FrontendBuildingState|globalThis\.FrontendBuildingState|window\.FrontendBuildingState/);
});
