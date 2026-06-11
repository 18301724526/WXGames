const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapService = require('../services/WorldMapService');
const Constants = require('../services/worldMap/WorldMapConstants');
const Shared = require('../services/worldMap/WorldMapShared');
const GenerationAuthority = require('../services/worldMap/WorldMapGenerationAuthority');
const Topology = require('../services/worldMap/WorldMapTopology');
const Water = require('../services/worldMap/WorldMapWater');
const Tiles = require('../services/worldMap/WorldMapTiles');

const serviceRoot = path.join(__dirname, '..', 'services');
const worldMapRoot = path.join(serviceRoot, 'worldMap');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('WorldMapService delegates terrain, water, and shared responsibilities to focused modules', () => {
  const facadePath = path.join(serviceRoot, 'WorldMapService.js');
  const moduleFiles = fs.readdirSync(worldMapRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 500, 'WorldMapService should stay below 500 lines');
  assert.deepEqual(moduleFiles, [
    'WorldMapBatch.js',
    'WorldMapConstants.js',
    'WorldMapGenerationAuthority.js',
    'WorldMapShared.js',
    'WorldMapTiles.js',
    'WorldMapTopology.js',
    'WorldMapWater.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(worldMapRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('world map generation authority owns deterministic server materialization rolls', () => {
  const roll = GenerationAuthority.createDeterministicRoll({
    seed: 'architecture-generation-seed',
    q: 'primary',
    r: 2,
    salt: 'ocean-primary-radius',
    action: 'waterBasin',
    subjectId: 'basin:primary',
  });
  const repeat = GenerationAuthority.createDeterministicRoll({
    seed: 'architecture-generation-seed',
    q: 'primary',
    r: 2,
    salt: 'ocean-primary-radius',
    action: 'waterBasin',
    subjectId: 'basin:primary',
  });

  assert.equal(roll.schema, GenerationAuthority.SCHEMA);
  assert.equal(roll.authority, 'server');
  assert.equal(roll.domain, 'worldMap');
  assert.equal(roll.mode, 'seeded-hash');
  assert.equal(roll.q, 'primary');
  assert.equal(roll.value, repeat.value);
  assert.match(roll.rollId, /^[a-f0-9]{8}$/);
  assert.equal(Shared.random01('architecture-generation-seed', 'primary', 2, 'ocean-primary-radius'), roll.value);
});

test('world map shared module owns stable ids and intel normalization', () => {
  assert.equal(Shared.getTileId(2, -1), 'tile_2_-1');
  assert.equal(Shared.toInteger('4.9'), 4);
  assert.deepEqual(Shared.normalizeTileIntel({}, { visibility: 'controlled', discovered: true, controlled: true }), {
    level: 4,
    knownTerrain: true,
    knownSite: true,
    knownOwner: true,
    knownGarrison: true,
    knownLeader: true,
    knownSkill: true,
  });
});

test('world map water module owns ocean and river template contracts', () => {
  const features = Water.getWorldWaterFeatures('architecture-water-seed');
  assert.equal(features.seed, 'architecture-water-seed');
  assert.equal(Array.isArray(features.basins), true);
  assert.equal(features.basins.length, 3);
  assert.equal(Water.getWorldWaterFeatures('architecture-water-seed'), features);

  const oceanCoord = features.basins[0];
  const oceanTemplates = Water.chooseOceanTemplates('architecture-water-seed', oceanCoord.centerQ, oceanCoord.centerR);
  assert.ok(oceanTemplates.includes('full'));
  assert.match(Water.getRiverMouthTemplateForNeighborOfOcean(-1, 0), /^river-mouth-/);
});

test('world map tile module owns terrain and tile normalization contracts', () => {
  const capital = Tiles.createTile('architecture-tile-seed', 0, 0, new Date('2026-06-06T00:00:00.000Z'), {
    visibility: 'controlled',
    siteId: 'capital',
  });
  assert.equal(capital.id, Constants.CAPITAL_TILE_ID);
  assert.equal(capital.terrain, 'capital');
  assert.equal(capital.visibility, 'controlled');
  assert.equal(capital.intel.level, 4);

  const normalized = Tiles.normalizeTile({
    q: 3,
    r: 1,
    terrain: 'unknown-terrain',
    discovered: true,
    visibility: 'scouted',
  }, 'architecture-tile-seed', new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(normalized.id, 'tile_3_1');
  assert.ok([...Constants.TERRAIN_TYPES, 'capital'].includes(normalized.terrain));
  assert.equal(Tiles.chooseTerrain('architecture-tile-seed', 0, 0), 'capital');
});

test('world map tile normalization preserves server-materialized terrain authority', () => {
  const now = new Date('2026-06-12T00:00:00.000Z');
  const materialized = Tiles.createTile('architecture-context-seed', 9, 2, now, {
    terrain: 'forest',
    visibility: 'scouted',
    generationContext: {
      direction: 'east',
      eventEpoch: 'storm',
      nearbyStateHash: 'frontier-context',
    },
  });
  const normalized = Tiles.normalizeTile(materialized, 'architecture-context-seed', now);

  assert.equal(materialized.terrain, 'forest');
  assert.equal(normalized.terrain, 'forest');
});

test('world map terrain materialization can depend on first-explorer context', () => {
  const now = new Date('2026-06-12T00:00:00.000Z');
  const base = Tiles.createTile('architecture-context-seed', 12, 7, now, {
    visibility: 'scouted',
  });
  const contextual = Tiles.createTile('architecture-context-seed', 12, 7, now, {
    visibility: 'scouted',
    generationContext: {
      source: 'player-world-explore',
      mode: 'manual',
      direction: 'e',
      eventEpoch: 'storm',
      nearbyStateHash: 'frontier-context',
      origin: { q: 11, r: 7 },
      target: { q: 12, r: 7 },
      step: 1,
    },
  });

  assert.equal(contextual.terrain, Tiles.chooseMaterializedTerrain(
    'architecture-context-seed',
    12,
    7,
    contextual.generationContext,
  ));
  assert.notEqual(contextual.terrain, base.terrain);
});

test('world map topology owns full wrapping server coordinates', () => {
  assert.deepEqual(Topology.normalizeCoord({ q: -1, r: 1024 }), {
    q: -1,
    r: 1024,
    x: -1,
    y: 1024,
    tileId: 'tile_-1_1024',
    worldQ: 1023,
    worldR: 0,
    generationQ: -1,
    generationR: 0,
    canonicalId: 'tile_1023_0',
    worldWidth: 1024,
    worldHeight: 1024,
    wrapped: true,
  });
  assert.equal(Topology.getCanonicalTileId(-1, 0), 'tile_1023_0');
  assert.equal(Topology.getWrappedDistance({ q: 0, r: 0 }, { q: 1023, r: 1023 }), 1);
  assert.deepEqual(Topology.createWorldTopologyMetadata(), {
    schema: Topology.SCHEMA,
    version: Topology.WORLD_TOPOLOGY_VERSION,
    coordinateSystem: Topology.COORDINATE_SYSTEM,
    width: 1024,
    height: 1024,
    wrapping: true,
    canonicalTileId: 'worldQ/worldR',
    displayTileId: 'q/r',
  });
});

test('world map service uses canonical ids for wrapping merge without moving display coords', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'wrap-merge-player',
    worldMap: WorldMapService.createInitialWorldMap('wrap-merge-seed', now),
  };

  const leftEdge = WorldMapService.revealTile(gameState, -1, 0, now, { visibility: 'scouted' });
  const rightEdge = WorldMapService.revealTile(gameState, 1023, 0, now, { visibility: 'controlled', siteId: 'edge-site' });
  const matchingTiles = gameState.worldMap.tiles.filter((tile) => tile.canonicalId === 'tile_1023_0');

  assert.equal(leftEdge.canonicalId, 'tile_1023_0');
  assert.equal(rightEdge.id, 'tile_-1_0');
  assert.equal(matchingTiles.length, 1);
  assert.equal(matchingTiles[0].q, -1);
  assert.equal(matchingTiles[0].siteId, 'edge-site');
  assert.equal(WorldMapService.chooseTerrain('wrap-merge-seed', -1, 0), WorldMapService.chooseTerrain('wrap-merge-seed', 1023, 0));
});

test('world map batch reveal preserves single-tile semantics with one indexed commit', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'batch-reveal-player',
    worldMap: WorldMapService.createInitialWorldMap('batch-reveal-seed', now),
  };

  const revealed = WorldMapService.revealTiles(gameState, [
    { q: -1, r: 0, overrides: { visibility: 'hidden', visible: false } },
    { q: 1023, r: 0, overrides: { visibility: 'controlled', siteId: 'edge-site' } },
    { q: 2, r: 1, overrides: { visibility: 'scouted' } },
  ], now);
  const matchingTiles = gameState.worldMap.tiles.filter((tile) => tile.canonicalId === 'tile_1023_0');
  const edgeTile = matchingTiles[0];

  assert.equal(revealed.length, 3);
  assert.equal(matchingTiles.length, 1);
  assert.equal(edgeTile.id, 'tile_-1_0');
  assert.equal(edgeTile.q, -1);
  assert.equal(edgeTile.r, 0);
  assert.equal(edgeTile.siteId, 'edge-site');
  assert.equal(edgeTile.visibility, 'controlled');
  assert.ok(gameState.worldMap.tiles.some((tile) => tile.id === 'tile_2_1' && tile.visibility === 'scouted'));
});

