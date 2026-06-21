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

test('WorldMarchProgressSnapshot detects active missions in mission lists', () => {
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();

  assert.equal(WorldMarchProgressSnapshot.hasActiveMission({
    missions: [createMission()],
    activeMission: null,
  }, { nowMs }), true);
  assert.equal(WorldMarchProgressSnapshot.hasActiveMission({
    missions: [createMission({ status: 'idle' })],
    activeMission: null,
  }, { nowMs }), false);
});

test('WorldMarchProgressSnapshot keeps rebased missions moving between confirmed tiles', () => {
  const nowMs = new Date('2026-06-06T00:00:15.000Z').getTime();
  const actor = WorldMarchProgressSnapshot.buildActorFromMission(createMission({
    origin: { q: 1, r: 0, tileId: 'tile_1_0' },
    position: { q: 1, r: 0, tileId: 'tile_1_0' },
    target: { q: 3, r: 0, tileId: 'tile_3_0' },
    route: [
      { q: 2, r: 0, tileId: 'tile_2_0', step: 1, revealed: false },
      { q: 3, r: 0, tileId: 'tile_3_0', step: 2, revealed: false },
    ],
    startedAt: '2026-06-06T00:00:10.000Z',
    nextStepAt: '2026-06-06T00:00:20.000Z',
    completesAt: '2026-06-06T00:00:30.000Z',
  }), { nowMs });

  assert.equal(actor.status, 'active');
  assert.equal(actor.current.q > 1, true);
  assert.equal(actor.current.q < 2, true);
});

test('WorldMarchProgressSnapshot exposes render-ready route tiles without revealing them', () => {
  const halfwayMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const nextSegmentMs = new Date('2026-06-06T00:00:15.000Z').getTime();
  const mission = createMission({
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: false },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: false },
    ],
    revealedTileIds: [],
  });

  const halfwayDerived = WorldMarchProgressSnapshot.deriveMissionForTime(mission, { nowMs: halfwayMs });
  const halfwayActor = WorldMarchProgressSnapshot.buildActorFromMission(mission, { nowMs: halfwayMs });
  const nextSegmentActor = WorldMarchProgressSnapshot.buildActorFromMission(mission, { nowMs: nextSegmentMs });

  assert.deepEqual(halfwayDerived.revealedTileIds, []);
  assert.deepEqual(halfwayDerived.route.map((step) => step.revealed), [false, false]);
  assert.equal(halfwayActor.renderAheadTileId, 'tile_1_0');
  assert.deepEqual(halfwayActor.renderReadyTileIds, ['tile_1_0']);
  assert.equal(halfwayActor.renderRevealSources[0].tileId, 'tile_1_0');
  assert.equal(halfwayActor.renderRevealSources[0].strength > 0, true);
  assert.equal(halfwayActor.renderRevealSources[0].strength < 1, true);
  assert.equal(nextSegmentActor.renderAheadTileId, 'tile_2_0');
  assert.deepEqual(nextSegmentActor.renderReadyTileIds, ['tile_1_0', 'tile_2_0']);
  assert.equal(nextSegmentActor.renderRevealSources[0].strength, 1);
  assert.equal(nextSegmentActor.renderRevealSources[1].strength > 0, true);
  assert.equal(nextSegmentActor.renderRevealSources[1].strength < 1, true);
});

test('WorldMarchProgressSnapshot canonicalizes stale tile ids through stable axes', () => {
  const coord = WorldMarchProgressSnapshot.normalizeCoord({
    x: 4,
    y: -2,
    q: 99,
    r: 99,
    tileId: 'legacy-away',
    id: 'legacy-id',
  });

  assert.deepEqual(coord, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
  });
});

test('WorldMarchProgressSnapshot normalizes mission rows without preserving stale tile ids', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    idleMissions: [createMission({
      status: 'idle',
      origin: { x: 0, y: 0, q: 88, r: 88, tileId: 'legacy-origin' },
      homeOrigin: { x: 0, y: 0, q: 77, r: 77, tileId: 'legacy-home' },
      target: { x: 0, y: 0, q: 66, r: 66, tileId: 'legacy-target' },
      position: { x: 0, y: 0, q: 55, r: 55, tileId: 'legacy-position' },
      route: [
        { x: 1, y: 0, q: 44, r: 44, tileId: 'legacy-route-1', step: 1, revealed: true },
        { x: 0, y: 0, q: 33, r: 33, tileId: 'legacy-route-2', step: 2, revealed: true },
      ],
      nextStepAt: null,
      completedAt: '2026-06-06T00:00:21.000Z',
    })],
  }, { nowMs });
  const mission = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const actor = WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1');

  assert.equal(mission.origin.tileId, 'tile_0_0');
  assert.equal(mission.homeOrigin.tileId, 'tile_0_0');
  assert.equal(mission.target.tileId, 'tile_0_0');
  assert.equal(mission.position.tileId, 'tile_0_0');
  assert.deepEqual(mission.route.map((step) => step.tileId), ['tile_1_0', 'tile_0_0']);
  assert.equal(actor.current.tileId, 'tile_0_0');
});

