const test = require('node:test');
const assert = require('node:assert/strict');

const WorldTileMapExplorerNormalizer = require('./WorldTileMapExplorerNormalizer');

test('WorldTileMapExplorerNormalizer normalizes explorer missions for map display', () => {
  const normalized = WorldTileMapExplorerNormalizer.normalizeWorldExplorerMission({
    id: 'explore-1',
    mode: 'manual',
    status: 'active',
    origin: { q: '0', r: '0' },
    target: { q: '2', r: '0' },
    position: { q: '1', r: '0' },
    route: [
      { q: '1', r: '0', step: '1', revealed: true },
      { q: '2', r: '0', step: '2' },
    ],
    revealedTileIds: ['tile_1_0'],
    stepDurationMs: 10800,
    stepDurationSeconds: '10.8',
    startedAt: '2026-06-06T00:00:00.000Z',
    completesAt: '2026-06-06T00:00:20.000Z',
  });

  assert.equal(normalized.kind, 'worldExplore');
  assert.equal(normalized.direction, 'manual');
  assert.deepEqual(normalized.origin, { q: 0, r: 0, tileId: 'tile_0_0' });
  assert.deepEqual(normalized.target, { q: 2, r: 0, tileId: 'tile_2_0' });
  assert.equal(normalized.actionPoints, 2);
  assert.equal(normalized.actionPointsRemaining, 1);
  assert.deepEqual(normalized.route.map((step) => step.tileId), ['tile_1_0', 'tile_2_0']);
  assert.deepEqual(normalized.revealedTileIds, ['tile_1_0']);
  assert.equal(normalized.stepDurationMs, 10800);
  assert.equal(normalized.stepDurationSeconds, 10);
});

test('WorldTileMapExplorerNormalizer normalizes stable x/y mission coordinates through canonical tile identity', () => {
  const normalized = WorldTileMapExplorerNormalizer.normalizeWorldExplorerMission({
    id: 'explore-stable-coord',
    mode: 'manual',
    status: 'active',
    origin: { x: '1', y: '0', q: 99, r: 99, tileId: 'legacy-origin' },
    target: { x: '3', y: '-1', q: 88, r: 88 },
    position: { x: '2', y: '-1' },
    route: [
      { x: '2', y: '-1', q: 77, r: 77, step: '1', tileId: 'legacy-route', revealed: true },
      { x: '3', y: '-1', step: '2' },
    ],
  });

  assert.deepEqual(normalized.origin, { q: 1, r: 0, tileId: 'tile_1_0' });
  assert.deepEqual(normalized.target, { q: 3, r: -1, tileId: 'tile_3_-1' });
  assert.deepEqual(normalized.position, { q: 2, r: -1, tileId: 'tile_2_-1' });
  assert.deepEqual(normalized.route.map((step) => step.tileId), ['tile_2_-1', 'tile_3_-1']);
});

test('WorldTileMapExplorerNormalizer merges mission slots while keeping richer arrays', () => {
  const missions = WorldTileMapExplorerNormalizer.mergeWorldExplorerMissions({
    missions: [{
      id: 'explore-1',
      status: 'ready',
      route: [{ q: 1, r: 0 }],
      plannedTiles: [{ id: 'tile_1_0', q: 1, r: 0 }],
      plannedSites: [{ siteId: 'site_1_0', q: 1, r: 0 }],
      revealedTileIds: ['tile_1_0'],
    }],
    activeMission: {
      id: 'explore-1',
      status: 'active',
      route: [],
      plannedTiles: [],
      revealedTileIds: [],
    },
  });

  assert.equal(missions.length, 1);
  assert.equal(missions[0].status, 'active');
  assert.deepEqual(missions[0].route, [{ q: 1, r: 0 }]);
  assert.deepEqual(missions[0].plannedTiles.map((tile) => tile.id), ['tile_1_0']);
  assert.deepEqual(missions[0].plannedSites.map((site) => site.siteId), ['site_1_0']);
  assert.deepEqual(missions[0].revealedTileIds, ['tile_1_0']);
});

