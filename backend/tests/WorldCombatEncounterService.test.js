const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');
const WorldMapService = require('../services/WorldMapService');
const GameStateRepository = require('../repositories/GameStateRepository');
const { WorldEncounterRepository } = require('../repositories/WorldEncounterRepository');
const { DEFAULT_WORLD_SEED } = require('../services/worldMap/WorldMapConstants');

const CAMP_SEED = 'combat-camp-seed';

function createPlayerState(playerId = 'player-a') {
  const gameState = {
    playerId,
    worldMap: { seed: CAMP_SEED, origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', q: 0, r: 0, owner: 'player', status: 'occupied' }],
    activeCityId: 'capital',
    cities: {
      capital: {
        id: 'capital',
        resources: { food: 100, wood: 100, knowledge: 100, iron: 0 },
      },
    },
    resources: null,
    famousPeople: [{ id: 'hero-1', name: 'Test Hero', attributes: { force: 90, command: 80 } }],
    worldCombat: {},
    exploreMissions: [],
  };
  gameState.resources = gameState.cities.capital.resources;
  return gameState;
}

function createSharedCamp(overrides = {}, now = new Date('2026-07-05T00:00:00.000Z')) {
  const spec = WorldCampSpawner.planCamps(CAMP_SEED, { q: 0, r: 0 }, {
    densityRoll: 1,
    minSpacing: 1,
    chooseTerrain: () => 'plains',
  })[0];
  assert.ok(spec, 'expected a camp spec');
  return WorldCombatEncounterService.normalizeEncounter(
    {
      ...WorldCampSpawner.campSpecToEncounter(spec, now),
      ...overrides,
      defender: {
        ...WorldCampSpawner.campSpecToEncounter(spec, now).defender,
        ...(overrides.defender || {}),
      },
    },
    createPlayerState(),
    now,
  );
}

function projectCombat(gameState, encounters, now = new Date('2026-07-05T00:00:00.000Z')) {
  return WorldCombatEncounterService.getClientState(gameState, now, {
    sharedWorldEncounters: encounters,
  });
}

test('normalizeCombatState clears legacy private encounters and keeps only player intel', () => {
  const gameState = createPlayerState();
  gameState.worldCombat = {
    encounters: [
      {
        id: 'camp_legacy',
        q: 3,
        r: 3,
        battleReport: { id: 'report_legacy', createdAt: '2026-07-05T00:00:00.000Z' },
      },
    ],
    recentReports: [{ id: 'report_legacy', report: { id: 'report_legacy' } }],
  };

  const state = WorldCombatEncounterService.normalizeCombatState(gameState);

  assert.equal(Object.prototype.hasOwnProperty.call(state, 'encounters'), false);
  assert.equal(state.recentReports.length, 1);
  assert.equal(state.encounterIntel.byEncounterId.camp_legacy.battleReportId, 'report_legacy');
});

test('getClientState projects shared encounters by current player vision, not save-state ownership', () => {
  const camp = createSharedCamp();
  const gameState = createPlayerState();

  const visible = projectCombat(gameState, [camp]);
  assert.equal(visible.activeEncounters.some((entry) => entry.id === camp.id), true);

  gameState.territories = [];
  gameState.worldMap.tiles = [{ q: camp.q, r: camp.r, visibility: 'scouted', visible: true }];
  const hidden = projectCombat(gameState, [camp]);
  assert.equal(hidden.activeEncounters.some((entry) => entry.id === camp.id), false);
});

test('another player occupied shared territory cannot become my vision source', () => {
  const camp = createSharedCamp({ q: 8, r: 8, tileId: WorldMapService.getTileId(8, 8) });
  const gameState = createPlayerState('player-a');
  gameState.territories = [{
    id: 'other_city',
    x: 8,
    y: 8,
    owner: 'player',
    ownerPlayerId: 'player-b',
    status: 'occupied',
  }];

  const hidden = projectCombat(gameState, [camp]);
  assert.equal(hidden.activeEncounters.some((entry) => entry.id === camp.id), false);

  gameState.territories[0].ownerPlayerId = 'player-a';
  const visible = projectCombat(gameState, [camp]);
  assert.equal(visible.activeEncounters.some((entry) => entry.id === camp.id), true);
});

test('battle intel is player-private; shared encounter does not leak defender strength', () => {
  const camp = createSharedCamp({
    defender: { soldiers: 80, threat: 5, scale: 3, leader: { abilityKit: { abilities: [] } } },
  });
  const playerA = createPlayerState('player-a');
  const playerB = createPlayerState('player-b');
  playerA.exploreMissions = [{ id: 'probe-a', status: 'active', position: { q: camp.q, r: camp.r } }];
  playerB.exploreMissions = [{ id: 'probe-b', status: 'active', position: { q: camp.q, r: camp.r } }];
  playerA.worldCombat = {
    encounterIntel: {
      byEncounterId: {
        [camp.id]: {
          encounterId: camp.id,
          foughtAt: '2026-07-05T00:00:00.000Z',
          battleReportId: 'report-a',
        },
      },
    },
  };

  const aView = projectCombat(playerA, [camp]).activeEncounters.find((entry) => entry.id === camp.id);
  const bView = projectCombat(playerB, [camp]).activeEncounters.find((entry) => entry.id === camp.id);

  assert.ok(aView.defender, 'player A learned defender strength from their own fight');
  assert.equal(bView.defender, null, 'player B must not inherit player A intel');
  assert.equal(Boolean(camp.battleReport), false, 'shared encounter carries no battle report');
});

test('resolveEncounterBattle writes world status to the shared repository and reports to player state', () => {
  const db = new Database(':memory:');
  try {
    const repo = new WorldEncounterRepository(db, { worldSeed: CAMP_SEED });
    repo.init();
    const now = new Date('2026-07-05T00:00:00.000Z');
    const camp = repo.upsertEncounter(createSharedCamp({
      defender: { soldiers: 1, leader: null },
    }, now), now);
    const gameState = createPlayerState('player-a');
    const mission = {
      id: 'mission-camp',
      formationSnapshot: {
        slot: 1,
        members: [{ personId: 'hero-1', soldiersCommitted: 500, soldiersRemaining: 500 }],
      },
    };

    const result = WorldCombatEncounterService.resolveEncounterBattle(
      gameState,
      mission,
      camp,
      now,
      { worldEncounterRepo: repo },
    );

    assert.equal(result.winner, 'attacker');
    const stored = repo.getEncounter(camp.id, { refreshRespawns: false });
    assert.equal(stored.status, 'resolved');
    assert.equal(stored.defender.soldiers, 0);
    assert.equal(stored.battleReport, undefined);
    assert.equal(stored.resolvedByMissionId, undefined);
    assert.equal(gameState.worldCombat.recentReports.length, 1);
    assert.equal(gameState.worldCombat.encounterIntel.byEncounterId[camp.id].battleReportId, result.battleReport.id);
  } finally {
    db.close();
  }
});

test('WorldEncounterRepository respawns resolved camps as shared world state', () => {
  const db = new Database(':memory:');
  try {
    const repo = new WorldEncounterRepository(db, { worldSeed: CAMP_SEED });
    repo.init();
    const now = new Date('2026-07-05T00:00:00.000Z');
    const camp = createSharedCamp({
      status: 'resolved',
      defender: { soldiers: 0, baseSoldiers: 42 },
      resolvedAt: now.toISOString(),
      respawnAt: new Date(now.getTime() - 1000).toISOString(),
    }, now);
    repo.upsertEncounter(camp, now);

    const refreshed = repo.getEncounter(camp.id, { now: new Date(now.getTime() + 1000) });

    assert.equal(refreshed.status, 'active');
    assert.equal(refreshed.defender.soldiers, 42);
    assert.equal(refreshed.respawnAt, null);
  } finally {
    db.close();
  }
});

test('GameStateRepository projects the same shared encounters to two players and never saves them privately', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const playerA = createPlayerState('shared-encounter-a');
    const playerB = createPlayerState('shared-encounter-b');
    repository.save(playerA);
    repository.save(playerB);

    const idsA = repository.getClientProjectionForPlayer(playerA.playerId)
      .sharedWorldEncounters.map((encounter) => encounter.id).sort();
    const idsB = repository.getClientProjectionForPlayer(playerB.playerId)
      .sharedWorldEncounters.map((encounter) => encounter.id).sort();
    const savedA = repository.findByPlayerId(playerA.playerId);

    assert.ok(idsA.length > 0);
    assert.deepEqual(idsA, idsB);
    assert.equal(Boolean(savedA.worldCombat.encounters), false);
    assert.equal(idsA.length, repository.worldEncounterRepo.getAllEncounters().length);
  } finally {
    db.close();
  }
});

