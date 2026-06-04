const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateService = require('../services/GameStateService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const ClientGameStateAssembler = require('../services/ClientGameStateAssembler');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('GameStateService keeps normalizeState compatible with GameStateNormalizer', () => {
  const rawState = {
    playerId: 'split-test',
    resources: { food: 10, metal: 3 },
    population: { total: 4, maxPop: 6, farmers: 2, scholars: 1, craftsmen: 1 },
    buildings: {},
    techs: {},
    currentEra: 1,
    updatedAt: '2026-06-04T00:00:00.000Z',
  };

  const viaFacade = GameStateService.normalizeState(clone(rawState));
  const viaModule = GameStateNormalizer.normalizeState(clone(rawState));

  assert.equal(viaFacade.playerId, viaModule.playerId);
  assert.deepEqual(viaFacade.resources, viaModule.resources);
  assert.deepEqual(viaFacade.population, viaModule.population);
  assert.equal(viaFacade.activeCityId, viaModule.activeCityId);
  assert.deepEqual(Object.keys(viaFacade.buildings), Object.keys(viaModule.buildings));
  assert.equal(Boolean(viaFacade.territoryState), Boolean(viaModule.territoryState));
});

test('GameStateService keeps getClientGameState compatible with ClientGameStateAssembler', () => {
  const initial = GameStateNormalizer.createInitialGameState('client-split-test');
  initial.updatedAt = '2026-06-04T00:00:00.000Z';

  const viaFacade = GameStateService.getClientGameState(clone(initial));
  const viaModule = ClientGameStateAssembler.getClientGameState(clone(initial));

  assert.equal(viaFacade.playerId, viaModule.playerId);
  assert.deepEqual(viaFacade.resources, viaModule.resources);
  assert.deepEqual(viaFacade.population, viaModule.population);
  assert.equal(viaFacade.currentEraName, viaModule.currentEraName);
  assert.equal(viaFacade.activeCityId, viaModule.activeCityId);
  assert.equal(viaFacade.cityState.activeCityId, viaModule.cityState.activeCityId);
  assert.equal(viaFacade.territoryState.worldMap.version, viaModule.territoryState.worldMap.version);
  assert.deepEqual(Object.keys(viaFacade.buildingCosts), Object.keys(viaModule.buildingCosts));
});

test('normalized client state keeps legacy iron and metal resources aligned', () => {
  const clientState = ClientGameStateAssembler.getClientGameState({
    playerId: 'legacy-metal-test',
    resources: { food: 1, knowledge: 2, wood: 3, metal: 7 },
    population: { total: 3, max: 3, farmers: 3 },
    buildings: {},
    techs: {},
    currentEra: 0,
    updatedAt: '2026-06-04T00:00:00.000Z',
  });

  assert.equal(clientState.resources.iron, 7);
  assert.equal(clientState.resources.metal, 7);
  assert.ok(clientState.cityState);
  assert.ok(clientState.territoryState);
});
