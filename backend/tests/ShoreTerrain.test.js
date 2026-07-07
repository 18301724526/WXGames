const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const GameStateRepository = require('../repositories/GameStateRepository');
const GameStateNormalizer = require('../services/GameStateNormalizer');
const GameStateService = require('../services/GameStateService');
const WorldMapService = require('../services/WorldMapService');
const Tiles = require('../services/worldMap/WorldMapTiles');
const RoutePlanner = require('../services/worldExplorer/WorldExplorerRoutePlanner');
const TutorialCity = require('../services/worldExplorer/WorldExplorerTutorialCity');
const TerritoryShared = require('../services/territory/TerritoryShared');
const SpawnScoring = require('../services/spawn/SpawnScoring');
const WorldMarchCore = require('../../shared/worldMarchCore');

const SEED = WorldMapService.DEFAULT_WORLD_SEED;
const SCAN_RADIUS = 48;

function isTraversable(q, r) {
  return !WorldMarchCore.isMarchBlockedTerrain(WorldMapService.chooseTerrain(SEED, q, r));
}

function findCoord(predicate) {
  for (let q = -SCAN_RADIUS; q <= SCAN_RADIUS; q += 1) {
    for (let r = -SCAN_RADIUS; r <= SCAN_RADIUS; r += 1) {
      if (predicate(q, r)) return { q, r };
    }
  }
  return null;
}

// A straight line origin -> shore -> end where both ends are marchable, so the
// shore tile can be exercised both as an intermediate step and as an endpoint.
function findShoreLine() {
  const dirs = [
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
    { q: 1, r: -1 },
  ];
  let found = null;
  findCoord((q, r) => {
    if (WorldMapService.chooseTerrain(SEED, q, r) !== 'shore') return false;
    for (const dir of dirs) {
      const origin = { q: q - dir.q, r: r - dir.r };
      const end = { q: q + dir.q, r: r + dir.r };
      if (!isTraversable(origin.q, origin.r) || !isTraversable(end.q, end.r)) continue;
      found = { origin, mid: { q, r }, end };
      return true;
    }
    return false;
  });
  return found;
}

function getRiverChannelTiles() {
  const channel = WorldMapService.getWorldWaterFeatures(SEED).river;
  assert.ok(channel, 'default world seed must generate a home river channel');
  const inlandDir = WorldMapService.SIDE_DIRECTIONS[channel.inlandSide];
  assert.ok(inlandDir);
  return {
    channel,
    inlandDir,
    mouth: { q: channel.q, r: channel.r },
    riverTile: { q: channel.q + inlandDir.q, r: channel.r + inlandDir.r },
  };
}

test('shore classification: water centers stay ocean, pure edge/corner coasts become shore', () => {
  assert.equal(Tiles.classifyOceanTemplates([]), '');
  assert.equal(Tiles.classifyOceanTemplates(['nw']), 'shore');
  assert.equal(Tiles.classifyOceanTemplates(['nw-ne']), 'shore');
  assert.equal(Tiles.classifyOceanTemplates(['corner-n']), 'shore');
  assert.equal(Tiles.classifyOceanTemplates(['se', 'corner-e']), 'shore');
  assert.equal(Tiles.classifyOceanTemplates(['full']), 'ocean');
  assert.equal(Tiles.classifyOceanTemplates(['river-mouth-se']), 'ocean');

  // Real-seed anchors for the same rule via chooseTerrain.
  const shore = findCoord((q, r) => WorldMapService.chooseTerrain(SEED, q, r) === 'shore');
  assert.ok(shore, 'default world must contain shore tiles near its ocean basins');
  const shoreTemplates = WorldMapService.chooseOceanTemplates(SEED, shore.q, shore.r);
  assert.ok(shoreTemplates.length > 0);
  assert.equal(
    shoreTemplates.some((key) => key === 'full' || key.startsWith('river-mouth-')),
    false,
  );

  const basin = WorldMapService.getWorldWaterFeatures(SEED).basins[0];
  assert.ok(
    WorldMapService.chooseOceanTemplates(SEED, basin.centerQ, basin.centerR).includes('full'),
  );
  assert.equal(WorldMapService.chooseTerrain(SEED, basin.centerQ, basin.centerR), 'ocean');

  const { mouth, riverTile } = getRiverChannelTiles();
  assert.ok(
    WorldMapService.chooseOceanTemplates(SEED, mouth.q, mouth.r).some((key) =>
      key.startsWith('river-mouth-'),
    ),
  );
  assert.equal(WorldMapService.chooseTerrain(SEED, mouth.q, mouth.r), 'ocean');
  assert.equal(WorldMapService.chooseTerrain(SEED, riverTile.q, riverTile.r), 'river');
});

