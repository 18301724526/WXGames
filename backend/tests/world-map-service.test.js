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

test('coordinate generation keeps lab-aligned ocean and river templates without bootstrapping the whole map', () => {
  const ocean = WorldMapService.createTile('world-test', 1, 0, '2026-06-01T00:00:00.000Z');
  const riverMouth = WorldMapService.createTile('world-test', 4, 1, '2026-06-01T00:00:00.000Z');
  const river = WorldMapService.createTile('world-test', 4, 2, '2026-06-01T00:00:00.000Z');
  const shoreCorner = WorldMapService.createTile('world-test', -3, 1, '2026-06-01T00:00:00.000Z');

  assert.equal(ocean.terrain, 'ocean');
  assert.deepEqual(ocean.oceanTemplates, ['full']);
  assert.equal(river.terrain, 'river');
  assert.deepEqual(river.riverPorts, ['ne', 'sw']);
  assert.equal(riverMouth.terrain, 'ocean');
  assert.deepEqual(riverMouth.oceanTemplates, ['river-mouth-ne']);
  assert.ok(shoreCorner.oceanTemplates?.includes('corner-e'));
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

test('createTile prioritizes fixed ocean/river semantics over caller terrain hints', () => {
  const capital = WorldMapService.createTile('world-test', 0, 0, '2026-06-01T00:00:00.000Z', { terrain: 'ocean' });
  const ocean = WorldMapService.createTile('world-test', 1, 0, '2026-06-01T00:00:00.000Z', { terrain: 'forest' });
  const river = WorldMapService.createTile('world-test', 4, 2, '2026-06-01T00:00:00.000Z', { terrain: 'plains' });

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
  const revealed = WorldMapService.revealTileArea(gameState, 3, 0, '2026-06-01T00:00:00.000Z');
  const ids = revealed.map((tile) => tile.id);

  assert.equal(revealed.length, 9);
  assert.ok(ids.includes('tile_3_0'));
  assert.ok(ids.includes('tile_4_1'));
  assert.deepEqual(gameState.worldMap.tiles.find((tile) => tile.id === 'tile_4_1').oceanTemplates, ['river-mouth-ne']);
});