test('WorldTileMapExplorerNormalizer reveals x/y planned tiles and sites using canonical route identity', () => {
  const worldExplorerState = {
    activeMission: {
      id: 'manual-stable',
      status: 'active',
      route: [
        { x: 3, y: -1, step: 1, revealed: true },
      ],
      plannedTiles: [
        { x: 3, y: -1, q: 99, r: 99, id: 'legacy-planned-id', terrain: 'forest' },
      ],
      plannedSites: [{
        x: 3,
        y: -1,
        tileId: 'legacy-site-tile',
        siteId: 'site_3_-1',
        materialized: true,
        site: { id: 'site_3_-1', x: 3, y: -1, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: [],
    },
  };

  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles(
    worldExplorerState,
  ).map((tile) => ({ id: tile.id, q: tile.q, r: tile.r })), [
    { id: 'tile_3_-1', q: 3, r: -1 },
  ]);
  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedSites(
    worldExplorerState,
  ).map((site) => ({ id: site.id, x: site.x, y: site.y })), [
    { id: 'site_3_-1', x: 3, y: -1 },
  ]);
});

test('WorldTileMapExplorerNormalizer derives planned site tile identity from raw site coordinates', () => {
  const worldExplorerState = {
    activeMission: {
      id: 'manual-site-fallback',
      status: 'active',
      route: [
        { x: 4, y: -2, step: 1, revealed: true },
      ],
      plannedSites: [{
        siteId: 'site_4_-2',
        materialized: true,
        tileId: 'legacy-site-tile',
        site: { id: 'site_4_-2', x: 4, y: -2, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: [],
    },
  };

  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedSites(
    worldExplorerState,
  ).map((site) => ({ id: site.id, x: site.x, y: site.y })), [
    { id: 'site_4_-2', x: 4, y: -2 },
  ]);
});

test('WorldTileMapExplorerNormalizer reveals planned tiles and sites by server-confirmed mission state', () => {
  const worldExplorerState = {
    activeMission: {
      id: 'manual-1',
      status: 'active',
      mode: 'manual',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      completesAt: '2026-06-06T00:00:20.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: true },
        { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: true },
      ],
      plannedTiles: [
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest' },
        { id: 'tile_2_0', q: 2, r: 0, terrain: 'hills' },
      ],
      plannedSites: [{
        tileId: 'tile_2_0',
        q: 2,
        r: 0,
        siteId: 'site_2_0',
        materialized: false,
        site: { id: 'site_2_0', x: 2, y: 0, type: 'town', owner: 'neutral', status: 'discovered' },
      }],
      revealedTileIds: ['tile_1_0', 'tile_2_0'],
    },
  };
  const before = new Date('2026-06-06T00:00:05.000Z').getTime();
  const afterDone = new Date('2026-06-06T00:00:25.000Z').getTime();

  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles(
    worldExplorerState,
    { epochNowMs: before },
  ).map((tile) => tile.id), ['tile_1_0', 'tile_2_0']);
  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles(
    worldExplorerState,
    { epochNowMs: afterDone },
  ).map((tile) => tile.id), ['tile_1_0', 'tile_2_0']);
  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedSites(
    worldExplorerState,
    { epochNowMs: afterDone },
  ).map((site) => site.id), ['site_2_0']);
});

test('WorldTileMapExplorerNormalizer does not reveal planned tiles from client time alone', () => {
  const worldExplorerState = {
    activeMission: {
      id: 'manual-server-authority',
      status: 'active',
      mode: 'manual',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 1, r: 0, tileId: 'tile_1_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      completesAt: '2026-06-06T00:00:10.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
      ],
      plannedTiles: [
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest' },
      ],
      revealedTileIds: [],
    },
  };
  const afterServerStepWouldHaveElapsed = new Date('2026-06-06T00:00:15.000Z').getTime();

  assert.deepEqual(WorldTileMapExplorerNormalizer.getWorldExplorerPlannedTiles(
    worldExplorerState,
    { epochNowMs: afterServerStepWouldHaveElapsed },
  ).map((tile) => tile.id), []);
});