test('march routes accept shore as intermediate step and endpoint', () => {
  const line = findShoreLine();
  assert.ok(line, 'expected a shore tile flanked by marchable tiles');

  const throughShore = RoutePlanner.buildManualRoute(line.origin, line.end, SEED);
  assert.equal(throughShore.success, true);
  assert.deepEqual(
    throughShore.route.map((step) => `${step.q},${step.r}`),
    [`${line.mid.q},${line.mid.r}`, `${line.end.q},${line.end.r}`],
  );

  const ontoShore = RoutePlanner.buildManualRoute(line.origin, line.mid, SEED);
  assert.equal(ontoShore.success, true);
  assert.deepEqual(ontoShore.target, { q: line.mid.q, r: line.mid.r });
});

test('march routes reject river channels (tightened) and open ocean, in fog and on known tiles', () => {
  const now = new Date('2026-07-04T00:00:00.000Z');
  const { inlandDir, riverTile } = getRiverChannelTiles();
  const perp = { q: inlandDir.r, r: inlandDir.q };

  // Fogged branch: route terrain comes from chooseTerrain — crossing the channel is rejected.
  const crossing = RoutePlanner.buildManualRoute(
    { q: riverTile.q - perp.q, r: riverTile.r - perp.r },
    { q: riverTile.q + perp.q, r: riverTile.r + perp.r },
    SEED,
  );
  assert.equal(crossing.success, false);
  assert.equal(crossing.error, 'EXPLORE_ROUTE_BLOCKED');
  assert.equal(crossing.message, '行军路线被水域阻断。');

  // Open ocean stays rejected.
  const basin = WorldMapService.getWorldWaterFeatures(SEED).basins[0];
  const intoOcean = RoutePlanner.buildManualRoute(
    { q: basin.centerQ - 1, r: basin.centerR },
    { q: basin.centerQ, r: basin.centerR },
    SEED,
  );
  assert.equal(intoOcean.error, 'EXPLORE_ROUTE_BLOCKED');

  // Known-tile branch: revealed tiles are judged by their stored terrain.
  const gameState = {
    playerId: 'shore-known-route-test',
    worldMap: WorldMapService.createInitialWorldMap(SEED, now),
  };
  WorldMapService.revealTile(gameState, riverTile.q, riverTile.r, now, { visibility: 'scouted' });
  assert.equal(
    RoutePlanner.canTraverseRouteTile(SEED, riverTile.q, riverTile.r, { gameState, now }),
    false,
  );

  const shore = findCoord((q, r) => WorldMapService.chooseTerrain(SEED, q, r) === 'shore');
  WorldMapService.revealTile(gameState, shore.q, shore.r, now, { visibility: 'scouted' });
  assert.equal(RoutePlanner.canTraverseRouteTile(SEED, shore.q, shore.r, { gameState, now }), true);
});

test('legacy stored water terrain self-heals on read while land overrides stay authoritative', () => {
  const now = new Date('2026-07-04T00:00:00.000Z');
  const shore = findCoord((q, r) => WorldMapService.chooseTerrain(SEED, q, r) === 'shore');
  assert.ok(shore);

  // A pre-shore save stored 'ocean' on a coastline tile: normalization recomputes it.
  const healed = Tiles.normalizeTile(
    {
      q: shore.q,
      r: shore.r,
      terrain: 'ocean',
      discovered: true,
      visibility: 'scouted',
    },
    SEED,
    now,
  );
  assert.equal(healed.terrain, 'shore');
  assert.deepEqual(
    healed.oceanTemplates,
    WorldMapService.chooseOceanTemplates(SEED, shore.q, shore.r),
  );
  assert.ok(healed.oceanTemplates.length > 0);

  const decorated = Tiles.decorateTile(
    {
      id: WorldMapService.getTileId(shore.q, shore.r),
      q: shore.q,
      r: shore.r,
      terrain: 'ocean',
    },
    SEED,
  );
  assert.equal(decorated.terrain, 'shore');

  // Stored water that matches the recompute stays what it is.
  const basin = WorldMapService.getWorldWaterFeatures(SEED).basins[0];
  const stillOcean = Tiles.normalizeTile(
    {
      q: basin.centerQ,
      r: basin.centerR,
      terrain: 'ocean',
      discovered: true,
      visibility: 'scouted',
    },
    SEED,
    now,
  );
  assert.equal(stillOcean.terrain, 'ocean');

  const { riverTile } = getRiverChannelTiles();
  const stillRiver = Tiles.normalizeTile(
    {
      q: riverTile.q,
      r: riverTile.r,
      terrain: 'river',
      discovered: true,
      visibility: 'scouted',
    },
    SEED,
    now,
  );
  assert.equal(stillRiver.terrain, 'river');
  assert.ok(stillRiver.riverPorts.length > 0);

  // Control (mirror of the migration hills-override guarantee): stored LAND terrain
  // is trusted unconditionally, even on a naturally-shore coordinate.
  const landOverride = Tiles.normalizeTile(
    {
      q: shore.q,
      r: shore.r,
      terrain: 'hills',
      discovered: true,
      visibility: 'scouted',
    },
    SEED,
    now,
  );
  assert.equal(landOverride.terrain, 'hills');
  assert.deepEqual(landOverride.oceanTemplates, []);
});

