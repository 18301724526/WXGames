const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldExplorerService = require('../services/WorldExplorerService');
const WorldAiExplorerService = require('../services/WorldAiExplorerService');
const WorldMapService = require('../services/WorldMapService');
const WorldCitySpawner = require('../services/worldCombat/WorldCitySpawner');
const RoutePlanner = require('../services/worldExplorer/WorldExplorerRoutePlanner');
const MissionNormalizer = require('../services/worldExplorer/WorldExplorerMissionNormalizer');
const Progression = require('../services/worldExplorer/WorldExplorerProgression');
const Shared = require('../services/worldExplorer/WorldExplorerShared');
const ClientState = require('../services/worldExplorer/WorldExplorerClientState');
const Actions = require('../services/worldExplorer/WorldExplorerActions');
const Realtime = require('../services/realtime');

const serviceRoot = path.join(__dirname, '..', 'services');
const explorerRoot = path.join(serviceRoot, 'worldExplorer');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('WorldExplorerService stays a facade over focused explorer modules', () => {
  const facadePath = path.join(serviceRoot, 'WorldExplorerService.js');
  const moduleFiles = fs.readdirSync(explorerRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 80);
  assert.deepEqual(moduleFiles, [
    'WorldExplorerActions.js',
    'WorldExplorerClientState.js',
    'WorldExplorerDtoMapper.js',
    'WorldExplorerMissionNormalizer.js',
    'WorldExplorerProgression.js',
    'WorldExplorerRoutePlanner.js',
    'WorldExplorerShared.js',
    'WorldExplorerTrace.js',
    'WorldExplorerVision.js',
    'WorldMarchVerification.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(explorerRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('world explorer modules preserve the public exploration contract', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const origin = { q: 0, r: 0, cityId: 'capital', territoryId: 'capital', name: 'Capital' };
  const manual = RoutePlanner.buildManualRoute(origin, { q: 2, r: 1 }, 'architecture-seed');
  const mission = MissionNormalizer.normalizeMission({
    id: 'arch-explore',
    mode: 'manual',
    status: 'active',
    origin,
    target: manual.target,
    route: manual.route,
    startedAt: now.toISOString(),
    nextStepAt: now.toISOString(),
    plannedTiles: [{ id: 'tile_1_1', q: 1, r: 1, terrain: 'plains' }],
  });
  const state = {
    playerId: 'world-explorer-architecture-test',
    worldMap: { seed: 'architecture-seed', tiles: [] },
    territories: [],
    exploreMissions: [mission],
  };

  assert.equal(manual.success, true);
  // Axis-aligned route: (0,0)->(2,1) is a 3-step staircase (Manhattan |2|+|1|), not the
  // old 2-step diagonal. Advance long enough for all 3 steps (10s each) to complete.
  assert.equal(mission.route.length, 3);
  Progression.normalizeExploreState(state, new Date(now.getTime() + 60000));
  assert.equal(state.exploreMissions[0].status, 'idle');
  assert.equal(ClientState.getClientState(state, now).idleMissions.length, 1);
});

test('WorldExplorerMissionNormalizer derives tile identity from mission coordinates', () => {
  const mission = MissionNormalizer.normalizeMission({
    id: 'stale-tile-id-mission',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'stale-origin-tile', cityId: 'capital' },
    homeOrigin: { q: 0, r: 0, tileId: 'stale-home-tile', cityId: 'capital' },
    target: { q: 2, r: -1, tileId: 'stale-target-tile' },
    position: { q: 1, r: -1, tileId: 'stale-position-tile' },
    route: [
      { q: 1, r: -1, step: 1, tileId: 'stale-route-tile', revealed: true },
      { q: 2, r: -1, step: 2, tileId: 'stale-route-target' },
    ],
    plannedTiles: [
      { id: 'stale-planned-tile', q: 2, r: -1, terrain: 'plains' },
    ],
    plannedSites: [
      { tileId: 'stale-planned-site-tile', q: 2, r: -1, siteId: 'site_2_-1', site: { id: 'site_2_-1' } },
    ],
  });

  assert.equal(mission.origin.tileId, 'tile_0_0');
  assert.equal(mission.homeOrigin.tileId, 'tile_0_0');
  assert.equal(mission.target.tileId, 'tile_2_-1');
  assert.equal(mission.position.tileId, 'tile_1_-1');
  assert.deepEqual(mission.route.map((step) => step.tileId), ['tile_1_-1', 'tile_2_-1']);
  assert.deepEqual(mission.plannedTiles.map((tile) => tile.id), ['tile_2_-1']);
  assert.deepEqual(mission.plannedSites.map((site) => site.tileId), ['tile_2_-1']);
  assert.deepEqual(mission.revealedTileIds, ['tile_1_-1']);
});

test('WorldExplorerMissionNormalizer derives revealed route identity from coordinate-bearing route aliases', () => {
  const mission = MissionNormalizer.normalizeMission({
    id: 'stale-revealed-route-id-mission',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    route: [
      { q: 1, r: 0, step: 1, tileId: 'legacy-route-1' },
      { q: 2, r: 0, step: 2, tileId: 'legacy-route-2' },
    ],
    revealedTileIds: ['legacy-route-1'],
  });

  assert.equal(mission.route[0].revealed, true);
  assert.deepEqual(mission.revealedTileIds, ['tile_1_0']);
  assert.equal(JSON.stringify(mission).includes('legacy-route'), false);
});

test('WorldExplorerService facade exposes only the actor march API', () => {
  const expectedApi = [
    'EXPLORE_REVEAL_RADIUS',
    'EXPLORE_STEP_DURATION_MS',
    'MAX_ACTIVE_EXPLORE_MISSIONS',
    'MAX_MANUAL_ROUTE_LENGTH',
    'advanceExploreMissions',
    'buildManualRoute',
    'getClientState',
    'normalizeExploreState',
    'normalizeMission',
    'returnWorldMarch',
    'stopWorldMarch',
    'startWorldMarch',
  ];

  assert.deepEqual(Object.keys(WorldExplorerService).sort(), expectedApi.sort());
  assert.equal(Object.prototype.hasOwnProperty.call(WorldExplorerService, 'startExplore'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(WorldExplorerService, 'claimExplore'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(WorldExplorerService, 'buildRandomRoute'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(Actions, 'startExplore'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(Actions, 'claimExplore'), false);
  assert.equal(typeof Actions.startWorldMarch, 'function');
});

test('WorldExplorerActions keeps route rebasing and trace summaries coordinate-authoritative', () => {
  const actionsSource = fs.readFileSync(path.join(explorerRoot, 'WorldExplorerActions.js'), 'utf8');
  const staleIdentityFallbacks = [
    'coord.tileId || WorldMapService.getTileId',
    'step.tileId || WorldMapService.getTileId',
    'tile.id || WorldMapService.getTileId',
    'options.origin.tileId || WorldMapService.getTileId',
    'mission.origin?.tileId || WorldMapService.getTileId',
  ];

  for (const fallback of staleIdentityFallbacks) {
    assert.equal(
      actionsSource.includes(fallback),
      false,
      `WorldExplorerActions must not let stale caller/persisted tile identity override coordinates: ${fallback}`,
    );
  }
});

test('WorldExplorerShared normalizes epoch-second mission timestamps', () => {
  const epochMs = new Date('2026-06-06T00:00:10.000Z').getTime();

  assert.equal(Shared.toTimestamp('2026-06-06T00:00:10.000Z'), epochMs);
  assert.equal(Shared.toTimestamp(epochMs), epochMs);
  assert.equal(Shared.toTimestamp(Math.floor(epochMs / 1000)), epochMs);
});

test('world explorer generation context hashes nearby state instead of the full world', () => {
  const baseState = {
    playerId: 'generation-context-aoi-test',
    currentEra: 2,
    gameDay: 9,
    activeCityId: 'capital',
    cities: { capital: { id: 'capital', territoryId: 'capital' } },
    worldMap: WorldMapService.createInitialWorldMap('generation-context-aoi-seed'),
    territories: [
      { id: 'capital', x: 0, y: 0, owner: 'player', status: 'occupied' },
      { id: 'near-camp', x: 4, y: 0, owner: 'neutral', status: 'discovered' },
    ],
    worldAi: { explorers: [] },
  };
  const origin = { q: 0, r: 0, cityId: 'capital', territoryId: 'capital' };
  const step = { q: 4, r: 0, step: 1 };
  const distantState = {
    ...baseState,
    territories: [...baseState.territories, { id: 'distant-city', x: 200, y: 200, owner: 'ai', status: 'occupied' }],
  };
  const nearbyState = {
    ...baseState,
    territories: [...baseState.territories, { id: 'near-ai', x: 5, y: 0, owner: 'ai', status: 'occupied' }],
  };

  const baseContext = RoutePlanner.createGenerationContext(baseState, step, { mode: 'manual', origin });
  const distantContext = RoutePlanner.createGenerationContext(distantState, step, { mode: 'manual', origin });
  const nearbyContext = RoutePlanner.createGenerationContext(nearbyState, step, { mode: 'manual', origin });

  assert.equal(baseContext.direction, 'e');
  assert.equal(distantContext.nearbyStateHash, baseContext.nearbyStateHash);
  assert.notEqual(nearbyContext.nearbyStateHash, baseContext.nearbyStateHash);
});

test('companion city planner authors a neutral city from the spawn allocation target', () => {
  const planned = WorldCitySpawner.planCompanionCity('world-explorer-seed', {
    allocation: { starterTarget: { q: 1, r: 0, terrain: 'plains' } },
  });

  assert.equal(planned.id, 'site_1_0');
  assert.equal(planned.owner, 'neutral');
  assert.equal(planned.type, 'town');
  assert.equal(planned.status, 'discovered');
  // §4-4: no derived fields authored.
  assert.equal(Object.prototype.hasOwnProperty.call(planned, 'garrison'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(planned, 'battleTarget'), false);
});

test('companion city planner skips march-blocked target tiles', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  // A blocked allocation target must not produce a companion city.
  WorldMapService.chooseTerrain = (_seed, q, r) => (q === 1 && r === 0 ? 'ocean' : 'plains');

  const planned = WorldCitySpawner.planCompanionCity('any-seed', {
    allocation: { starterTarget: { q: 1, r: 0 } },
  });

  assert.equal(planned, null);
});

test('world explorer progression reveals a step through the world-map batch API', (t) => {
  const originalRevealTiles = WorldMapService.revealTiles;
  const originalRevealTile = WorldMapService.revealTile;
  const calls = {
    revealTile: 0,
    revealTiles: [],
  };
  t.after(() => {
    WorldMapService.revealTiles = originalRevealTiles;
    WorldMapService.revealTile = originalRevealTile;
  });
  WorldMapService.revealTile = () => {
    calls.revealTile += 1;
    throw new Error('world explorer progression should batch reveal step coordinates');
  };
  WorldMapService.revealTiles = (_gameState, coords, _now, options = {}) => {
    const batch = coords.map((coord) => ({
      q: coord.q,
      r: coord.r,
      overrides: typeof options.overrides === 'function' ? options.overrides(coord) : options.overrides,
    }));
    calls.revealTiles.push(batch);
    return batch.map((coord) => ({
      id: WorldMapService.getTileId(coord.q, coord.r),
      q: coord.q,
      r: coord.r,
      terrain: coord.overrides?.terrain || 'plains',
      visibility: coord.overrides?.visibility || 'scouted',
      generationContext: coord.overrides?.generationContext,
    }));
  };
  const gameState = { territories: [] };
  const mission = {
    id: 'batch-step',
    plannedTiles: [{
      id: 'tile_1_0',
      q: 1,
      r: 0,
      terrain: 'forest',
      generationContext: { direction: 'e', eventEpoch: 'frontier' },
    }],
    plannedSites: [],
  };

  const revealed = Progression.revealStep(gameState, mission, { q: 1, r: 0 }, new Date('2026-06-06T00:00:00.000Z'));

  assert.equal(calls.revealTile, 0);
  assert.equal(calls.revealTiles.length, 1);
  assert.deepEqual(calls.revealTiles[0].map(({ q, r }) => `${q},${r}`), [
    '1,0',
    '0,-1',
    '0,0',
    '0,1',
    '1,-1',
    '1,1',
    '2,-1',
    '2,0',
    '2,1',
  ]);
  assert.deepEqual(calls.revealTiles[0][0], {
    q: 1,
    r: 0,
    overrides: {
      terrain: 'forest',
      riverPorts: undefined,
      oceanTemplates: undefined,
      transitionKey: undefined,
      generatedAt: undefined,
      visibility: 'scouted',
      generationContext: { direction: 'e', eventEpoch: 'frontier' },
    },
  });
  assert.deepEqual(revealed.map((tile) => tile.terrain)[0], 'forest');
  assert.equal(revealed[0].generationContext.direction, 'e');
});

test('world explorer progression merges vision-discovered city tiles into the revealed set', (t) => {
  // S5: revealStep no longer materializes plannedSites. Instead, a PRE-PLACED neutral city whose tile
  // enters vision is discovered (discoverPrePlacedCitiesInVision) and its tile is merged into the returned
  // reveal set so the caller flows it into newlyRevealedTiles / the client. Here the city is fed via the
  // shared projection, exactly as the S3 store delivers it.
  const originalRevealTiles = WorldMapService.revealTiles;
  const originalBindSiteToTile = WorldMapService.bindSiteToTile;
  const originalRecordVisionSource = WorldMapService.recordVisionSource;
  t.after(() => {
    WorldMapService.revealTiles = originalRevealTiles;
    WorldMapService.bindSiteToTile = originalBindSiteToTile;
    WorldMapService.recordVisionSource = originalRecordVisionSource;
  });
  WorldMapService.revealTiles = (_gameState, coords) => coords.map((coord) => ({
    id: WorldMapService.getTileId(coord.q, coord.r),
    q: coord.q,
    r: coord.r,
    terrain: 'plains',
    visibility: 'scouted',
  }));
  WorldMapService.bindSiteToTile = (gameStateArg, x, y, siteId, _now, options) => {
    const tile = {
      id: WorldMapService.getTileId(x, y),
      q: x,
      r: y,
      siteId,
      visibility: options?.visibility || 'scouted',
    };
    gameStateArg.worldMap = gameStateArg.worldMap || { tiles: [] };
    gameStateArg.worldMap.tiles = [...(gameStateArg.worldMap.tiles || []), tile];
    return tile;
  };
  WorldMapService.recordVisionSource = () => {};

  const gameState = { territories: [], worldMap: { tiles: [] } };
  const mission = { id: 'merge-discovered-step', plannedTiles: [], plannedSites: [] };

  const revealed = Progression.revealStep(gameState, mission, { q: 2, r: -1 }, new Date('2026-06-06T00:00:00.000Z'), {
    planningContext: {
      sharedWorldTerritories: [{
        id: 'site_2_-1', x: 2, y: -1, owner: 'neutral', type: 'town', status: 'discovered', scale: 1, naturalName: '河湾村镇',
      }],
    },
  });

  assert.equal(revealed.length, 9);
  assert.equal(revealed.some((tile) => tile.siteId === 'site_2_-1'), true);
  assert.equal(gameState.territories.some((territory) => territory.id === 'site_2_-1'), true);
});

test('world explorer progression stores revealed mission ids from coordinates', (t) => {
  const originalRevealTiles = WorldMapService.revealTiles;
  t.after(() => {
    WorldMapService.revealTiles = originalRevealTiles;
  });
  WorldMapService.revealTiles = (_gameState, coords, _now, options = {}) => coords.map((coord) => ({
    id: 'legacy-revealed-id',
    q: coord.q,
    r: coord.r,
    terrain: options.overrides?.(coord)?.terrain || 'plains',
    visibility: 'scouted',
  }));

  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    territories: [],
    exploreMissions: [{
      id: 'coordinate-revealed-ids',
      mode: 'manual',
      status: 'active',
      origin: { q: 0, r: 0, cityId: 'capital', territoryId: 'capital' },
      target: { q: 4, r: -2 },
      position: { q: 0, r: 0 },
      route: [{ q: 4, r: -2, step: 1, revealed: false }],
      plannedTiles: [],
      plannedSites: [],
      revealedTileIds: [],
      nextStepAt: now.toISOString(),
      stepDurationMs: 1000,
    }],
  };

  Progression.advanceExploreMissions(gameState, now);

  const mission = gameState.exploreMissions[0];
  assert.equal(mission.status, 'idle');
  assert.deepEqual(mission.revealedTileIds, [
    'tile_4_-2',
    'tile_3_-3',
    'tile_3_-2',
    'tile_3_-1',
    'tile_4_-3',
    'tile_4_-1',
    'tile_5_-3',
    'tile_5_-2',
    'tile_5_-1',
  ]);
  assert.deepEqual(mission.position, { q: 4, r: -2, tileId: 'tile_4_-2' });
});

test('world AI reveal stores revealed ids from coordinates', (t) => {
  const originalRevealTiles = WorldMapService.revealTiles;
  t.after(() => {
    WorldMapService.revealTiles = originalRevealTiles;
  });
  WorldMapService.revealTiles = (_gameState, coords) => coords.map((coord) => ({
    id: 'legacy-ai-revealed-id',
    q: coord.q,
    r: coord.r,
    canonicalId: WorldMapService.getCanonicalTileId(coord.q, coord.r),
    visibility: 'hidden',
  }));

  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'ai-coordinate-revealed-ids',
    worldMap: WorldMapService.createInitialWorldMap('ai-coordinate-seed', now),
    worldAi: WorldAiExplorerService.normalizeWorldAi({
      explorers: [{
        id: 'ai-frontier-coordinate',
        factionId: 'ai-frontier',
        position: { q: 7, r: -3 },
        revealedTileIds: [],
        revealedCanonicalIds: [],
      }],
    }, now),
  };
  const explorer = gameState.worldAi.explorers[0];

  WorldAiExplorerService.revealAiArea(gameState, explorer, 7, -3, now);

  assert.deepEqual(explorer.revealedTileIds, ['tile_7_-3']);
  assert.deepEqual(explorer.revealedCanonicalIds, ['tile_7_1021']);
});

test('realtime authority contracts expose the P11 backend-authoritative baselines', () => {
  assert.equal(typeof Realtime.CommandAuthorityContract.accept, 'function');
  assert.equal(typeof Realtime.ServerTimelineSnapshot.createMissionSnapshot, 'function');
  assert.equal(typeof Realtime.AoiSyncSnapshot.createSnapshot, 'function');
});

test('world AI explorer stays focused and exposes the AI reveal sync contract', () => {
  const aiPath = path.join(serviceRoot, 'WorldAiExplorerService.js');

  assert.ok(lineCount(aiPath) < 300, 'WorldAiExplorerService should stay below 300 lines');
  assert.deepEqual(Object.keys(WorldAiExplorerService).sort(), [
    'DEFAULT_AI_EXPLORER_ID',
    'DEFAULT_AI_FACTION_ID',
    'DEFAULT_REVEAL_RADIUS',
    'DEFAULT_STEP_DURATION_MS',
    'DEFAULT_SYNC_RADIUS',
    'MAX_ADVANCE_STEPS',
    'MAX_SYNC_TILES_PER_PASS',
    'WORLD_AI_SCHEMA',
    'advanceAiExploration',
    'normalizeExplorer',
    'normalizeWorldAi',
    'normalizeWorldAiState',
    'pickNextStep',
    'revealAiArea',
    'syncAiRevealToPlayer',
  ].sort());
});

test('AI explored terrain stays server-side until it meets the player reveal frontier', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'ai-sync-player',
    worldMap: WorldMapService.createInitialWorldMap('ai-sync-seed', now),
    worldAi: WorldAiExplorerService.normalizeWorldAi({
      explorers: [{
        id: 'ai-frontier-1',
        factionId: 'ai-frontier',
        position: { q: 1021, r: 0 },
        revealedTileIds: [],
        revealedCanonicalIds: [],
      }],
    }, now),
  };
  const explorer = gameState.worldAi.explorers[0];

  WorldAiExplorerService.revealAiArea(gameState, explorer, 1021, 0, now);

  assert.equal(gameState.worldMap.tiles.some((tile) => tile.canonicalId === 'tile_1021_0' && tile.visibility === 'hidden'), true);
  assert.equal(WorldMapService.getClientWorldMap(gameState, now).tiles.some((tile) => tile.canonicalId === 'tile_1021_0'), false);

  const synced = WorldAiExplorerService.syncAiRevealToPlayer(gameState, now);
  const clientMap = WorldMapService.getClientWorldMap(gameState, now);
  const syncedTile = clientMap.tiles.find((tile) => tile.canonicalId === 'tile_1021_0');

  assert.equal(synced.length, 1);
  assert.ok(syncedTile);
  assert.equal(syncedTile.id, 'tile_-3_0');
  assert.equal(syncedTile.q, -3);
  assert.equal(syncedTile.r, 0);
  assert.equal(syncedTile.visibility, 'scouted');
});

test('AI reveal sync only exposes AI tiles inside the encounter radius', () => {
  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'ai-sync-radius-player',
    worldMap: WorldMapService.createInitialWorldMap('ai-sync-radius-seed', now),
    worldAi: WorldAiExplorerService.normalizeWorldAi({
      explorers: [{
        id: 'ai-frontier-1',
        factionId: 'ai-frontier',
        position: { q: 3, r: 0 },
        revealedTileIds: [],
        revealedCanonicalIds: [],
      }],
    }, now),
  };
  const explorer = gameState.worldAi.explorers[0];

  WorldAiExplorerService.revealAiArea(gameState, explorer, 3, 0, now);
  WorldAiExplorerService.revealAiArea(gameState, explorer, 20, 20, now);

  const synced = WorldAiExplorerService.syncAiRevealToPlayer(gameState, now, {
    syncRadius: 1,
    syncLimit: 64,
  });
  const syncedCanonicalIds = synced.map((tile) => tile.canonicalId || WorldMapService.getCanonicalTileId(tile.q, tile.r));
  const clientCanonicalIds = WorldMapService.getClientWorldMap(gameState, now).tiles
    .map((tile) => tile.canonicalId || WorldMapService.getCanonicalTileId(tile.q, tile.r));

  assert.equal(syncedCanonicalIds.includes('tile_3_0'), true);
  assert.equal(syncedCanonicalIds.includes('tile_20_20'), false);
  assert.equal(clientCanonicalIds.includes('tile_20_20'), false);
});
