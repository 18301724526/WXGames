const test = require('node:test');
const assert = require('node:assert/strict');

const WorldCombatSessionService = require('../services/worldCombat/WorldCombatSessionService');
const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const WorldMapService = require('../services/WorldMapService');

const SEED = 'combat-session-seed';

// A camp encounter plus an idle mission whose formation is a real attacking squad. The
// mission position is a parameter so we can place the squad ON or OFF the camp tile.
function createGameState({ missionAtCamp = true } = {}) {
  const gameState = {
    worldMap: { seed: SEED, origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', q: 0, r: 0 }],
    activeCityId: 'capital',
    cities: { capital: { id: 'capital', resources: { food: 100, wood: 100, knowledge: 100 } } },
    resources: null,
    famousPeople: [{ id: 'hero-1', name: 'Test Hero', attributes: { force: 60, command: 55 } }],
    worldCombat: { encounters: [] },
    exploreMissions: [],
  };
  gameState.resources = gameState.cities.capital.resources;

  WorldCombatEncounterService.normalizeCombatState(gameState, new Date());
  const camp = gameState.worldCombat.encounters.find((e) => e.campArchetypeKey);
  const campTileId = camp.tileId || WorldMapService.getTileId(camp.q, camp.r);

  const position = missionAtCamp
    ? { q: camp.q, r: camp.r, tileId: campTileId }
    : { q: 0, r: 0, tileId: WorldMapService.getTileId(0, 0) };

  gameState.exploreMissions = [
    {
      id: 'mission-attacker',
      status: 'idle',
      position,
      formation: { cityId: 'capital', slot: 1 },
      formationSnapshot: {
        schema: 'formation-snapshot-v1',
        cityId: 'capital',
        slot: 1,
        soldiersCommitted: 500,
        soldiersRemaining: 500,
        members: [{ personId: 'hero-1', soldiersCommitted: 500, soldiersRemaining: 500 }],
      },
    },
  ];
  return { gameState, camp };
}

test('openSession refuses to attack a camp from afar (must march there first)', () => {
  const { gameState, camp } = createGameState({ missionAtCamp: false });
  const result = WorldCombatSessionService.openSession(gameState, {
    formationSlot: 1,
    cityId: 'capital',
    targetQ: camp.q,
    targetR: camp.r,
  });
  assert.equal(result.success, false);
  assert.equal(result.error, 'WORLD_COMBAT_NOT_IN_RANGE');
  assert.equal(gameState.worldCombat.session, null);
});

test('openSession allows the attack when the formation is standing on the camp tile', () => {
  const { gameState, camp } = createGameState({ missionAtCamp: true });
  const result = WorldCombatSessionService.openSession(gameState, {
    missionId: 'mission-attacker',
    formationSlot: 1,
    cityId: 'capital',
    targetQ: camp.q,
    targetR: camp.r,
  });
  assert.equal(result.success, true);
  assert.equal(typeof result.battleId, 'string');
  assert.ok(gameState.worldCombat.session);
});

test('resolving an interactive camp victory grants the same loot + respawn cooldown as the passive path', () => {
  const { gameState, camp } = createGameState({ missionAtCamp: true });
  const opened = WorldCombatSessionService.openSession(gameState, {
    missionId: 'mission-attacker',
    formationSlot: 1,
    cityId: 'capital',
    targetQ: camp.q,
    targetR: camp.r,
  });
  assert.equal(opened.success, true);
  const foodBefore = gameState.resources.food;

  // 500 soldiers vs a small camp with allOut orders => attacker wins.
  const resolved = WorldCombatSessionService.resolveSession(gameState, {
    battleId: opened.battleId,
    inputStream: [
      { tick: 0, type: 'order', side: 0, order: 'allOut' },
      { tick: 0, type: 'order', side: 1, order: 'allOut' },
    ],
  });
  assert.equal(resolved.success, true);
  assert.equal(resolved.report.result, 'victory');
  assert.ok(resolved.report.loot && Object.keys(resolved.report.loot).length > 0, 'expected loot');
  assert.equal(gameState.resources.food > foodBefore, true, 'loot food credited');

  const resolvedCamp = gameState.worldCombat.encounters.find((e) => e.id === camp.id);
  assert.equal(resolvedCamp.status, 'resolved');
  assert.equal(typeof resolvedCamp.respawnAt, 'string', 'respawn cooldown set');
});
