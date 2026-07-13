const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateService = require('../services/GameStateService');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const ClientGameStateAssembler = require('../services/ClientGameStateAssembler');
const GameStateMigrationPipeline = require('../services/GameStateMigrationPipeline');
const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');

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

test('GameStateService normalizes schema-0 saves through the migration pipeline', () => {
  const rawState = {
    playerId: 'schema-0-save-normalize-test',
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
  assert.deepEqual(normalized.saveMetadata.migrations.map((entry) => entry.id), [
    'initialize-save-schema-v1',
    'initialize-city-source-v2',
    'upgrade-stored-skill-effects-v3',
    'upgrade-territory-source-v4',
  ]);
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

test('new client state exposes the first house before era one unlocks buildings', () => {
  const initial = GameStateNormalizer.createInitialGameState('house-client-test');
  const clientState = GameStateService.getClientGameState(initial);

  assert.equal(clientState.currentEra, 0);
  assert.equal(clientState.unlockedBuildings.includes('house'), true);
  assert.deepEqual(BuildingConfig.getBuildCost('house'), {});
});

test('initial game state can be created around an assigned real-world spawn', () => {
  const initial = GameStateNormalizer.createInitialGameState('spawn-aware-initial-state-test', {
    now: new Date('2026-06-16T00:00:00.000Z'),
    spawn: {
      q: 48,
      r: -12,
      spawnKey: '48,-12',
      starterTarget: { q: 49, r: -12 },
    },
  });
  const capital = initial.territories.find((territory) => territory.id === 'capital');
  const capitalTile = initial.worldMap.tiles.find((tile) => tile.q === 48 && tile.r === -12);

  assert.equal(capital.x, 48);
  assert.equal(capital.y, -12);
  assert.deepEqual(initial.worldMap.origin, { q: 48, r: -12 });
  assert.equal(capitalTile.siteId, 'capital');
  assert.equal(capitalTile.visibility, 'controlled');
  assert.equal(initial.worldMap.tiles.some((tile) => tile.q === 0 && tile.r === 0 && tile.siteId === 'capital'), false);
});

test('state normalization preserves an assigned real-world capital coordinate', () => {
  const raw = GameStateNormalizer.createInitialGameState('spawn-normalize-capital-test', {
    now: new Date('2026-06-16T00:00:00.000Z'),
    spawn: {
      q: -6,
      r: 28,
      spawnKey: '-6,28',
    },
  });
  raw.territories = raw.territories.map((territory) => (
    territory.id === 'capital'
      ? { ...territory, x: 0, y: 0 }
      : territory
  ));

  const normalized = GameStateService.normalizeState(clone(raw));
  const clientState = GameStateService.getClientGameStateFromNormalized(normalized);
  const capital = normalized.territories.find((territory) => territory.id === 'capital');
  const clientCapital = clientState.territoryState.territories.find((territory) => territory.id === 'capital');
  const capitalTile = clientState.territoryState.worldMap.tiles.find((tile) => tile.siteId === 'capital');

  assert.equal(capital.x, 0);
  assert.equal(capital.y, 0);
  assert.deepEqual(normalized.worldMap.origin, { q: -6, r: 28 });
  assert.equal(clientCapital.x, -6);
  assert.equal(clientCapital.y, 28);
  assert.equal(capitalTile.q, -6);
  assert.equal(capitalTile.r, 28);
  assert.equal(clientState.territoryState.worldMap.tiles.some((tile) => tile.q === 0 && tile.r === 0 && tile.siteId === 'capital'), false);
});

test('state normalization removes neutral-city pollution from fog vision history', () => {
  const raw = GameStateNormalizer.createInitialGameState('vision-history-neutral-city-cleanup-test', {
    now: new Date('2026-07-07T00:00:00.000Z'),
  });
  raw.territories.push(
    { id: 'neutral-town', x: 3, y: 1, owner: 'neutral', status: 'discovered', type: 'town' },
    { id: 'frontier', x: 4, y: 1, owner: 'player', status: 'occupied', type: 'town' },
    { id: 'other-player-city', x: 5, y: 1, owner: 'player', ownerPlayerId: 'other-player', status: 'occupied', type: 'town' },
  );
  raw.worldMap.visionHistory = {
    sources: [
      { kind: 'city', q: 0, r: 0 },
      { kind: 'city', q: 3, r: 1 },
      { kind: 'city', q: 4, r: 1 },
      { kind: 'city', q: 5, r: 1 },
      { kind: 'unit', q: 2, r: 1 },
    ],
  };

  const normalized = GameStateService.normalizeState(clone(raw));
  const sources = normalized.worldMap.visionHistory.sources;

  assert.equal(sources.some((source) => source.kind === 'city' && source.q === 0 && source.r === 0), true);
  assert.equal(sources.some((source) => source.kind === 'city' && source.q === 4 && source.r === 1), true);
  assert.equal(sources.some((source) => source.kind === 'city' && source.q === 3 && source.r === 1), false);
  assert.equal(sources.some((source) => source.kind === 'city' && source.q === 5 && source.r === 1), false);
  assert.equal(sources.some((source) => source.kind === 'unit' && source.q === 2 && source.r === 1), true);
});

test('initial game state keeps the legacy origin when no spawn assignment is provided', () => {
  const initial = GameStateNormalizer.createInitialGameState('legacy-origin-initial-state-test', {
    now: new Date('2026-06-16T00:00:00.000Z'),
  });
  const capital = initial.territories.find((territory) => territory.id === 'capital');

  assert.equal(capital.x, 0);
  assert.equal(capital.y, 0);
  assert.deepEqual(initial.worldMap.origin, { q: 0, r: 0 });
  assert.equal(initial.worldMap.tiles.some((tile) => tile.q === 0 && tile.r === 0 && tile.siteId === 'capital'), true);
});

test('neutral settlement state grants no soldiers during normalization', () => {
  const siteId = 'site_3_1';
  const rawState = {
    playerId: 'settlement-soldier-normalize-test',
    activeCityId: 'capital',
    resources: { food: 0, knowledge: 0, wood: 0, iron: 0, stone: 0, metal: 0 },
    buildings: {},
    population: { total: 3, max: 3, maxPop: 3, farmers: 3 },
    military: { soldiers: 0, soldierCap: 0 },
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

  // Settlement needs no soldiers, so normalization must keep the trained amount at zero.
  assert.equal(normalized.military.soldiers, 0);
  assert.equal(normalized.military.soldierCap, 0);
  assert.equal(normalized.military.availableSoldiers, 0);
  assert.equal(normalized.cities.capital.military.soldiers, 0);
});
