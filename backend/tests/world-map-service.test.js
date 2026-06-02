const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapService = require('../services/WorldMapService');

test('initial v2 world map starts with only the already discovered capital tile', () => {
  const worldMap = WorldMapService.createInitialWorldMap('world-test', '2026-06-01T00:00:00.000Z');
  const byId = new Map(worldMap.tiles.map((tile) => [tile.id, tile]));

  assert.equal(worldMap.version, WorldMapService.WORLD_MAP_VERSION);
  assert.equal(worldMap.tiles.length, 1);
  assert.equal(byId.get('tile_0_0').terrain, 'capital');
  assert.equal(byId.get('tile_0_0').siteId, 'capital');
});

test('normalizing a saved world map keeps only persisted discovered tiles', () => {
  const worldMap = WorldMapService.normalizeWorldMap({
    version: 1,
    seed: 'world-test',
    origin: { q: 0, r: 0 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', siteId: 'capital', discovered: true, visible: true },
    ],
  });

  const byId = new Map(worldMap.tiles.map((tile) => [tile.id, tile]));

  assert.equal(worldMap.version, WorldMapService.WORLD_MAP_VERSION);
  assert.equal(byId.get('tile_0_0').terrain, 'capital');
  assert.deepEqual(byId.get('tile_0_0').oceanTemplates, []);
  assert.deepEqual(byId.get('tile_0_0').riverPorts, []);
  assert.equal(byId.has('tile_1_0'), false);
  assert.equal(byId.has('tile_4_1'), false);
});

test('coordinate generation keeps rule-driven ocean and river templates without bootstrapping the whole map', () => {
  const features = WorldMapService.getWorldWaterFeatures('world-test');
  const mouthCoord = features.river;
  const inlandDir = WorldMapService.SIDE_DIRECTIONS[features.river.inlandSide];
  const riverMouth = WorldMapService.createTile('world-test', mouthCoord.q, mouthCoord.r, '2026-06-01T00:00:00.000Z');
  const river = WorldMapService.createTile('world-test', mouthCoord.q + inlandDir.q, mouthCoord.r + inlandDir.r, '2026-06-01T00:00:00.000Z');
  const riverSource = WorldMapService.createTile(
    'world-test',
    mouthCoord.q + inlandDir.q * (features.river.length - 1),
    mouthCoord.r + inlandDir.r * (features.river.length - 1),
    '2026-06-01T00:00:00.000Z',
  );
  const beyondSource = WorldMapService.createTile(
    'world-test',
    mouthCoord.q + inlandDir.q * features.river.length,
    mouthCoord.r + inlandDir.r * features.river.length,
    '2026-06-01T00:00:00.000Z',
  );
  const oceanDir = WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide];
  const ocean = WorldMapService.createTile('world-test', mouthCoord.q + oceanDir.q, mouthCoord.r + oceanDir.r, '2026-06-01T00:00:00.000Z');

  assert.equal(ocean.terrain, 'ocean');
  assert.deepEqual(ocean.oceanTemplates, ['full']);
  assert.equal(river.terrain, 'river');
  assert.deepEqual(river.riverPorts, [features.river.oceanSide, features.river.inlandSide].sort((a, b) => WorldMapService.SIDE_ORDER.indexOf(a) - WorldMapService.SIDE_ORDER.indexOf(b)));
  assert.equal(riverSource.terrain, 'river');
  assert.deepEqual(riverSource.riverPorts, [features.river.oceanSide]);
  assert.notEqual(beyondSource.terrain, 'river');
  assert.equal(riverMouth.terrain, 'ocean');
  assert.deepEqual(riverMouth.oceanTemplates, [WorldMapService.getRiverMouthTemplateForNeighborOfOcean(
    -(WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide].q),
    -(WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide].r),
  )]);
});

test('river mouth templates match visual ocean-neighbor directions', () => {
  assert.equal(WorldMapService.getRiverMouthTemplateForNeighborOfOcean(0, 1), 'river-mouth-ne');
  assert.equal(WorldMapService.getRiverMouthTemplateForNeighborOfOcean(0, -1), 'river-mouth-sw');
  assert.equal(WorldMapService.getRiverMouthTemplateForNeighborOfOcean(1, 0), 'river-mouth-nw');
  assert.equal(WorldMapService.getRiverMouthTemplateForNeighborOfOcean(-1, 0), 'river-mouth-se');
});

test('base terrain is generated from seed rules instead of fixed coordinate bands', () => {
  assert.equal(WorldMapService.chooseBaseTerrain('world-test', -4, -1), 'forest');
  assert.equal(WorldMapService.chooseBaseTerrain('world-test', -2, 0), 'plains');
  assert.equal(WorldMapService.chooseBaseTerrain('world-test', 8, 0), 'hills');
  assert.equal(WorldMapService.chooseBaseTerrain('world-alt', -4, 0), 'plains');
  assert.notEqual(WorldMapService.chooseBaseTerrain('world-test', -4, 0), WorldMapService.chooseBaseTerrain('world-alt', -4, 0));
});

