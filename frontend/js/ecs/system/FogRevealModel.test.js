const test = require('node:test');
const assert = require('node:assert/strict');

const FogRevealModel = require('./FogRevealModel');
const WorldMarchCore = require('../../../../shared/worldMarchCore');

function createMission(overrides = {}) {
  const startedAt = Date.parse('2026-07-04T00:00:00.000Z');
  return {
    id: 'reveal-mission-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
    ],
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    startedAt: new Date(startedAt).toISOString(),
    stepDurationMs: 10000,
    revealedTileIds: [],
    ...overrides,
  };
}

function startMs(mission) {
  return Date.parse(mission.startedAt);
}

test('runRevealSystem stores reveal facts in component arrays for the requested instant', () => {
  const mission = createMission();
  const revealWorld = FogRevealModel.createRevealWorld();
  FogRevealModel.runRevealSystem(revealWorld, [mission], startMs(mission) + 15000);

  assert.equal(revealWorld.missionIds.length, 1);
  assert.equal(revealWorld.order.length > 0, true);
  const { FogRevealSource } = FogRevealModel;
  const strengths = revealWorld.order.map((eid) => FogRevealSource.strength[eid]);
  assert.equal(
    strengths.every((value) => value >= 0 && value <= 1),
    true,
  );
  const frontier = revealWorld.order.find(
    (eid) => FogRevealSource.strength[eid] > 0 && FogRevealSource.strength[eid] < 1,
  );
  assert.notEqual(frontier, undefined);
});

test('two system runs at different instants replace entities instead of accumulating', () => {
  const mission = createMission();
  const revealWorld = FogRevealModel.createRevealWorld();
  FogRevealModel.runRevealSystem(revealWorld, [mission], startMs(mission) + 5000);
  const firstCount = revealWorld.order.length;
  FogRevealModel.runRevealSystem(revealWorld, [mission], startMs(mission) + 15000);
  const matches = FogRevealModel.revealQuery(revealWorld.world);
  assert.equal(matches.length, revealWorld.order.length);
  assert.equal(firstCount > 0, true);
});

test('snapshot matches WorldMarchCore projection for the same instant', () => {
  const mission = createMission();
  const nowMs = startMs(mission) + 15000;
  const snapshot = FogRevealModel.createSnapshot([mission], nowMs);
  const fromSnapshot = FogRevealModel.getMissionRevealSources(snapshot, mission.id);
  const fromCore = WorldMarchCore.getRouteRenderRevealSources(mission, nowMs);

  assert.equal(snapshot.schema, 'world-fog-reveal-v1');
  assert.equal(snapshot.nowMs, nowMs);
  assert.equal(fromSnapshot.length, fromCore.length);
  fromCore.forEach((coreSource, index) => {
    assert.equal(fromSnapshot[index].tileId, coreSource.tileId);
    assert.equal(Math.abs(fromSnapshot[index].strength - coreSource.strength) < 0.002, true);
    assert.equal(fromSnapshot[index].source, coreSource.source);
  });
});

test('snapshot signature is pure: same facts and instant produce the same signature', () => {
  const mission = createMission();
  const nowMs = startMs(mission) + 12000;
  const first = FogRevealModel.createSnapshot([mission], nowMs);
  const second = FogRevealModel.createSnapshot([mission], nowMs);
  const moved = FogRevealModel.createSnapshot([mission], nowMs + 3000);

  assert.equal(first.signature, second.signature);
  assert.notEqual(first.signature, moved.signature);
});

test('fail-closed: non-finite nowMs throws instead of returning stale or empty facts', () => {
  const mission = createMission();
  assert.throws(() => FogRevealModel.createSnapshot([mission], Number.NaN), /finite nowMs/);
  assert.throws(
    () => FogRevealModel.runRevealSystem(FogRevealModel.createRevealWorld(), [mission], undefined),
    /finite nowMs/,
  );
});