test('world map authority repository lazily repairs stale water blobs and keeps land overrides', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  try {
    const now = new Date('2026-07-04T00:00:00.000Z');
    const shore = findCoord((q, r) => WorldMapService.chooseTerrain(SEED, q, r) === 'shore');
    const land = findCoord(
      (q, r) =>
        WorldMapService.chooseTerrain(SEED, q, r) === 'plains' &&
        Math.max(Math.abs(q), Math.abs(r)) > 4,
    );
    assert.ok(shore);
    assert.ok(land);

    const state = GameStateNormalizer.createInitialGameState('shore-water-blob-self-heal');
    WorldMapService.revealTile(state, shore.q, shore.r, now, { visibility: 'scouted' });
    WorldMapService.revealTile(state, land.q, land.r, now, {
      terrain: 'hills',
      visibility: 'scouted',
    });
    repository.save(state);

    const shoreCanonicalId = WorldMapService.getCanonicalTileId(shore.q, shore.r);
    const landCanonicalId = WorldMapService.getCanonicalTileId(land.q, land.r);
    const readBlob = (canonicalId) =>
      JSON.parse(
        db.prepare('SELECT tile FROM global_world_tiles WHERE canonicalId = ?').get(canonicalId)
          .tile,
      );

    assert.equal(readBlob(shoreCanonicalId).terrain, 'shore');
    assert.equal(readBlob(landCanonicalId).terrain, 'hills');

    // Simulate a pre-shore blob: the coastline tile was persisted as 'ocean'.
    db.prepare('UPDATE global_world_tiles SET tile = ? WHERE canonicalId = ?').run(
      JSON.stringify({ ...readBlob(shoreCanonicalId), terrain: 'ocean' }),
      shoreCanonicalId,
    );

    // Read path already serves the healed terrain to the client.
    const reloaded = repository.findByPlayerId(state.playerId);
    const client = GameStateService.getClientGameStateFromNormalized(
      GameStateService.normalizeState(reloaded),
    );
    const clientTile = client.territoryState.worldMap.tiles.find(
      (tile) => tile.q === shore.q && tile.r === shore.r,
    );
    assert.ok(clientTile);
    assert.equal(clientTile.terrain, 'shore');

    // Write path repairs the stale water blob in place...
    repository.save(state);
    assert.equal(readBlob(shoreCanonicalId).terrain, 'shore');

    // ...but never touches trusted land overrides (hills survives resaving even
    // though the seed recompute would say otherwise).
    assert.notEqual(WorldMapService.chooseTerrain(SEED, land.q, land.r), 'hills');
    assert.equal(readBlob(landCanonicalId).terrain, 'hills');
  } finally {
    db.close();
  }
});

test('shore maps to the coast planning archive and stays off spawn/site/tutorial placement', () => {
  assert.equal(TerritoryShared.getPlanningTerrainForMapTerrain('shore'), 'coast');
  assert.equal(SpawnScoring.isBlockedTerrain('shore'), true);

  const shore = findCoord((q, r) => WorldMapService.chooseTerrain(SEED, q, r) === 'shore');
  assert.ok(shore);
  assert.equal(WorldMapService.canPlaceSiteOnTerrain(SEED, shore.q, shore.r), false);

  // The pre-placed tutorial city (S5) never lands on shore/water: chooseTutorialCityTile skips every
  // march-blocked and shore tile, so the chosen tile is always solid land.
  const originShore = { q: shore.q, r: shore.r };
  const tile = TutorialCity.chooseTutorialCityTile(SEED, originShore);
  assert.ok(tile, 'a land tile is chosen near even a shore origin');
  assert.notEqual(WorldMapService.chooseTerrain(SEED, tile.q, tile.r), 'shore');
  assert.equal(WorldMarchCore.isMarchBlockedTerrain(WorldMapService.chooseTerrain(SEED, tile.q, tile.r)), false);
});
