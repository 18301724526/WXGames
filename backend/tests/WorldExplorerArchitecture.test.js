const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldExplorerService = require('../services/WorldExplorerService');
const WorldAiExplorerService = require('../services/WorldAiExplorerService');
const WorldMapService = require('../services/WorldMapService');
const RoutePlanner = require('../services/worldExplorer/WorldExplorerRoutePlanner');
const MissionNormalizer = require('../services/worldExplorer/WorldExplorerMissionNormalizer');
const Progression = require('../services/worldExplorer/WorldExplorerProgression');
const ClientState = require('../services/worldExplorer/WorldExplorerClientState');
  const Shared = require('../services/worldExplorer/WorldExplorerShared');
const Actions = require('../services/worldExplorer/WorldExplorerActions');
const Realtime = require('../services/realtime');
const { TutorialFlowConfig } = require('../services/config/GameplayConfigRuntime');

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
    'WorldExplorerTutorial.js',
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
    tutorial: { completed: true },
  };

  assert.equal(manual.success, true);
  assert.equal(mission.route.length, 2);
  Progression.normalizeExploreState(state, new Date(now.getTime() + 30000));
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

test('world explorer progression materializes planned sites by step coordinates', (t) => {
  const originalBindSiteToTile = WorldMapService.bindSiteToTile;
  const calls = [];
  t.after(() => {
    WorldMapService.bindSiteToTile = originalBindSiteToTile;
  });
  WorldMapService.bindSiteToTile = (_gameState, x, y, siteId, _now, options) => {
    calls.push({ x, y, siteId, options });
    return {
      id: WorldMapService.getTileId(x, y),
      q: x,
      r: y,
      siteId,
      visibility: options?.visibility || 'scouted',
    };
  };

  const gameState = { territories: [], tutorial: { completed: true } };
  const mission = {
    id: 'stale-step-tile',
    plannedSites: [{
      tileId: 'tile_2_-1',
      q: 2,
      r: -1,
      siteId: 'site_2_-1',
      materialized: false,
      site: {
        id: 'site_2_-1',
        x: 2,
        y: -1,
        owner: 'neutral',
        status: 'discovered',
      },
    }],
  };

  const materialized = Progression.materializePlannedSitesForStep(
    gameState,
    mission,
    { q: 2, r: -1, tileId: 'stale-step-tile' },
    new Date('2026-06-06T00:00:00.000Z'),
  );

  assert.equal(materialized.length, 1);
  assert.equal(materialized[0].site.id, 'site_2_-1');
  assert.equal(materialized[0].tile.id, 'tile_2_-1');
  assert.deepEqual(calls, [{
    x: 2,
    y: -1,
    siteId: 'site_2_-1',
    options: { visibility: 'scouted' },
  }]);
  assert.equal(mission.plannedSites[0].materialized, true);
});

test('WorldExplorerService facade exposes only the actor march API', () => {
  const expectedApi = [
    'EXPLORE_REVEAL_RADIUS',
    'EXPLORE_STEP_DURATION_MS',
    'MAX_ACTIVE_EXPLORE_MISSIONS',
    'MAX_MANUAL_ROUTE_LENGTH',
    'TUTORIAL_FIRST_SITE_GRANT_KEY',
    'advanceExploreMissions',
    'buildManualRoute',
    'ensureTutorialFirstCityClaimSoldiers',
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

test('world explorer route planner creates tutorial planned sites by route coordinates', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  WorldMapService.chooseTerrain = () => 'ocean';

  const now = new Date('2026-06-06T00:00:00.000Z');
  const gameState = {
    playerId: 'tutorial-planned-site-coordinate-test',
    worldMap: { seed: 'tutorial-planned-site-seed', tiles: [] },
    territories: [],
    tutorial: {
      completed: false,
      currentStep: TutorialFlowConfig.TUTORIAL_STEPS.scoutFormationSaved,
      grants: {},
    },
  };
  const route = [
    { q: 2, r: -1, step: 1, tileId: 'stale-route-tile' },
  ];
  const plannedTiles = [{
    id: 'tile_2_-1',
    q: 2,
    r: -1,
    terrain: 'forest',
    visibility: 'scouted',
  }];

  const plannedSites = RoutePlanner.createTutorialPlannedSites(gameState, route, plannedTiles, now);

  assert.equal(plannedSites.length, 1);
  assert.equal(plannedSites[0].tileId, 'tile_2_-1');
  assert.equal(plannedSites[0].site.mapTerrain, 'forest');
  assert.equal(plannedSites[0].site.terrain, 'forest');
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
  const gameState = { territories: [], tutorial: { completed: true } };
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
  assert.deepEqual(calls.revealTiles[0], [{
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
  }]);
  assert.deepEqual(revealed.map((tile) => tile.terrain), ['forest']);
  assert.equal(revealed[0].generationContext.direction, 'e');
});

test('world explorer progression merges materialized reveal tiles by coordinates', (t) => {
  const originalRevealTiles = WorldMapService.revealTiles;
  const originalBindSiteToTile = WorldMapService.bindSiteToTile;
  t.after(() => {
    WorldMapService.revealTiles = originalRevealTiles;
    WorldMapService.bindSiteToTile = originalBindSiteToTile;
  });
  WorldMapService.revealTiles = (_gameState, coords) => coords.map((coord) => ({
    id: 'legacy-revealed-id',
    q: coord.q,
    r: coord.r,
    terrain: 'plains',
    visibility: 'scouted',
  }));
  WorldMapService.bindSiteToTile = (_gameState, x, y, siteId, _now, options) => ({
    id: WorldMapService.getTileId(x, y),
    q: x,
    r: y,
    siteId,
    visibility: options?.visibility || 'scouted',
  });

  const gameState = { territories: [], tutorial: { completed: true } };
  const mission = {
    id: 'merge-materialized-step',
    plannedTiles: [],
    plannedSites: [{
      tileId: 'tile_2_-1',
      q: 2,
      r: -1,
      siteId: 'site_2_-1',
      materialized: false,
      site: {
        id: 'site_2_-1',
        x: 2,
        y: -1,
        owner: 'neutral',
        status: 'discovered',
      },
    }],
  };

  const revealed = Progression.revealStep(gameState, mission, { q: 2, r: -1 }, new Date('2026-06-06T00:00:00.000Z'));

  assert.equal(revealed.length, 1);
  assert.equal(revealed[0].siteId, 'site_2_-1');
  assert.equal(mission.plannedSites[0].materialized, true);
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
    tutorial: { completed: true },
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
  assert.deepEqual(mission.revealedTileIds, ['tile_4_-2']);
  assert.deepEqual(mission.position, { q: 4, r: -2, tileId: 'tile_4_-2' });
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
