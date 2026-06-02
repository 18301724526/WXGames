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
  assert.equal(byId.get('tile_0_0').visibility, 'controlled');
  assert.equal(byId.get('tile_0_0').discoveredAt, '2026-06-01T00:00:00.000Z');
  assert.equal(byId.get('tile_0_0').lastScoutedAt, '2026-06-01T00:00:00.000Z');
  assert.deepEqual(byId.get('tile_0_0').intel, {
    level: 4,
    knownTerrain: true,
    knownSite: true,
    knownOwner: true,
    knownGarrison: true,
    knownLeader: true,
    knownSkill: true,
  });
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
  assert.equal(byId.get('tile_0_0').visibility, 'controlled');
  assert.equal(byId.get('tile_0_0').intel.level, 4);
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

test('generated oceans stay open toward the continental edge instead of forming enclosed basins', () => {
  const seeds = ['world-test', 'world-alt', 'world-seed-v1', 'chunk-player'];
  for (const seed of seeds) {
    const features = WorldMapService.getWorldWaterFeatures(seed);
    for (const basin of features.basins) {
      const side = WorldMapService.SIDE_DIRECTIONS[basin.side];
      assert.ok(side, `${seed}:${basin.id} should have a valid ocean side`);
      let q = basin.centerQ;
      let r = basin.centerR;
      assert.deepEqual(WorldMapService.chooseOceanTemplates(seed, q, r), ['full'], `${seed}:${basin.id} should start from ocean core`);
      for (let step = 0; step < 24; step += 1) {
        assert.deepEqual(WorldMapService.chooseOceanTemplates(seed, q, r), ['full'], `${seed}:${basin.id} should remain ocean while moving ${basin.side} from ${basin.centerQ},${basin.centerR}`);
        q += side.q;
        r += side.r;
      }
    }
  }
});

test('bounded ocean core components always connect to the scanned world edge', () => {
  const radius = 36;
  const offsets = Object.values(WorldMapService.SIDE_DIRECTIONS);
  for (const seed of ['world-test', 'world-alt', 'world-seed-v1', 'chunk-player']) {
    const oceanCores = new Set();
    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        if (WorldMapService.chooseOceanTemplates(seed, q, r).includes('full')) oceanCores.add(WorldMapService.getTileId(q, r));
      }
    }
    assert.ok(oceanCores.size > 0, `${seed} should generate open ocean cores`);
    const visited = new Set();
    for (const start of oceanCores) {
      if (visited.has(start)) continue;
      const queue = [start];
      visited.add(start);
      let touchesWorldEdge = false;
      while (queue.length) {
        const id = queue.shift();
        const [, qText, rText] = id.split('_');
        const q = Number(qText);
        const r = Number(rText);
        if (Math.abs(q) === radius || Math.abs(r) === radius) touchesWorldEdge = true;
        for (const offset of offsets) {
          const neighborId = WorldMapService.getTileId(q + offset.q, r + offset.r);
          if (!oceanCores.has(neighborId) || visited.has(neighborId)) continue;
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
      assert.ok(touchesWorldEdge, `${seed} ocean component starting at ${start} should not be enclosed inside the scan`);
    }
  }
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
  assert.equal(tile.visibility, 'scouted');
  assert.equal(tile.intel.level, 1);
  assert.equal(tile.intel.knownTerrain, true);
  assert.equal(tile.intel.knownSite, true);
  assert.equal(tile.intel.knownOwner, true);
  assert.equal(tile.intel.knownGarrison, false);
  assert.equal(tile.intel.knownLeader, false);
  assert.equal(tile.intel.knownSkill, false);
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
  assert.ok(revealed.every((tile) => tile.visibility === 'scouted'));
  assert.ok(revealed.every((tile) => tile.lastScoutedAt === '2026-06-01T00:00:00.000Z'));
  assert.ok(revealed.every((tile) => tile.intel.level === 1));
  assert.ok(revealed.every((tile) => tile.intel.knownGarrison === false));
  assert.deepEqual(
    gameState.worldMap.tiles.find((tile) => tile.id === WorldMapService.getTileId(features.river.q, features.river.r)).oceanTemplates,
    [WorldMapService.getRiverMouthTemplateForNeighborOfOcean(
      -(WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide].q),
      -(WorldMapService.SIDE_DIRECTIONS[features.river.oceanSide].r),
    )],
  );
});

test('repeat scout reveal updates tile scout timestamp without expanding unrelated map truth', () => {
  const gameState = { playerId: 'repeat-scout', worldMap: WorldMapService.createInitialWorldMap('world-test', '2026-06-01T00:00:00.000Z') };

  WorldMapService.revealTile(gameState, 3, 0, '2026-06-01T00:01:00.000Z');
  const first = gameState.worldMap.tiles.find((tile) => tile.id === 'tile_3_0');
  WorldMapService.revealTile(gameState, 3, 0, '2026-06-01T00:02:00.000Z');
  const second = gameState.worldMap.tiles.find((tile) => tile.id === 'tile_3_0');

  assert.equal(gameState.worldMap.tiles.length, 2);
  assert.equal(first.discoveredAt, '2026-06-01T00:01:00.000Z');
  assert.equal(second.discoveredAt, '2026-06-01T00:01:00.000Z');
  assert.equal(second.lastScoutedAt, '2026-06-01T00:02:00.000Z');
  assert.equal(second.visibility, 'scouted');
  assert.equal(second.siteId, null);
  assert.equal(gameState.worldMap.tiles.some((tile) => tile.id === 'tile_4_0'), false);
});

test('binding a site controls only explicitly controlled player tiles', () => {
  const gameState = { playerId: 'site-bind', worldMap: WorldMapService.createInitialWorldMap('world-test', '2026-06-01T00:00:00.000Z') };

  const scouted = WorldMapService.bindSiteToTile(gameState, 3, 0, 'site_enemy', '2026-06-01T00:01:00.000Z');
  const controlled = WorldMapService.bindSiteToTile(gameState, 6, 0, 'site_player', '2026-06-01T00:02:00.000Z', { visibility: 'controlled' });

  assert.equal(scouted.visibility, 'scouted');
  assert.equal(scouted.intel.level, 1);
  assert.equal(scouted.intel.knownGarrison, false);
  assert.equal(controlled.visibility, 'controlled');
  assert.equal(controlled.intel.level, 4);
  assert.equal(controlled.intel.knownGarrison, true);
  assert.equal(controlled.intel.knownLeader, true);
  assert.equal(controlled.intel.knownSkill, true);
});

test('scout reveal area follows the route direction with deterministic branches', () => {
  const route = WorldMapService.buildScoutRoute({ q: 0, r: 0 }, 'e', 5);
  const area = WorldMapService.getScoutRevealArea('world-test', route, 'e');
  const main = area.filter((coord) => coord.kind === 'main');
  const branches = area.filter((coord) => coord.kind === 'branch');

  assert.deepEqual(main.map((coord) => [coord.q, coord.r]), [[1, 0], [2, 0], [3, 0]]);
  assert.ok(area.length >= 4);
  assert.ok(area.length <= WorldMapService.SCOUT_REVEAL_TILE_LIMIT);
  assert.ok(branches.length > 0);
  assert.ok(branches.every((coord) => coord.step <= WorldMapService.SCOUT_REVEAL_BRANCH_LIMIT));
  assert.ok(branches.every((coord) => coord.step <= WorldMapService.SCOUT_REVEAL_MAIN_LIMIT));
  assert.ok(branches.every((coord) => coord.q === coord.step && Math.abs(coord.r) === 1));
});
