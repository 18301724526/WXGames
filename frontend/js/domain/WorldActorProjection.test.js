const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchProgressSnapshot = require('./WorldMarchProgressSnapshot');
const WorldActorProjection = require('./WorldActorProjection');

function createMission(overrides = {}) {
  return {
    id: 'explore-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'idle',
    origin: { q: 2, r: 0, tileId: 'tile_2_0' },
    homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
    target: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true },
      { q: 0, r: 0, tileId: 'tile_0_0', step: 2, revealed: true },
    ],
    formation: { cityId: 'capital', slot: 1, memberIds: ['fp-1'] },
    stepDurationSeconds: 10,
    startedAt: '2026-06-06T00:00:20.000Z',
    nextStepAt: null,
    completesAt: '2026-06-06T00:00:40.000Z',
    completedAt: '2026-06-06T00:00:41.000Z',
    ...overrides,
  };
}

test('WorldActorProjection keeps returned-home idle missions out of world actors', () => {
  const nowMs = new Date('2026-06-06T00:00:45.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    idleMissions: [createMission()],
  }, { nowMs });

  const actors = WorldActorProjection.projectWorldActors(snapshot, { nowMs });

  assert.equal(snapshot.counts.missions, 1);
  assert.equal(snapshot.counts.idle, 1);
  assert.equal(WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1').position.tileId, 'tile_0_0');
  assert.deepEqual(actors, []);
});

test('WorldActorProjection canonicalizes coord keys through stable axes', () => {
  assert.equal(
    WorldActorProjection.coordKey({ x: 2, y: -1, q: 99, r: 99, tileId: 'legacy-away' }),
    'tile_2_-1',
  );
});

test('WorldActorProjection treats returned-home idle rows with stale tile ids as garrisoned', () => {
  const row = {
    id: 'returned-with-stale-id',
    status: 'idle',
    current: { x: 0, y: 0, tileId: 'legacy-away' },
    position: { x: 0, y: 0, tileId: 'legacy-away' },
    target: { x: 0, y: 0, tileId: 'legacy-away' },
    homeOrigin: { x: 0, y: 0, tileId: 'legacy-home' },
    routeLength: 0,
  };

  assert.equal(WorldActorProjection.getProjectionKind(row), 'garrisonedAtHome');
  assert.equal(WorldActorProjection.shouldRenderWorldActor(row), false);
  assert.equal(WorldActorProjection.projectActorFromProgress(row), null);
});

test('WorldActorProjection keeps away-from-home idle missions as parked world actors', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    idleMissions: [createMission({
      origin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      position: { q: 2, r: 0, tileId: 'tile_2_0' },
      route: [
        { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true },
        { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: true },
      ],
    })],
  }, { nowMs });

  const actors = WorldActorProjection.projectWorldActors(snapshot, { nowMs });

  assert.equal(actors.length, 1);
  assert.equal(actors[0].id, 'explore-1');
  assert.equal(actors[0].status, 'idle');
  assert.equal(actors[0].current.tileId, 'tile_2_0');
  assert.equal(actors[0].projection.kind, 'parkedAwayFromHome');
});

test('WorldActorProjection renders active returning missions until they arrive home', () => {
  const nowMs = new Date('2026-06-06T00:00:25.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    missions: [createMission({
      status: 'active',
      position: { q: 2, r: 0, tileId: 'tile_2_0' },
      startedAt: '2026-06-06T00:00:20.000Z',
      nextStepAt: '2026-06-06T00:00:30.000Z',
      completesAt: '2026-06-06T00:00:40.000Z',
      completedAt: null,
    })],
  }, { nowMs });

  const actors = WorldActorProjection.projectWorldActors(snapshot, { nowMs });

  assert.equal(actors.length, 1);
  assert.equal(actors[0].status, 'active');
  assert.equal(actors[0].projection.kind, 'worldRoute');
});