test('WorldMarchProgressSnapshot derives revealed route identity from coordinate-bearing route steps', () => {
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const derived = WorldMarchProgressSnapshot.deriveMissionForTime(createMission({
    revealedTileIds: ['legacy-route-1'],
    route: [
      { q: 1, r: 0, tileId: 'legacy-route-1', step: 1 },
      { q: 2, r: 0, tileId: 'legacy-route-2', step: 2 },
    ],
    nextStepAt: '2026-06-06T00:00:10.000Z',
    completesAt: '2026-06-06T00:00:20.000Z',
  }), { nowMs });

  assert.equal(derived.route[0].revealed, true);
  assert.deepEqual(derived.revealedTileIds, ['tile_1_0']);
  assert.equal(JSON.stringify(derived).includes('legacy-route'), false);
});

test('WorldMarchProgressSnapshot does not treat area visibility as route arrival', () => {
  const nowMs = new Date('2026-06-06T00:00:55.000Z').getTime();
  const derived = WorldMarchProgressSnapshot.deriveMissionForTime(createMission({
    id: 'return-home',
    mode: 'manual',
    status: 'active',
    origin: { q: 2, r: 0, tileId: 'tile_2_0', cityId: 'capital' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 1, r: 0, tileId: 'tile_1_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true },
      { q: 0, r: 0, tileId: 'tile_0_0', step: 2, revealed: false },
    ],
    revealedTileIds: ['tile_1_0', 'tile_0_0'],
    startedAt: '2026-06-06T00:00:40.000Z',
    nextStepAt: '2026-06-06T00:01:00.000Z',
    completesAt: '2026-06-06T00:01:00.000Z',
  }), { nowMs });
  const actor = WorldMarchProgressSnapshot.buildActorFromMission(derived, { nowMs });

  assert.deepEqual(derived.route.map((step) => step.revealed), [true, false]);
  assert.equal(derived.position.tileId, 'tile_1_0');
  assert.equal(actor.status, 'active');
  assert.equal(actor.current.q > 0, true);
  assert.equal(actor.current.q < 1, true);
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

test('WorldMarchProgressSnapshot renders stopped idle missions without a route as parked actors', () => {
  const nowMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    idleMissions: [createMission({
      status: 'idle',
      target: { q: 0, r: 0, tileId: 'tile_0_0' },
      position: { q: 0, r: 0, tileId: 'tile_0_0' },
      route: [],
      nextStepAt: null,
      completesAt: '2026-06-06T00:00:01.000Z',
      completedAt: '2026-06-06T00:00:01.000Z',
    })],
  }, { nowMs });
  const mission = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const actor = WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1');

  assert.equal(mission.status, WorldMarchProgressSnapshot.STATUS_IDLE);
  assert.equal(mission.routeLength, 0);
  assert.equal(actor.status, 'idle');
  assert.equal(actor.current.tileId, 'tile_0_0');
  assert.equal(actor.animationId, 'idle');
});

test('WorldMarchProgressSnapshot keeps idle actor on backend position when target differs', () => {
  const nowMs = new Date('2026-06-06T00:01:05.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    idleMissions: [createMission({
      status: 'idle',
      origin: { q: 0, r: 5, tileId: 'tile_0_5' },
      target: { q: 0, r: 6, tileId: 'tile_0_6' },
      position: { q: 0, r: 5, tileId: 'tile_0_5' },
      route: [
        { q: 0, r: 6, tileId: 'tile_0_6', step: 1, revealed: true },
      ],
      nextStepAt: null,
      completesAt: '2026-06-06T00:01:00.000Z',
      completedAt: '2026-06-06T00:01:00.000Z',
    })],
  }, { nowMs });
  const mission = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const actor = WorldMarchProgressSnapshot.getActor(snapshot, 'explore-1');

  assert.equal(mission.target.tileId, 'tile_0_6');
  assert.equal(mission.position.tileId, 'tile_0_5');
  assert.equal(mission.current.tileId, 'tile_0_5');
  assert.equal(actor.current.tileId, 'tile_0_5');
});

test('WorldMarchProgressSnapshot exposes expired random arrival as idle parked actor', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    missions: [createMission({ mode: 'random' })],
  }, { nowMs });
  const mission = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const arrival = WorldMarchProgressSnapshot.getArrival(snapshot, 'explore-1');

  assert.equal(mission.status, WorldMarchProgressSnapshot.STATUS_IDLE);
  assert.equal(mission.arrivalKind, WorldMarchProgressSnapshot.ARRIVAL_IDLE);
  assert.equal(snapshot.actors.length, 1);
  assert.equal(arrival.claimable, false);
  assert.equal(arrival.parked, true);
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

test('WorldMarchSystem delegates actor collections through the projection boundary', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const derived = WorldMarchSystem.deriveMissionForTime(createMission({ mode: 'random' }), { nowMs });
  const actors = WorldMarchSystem.buildActors({
    missions: [createMission({ mode: 'random' })],
    idleMissions: [
      createMission({ id: 'manual-home', status: 'idle', position: { q: 0, r: 0, tileId: 'tile_0_0' } }),
      createMission({
        id: 'manual-away',
        status: 'idle',
        position: { q: 2, r: 0, tileId: 'tile_2_0' },
      }),
    ],
  }, { nowMs });

  assert.equal(derived.status, 'idle');
  assert.equal(derived.route.every((step) => step.revealed), true);
  assert.deepEqual(actors.map((actor) => actor.id), ['manual-away']);
  assert.equal(actors[0].projection.kind, 'parkedAwayFromHome');
});