test('resolveEngagedTimeouts settles an arrived mission through the shared repository', () => {
  const db = new Database(':memory:');
  try {
    const repo = new WorldEncounterRepository(db, { worldSeed: CAMP_SEED });
    repo.init();
    const now = new Date('2026-07-05T00:00:00.000Z');
    const camp = repo.upsertEncounter(createSharedCamp({
      defender: { soldiers: 1, leader: null },
    }, now), now);
    const gameState = createPlayerState('player-timeout');
    gameState.exploreMissions = [{
      id: 'mission-timeout',
      status: 'idle',
      position: { q: camp.q, r: camp.r, tileId: camp.tileId },
      target: { q: camp.q, r: camp.r, tileId: camp.tileId },
      formationSnapshot: {
        slot: 1,
        members: [{ personId: 'hero-1', soldiersCommitted: 500, soldiersRemaining: 500 }],
      },
      combat: {
        encounterId: camp.id,
        status: 'engaged',
        engagedAt: now.toISOString(),
      },
    }];
    const timeoutAt = new Date(now.getTime() + WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS + 1);

    const settled = WorldCombatEncounterService.resolveEngagedTimeouts(gameState, timeoutAt, {
      worldEncounterRepo: repo,
    });

    assert.equal(settled, 1);
    assert.equal(gameState.exploreMissions[0].combat.status, 'resolved');
    assert.equal(repo.getEncounter(camp.id, { refreshRespawns: false }).status, 'resolved');
  } finally {
    db.close();
  }
});