test('WorldActorProjection keeps expired active manual march visible when parked away from home', () => {
  const nowMs = new Date('2026-06-06T00:00:45.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    missions: [createMission({
      status: 'active',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      homeOrigin: { q: 0, r: 0, tileId: 'tile_0_0', cityId: 'capital' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      position: { q: 1, r: 0, tileId: 'tile_1_0' },
      route: [
        { q: 1, r: 0, tileId: 'tile_1_0', step: 1, revealed: true },
        { q: 2, r: 0, tileId: 'tile_2_0', step: 2, revealed: true },
      ],
      startedAt: '2026-06-06T00:00:20.000Z',
      nextStepAt: '2026-06-06T00:00:40.000Z',
      completesAt: '2026-06-06T00:00:40.000Z',
      completedAt: null,
    })],
  }, { nowMs });

  const row = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const actors = WorldActorProjection.projectWorldActors(snapshot, { nowMs });

  assert.equal(row.status, 'idle');
  assert.equal(row.rawStatus, 'active');
  assert.equal(row.current.tileId, 'tile_2_0');
  assert.equal(actors.length, 1);
  assert.equal(actors[0].status, 'idle');
  assert.equal(actors[0].current.tileId, 'tile_2_0');
  assert.equal(actors[0].projection.kind, 'parkedAwayFromHome');
});

test('WorldActorProjection keeps expired active return-home mission hidden at home', () => {
  const nowMs = new Date('2026-06-06T00:00:45.000Z').getTime();
  const snapshot = WorldMarchProgressSnapshot.createSnapshot({
    missions: [createMission({
      status: 'active',
      position: { q: 1, r: 0, tileId: 'tile_1_0' },
      startedAt: '2026-06-06T00:00:20.000Z',
      nextStepAt: '2026-06-06T00:00:40.000Z',
      completesAt: '2026-06-06T00:00:40.000Z',
      completedAt: null,
    })],
  }, { nowMs });

  const row = WorldMarchProgressSnapshot.getMission(snapshot, 'explore-1');
  const actors = WorldActorProjection.projectWorldActors(snapshot, { nowMs });

  assert.equal(row.status, 'idle');
  assert.equal(row.rawStatus, 'active');
  assert.equal(row.current.tileId, 'tile_0_0');
  assert.deepEqual(actors, []);
});

test('WorldActorProjection projects active combat encounters as hostile world actors', () => {
  const actors = WorldActorProjection.projectWorldActors({
    combat: {
      activeEncounters: [{
        id: 'hostile_force_capital_ridge',
        status: 'active',
        kind: 'hostileForce',
        name: 'Frontier Patrol',
        q: 2,
        r: -1,
        tileId: 'tile_2_-1',
        terrain: 'forest',
        unitKey: 'hostile_squad_default',
        defender: { soldiers: 40 },
        battleTarget: { source: 'world-combat' },
      }],
    },
  });

  assert.equal(actors.length, 1);
  assert.equal(actors[0].id, 'hostile_force_capital_ridge');
  assert.equal(actors[0].type, 'hostileForce');
  assert.equal(actors[0].unitKey, 'hostile_squad_default');
  assert.equal(actors[0].name, 'Frontier Patrol');
  assert.equal(actors[0].nameKey, '');
  assert.equal(actors[0].current.tileId, 'tile_2_-1');
  assert.equal(actors[0].combatTarget.encounterId, 'hostile_force_capital_ridge');
  assert.equal(actors[0].combatTarget.defender.soldiers, 40);
});

test('WorldActorProjection exposes locale keys for unnamed hostile encounters', () => {
  const actors = WorldActorProjection.projectWorldActors({
    combat: {
      activeEncounters: [
        {
          id: 'hostile_force_unnamed',
          status: 'active',
          q: 1,
          r: 0,
          defender: { soldiers: 20 },
        },
      ],
    },
  });

  assert.equal(actors.length, 1);
  assert.equal(actors[0].name, '');
  assert.equal(actors[0].nameKey, 'world.combat.hostileForce.title');
  assert.equal(actors[0].combatTarget.nameKey, 'world.combat.hostileForce.title');
});
