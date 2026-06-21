const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./TileMapGeometry');
require('./WorldMarchGeometry');
const WorldMarchSystem = require('./WorldMarchSystem');

function createMission(overrides = {}) {
  return {
    id: 'explore-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
    ],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-1'] },
    stepDurationSeconds: 10,
    startedAt: '2026-06-06T00:00:00.000Z',
    completesAt: '2026-06-06T00:00:20.000Z',
    ...overrides,
  };
}

test('WorldMarchSystem computes actor progress, remaining time, and stop tile', () => {
  const nowMs = new Date('2026-06-06T00:00:06.000Z').getTime();
  const actor = WorldMarchSystem.buildActorFromMission(createMission(), { nowMs });

  assert.equal(actor.unitKey, 'scout_squad_default');
  assert.equal(actor.current.q > 0, true);
  assert.equal(actor.current.q < 1, true);
  assert.equal(actor.stopTile.tileId, 'tile_1_0');
  assert.equal(actor.remainingSeconds, 14);
  assert.equal(actor.formation.slot, 1);
});

test('WorldMarchSystem exposes active mission detection through facade', () => {
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();

  assert.equal(WorldMarchSystem.hasActiveMission({
    missions: [createMission()],
    activeMission: null,
  }, { nowMs }), true);
});

test('WorldMarchSystem accepts epoch seconds from legacy mission timestamps', () => {
  const nowMs = new Date('2026-06-06T00:00:06.000Z').getTime();
  const actor = WorldMarchSystem.buildActorFromMission(createMission({
    startedAt: Math.floor(new Date('2026-06-06T00:00:00.000Z').getTime() / 1000),
    completesAt: Math.floor(new Date('2026-06-06T00:00:20.000Z').getTime() / 1000),
  }), { nowMs });

  assert.equal(actor.current.q > 0, true);
  assert.equal(actor.current.q < 1, true);
  assert.equal(actor.remainingSeconds, 14);
});

test('WorldMarchSystem ignores retired ready missions from stale state', () => {
  const nowMs = new Date('2026-06-06T00:00:30.000Z').getTime();
  const actors = WorldMarchSystem.buildActors({
    missions: [createMission({ status: 'ready' })],
  }, { nowMs });

  assert.deepEqual(actors, []);
});

test('WorldMarchSystem renders idle missions at their position without remaining travel', () => {
  const nowMs = new Date('2026-06-06T00:00:30.000Z').getTime();
  const actors = WorldMarchSystem.buildActors({
    idleMissions: [createMission({
      status: 'idle',
      position: { q: 2, r: 0, tileId: 'tile_2_0' },
    })],
  }, { nowMs });

  assert.equal(actors.length, 1);
  assert.equal(actors[0].status, 'idle');
  assert.equal(actors[0].current.tileId, 'tile_2_0');
  assert.equal(actors[0].remainingSeconds, 0);
});

test('WorldMarchSystem derives expired manual marches as idle at the target', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const mission = createMission({
    status: 'active',
    mode: 'manual',
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
  });
  const derived = WorldMarchSystem.deriveMissionForTime(mission, { nowMs });
  const actor = WorldMarchSystem.buildActorFromMission(mission, { nowMs });

  assert.equal(derived.status, 'idle');
  assert.equal(derived.route.every((step) => step.revealed), true);
  assert.equal(derived.position.tileId, 'tile_2_0');
  assert.equal(actor.status, 'idle');
  assert.equal(actor.animationId, 'idle');
  assert.equal(actor.current.tileId, 'tile_2_0');
  assert.equal(actor.remainingSeconds, 0);
});

test('WorldMarchSystem derives expired random explores as idle at the target', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const derived = WorldMarchSystem.deriveMissionForTime(createMission({
    mode: 'random',
  }), { nowMs });

  assert.equal(derived.status, 'idle');
  assert.equal(derived.route.every((step) => step.revealed), true);
  assert.equal(derived.position.tileId, 'tile_2_0');
});

test('WorldMarchSystem chooses previous tile before halfway through a segment', () => {
  const nowMs = new Date('2026-06-06T00:00:03.000Z').getTime();
  const stopTile = WorldMarchSystem.chooseStopTile(createMission(), nowMs);

  assert.equal(stopTile.tileId, 'tile_0_0');
});

test('WorldMarchSystem maps a screen point to the nearest rendered tile', () => {
  const tileMapView = {
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
    tiles: [
      { id: 'tile_0_0', q: 0, r: 0 },
      { id: 'tile_1_0', q: 1, r: 0 },
    ],
  };
  const viewport = { originX: 100, originY: 100, panX: 0, panY: 0, scale: 0.5 };
  const target = WorldMarchSystem.screenPointToNearestTile({ x: 148, y: 124 }, tileMapView, viewport);

  assert.equal(target.tileId, 'tile_1_0');
});

test('WorldMarchSystem maps fog screen points back to axial tile coordinates', () => {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  const viewport = { originX: 100, originY: 100, panX: 0, panY: 0, scale: 0.5 };
  const point = WorldMarchSystem.getTileScreenCenter({ q: 3, r: -2 }, viewport, geometry);
  const target = WorldMarchSystem.screenPointToAxialTile(point, viewport, geometry);

  assert.equal(target.tileId, 'tile_3_-2');
  assert.equal(target.inferred, true);
});

test('WorldMarchSystem delegates geometry facade behavior', () => {
  assert.deepEqual(WorldMarchSystem.getMarchTargetUiState({
    worldMarchTarget: { q: '2', r: '-1', pickerOpen: true },
  }), {
    q: 2,
    r: -1,
    tileId: 'tile_2_-1',
    pickerOpen: true,
    known: undefined,
    terrain: '',
    terrainLabel: '',
  });
});

test('entrypoints load shared world march core before march domain modules', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const html = fs.readFileSync(path.join(rootDir, 'frontend/index.html'), 'utf8');
  const minigame = fs.readFileSync(path.join(rootDir, 'frontend/minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMarchCoreAdapter.js') >= 0, 'index.html should load WorldMarchCoreAdapter');
  assert.ok(
    html.indexOf('WorldMarchCoreAdapter.js') < html.indexOf('TileCoord.js'),
    'index.html should load WorldMarchCoreAdapter before TileCoord',
  );
  assert.ok(
    html.indexOf('WorldMarchCoreAdapter.js') < html.indexOf('WorldMarchProgressSnapshot.js'),
    'index.html should load WorldMarchCoreAdapter before WorldMarchProgressSnapshot',
  );
  assert.ok(
    minigame.indexOf("require('../js/shared/WorldMarchCoreAdapter')") < minigame.indexOf("require('../js/domain/TileCoord')"),
    'minigame should load WorldMarchCoreAdapter before TileCoord',
  );
  assert.ok(
    minigame.indexOf("require('../js/shared/WorldMarchCoreAdapter')") < minigame.indexOf("require('../js/domain/WorldMarchProgressSnapshot')"),
    'minigame should load WorldMarchCoreAdapter before WorldMarchProgressSnapshot',
  );
  assert.ok(html.indexOf('WorldMarchGeometry.js') >= 0, 'index.html should load WorldMarchGeometry');
  assert.ok(
    html.indexOf('WorldMarchGeometry.js') < html.indexOf('WorldMarchSystem.js'),
    'index.html should load WorldMarchGeometry before WorldMarchSystem',
  );
  assert.ok(
    minigame.indexOf("require('../js/domain/WorldMarchGeometry')") < minigame.indexOf("require('../js/domain/WorldMarchSystem')"),
    'minigame should load WorldMarchGeometry before WorldMarchSystem',
  );
});
