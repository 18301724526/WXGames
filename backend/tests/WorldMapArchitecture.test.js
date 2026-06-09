const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapService = require('../services/WorldMapService');
const Constants = require('../services/worldMap/WorldMapConstants');
const Shared = require('../services/worldMap/WorldMapShared');
const GenerationAuthority = require('../services/worldMap/WorldMapGenerationAuthority');
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
    'WorldMapConstants.js',
    'WorldMapGenerationAuthority.js',
    'WorldMapShared.js',
    'WorldMapTiles.js',
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

test('WorldMapService facade preserves public map API and scout reveal behavior', () => {
  const expectedApi = [
    'CAPITAL_TILE_ID',
    'DEFAULT_WORLD_SEED',
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
    'bindSiteToTile',
    'buildScoutRoute',
    'canPlaceSiteOnTerrain',
    'chooseBaseTerrain',
    'chooseOceanTemplates',
    'chooseTerrain',
    'createInitialWorldMap',
    'createTile',
    'createWorldMapGenerationMetadata',
    'ensureWorldMap',
    'getClientWorldMap',
    'getDistanceFromCapital',
    'getRevealArea',
    'getRiverMouthTemplateForNeighborOfOcean',
    'getRiverPorts',
    'getScoutRevealArea',
    'getTileId',
    'getWorldMapVersion',
    'getWorldWaterFeatures',
    'normalizeWorldMap',
    'recordScoutTrail',
    'revealScoutArea',
    'revealTile',
    'revealTileArea',
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
    seed: 'world-architecture-player',
  });
  assert.equal(worldMap.tiles.some((tile) => tile.id === Constants.CAPITAL_TILE_ID && tile.visibility === 'controlled'), true);
  const route = WorldMapService.buildScoutRoute({ q: 0, r: 0 }, 'e', 3);
  assert.deepEqual(route.map((coord) => coord.q), [1, 2, 3]);
  const revealArea = WorldMapService.getScoutRevealArea(worldMap.seed, route, 'e', { tileLimit: 4, minTileLimit: 4 });
  const revealed = WorldMapService.revealScoutArea(gameState, revealArea, new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(revealed.length >= 4, true);
  const trail = WorldMapService.recordScoutTrail(gameState, { id: 'mission-1', direction: 'e' }, revealed.map((tile) => tile.id), true);
  assert.equal(trail.returned, true);
});
