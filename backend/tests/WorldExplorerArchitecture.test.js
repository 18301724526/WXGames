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
const Actions = require('../services/worldExplorer/WorldExplorerActions');
  const Shared = require('../services/worldExplorer/WorldExplorerShared');
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

test('WorldExplorerService facade preserves the legacy API', () => {
  const expectedApi = [
    'DEFAULT_RANDOM_ROUTE_LENGTH',
    'EXPLORE_REVEAL_RADIUS',
    'EXPLORE_STEP_DURATION_MS',
    'MAX_ACTIVE_EXPLORE_MISSIONS',
    'MAX_MANUAL_ROUTE_LENGTH',
    'MAX_RANDOM_ROUTE_LENGTH',
    'TUTORIAL_FIRST_SITE_GRANT_KEY',
    'advanceExploreMissions',
    'buildManualRoute',
    'buildRandomRoute',
    'claimExplore',
    'ensureTutorialFirstCityClaimSoldiers',
    'getClientState',
    'normalizeExploreState',
    'normalizeMission',
    'returnWorldMarch',
    'stopWorldMarch',
    'startExplore',
    'startWorldMarch',
  ];

  assert.deepEqual(Object.keys(WorldExplorerService).sort(), expectedApi.sort());
  assert.equal(typeof Actions.startExplore, 'function');
  assert.equal(typeof Actions.startWorldMarch, 'function');
});

test('WorldExplorerShared normalizes epoch-second mission timestamps', () => {
  const epochMs = new Date('2026-06-06T00:00:10.000Z').getTime();

  assert.equal(Shared.toTimestamp('2026-06-06T00:00:10.000Z'), epochMs);
  assert.equal(Shared.toTimestamp(epochMs), epochMs);
  assert.equal(Shared.toTimestamp(Math.floor(epochMs / 1000)), epochMs);
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
