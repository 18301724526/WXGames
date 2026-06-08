const test = require('node:test');
const assert = require('node:assert/strict');

require('./WorldTime');
const WorldMarchProgressSnapshot = require('./WorldMarchProgressSnapshot');
require('./WorldMarchSystem');
const WorldMarchSystem = require('./WorldMarchSystem');

function createMission(overrides = {}) {
  return {
    id: 'explore-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 2, r: 0, tileId: 'tile_2_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
    ],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-1'] },
    stepDurationSeconds: 10,
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:10.000Z',
    completesAt: '2026-06-06T00:00:20.000Z',
    ...overrides,
  };
}

test('WorldMarchProgressSnapshot normalizes active march progress, actor, and index', () => {
  const nowMs = new Date('2026-06-06T00:00:06.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    missions: [createMission()],
  }, { nowMs });

  assert.equal(snapshot.schema, 'world-march-progress-snapshot-v1');
  assert.equal(snapshot.counts.missions, 1);
  assert.equal(snapshot.counts.actors, 1);
  assert.equal(snapshot.counts.arrivals, 0);
  assert.equal(snapshot.counts.active, 1);
  assert.equal(snapshot.indexById.missions['explore-1'], 0);
  assert.equal(WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1').remainingSeconds, 4);
  assert.equal(WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1').travelRemainingSeconds, 14);
  assert.equal(WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1').current.q > 0, true);
  assert.equal(WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1').current.q < 1, true);
  assert.equal(WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1').stopTile.tileId, 'tile_1_0');
});

test('WorldMarchProgressSnapshot exposes manual arrival as idle parked actor', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    activeMission: createMission({ mode: 'manual' }),
  }, { nowMs });
  const mission = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const actor = WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1');
  const arrival = WorldMarchProgressSnapshot.getArrival(snapshot, 'explore-1');

  assert.equal(mission.status, WorldMarchProgressSnapshot.STATUS_IDLE);
  assert.equal(mission.arrivalKind, WorldMarchProgressSnapshot.ARRIVAL_IDLE);
  assert.equal(actor.status, 'idle');
  assert.equal(actor.animationId, 'idle');
  assert.equal(actor.current.tileId, 'tile_2_0');
  assert.equal(arrival.parked, true);
  assert.equal(arrival.claimable, false);
});

test('WorldMarchProgressSnapshot exposes random arrival as ready result without map actor', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    missions: [createMission({ mode: 'random' })],
  }, { nowMs });
  const mission = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const arrival = WorldMarchProgressSnapshot.getArrival(snapshot, 'explore-1');

  assert.equal(mission.status, WorldMarchProgressSnapshot.STATUS_READY);
  assert.equal(mission.arrivalKind, WorldMarchProgressSnapshot.ARRIVAL_READY);
  assert.equal(snapshot.actors.length, 0);
  assert.equal(arrival.claimable, true);
  assert.equal(arrival.parked, false);
});

test('WorldMarchProgressSnapshot keeps signatures stable and avoids nested entity maps', () => {
  const missions = [];
  for (let i = 0; i < 2000; i += 1) {
    missions.push(createMission({
      id: `mission-${i}`,
      target: { q: i + 1, r: -i, tileId: `tile_${i + 1}_${-i}` },
      route: [{ q: i + 1, r: -i, tileId: `tile_${i + 1}_${-i}`, step: 1 }],
      stepDurationSeconds: 20,
      completesAt: '2026-06-06T00:00:20.000Z',
    }));
  }
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const first = WorldMarchProgressSnapshot.createSnapshot({ missions }, { nowMs });
  const second = WorldMarchProgressSnapshot.createSnapshot({ missions }, { nowMs });

  assert.equal(first.counts.missions, 2000);
  assert.equal(first.counts.actors, 2000);
  assert.equal(first.signature, second.signature);
  assert.equal(first.indexById.missions['mission-1999'], 1999);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'missionsById'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'entitiesById'), false);
});

test('WorldMarchSystem delegates march progress facade behavior to snapshot boundary', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const derived = WorldMarchSystem.deriveMissionForTime(createMission({ mode: 'random' }), { nowMs });
  const actors = WorldMarchSystem.buildActors({
    missions: [createMission({ mode: 'random' })],
    idleMissions: [createMission({ id: 'manual-idle', status: 'idle' })],
  }, { nowMs });

  assert.equal(derived.status, 'ready');
  assert.equal(derived.route.every((step) => step.revealed), true);
  assert.deepEqual(actors.map((actor) => actor.id), ['manual-idle']);
});
