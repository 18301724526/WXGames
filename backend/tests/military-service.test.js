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
    soldiersOnMission: 0,
    availableSoldiers: 0,
    trainingProgress: 0,
    trainingIntervalSeconds: 0,
    trainingBatchSize: 0,
    defensePerSoldier: 0.01,
    defense: 0,
  });
});

test('level 1 barracks trains squads every 30 seconds up to 300 soldiers', () => {
  const state = createStateWithBarracks(1);

  MilitaryService.advanceTraining(state, 29);
  assert.equal(state.military.soldiers, 0);
  assert.equal(state.military.soldierCap, 300);
  assert.equal(state.military.trainingProgress, 29);
  assert.equal(state.military.trainingIntervalSeconds, 30);
  assert.equal(state.military.trainingBatchSize, 10);

  MilitaryService.advanceTraining(state, 1);
  assert.equal(state.military.soldiers, 10);
  assert.equal(state.military.trainingProgress, 0);
  assert.equal(state.military.defense, 0.1);

  MilitaryService.advanceTraining(state, 900);
  assert.equal(state.military.soldiers, 300);
  assert.equal(state.military.trainingProgress, 0);
  assert.equal(state.military.defense, 3);
});

test('level 2 barracks uses the faster interval, bigger batch, and higher soldier cap', () => {
  const state = createStateWithBarracks(2);

  MilitaryService.advanceTraining(state, 50);

  assert.equal(state.military.soldiers, 40);
  assert.equal(state.military.soldierCap, 600);
  assert.equal(state.military.trainingIntervalSeconds, 25);
  assert.equal(state.military.trainingBatchSize, 20);
  assert.equal(state.military.defense, 0.4);
});

test('legacy single-digit soldiers migrate to the hundred-soldier scale', () => {
  const state = createStateWithBarracks(1);
  state.military = { soldiers: 3, trainingProgress: 12 };

  const clientState = gameStateService.getClientGameState(state);

  assert.deepEqual(clientState.military, {
    soldiers: 300,
    soldierCap: 300,
    soldiersOnMission: 0,
    availableSoldiers: 300,
    trainingProgress: 0,
    trainingIntervalSeconds: 30,
    trainingBatchSize: 10,
    defensePerSoldier: 0.01,
    defense: 3,
  });
});
