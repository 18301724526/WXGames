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

test('client territory projection hides an undiscovered shared neutral city (no reveal-at-spawn)', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-hidden-neutral');
  const now = new Date('2026-07-06T00:00:00.000Z');
  const neutralCity = {
    id: 'site_9_0',
    x: 9,
    y: 0,
    naturalName: '河湾城邦',
    type: 'city',
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
  };
  TerritoryService.normalizeTerritoryState(state, now);

  // The player has NOT revealed the tile at (9,0), so the pre-placed neutral city must be absent from
  // the client DTO and never bound to the map (docs/design/10 §6-R2).
  const clientState = TerritoryService.getClientTerritoryState(clone(state), now, {
    sharedWorldTerritories: [neutralCity],
  });

  assert.equal(clientState.territories.some((site) => site.id === neutralCity.id), false);
  assert.equal(clientState.worldMap.tiles.some((tile) => tile.siteId === neutralCity.id), false);
});

test('an AI-explorer hidden tile does NOT surface a shared neutral city (coord-set pollution guard)', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-ai-hidden-neutral');
  const now = new Date('2026-07-06T00:00:00.000Z');
  const neutralCity = {
    id: 'site_9_0',
    x: 9,
    y: 0,
    naturalName: '河湾城邦',
    type: 'city',
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
  };
  TerritoryService.normalizeTerritoryState(state, now);
  // An AI explorer walked over (9,0): the tile exists in the RAW worldMap.tiles array but is
  // hidden from the player (the exact shape WorldAiExplorerService.revealAiArea writes). The
  // discovery gate reads the SSOT revealed set, so this tile must never surface the city.
  WorldMapService.revealTile(state, 9, 0, now, {
    visibility: 'hidden',
    discovered: true,
    visible: false,
    intel: { level: 0 },
  });

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now, {
    sharedWorldTerritories: [neutralCity],
  });

  assert.equal(clientState.territories.some((site) => site.id === neutralCity.id), false);
  assert.equal(clientState.worldMap.tiles.some((tile) => tile.siteId === neutralCity.id), false);
});

test('client territory projection reveals a shared neutral city once its tile is discovered', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-revealed-neutral');
  const now = new Date('2026-07-06T00:00:00.000Z');
  const neutralCity = {
    id: 'site_9_0',
    x: 9,
    y: 0,
    naturalName: '河湾城邦',
    type: 'city',
    owner: 'neutral',
    status: 'discovered',
    scale: 2,
  };
  TerritoryService.normalizeTerritoryState(state, now);
  // Simulate the player gaining tile visibility at the city coordinate (what S4 discovery will do).
  WorldMapService.revealTile(state, 9, 0, now, { visibility: 'scouted' });

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now, {
    sharedWorldTerritories: [neutralCity],
  });

  assert.equal(clientState.territories.some((site) => site.id === neutralCity.id), true);
  const cityTile = clientState.worldMap.tiles.find((tile) => tile.q === 9 && tile.r === 0);
  assert.equal(cityTile.siteId, neutralCity.id);
});

// A discovered DEFENDED neutral city, in the post-S4 shape: present in gameState.territories (so
// normalizeTerritory derives its garrison from the distance band) with its tile revealed. At (40,0)
// the deep band is defended (conquest occupation) — the meaningful case for the strength gate.
function createDefendedNeutralCityState(seed, extraTerritory = {}) {
  const state = GameStateNormalizer.createInitialGameState(seed);
  const now = new Date('2026-07-06T00:00:00.000Z');
  // Tutorial forces settlement mode on every neutral city (getOccupationMode short-circuit); complete
  // it so the distance band actually decides conquest-vs-settlement, exercising the defended path.
  state.tutorial = { ...(state.tutorial || {}), completed: true };
  state.territories.push({
    id: 'site_40_0', x: 40, y: 0, naturalName: '远疆城邦', type: 'city',
    owner: 'neutral', status: 'discovered', scale: 3, ...extraTerritory,
  });
  TerritoryService.normalizeTerritoryState(state, now);
  WorldMapService.revealTile(state, 40, 0, now, { visibility: 'scouted' });
  return { state, now };
}

test('a revealed-but-unfought neutral city withholds its defender strength scalars', () => {
  // "打了才知道": strength (defense / recommendedSoldiers / threat) is learned in battle, not by
  // scouting. A deep-band neutral city IS defended (has a garrison), but until the player has a
  // lastBattle record, the raw strength scalars must be ABSENT from the DTO (not projected as 0).
  const { state, now } = createDefendedNeutralCityState('territory-client-unfought-strength');
  const clientState = TerritoryService.getClientTerritoryState(clone(state), now);
  const projected = clientState.territories.find((site) => site.id === 'site_40_0');
  assert.ok(projected, 'the revealed city is projected');
  assert.equal(projected.occupationMode, 'conquest', 'deep-band city is a conquest target');
  assert.equal(
    Object.prototype.hasOwnProperty.call(projected, 'defense'),
    false,
    'defense scalar withheld until fought',
  );
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'recommendedSoldiers'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'threat'), false);
  // `scale` encodes the garrison band (deep=3/city=2/frontier=1) and GarrisonPolicy scales soldiers by
  // it, so it is a strength scalar too — withheld until fought, matching the encounter side.
  assert.equal(
    Object.prototype.hasOwnProperty.call(projected, 'scale'),
    false,
    'scale (garrison-band tier) withheld until fought',
  );
  // The garrison object was already intel-gated (unknown at level 1) — confirm it too is hidden.
  assert.equal(projected.garrison, null);
});

test('a fought neutral city (lastBattle present) keeps its defender strength scalars', () => {
  const { state, now } = createDefendedNeutralCityState('territory-client-fought-strength', {
    lastBattle: { success: false, casualties: 30, leaderName: '先锋' },
  });
  const clientState = TerritoryService.getClientTerritoryState(clone(state), now);
  const projected = clientState.territories.find((site) => site.id === 'site_40_0');
  assert.ok(projected, 'the revealed city is projected');
  assert.equal(projected.occupationMode, 'conquest');
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'defense'), true);
  assert.ok(projected.defense > 0, 'a fought city reveals its defense strength');
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'recommendedSoldiers'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, 'scale'), true, 'a fought city reveals its scale tier');
  assert.ok(projected.scale > 0, 'the revealed scale is the authored deep-band tier');
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
