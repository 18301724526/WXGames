const test = require('node:test');
const assert = require('node:assert/strict');

const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');

const CAMP_SEED = 'combat-camp-seed';

function createCampGameState() {
  const gameState = {
    worldMap: { seed: CAMP_SEED, origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', q: 0, r: 0 }],
    activeCityId: 'capital',
    cities: {
      capital: {
        id: 'capital',
        resources: { food: 100, wood: 100, knowledge: 100, iron: 0 },
      },
    },
    resources: null,
    worldCombat: { encounters: [] },
  };
  // Mirror the top-level alias the rest of the backend maintains.
  gameState.resources = gameState.cities.capital.resources;
  return gameState;
}

function getFirstCamp(gameState, now) {
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  return gameState.worldCombat.encounters.find((encounter) => encounter.campArchetypeKey);
}

test('getClientState exposes a localizable nameKey on the seeded hostile encounter', () => {
  const clientState = WorldCombatEncounterService.getClientState({}, new Date());
  const encounter = (clientState.activeEncounters || [])[0];
  assert.ok(encounter, 'expected a seeded active encounter');
  assert.equal(encounter.name, 'Frontier Patrol');
  assert.equal(encounter.nameKey, 'world.combat.encounter.frontierPatrol');
});

test('getClientState backfills nameKey for legacy encounters that only stored an English name', () => {
  const clientState = WorldCombatEncounterService.getClientState(
    {
      worldCombat: {
        encounters: [
          {
            id: 'hostile_force_capital_ridge',
            kind: 'hostileForce',
            status: 'active',
            name: 'Frontier Patrol',
            q: 2,
            r: -1,
            defender: { soldiers: 40 },
          },
        ],
      },
    },
    new Date(),
  );
  const encounter = (clientState.activeEncounters || []).find(
    (entry) => entry.id === 'hostile_force_capital_ridge',
  );
  assert.ok(encounter, 'expected the legacy encounter to survive normalization');
  // The client DTO must carry nameKey so the renderer can localize it (was leaking "Frontier Patrol").
  assert.equal(encounter.nameKey, 'world.combat.encounter.frontierPatrol');
});

test('normalizeEncounter passes through the camp fields with inert defaults for legacy encounters', () => {
  const legacy = WorldCombatEncounterService.normalizeEncounter(
    { id: 'legacy', q: 3, r: 3, defender: { soldiers: 12 } },
    {},
    new Date(),
  );
  assert.equal(legacy.campArchetypeKey, null);
  assert.equal(legacy.lootTable, null);
  assert.equal(legacy.respawnCooldownMs, 0);
  assert.equal(legacy.respawnAt, null);

  const camp = WorldCombatEncounterService.normalizeEncounter(
    {
      id: 'camp_5_5',
      q: 5,
      r: 5,
      campArchetypeKey: 'raiders',
      lootTable: { food: 60, wood: 45 },
      respawnCooldownMs: 60000,
      respawnAt: '2026-07-05T00:01:00.000Z',
      defender: { soldiers: 80, baseSoldiers: 80 },
    },
    {},
    new Date(),
  );
  assert.equal(camp.campArchetypeKey, 'raiders');
  assert.deepEqual(camp.lootTable, { food: 60, wood: 45 });
  assert.equal(camp.respawnCooldownMs, 60000);
  assert.equal(camp.respawnAt, '2026-07-05T00:01:00.000Z');
  assert.equal(camp.defender.baseSoldiers, 80);
});

test('normalizeCombatState seeds the deterministic camps alongside the legacy stub', () => {
  const gameState = createCampGameState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  const state = WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const stub = state.encounters.find((e) => e.id === WorldCombatEncounterService.ENCOUNTER_ID);
  const camps = state.encounters.filter((e) => e.campArchetypeKey);
  assert.ok(stub, 'legacy stub must remain');
  assert.ok(camps.length > 0, 'camps must be seeded');
  // Idempotent: a second normalize keeps the same encounter count.
  const before = state.encounters.length;
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  assert.equal(gameState.worldCombat.encounters.length, before);
});

test('respawnAt gating keeps a resolved camp resolved until its cooldown elapses', () => {
  const gameState = createCampGameState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  const camp = getFirstCamp(gameState, now);
  assert.ok(camp, 'expected a seeded camp');
  camp.status = 'resolved';
  camp.defender.soldiers = 0;
  camp.resolvedAt = now.toISOString();
  camp.respawnAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  // Still inside the cooldown window: stays resolved.
  const midCooldown = new Date(now.getTime() + 10 * 60 * 1000);
  WorldCombatEncounterService.normalizeCombatState(gameState, midCooldown);
  const stillResolved = gameState.worldCombat.encounters.find((e) => e.id === camp.id);
  assert.equal(stillResolved.status, 'resolved');
  assert.equal(stillResolved.defender.soldiers, 0);

  // Past the cooldown: reactivates with the original garrison restored.
  const afterCooldown = new Date(now.getTime() + 31 * 60 * 1000);
  WorldCombatEncounterService.normalizeCombatState(gameState, afterCooldown);
  const revived = gameState.worldCombat.encounters.find((e) => e.id === camp.id);
  assert.equal(revived.status, 'active');
  assert.equal(revived.defender.soldiers, revived.defender.baseSoldiers);
  assert.equal(revived.respawnAt, null);
  assert.equal(revived.battleReport, null);
  assert.equal(revived.resolvedAt, null);
});

test('a camp victory grants loot and sets the respawn cooldown', () => {
  const gameState = createCampGameState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  const camp = getFirstCamp(gameState, now);
  assert.ok(camp, 'expected a seeded camp');
  // Weaken the garrison so the overwhelming attacker deterministically wins.
  camp.defender.soldiers = 1;
  camp.defender.leader = null;
  const foodBefore = gameState.resources.food;
  const lootTable = { ...camp.lootTable };

  const mission = {
    id: 'mission_camp',
    formationSnapshot: {
      slot: 1,
      members: [{ personId: 'p1', soldiersCommitted: 500, soldiersRemaining: 500 }],
    },
  };
  const result = WorldCombatEncounterService.resolveEncounterBattle(gameState, mission, camp, now);
  assert.ok(result, 'expected a battle result');
  assert.equal(result.winner, 'attacker');
  assert.equal(camp.status, 'resolved');
  // Loot was credited via the canonical city-resource entry (top-level alias sees it too).
  assert.equal(gameState.resources.food, foodBefore + (lootTable.food || 0));
  assert.deepEqual(result.battleReport.loot, awardedSubset(lootTable));
  // respawnAt is set to now + cooldown.
  assert.equal(camp.respawnAt, new Date(now.getTime() + camp.respawnCooldownMs).toISOString());
});

// The loot report only reflects positive, valid resource keys that were actually granted.
function awardedSubset(lootTable) {
  const granted = {};
  ['food', 'wood', 'knowledge', 'iron', 'stone', 'metal'].forEach((key) => {
    const amount = Number(lootTable[key]) || 0;
    if (amount > 0) granted[key] = Math.floor(amount);
  });
  return granted;
}

test('the legacy stub still respawns unconditionally (no cooldown regression)', () => {
  const gameState = createCampGameState();
  const now = new Date('2026-07-05T00:00:00.000Z');
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const stub = gameState.worldCombat.encounters.find(
    (e) => e.id === WorldCombatEncounterService.ENCOUNTER_ID,
  );
  stub.status = 'resolved';
  stub.defender.soldiers = 0;
  // No respawnAt on the stub: it must revive immediately on the next normalize.
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const revived = gameState.worldCombat.encounters.find(
    (e) => e.id === WorldCombatEncounterService.ENCOUNTER_ID,
  );
  assert.equal(revived.status, 'active');
  assert.ok(revived.defender.soldiers > 0);
});

test('WorldCampSpawner is not required for the stub to exist (rollback safety)', () => {
  // Without ever calling seedCampEncounters, normalizeEncounter still yields the stub.
  const gameState = { worldMap: { seed: CAMP_SEED } };
  const seeded = WorldCampSpawner.planCamps(CAMP_SEED, { q: 0, r: 0 });
  assert.ok(Array.isArray(seeded));
  const client = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.ok(
    client.encounters.some((e) => e.id === WorldCombatEncounterService.ENCOUNTER_ID),
    'stub must survive independent of camp spawning',
  );
});
