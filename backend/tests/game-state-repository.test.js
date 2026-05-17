const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const GameStateRepository = require('../repositories/GameStateRepository');

function insertPlayer(db, playerId, deviceId) {
  db.prepare(`
    INSERT INTO players (playerId, deviceId, token, createdAt, lastActiveAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(playerId, deviceId, `${playerId}-token`, new Date().toISOString(), new Date().toISOString());
}

function insertGameState(db, playerId) {
  db.prepare(`
    INSERT INTO game_states (
      playerId, resources, buildings, population, techs, techEffects, currentEra,
      eraHistory, happiness, gameDay, eventQueue, eventHistory, offlineSnapshot,
      offlineEventLog, negativeStreak, lastEventAt, tutorial, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    playerId,
    '{}',
    '{}',
    '{}',
    '{}',
    '{}',
    0,
    '[]',
    100,
    1,
    '[]',
    '[]',
    '{}',
    '[]',
    0,
    0,
    '{"completed":false,"currentStep":0}',
    new Date().toISOString(),
  );
}

test('findAll 只返回仍存在于 players 表中的玩家状态', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  insertPlayer(db, 'player-live', 'device-live');
  insertGameState(db, 'player-live');
  insertGameState(db, 'player-orphan');

  const result = repository.findAll();

  assert.equal(result.length, 1);
  assert.equal(result[0].playerId, 'player-live');

  db.close();
});

test('save and findByPlayerId round-trip military state', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  insertPlayer(db, 'player-military', 'device-military');
  repository.save({
    playerId: 'player-military',
    resources: {},
    buildings: {},
    population: {},
    techs: {},
    techEffects: {},
    currentEra: 3,
    eraHistory: [],
    happiness: 100,
    gameDay: 1,
    eventQueue: [],
    eventHistory: [],
    offlineSnapshot: {},
    offlineEventLog: [],
    negativeStreak: 0,
    lastEventAt: 0,
    tutorial: { completed: true, currentStep: 0 },
    softGuideState: {},
    military: {
      soldiers: 2,
      soldierCap: 5,
      trainingProgress: 12,
      trainingIntervalSeconds: 30,
      defensePerSoldier: 1,
      defense: 2,
    },
  });

  const result = repository.findByPlayerId('player-military');

  assert.deepEqual(result.military, {
    soldiers: 2,
    soldierCap: 5,
    trainingProgress: 12,
    trainingIntervalSeconds: 30,
    defensePerSoldier: 1,
    defense: 2,
  });

  db.close();
});

test('save and findByPlayerId round-trip regular event state and active buffs', () => {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();

  insertPlayer(db, 'player-events', 'device-events');
  repository.save({
    playerId: 'player-events',
    resources: {},
    buildings: {},
    population: {},
    techs: {},
    techEffects: {},
    currentEra: 2,
    eraHistory: [],
    happiness: 100,
    gameDay: 1,
    eventQueue: [],
    eventHistory: [],
    regularEventState: {
      nextAt: '2026-05-17T08:04:00.000Z',
      lastGeneratedAt: '2026-05-17T08:00:00.000Z',
      generatedCount: 2,
      recentTemplateIds: ['harvest_sign'],
    },
    threatEventState: {
      nextAt: '2026-05-17T08:06:00.000Z',
      lastGeneratedAt: '2026-05-17T08:00:00.000Z',
      generatedCount: 1,
      recentTemplateIds: ['border_probe'],
    },
    activeBuffs: [
      {
        id: 'buff-food',
        type: 'resourceMultiplier',
        target: 'food',
        value: 0.2,
        expiresAt: '2026-05-17T08:05:00.000Z',
        label: '丰收庆祝',
      },
    ],
    offlineSnapshot: {},
    offlineEventLog: [],
    negativeStreak: 0,
    lastEventAt: 0,
    tutorial: { completed: true, currentStep: 15 },
    softGuideState: {},
    military: {},
    polity: { name: '赤火联盟', namePrompted: true, capitalCityName: '火种城' },
    territories: [{ id: 'capital', cityName: '火种城', status: 'occupied' }],
    warMissions: [{ id: 'mission-x', territoryId: 'river_plain', soldiersCommitted: 4, status: 'active' }],
  });

  const result = repository.findByPlayerId('player-events');

  assert.deepEqual(result.regularEventState, {
    nextAt: '2026-05-17T08:04:00.000Z',
    lastGeneratedAt: '2026-05-17T08:00:00.000Z',
    generatedCount: 2,
    recentTemplateIds: ['harvest_sign'],
  });
  assert.deepEqual(result.threatEventState, {
    nextAt: '2026-05-17T08:06:00.000Z',
    lastGeneratedAt: '2026-05-17T08:00:00.000Z',
    generatedCount: 1,
    recentTemplateIds: ['border_probe'],
  });
  assert.deepEqual(result.activeBuffs, [
    {
      id: 'buff-food',
      type: 'resourceMultiplier',
      target: 'food',
      value: 0.2,
      expiresAt: '2026-05-17T08:05:00.000Z',
      label: '丰收庆祝',
    },
  ]);
  assert.deepEqual(result.polity, { name: '赤火联盟', namePrompted: true, capitalCityName: '火种城' });
  assert.deepEqual(result.territories, [{ id: 'capital', cityName: '火种城', status: 'occupied' }]);
  assert.deepEqual(result.warMissions, [{ id: 'mission-x', territoryId: 'river_plain', soldiersCommitted: 4, status: 'active' }]);

  db.close();
});
