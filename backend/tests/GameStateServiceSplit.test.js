const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateService = require('../services/GameStateService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const ClientGameStateAssembler = require('../services/ClientGameStateAssembler');
const GameStateMigrationPipeline = require('../services/GameStateMigrationPipeline');
const TutorialService = require('../services/TutorialService');
const TerritoryService = require('../services/TerritoryService');
const WorldExplorerService = require('../services/WorldExplorerService');

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

test('GameStateService normalizes legacy saves through the migration pipeline', () => {
  const rawState = {
    playerId: 'legacy-save-normalize-test',
    resources: { food: 10, metal: 4 },
    population: { total: 3, maxPop: 3, farmers: 3 },
    buildings: {},
    techs: {},
    currentEra: 0,
    taskProgress: {},
    eventQueue: null,
    updatedAt: '2026-06-04T00:00:00.000Z',
  };

  const normalized = GameStateService.normalizeState(clone(rawState));

  assert.equal(normalized.saveMetadata.schema, GameStateMigrationPipeline.SAVE_SCHEMA_NAME);
  assert.equal(normalized.saveMetadata.schemaVersion, GameStateMigrationPipeline.CURRENT_SCHEMA_VERSION);
  assert.deepEqual(normalized.saveMetadata.migrations.map((entry) => entry.id), ['initialize-save-schema-v1']);
  assert.equal(normalized.resources.iron, 4);
  assert.equal(normalized.resources.metal, 4);
  assert.deepEqual(normalized.taskProgress.claimed, {});
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

test('new tutorial client state exposes the first house before era one unlocks buildings', () => {
  const initial = GameStateNormalizer.createInitialGameState('tutorial-house-client-test');
  const clientState = GameStateService.getClientGameState(initial);

  assert.equal(clientState.currentEra, 0);
  assert.equal(clientState.unlockedBuildings.includes('house'), true);
  assert.equal(clientState.resources.food >= 110, true);
});

test('guided first city settlement soldiers survive state normalization', () => {
  const siteId = 'site_3_1';
  const rawState = {
    playerId: 'tutorial-settlement-soldier-normalize-test',
    activeCityId: 'capital',
    resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: { total: 3, max: 3, maxPop: 3, farmers: 3 },
    military: { soldiers: 0, soldierCap: 0 },
    tutorial: {
      ...TutorialService.manualAdvance(
        TutorialService.createInitialTutorialState(),
        TutorialService.TUTORIAL_STEPS.firstCityDiscovered,
      ),
      grants: {
        [WorldExplorerService.TUTORIAL_FIRST_SITE_GRANT_KEY]: { siteId },
      },
    },
    territories: [
      { id: 'capital', x: 0, y: 0, naturalName: 'Origin', cityName: 'Capital', type: 'capital', owner: 'player', status: 'occupied' },
      { id: siteId, x: 3, y: 1, naturalName: 'River Bend', type: 'town', owner: 'neutral', status: 'discovered', scale: 2 },
    ],
    cities: {
      capital: {
        id: 'capital',
        territoryId: 'capital',
        isCapital: true,
        name: 'Capital',
        resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
        buildings: {},
        population: { total: 3, max: 3, maxPop: 3, farmers: 3 },
        military: { soldiers: 0, soldierCap: 0 },
      },
    },
  };

  const normalized = GameStateService.normalizeState(rawState);

  assert.equal(normalized.military.soldiers, TerritoryService.MIN_EXPEDITION_SOLDIERS);
  assert.equal(normalized.military.soldierCap, TerritoryService.MIN_EXPEDITION_SOLDIERS);
  assert.equal(normalized.military.availableSoldiers, TerritoryService.MIN_EXPEDITION_SOLDIERS);
  assert.equal(normalized.cities.capital.military.soldiers, TerritoryService.MIN_EXPEDITION_SOLDIERS);
});