test('water features are seed-driven and keep deterministic river mouths', () => {
  const first = WorldMapService.getWorldWaterFeatures('world-test');
  const second = WorldMapService.getWorldWaterFeatures('world-test');
  const alternate = WorldMapService.getWorldWaterFeatures('world-alt');

  assert.deepEqual(first, second);
  assert.notDeepEqual(first.basins.map((basin) => [basin.side, basin.centerQ, basin.centerR]), alternate.basins.map((basin) => [basin.side, basin.centerQ, basin.centerR]));
  assert.ok(first.river);
  assert.ok(alternate.river);
  assert.notDeepEqual(
    [first.river.q, first.river.r, first.river.oceanSide],
    [alternate.river.q, alternate.river.r, alternate.river.oceanSide],
  );
});

test('incomplete v2 world map heals only the capital tile', () => {
  const worldMap = WorldMapService.normalizeWorldMap({
    version: 2,
    seed: 'world-test',
    origin: { q: 0, r: 0 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', siteId: 'capital', discovered: true, visible: true },
    ],
  });
  const byId = new Map(worldMap.tiles.map((tile) => [tile.id, tile]));

  assert.equal(worldMap.version, WorldMapService.WORLD_MAP_VERSION);
  assert.equal(worldMap.tiles.length, 1);
  assert.equal(byId.get('tile_0_0').terrain, 'capital');
});

test('normalizing old discovered tiles refreshes terrain semantics for the current generator', () => {
  const worldMap = WorldMapService.normalizeWorldMap({
    version: 2,
    seed: 'world-test',
    origin: { q: 0, r: 0 },
    tiles: [
      { id: 'tile_4_1', q: 4, r: 1, terrain: 'ocean', oceanTemplates: ['river-mouth-ne'], discovered: true, visible: true },
    ],
  });
  const tile = worldMap.tiles.find((item) => item.id === 'tile_4_1');

  assert.equal(worldMap.version, WorldMapService.WORLD_MAP_VERSION);
  assert.equal(tile.terrain, WorldMapService.chooseTerrain('world-test', 4, 1));
  assert.deepEqual(tile.oceanTemplates, WorldMapService.chooseOceanTemplates('world-test', 4, 1));
  assert.deepEqual(tile.riverPorts, WorldMapService.getRiverPorts('world-test', 4, 1));
});

test('createTile prioritizes generated ocean/river semantics over caller terrain hints', () => {
  const capital = WorldMapService.createTile('world-test', 0, 0, '2026-06-01T00:00:00.000Z', { terrain: 'ocean' });
  const features = WorldMapService.getWorldWaterFeatures('world-test');
  const oceanDir = WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide];
  const inlandDir = WorldMapService.SIDE_DIRECTIONS[features.river.inlandSide];
  const ocean = WorldMapService.createTile('world-test', features.river.q + oceanDir.q, features.river.r + oceanDir.r, '2026-06-01T00:00:00.000Z', { terrain: 'forest' });
  const river = WorldMapService.createTile('world-test', features.river.q + inlandDir.q, features.river.r + inlandDir.r, '2026-06-01T00:00:00.000Z', { terrain: 'plains' });

  assert.equal(capital.terrain, 'capital');
  assert.deepEqual(capital.oceanTemplates, []);
  assert.deepEqual(capital.riverPorts, []);
  assert.equal(ocean.terrain, 'ocean');
  assert.deepEqual(ocean.oceanTemplates, ['full']);
  assert.equal(river.terrain, 'river');
  assert.deepEqual(river.riverPorts, ['ne', 'sw']);
});

test('scout reveal areas generate a stable chunk around the target coordinate', () => {
  const gameState = { playerId: 'chunk-player', worldMap: WorldMapService.createInitialWorldMap('world-test', '2026-06-01T00:00:00.000Z') };
  const features = WorldMapService.getWorldWaterFeatures('world-test');
  const revealed = WorldMapService.revealTileArea(gameState, features.river.q, features.river.r, '2026-06-01T00:00:00.000Z');
  const ids = revealed.map((tile) => tile.id);

  assert.equal(revealed.length, 9);
  assert.ok(ids.includes(WorldMapService.getTileId(features.river.q, features.river.r)));
  assert.deepEqual(
    gameState.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(features.river.q, features.river.r)).oceanTemplates,
    [WorldMapService.getRiverMouthTemplateForNeighborOfOcean(
      -(WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide].q),
      -(WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide].r),
    )],
  );
});

test('scout reveal area follows the route direction with deterministic branches', () => {
  const route = WorldMapService.buildScoutRoute({ q: 0, r: 0 }, 'e', 5);
  const area = WorldMapService.getScoutRevealArea('world-test', route, 'e');
  const main = area.filter((coord) => coord.kind === 'main');
  const branches = area.filter((coord) => coord.kind === 'branch');

  assert.deepEqual(main.map((coord) => [coord.q, coord.r]), [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]);
  assert.ok(branches.length > 0);
  assert.ok(branches.every((coord) => coord.step <= WorldMapService.SCOUT_REVEAL_BRANCH_LIMIT));
  assert.ok(branches.every((coord) => coord.q === coord.step && Math.abs(coord.r) === 1));
});
