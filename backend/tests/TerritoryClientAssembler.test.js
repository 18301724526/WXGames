const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateNormalizer = require('../services/GameStateNormalizer');
const TerritoryService = require('../services/TerritoryService');
const TerritoryClientAssembler = require('../services/TerritoryClientAssembler');
const WorldMapService = require('../services/WorldMapService');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('TerritoryService facade still returns the expected client territory contract', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-test');
  const now = new Date('2026-06-04T00:00:00.000Z');
  TerritoryService.normalizeTerritoryState(state, now);

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now);

  assert.ok(Array.isArray(clientState.territories));
  assert.ok(clientState.worldMap);
  assert.ok(clientState.mapBounds);
  assert.equal(clientState.missionDurationSeconds, Math.floor(TerritoryService.CONQUEST_DURATION_MS / 1000));
});

test('redacts garrison leader skills according to territory intel', () => {
  const garrison = {
    id: 'garrison-1',
    owner: 'npc',
    soldiers: 120,
    leader: {
      id: 'leader-1',
      name: 'Hidden Leader',
      abilityKit: { abilities: [{ id: 'skill-1' }] },
      skills: [{ id: 'legacy-skill' }],
    },
  };

  const partial = TerritoryClientAssembler.redactGarrisonForIntel(garrison, {
    knownGarrison: true,
    knownLeader: true,
    knownSkill: false,
  });
  const full = TerritoryClientAssembler.redactGarrisonForIntel(garrison, {
    knownGarrison: true,
    knownLeader: true,
    knownSkill: true,
  });
  const hidden = TerritoryClientAssembler.redactGarrisonForIntel(garrison, {
    knownGarrison: false,
    knownLeader: false,
    knownSkill: false,
  });

  assert.equal(partial.leader.name, 'Hidden Leader');
  assert.equal(partial.leader.abilityKit, null);
  assert.deepEqual(partial.leader.skills, []);
  assert.deepEqual(full.leader.abilityKit, { abilities: [{ id: 'skill-1' }] });
  assert.deepEqual(full.leader.skills, [{ id: 'legacy-skill' }]);
  assert.equal(hidden, null);
});

test('client territory projection includes shared sites without using them for local naming progress', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-shared-sites');
  const now = new Date('2026-06-12T00:00:00.000Z');
  const projection = {
    sharedWorldTerritories: [{
    id: 'site_shared_1',
    x: 5,
    y: 0,
    naturalName: 'Shared Frontier',
    cityName: 'Shared City',
    type: 'town',
    owner: 'player',
    ownerPlayerId: 'other-player',
    status: 'occupied',
    }],
  };
  TerritoryService.normalizeTerritoryState(state, now);

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now, projection);

  assert.equal(clientState.territories.some((site) => site.id === 'site_shared_1'), true);
  assert.equal(clientState.occupiedCount, 1);
  assert.equal(clientState.namingPrompt, null);
});

test('client territory projection lets shared occupied sites win coordinate conflicts', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-shared-conflict');
  const now = new Date('2026-06-15T00:00:00.000Z');
  const staleTutorialSite = {
    id: 'site_2_0',
    x: 2,
    y: 0,
    naturalName: 'Stale Tutorial City',
    type: 'town',
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
  };
  const sharedOccupiedSite = {
    id: 'shared_city_2_0',
    x: 2,
    y: 0,
    naturalName: 'Other Player City',
    cityName: 'Other Player City',
    type: 'town',
    owner: 'player',
    ownerPlayerId: 'other-player',
    status: 'occupied',
  };

  TerritoryService.normalizeTerritoryState(state, now);
  state.territories = [...state.territories, staleTutorialSite];
  WorldMapService.bindSiteToTile(state, 2, 0, staleTutorialSite.id, now, { visibility: 'scouted' });

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now, {
    sharedWorldTerritories: [sharedOccupiedSite],
  });
  const conflictTile = clientState.worldMap.tiles.find((tile) => tile.q === 2 && tile.r === 0);

  assert.equal(clientState.territories.some((site) => site.id === staleTutorialSite.id), false);
  assert.equal(clientState.territories.some((site) => site.id === sharedOccupiedSite.id), true);
  assert.equal(conflictTile.siteId, sharedOccupiedSite.id);
});

test('client world map projection omits stale legacy capital tiles outside current origin', () => {
  const now = new Date('2026-06-16T00:00:00.000Z');
  const state = GameStateNormalizer.createInitialGameState('territory-client-stale-capital', {
    now,
    spawn: { q: -6, r: 28, spawnKey: '-6,28' },
  });
  state.worldMap.tiles.push(WorldMapService.createTile(state.worldMap.seed, 0, 0, now, {
    terrain: 'capital',
    siteId: 'capital',
    visibility: 'controlled',
    controlled: true,
  }));

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now);
  const capitalTiles = clientState.worldMap.tiles.filter((tile) => tile.siteId === 'capital' || tile.terrain === 'capital');

  assert.deepEqual(clientState.worldMap.origin, { q: -6, r: 28 });
  assert.equal(clientState.worldMap.tiles.some((tile) => tile.q === 0 && tile.r === 0), false);
  assert.deepEqual(capitalTiles.map((tile) => `${tile.q},${tile.r}`), ['-6,28']);
});
