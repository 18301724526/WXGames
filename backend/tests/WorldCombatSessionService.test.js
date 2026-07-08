const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const WorldCombatSessionService = require('../services/worldCombat/WorldCombatSessionService');
const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');
const WorldMapService = require('../services/WorldMapService');
const { WorldEncounterRepository } = require('../repositories/WorldEncounterRepository');

const SEED = 'combat-session-seed';

function createSharedCamp(overrides = {}, now = new Date('2026-07-05T00:00:00.000Z')) {
  const spec = WorldCampSpawner.planCamps(SEED, { q: 0, r: 0 }, {
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  })[0];
  const base = WorldCampSpawner.campSpecToEncounter(spec, now);
  return {
    ...base,
    ...overrides,
    defender: {
      ...base.defender,
      ...(overrides.defender || {}),
    },
  };
}

function createGameState({
  missionAtCamp = true,
  attackerSoldiers = 500,
  defenderSoldiers = null,
  attackerForce = 60,
} = {}) {
  const db = new Database(':memory:');
  const repo = new WorldEncounterRepository(db, { worldSeed: SEED });
  repo.init();
  const now = new Date('2026-07-05T00:00:00.000Z');
  const camp = repo.upsertEncounter(createSharedCamp({
    ...(defenderSoldiers != null ? { defender: { soldiers: defenderSoldiers } } : {}),
  }, now), now);
  const gameState = {
    playerId: 'session-player',
    worldMap: { seed: SEED, origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', q: 0, r: 0, owner: 'player', status: 'occupied' }],
    activeCityId: 'capital',
    cities: { capital: { id: 'capital', resources: { food: 100, wood: 100, knowledge: 100 } } },
    resources: null,
    famousPeople: [
      { id: 'hero-1', name: 'Test Hero', attributes: { force: attackerForce, command: 55 } },
    ],
    worldCombat: {},
    exploreMissions: [],
  };
  gameState.resources = gameState.cities.capital.resources;

  const campTileId = camp.tileId || WorldMapService.getTileId(camp.q, camp.r);
  const position = missionAtCamp
    ? { q: camp.q, r: camp.r, tileId: campTileId }
    : { q: 0, r: 0, tileId: WorldMapService.getTileId(0, 0) };

  gameState.exploreMissions = [
    {
      id: 'mission-attacker',
      status: 'idle',
      position,
      homeOrigin: { q: 0, r: 0, tileId: WorldMapService.getTileId(0, 0) },
      origin: { q: 0, r: 0, tileId: WorldMapService.getTileId(0, 0) },
      stepDurationMs: 20000,
      formation: { cityId: 'capital', slot: 1 },
      formationSnapshot: {
        schema: 'formation-snapshot-v1',
        cityId: 'capital',
        slot: 1,
        soldiersCommitted: attackerSoldiers,
        soldiersRemaining: attackerSoldiers,
        members: [
          {
            personId: 'hero-1',
            soldiersCommitted: attackerSoldiers,
            soldiersRemaining: attackerSoldiers,
          },
        ],
      },
    },
  ];
  return { db, repo, gameState, camp };
}

test('openSession refuses to attack a camp from afar (must march there first)', () => {
  const { db, repo, gameState, camp } = createGameState({ missionAtCamp: false });
  try {
    const result = WorldCombatSessionService.openSession(gameState, {
      formationSlot: 1,
      cityId: 'capital',
      targetQ: camp.q,
      targetR: camp.r,
    }, new Date(), { worldEncounterRepo: repo });
    assert.equal(result.success, false);
    assert.equal(result.error, 'WORLD_COMBAT_NOT_IN_RANGE');
    assert.equal(gameState.worldCombat.session, null);
  } finally {
    db.close();
  }
});

test('openSession allows the attack when the formation is standing on the shared camp tile', () => {
  const { db, repo, gameState, camp } = createGameState({ missionAtCamp: true });
  try {
    const result = WorldCombatSessionService.openSession(gameState, {
      missionId: 'mission-attacker',
      formationSlot: 1,
      cityId: 'capital',
      targetQ: camp.q,
      targetR: camp.r,
    }, new Date(), { worldEncounterRepo: repo });
    assert.equal(result.success, true);
    assert.equal(typeof result.battleId, 'string');
    assert.ok(gameState.worldCombat.session);
  } finally {
    db.close();
  }
});

test('resolving an interactive camp victory updates shared status and player-only report/intel', () => {
  const { db, repo, gameState, camp } = createGameState({ missionAtCamp: true, defenderSoldiers: 1 });
  try {
    const opened = WorldCombatSessionService.openSession(gameState, {
      missionId: 'mission-attacker',
      formationSlot: 1,
      cityId: 'capital',
      targetQ: camp.q,
      targetR: camp.r,
    }, new Date(), { worldEncounterRepo: repo });
    assert.equal(opened.success, true);
    const foodBefore = gameState.resources.food;

    const resolved = WorldCombatSessionService.resolveSession(gameState, {
      battleId: opened.battleId,
      inputStream: [
        { tick: 0, type: 'order', side: 0, order: 'allOut' },
        { tick: 0, type: 'order', side: 1, order: 'allOut' },
      ],
    }, new Date(), { worldEncounterRepo: repo });

    assert.equal(resolved.success, true);
    assert.equal(resolved.report.result, 'victory');
    assert.ok(resolved.report.loot && Object.keys(resolved.report.loot).length > 0, 'expected loot');
    assert.equal(gameState.resources.food > foodBefore, true, 'loot food credited');
    assert.equal(gameState.worldCombat.recentReports.length, 1);
    assert.equal(gameState.worldCombat.encounterIntel.byEncounterId[camp.id].battleReportId, resolved.report.id);

    const stored = repo.getEncounter(camp.id, { refreshRespawns: false });
    assert.equal(stored.status, 'resolved');
    assert.equal(typeof stored.respawnAt, 'string');
    assert.equal(stored.battleReport, undefined);
  } finally {
    db.close();
  }
});

test('a victory does NOT send the formation home: the squad idles on the cleared tile', () => {
  const { db, repo, gameState, camp } = createGameState({ missionAtCamp: true, defenderSoldiers: 1 });
  try {
    const opened = WorldCombatSessionService.openSession(gameState, {
      missionId: 'mission-attacker',
      formationSlot: 1,
      cityId: 'capital',
      targetQ: camp.q,
      targetR: camp.r,
    }, new Date(), { worldEncounterRepo: repo });
    const resolved = WorldCombatSessionService.resolveSession(gameState, {
      battleId: opened.battleId,
      inputStream: [
        { tick: 0, type: 'order', side: 0, order: 'allOut' },
        { tick: 0, type: 'order', side: 1, order: 'allOut' },
      ],
    }, new Date(), { worldEncounterRepo: repo });
    assert.equal(resolved.winner, 'attacker');
    const mission = gameState.exploreMissions[0];
    assert.equal(mission.status, 'idle');
    assert.equal((mission.route || []).length, 0);
    assert.equal(mission.position.tileId, camp.tileId || WorldMapService.getTileId(camp.q, camp.r));
  } finally {
    db.close();
  }
});

test('a non-victory with survivors sends the formation home and leaves the shared camp active', () => {
  const { db, repo, gameState, camp } = createGameState({
    missionAtCamp: true,
    attackerSoldiers: 60,
    attackerForce: 40,
    defenderSoldiers: 400,
  });
  try {
    const opened = WorldCombatSessionService.openSession(gameState, {
      missionId: 'mission-attacker',
      formationSlot: 1,
      cityId: 'capital',
      targetQ: camp.q,
      targetR: camp.r,
    }, new Date(), { worldEncounterRepo: repo });
    const resolved = WorldCombatSessionService.resolveSession(gameState, {
      battleId: opened.battleId,
      inputStream: [],
    }, new Date(), { worldEncounterRepo: repo });
    assert.notEqual(resolved.winner, 'attacker');
    assert.ok(resolved.attackerSnapshot.soldiersRemaining > 0, 'expected surviving soldiers');
    const mission = gameState.exploreMissions[0];
    assert.equal(mission.status, 'active');
    assert.ok((mission.route || []).length > 0, 'expected a return route');
    assert.equal(mission.target.tileId, WorldMapService.getTileId(0, 0));
    assert.equal(mission.combat.status, 'resolved');
    assert.equal(repo.getEncounter(camp.id, { refreshRespawns: false }).status, 'active');
  } finally {
    db.close();
  }
});
