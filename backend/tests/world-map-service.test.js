const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapService = require('../services/WorldMapService');

test('initial v2 world map starts with the same micro terrain used by the tile lab', () => {
  const worldMap = WorldMapService.createInitialWorldMap('world-test', '2026-06-01T00:00:00.000Z');
  const byId = new Map(worldMap.tiles.map((tile) => [tile.id, tile]));

  assert.equal(worldMap.version, WorldMapService.WORLD_MAP_VERSION);
  assert.ok(worldMap.tiles.length > 80);
  assert.equal(byId.get('tile_0_0').terrain, 'capital');
  assert.equal(byId.get('tile_0_0').siteId, 'capital');
  assert.equal(byId.get('tile_1_0').terrain, 'ocean');
  assert.deepEqual(byId.get('tile_4_1').oceanTemplates, ['river-mouth-sw']);
});

test('v1 world map normalizes to lab-aligned v2 ocean and river templates', () => {
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
  assert.equal(byId.get('tile_1_0').terrain, 'ocean');
  assert.deepEqual(byId.get('tile_1_0').oceanTemplates, ['full']);
  assert.equal(byId.get('tile_4_2').terrain, 'river');
  assert.deepEqual(byId.get('tile_4_2').riverPorts, ['ne', 'sw']);
  assert.equal(byId.get('tile_4_1').terrain, 'ocean');
  assert.deepEqual(byId.get('tile_4_1').oceanTemplates, ['river-mouth-sw']);
  assert.deepEqual(byId.get('tile_3_0').riverPorts, []);
  assert.ok(byId.get('tile_-3_1').oceanTemplates?.includes('corner-e'));
});

test('incomplete v2 world map heals to the lab-aligned micro terrain bootstrap', () => {
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
  assert.ok(worldMap.tiles.length > 80);
  assert.deepEqual(byId.get('tile_4_1').oceanTemplates, ['river-mouth-sw']);
  assert.deepEqual(byId.get('tile_4_2').riverPorts, ['ne', 'sw']);
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