test('legacy player-derived world seeds normalize to the shared server world', () => {
  const gameState = {
    playerId: 'seed-player',
    worldMap: {
      seed: 'world-seed-player',
      tiles: [],
    },
  };

  const worldMap = WorldMapService.ensureWorldMap(gameState, new Date('2026-06-06T00:00:00.000Z'));

  assert.equal(worldMap.seed, Constants.DEFAULT_WORLD_SEED);
  assert.equal(worldMap.generationAuthority.seed, Constants.DEFAULT_WORLD_SEED);
});

test('WorldMapService facade preserves public map API and scout reveal behavior', () => {
  const expectedApi = [
    'CAPITAL_TILE_ID',
    'DEFAULT_WORLD_HEIGHT',
    'DEFAULT_WORLD_SEED',
    'DEFAULT_WORLD_WIDTH',
    'DEFAULT_WORLD_WRAPPING',
    'DIRECTION_VECTORS',
    'SCOUT_REVEAL_BRANCH_LIMIT',
    'SCOUT_REVEAL_MAIN_LIMIT',
    'SCOUT_REVEAL_RADIUS',
    'SCOUT_REVEAL_TILE_LIMIT',
    'SIDE_DIRECTIONS',
    'SIDE_ORDER',
    'START_REVEAL_RADIUS',
    'START_SAFE_LAND_RADIUS',
    'WORLD_MAP_VERSION',
    'WORLD_TOPOLOGY_VERSION',
    'bindSiteToTile',
    'buildScoutRoute',
    'canPlaceSiteOnTerrain',
    'chooseBaseTerrain',
    'chooseOceanTemplates',
    'chooseTerrain',
    'createInitialWorldMap',
    'createTile',
    'createWorldMapBatch',
    'createWorldMapGenerationMetadata',
    'createWorldTopologyMetadata',
    'ensureWorldMap',
    'getCanonicalTileId',
    'getClientWorldMap',
    'getClientWorldMapFromNormalized',
    'getDistanceFromCapital',
    'getRevealArea',
    'getRiverMouthTemplateForNeighborOfOcean',
    'getRiverPorts',
    'getScoutRevealArea',
    'getTileId',
    'getWorldMapVersion',
    'getWorldWaterFeatures',
    'getWrappedDelta',
    'getWrappedDistance',
    'normalizeWorldCoord',
    'normalizeWorldMap',
    'normalizeWorldSize',
    'recordScoutTrail',
    'revealScoutArea',
    'revealTile',
    'revealTileArea',
    'revealTiles',
  ];
  assert.deepEqual(Object.keys(WorldMapService).sort(), expectedApi.sort());

  const gameState = { playerId: 'architecture-player' };
  const worldMap = WorldMapService.ensureWorldMap(gameState, new Date('2026-06-06T00:00:00.000Z'));
  assert.deepEqual(worldMap.generationAuthority, {
    schema: GenerationAuthority.SCHEMA,
    authority: 'server',
    domain: 'worldMap',
    mode: 'seeded-hash',
    action: 'worldMaterialization',
    subjectId: 'world-map',
    seed: Constants.DEFAULT_WORLD_SEED,
  });
  assert.equal(worldMap.topology.schema, Topology.SCHEMA);
  assert.equal(worldMap.tiles.some((tile) => tile.id === Constants.CAPITAL_TILE_ID && tile.visibility === 'controlled'), true);
  const route = WorldMapService.buildScoutRoute({ q: 0, r: 0 }, 'e', 3);
  assert.deepEqual(route.map((coord) => coord.q), [1, 2, 3]);
  const revealArea = WorldMapService.getScoutRevealArea(worldMap.seed, route, 'e', { tileLimit: 4, minTileLimit: 4 });
  const revealed = WorldMapService.revealScoutArea(gameState, revealArea, new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(revealed.length >= 4, true);
  const trail = WorldMapService.recordScoutTrail(gameState, { id: 'mission-1', direction: 'e' }, revealed.map((tile) => tile.id), true);
  assert.equal(trail.returned, true);
});
