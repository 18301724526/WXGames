const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const MilitaryService = require('../services/MilitaryService');

function createStateWithBarracks(level = 0) {
  const state = gameStateService.createInitialGameState(`military-${level}`);
  if (level > 0) {
    state.buildings.barracks = {
      level,
      builtAt: new Date().toISOString(),
      upgradedAt: new Date().toISOString(),
    };
  }
  return state;
}

test('no barracks keeps military training disabled', () => {
  const state = createStateWithBarracks(0);

  const result = MilitaryService.advanceTraining(state, 120);

  assert.equal(result.trained, 0);
  assert.deepEqual(state.military, {
    soldiers: 0,
    soldierCap: 0,
    trainingProgress: 0,
    trainingIntervalSeconds: 0,
    defensePerSoldier: 1,
    defense: 0,
  });
});

test('level 1 barracks trains one soldier every 30 seconds up to 5 soldiers', () => {
  const state = createStateWithBarracks(1);

  MilitaryService.advanceTraining(state, 29);
  assert.equal(state.military.soldiers, 0);
  assert.equal(state.military.soldierCap, 5);
  assert.equal(state.military.trainingProgress, 29);
  assert.equal(state.military.trainingIntervalSeconds, 30);

  MilitaryService.advanceTraining(state, 1);
  assert.equal(state.military.soldiers, 1);
  assert.equal(state.military.trainingProgress, 0);
  assert.equal(state.military.defense, 1);

  MilitaryService.advanceTraining(state, 300);
  assert.equal(state.military.soldiers, 5);
  assert.equal(state.military.trainingProgress, 0);
  assert.equal(state.military.defense, 5);
});

test('level 2 barracks uses the faster interval and higher soldier cap', () => {
  const state = createStateWithBarracks(2);

  MilitaryService.advanceTraining(state, 40);

  assert.equal(state.military.soldiers, 2);
  assert.equal(state.military.soldierCap, 10);
  assert.equal(state.military.trainingIntervalSeconds, 20);
  assert.equal(state.military.defense, 2);
});

test('client state exposes backend-normalized military fields', () => {
  const state = createStateWithBarracks(1);
  state.military = { soldiers: 3, trainingProgress: 12 };

  const clientState = gameStateService.getClientGameState(state);

  assert.deepEqual(clientState.military, {
    soldiers: 3,
    soldierCap: 5,
    trainingProgress: 12,
    trainingIntervalSeconds: 30,
    defensePerSoldier: 1,
    defense: 3,
  });
});
