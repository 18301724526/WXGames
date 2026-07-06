const test = require('node:test');
const assert = require('node:assert/strict');

const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');
const WorldCampSpawner = require('../services/worldCombat/WorldCampSpawner');
const WorldMapService = require('../services/WorldMapService');

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

// Hostile encounters project only while inside the player's CURRENT vision (occupied cities +
// fielded march parties). For tests that assert on the projected DTO regardless of vision,
// normalize first then park a fielded vision probe on every encounter's coordinate.
function surfaceAllEncounters(gameState, now = new Date()) {
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  gameState.exploreMissions = [
    ...(gameState.exploreMissions || []),
    ...(gameState.worldCombat.encounters || []).map((encounter, index) => ({
      id: `vision_probe_${index}`,
      status: 'active',
      position: { q: encounter.q, r: encounter.r },
    })),
  ];
  return gameState;
}

test('getClientState exposes a localizable nameKey on the seeded hostile encounter', () => {
  const gameState = surfaceAllEncounters({}, new Date());
  const clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  const encounter = (clientState.activeEncounters || []).find(
    (entry) => entry.id === WorldCombatEncounterService.ENCOUNTER_ID,
  );
  assert.ok(encounter, 'expected a seeded active encounter');
  assert.equal(encounter.name, 'Frontier Patrol');
  assert.equal(encounter.nameKey, 'world.combat.encounter.frontierPatrol');
});

test('getClientState backfills nameKey for legacy encounters that only stored an English name', () => {
  const gameState = {
    // The capital-ridge stub sits at ring distance 2 — inside the capital's city vision.
    worldMap: { origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', x: 0, y: 0 }],
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
  };
  const clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  const encounter = (clientState.activeEncounters || []).find(
    (entry) => entry.id === 'hostile_force_capital_ridge',
  );
  assert.ok(encounter, 'expected the legacy encounter to survive normalization');
  // The client DTO must carry nameKey so the renderer can localize it (was leaking "Frontier Patrol").
  assert.equal(encounter.nameKey, 'world.combat.encounter.frontierPatrol');
});

// --- Current-vision gate: hostile encounters are LIVE units — visible only inside the player's
// current vision (cities + fielded parties), never via reveal history (anti through-fog leak) ---

// A gameState with NO worldMap.seed does not seed extra camps, so the only encounter is ours —
// letting us assert the vision gate in isolation (normalizeCombatState still keeps the legacy stub,
// but with no territories and no missions there is no vision source, so it is gated out too).
function createLoneEncounterState(extra = {}) {
  return {
    worldMap: { origin: { q: 0, r: 0 } },
    worldCombat: {
      encounters: [
        { id: 'camp_far', kind: 'hostileForce', status: 'active', q: 7, r: 7, defender: { soldiers: 40 } },
      ],
    },
    ...extra,
  };
}

test('an encounter inside a fielded party\'s current vision projects; after the party moves away it hides', () => {
  const gameState = createLoneEncounterState({
    exploreMissions: [{ id: 'm_scout', status: 'active', position: { q: 6, r: 7 } }], // Chebyshev 1 of (7,7)
  });
  let clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.equal(clientState.encounters.some((e) => e.id === 'camp_far'), true);
  assert.equal(clientState.activeEncounters.some((e) => e.id === 'camp_far'), true);

  // The party marches on — the camp leaves current vision and hides again (live-unit semantics).
  gameState.exploreMissions[0].position = { q: 2, r: 2 };
  clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.equal(clientState.encounters.some((e) => e.id === 'camp_far'), false);
  assert.equal(clientState.activeEncounters.some((e) => e.id === 'camp_far'), false);
  // Server-side encounter state is UNTOUCHED — the gate only filters the projection.
  assert.equal(gameState.worldCombat.encounters.some((e) => e.id === 'camp_far'), true);
  assert.equal(gameState.worldCombat.encounters.find((e) => e.id === 'camp_far').status, 'active');
});

test('a revealed-history tile alone (solid-fill shape) does NOT surface an encounter', () => {
  // The through-fog root cause: revealSolidKnownWorldTiles writes visible bridge tiles into
  // worldMap.tiles far beyond anything the player has actually seen. Reveal history must never
  // stand in for current vision.
  const gameState = createLoneEncounterState();
  gameState.worldMap.tiles = [{ q: 7, r: 7, visibility: 'scouted', visible: true }];
  const clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.equal(clientState.encounters.some((e) => e.id === 'camp_far'), false);
  assert.equal(clientState.activeEncounters.some((e) => e.id === 'camp_far'), false);
  assert.equal(gameState.worldCombat.encounters.some((e) => e.id === 'camp_far'), true);
});

test('an AI-explorer hidden tile does NOT surface an encounter', () => {
  const gameState = createLoneEncounterState();
  gameState.worldMap.tiles = [{ q: 7, r: 7, visibility: 'hidden', visible: false, discovered: true }];
  const clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.equal(clientState.encounters.some((e) => e.id === 'camp_far'), false);
});

test('an encounter inside an occupied city\'s vision projects; beyond the city radius it hides', () => {
  const inRange = createLoneEncounterState({
    territories: [{ id: 'city_east', x: 8, y: 8, owner: 'player', status: 'occupied' }], // Chebyshev 1
  });
  assert.equal(
    WorldCombatEncounterService.getClientState(inRange, new Date()).activeEncounters.some((e) => e.id === 'camp_far'),
    true,
  );

  const outOfRange = createLoneEncounterState({
    territories: [{ id: 'city_far', x: 10, y: 10, owner: 'player', status: 'occupied' }], // Chebyshev 3 > radius 2
  });
  assert.equal(
    WorldCombatEncounterService.getClientState(outOfRange, new Date()).activeEncounters.some((e) => e.id === 'camp_far'),
    false,
  );

  // A neutral (not occupied) city is nobody's eyes.
  const neutral = createLoneEncounterState({
    territories: [{ id: 'city_neutral', x: 8, y: 8, owner: 'neutral', status: 'discovered' }],
  });
  assert.equal(
    WorldCombatEncounterService.getClientState(neutral, new Date()).activeEncounters.some((e) => e.id === 'camp_far'),
    false,
  );
});

test('an engaged mission standing on the encounter keeps it visible (battle UI never loses its target)', () => {
  const gameState = createLoneEncounterState({
    exploreMissions: [{
      id: 'm_engaged',
      status: 'idle', // arrival already flipped the march idle …
      position: { q: 7, r: 7, tileId: 'tile_7_7' },
      combat: { status: 'engaged', encounterId: 'camp_far', engagedAt: new Date().toISOString() },
    }],
  });
  const clientState = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.equal(clientState.activeEncounters.some((e) => e.id === 'camp_far'), true);
});

// --- "打了才知道": defender strength withheld until the encounter has a battleReport ---

test('a revealed-but-unfought encounter projects NO defender strength (intel all false)', () => {
  const gameState = {
    worldMap: { origin: { q: 0, r: 0 } },
    exploreMissions: [{ id: 'm_probe', status: 'active', position: { q: 7, r: 7 } }],
    worldCombat: {
      encounters: [
        {
          id: 'camp_far',
          kind: 'hostileForce',
          status: 'active',
          q: 7,
          r: 7,
          defender: { soldiers: 80, threat: 5, scale: 3, leader: { abilityKit: { abilities: [] } } },
          battleReport: null,
        },
      ],
    },
  };
  const encounter = WorldCombatEncounterService.getClientState(gameState, new Date()).encounters.find(
    (e) => e.id === 'camp_far',
  );
  assert.equal(encounter.defender, null, 'defender detail must be withheld until fought');
  assert.equal(encounter.battleTarget.defender, null);
  assert.equal(encounter.battleTarget.site.threat, 0, 'threat/scale are 0 = unknown, not projected strength');
  assert.equal(encounter.battleTarget.site.scale, 0);
  const intel = encounter.battleTarget.intelSnapshot;
  assert.equal(intel.knownGarrison, false);
  assert.equal(intel.knownLeader, false);
  assert.equal(intel.knownSkill, false);
  // Non-strength facts stay known (needed to render/target the actor).
  assert.equal(intel.knownTerrain, true);
  assert.equal(intel.knownSite, true);
});

test('a fought encounter (battleReport present) projects the defender strength', () => {
  const gameState = {
    worldMap: { origin: { q: 0, r: 0 } },
    exploreMissions: [{ id: 'm_probe', status: 'active', position: { q: 7, r: 7 } }],
    worldCombat: {
      encounters: [
        {
          id: 'camp_far',
          kind: 'hostileForce',
          status: 'active',
          q: 7,
          r: 7,
          defender: { soldiers: 80, threat: 5, scale: 3, leader: { abilityKit: { abilities: [] } } },
          battleReport: { id: 'report_1', summary: 'fought' },
        },
      ],
    },
  };
  const encounter = WorldCombatEncounterService.getClientState(gameState, new Date()).encounters.find(
    (e) => e.id === 'camp_far',
  );
  assert.ok(encounter.defender, 'defender detail is known after a battle');
  assert.equal(encounter.defender.soldiers, 80);
  assert.equal(encounter.battleTarget.intelSnapshot.knownGarrison, true);
  assert.equal(encounter.battleTarget.intelSnapshot.knownLeader, true);
  assert.equal(encounter.battleTarget.intelSnapshot.knownSkill, true);
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
  // Park vision probes on the encounter tiles so the current-vision gate lets the projected stub
  // through (the stub exists in state regardless — this test is about state, not visibility).
  surfaceAllEncounters(gameState, new Date());
  const client = WorldCombatEncounterService.getClientState(gameState, new Date());
  assert.ok(
    client.encounters.some((e) => e.id === WorldCombatEncounterService.ENCOUNTER_ID),
    'stub must survive independent of camp spawning',
  );
});

// --- auto-engage + timeout fallback (2026-07-05) ---

// A camp encounter + an idle mission standing ON the camp tile, with a real attacking
// squad snapshot. Mirrors WorldCombatSessionService.test.js setup but shaped for the
// arrival/timeout hooks (mission.combat pre-tagged with the marching encounter).
function createEngagedGameState({ soldiers = 500 } = {}) {
  const gameState = {
    worldMap: { seed: 'combat-engage-seed', origin: { q: 0, r: 0 } },
    territories: [{ id: 'capital', q: 0, r: 0 }],
    activeCityId: 'capital',
    cities: { capital: { id: 'capital', resources: { food: 100, wood: 100, knowledge: 100 } } },
    resources: null,
    famousPeople: [{ id: 'hero-1', name: 'Test Hero', attributes: { force: 90, command: 80 } }],
    worldCombat: { encounters: [] },
    exploreMissions: [],
  };
  gameState.resources = gameState.cities.capital.resources;
  const now = new Date('2026-07-05T00:00:00.000Z');
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  const camp = gameState.worldCombat.encounters.find((e) => e.campArchetypeKey);
  // Weaken the garrison so the overwhelming attacker deterministically wins on allOut.
  camp.defender.soldiers = 1;
  camp.defender.leader = null;
  const campTileId = camp.tileId || WorldMapService.getTileId(camp.q, camp.r);
  gameState.exploreMissions = [
    {
      id: 'mission-attacker',
      status: 'idle',
      position: { q: camp.q, r: camp.r, tileId: campTileId },
      target: { q: camp.q, r: camp.r, tileId: campTileId },
      formation: { cityId: 'capital', slot: 1 },
      formationSnapshot: {
        schema: 'formation-snapshot-v1',
        cityId: 'capital',
        slot: 1,
        soldiersCommitted: soldiers,
        soldiersRemaining: soldiers,
        members: [{ personId: 'hero-1', soldiersCommitted: soldiers, soldiersRemaining: soldiers }],
      },
      combat: { encounterId: camp.id, status: 'marching', startedAt: now.toISOString() },
    },
  ];
  return { gameState, camp, now };
}

test('resolveMissionArrival marks the mission engaged and does NOT settle the battle', () => {
  const { gameState, camp, now } = createEngagedGameState();
  const mission = gameState.exploreMissions[0];
  const marker = WorldCombatEncounterService.resolveMissionArrival(gameState, mission, now);

  assert.ok(marker && marker.engaged === true, 'expected an engaged marker');
  assert.equal(marker.encounter.id, camp.id);
  assert.equal(mission.combat.status, 'engaged');
  assert.equal(mission.combat.encounterId, camp.id);
  assert.equal(typeof mission.combat.engagedAt, 'string');
  assert.equal(mission.combat.battleReportId, null);
  // No settlement: no report, camp still active at full (weakened) strength.
  assert.equal(gameState.worldCombat.recentReports.length, 0);
  const encounter = gameState.worldCombat.encounters.find((e) => e.id === camp.id);
  assert.equal(encounter.status, 'active');
});

test('resolveMissionArrival is idempotent: re-running does not re-arm engagedAt', () => {
  const { gameState, now } = createEngagedGameState();
  const mission = gameState.exploreMissions[0];
  WorldCombatEncounterService.resolveMissionArrival(gameState, mission, now);
  const firstEngagedAt = mission.combat.engagedAt;
  const later = new Date(now.getTime() + 10000);
  WorldCombatEncounterService.resolveMissionArrival(gameState, mission, later);
  assert.equal(mission.combat.engagedAt, firstEngagedAt, 'engagedAt must not reset on re-run');
  assert.equal(mission.combat.status, 'engaged');
});

test('resolveEngagedTimeouts force-settles an engaged mission only after the fallback window', () => {
  const { gameState, camp, now } = createEngagedGameState();
  const mission = gameState.exploreMissions[0];
  WorldCombatEncounterService.resolveMissionArrival(gameState, mission, now);

  // Inside the window: no settlement yet.
  const beforeWindow = new Date(
    now.getTime() + WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS - 1,
  );
  assert.equal(WorldCombatEncounterService.resolveEngagedTimeouts(gameState, beforeWindow), 0);
  assert.equal(mission.combat.status, 'engaged');

  // Past the window: allOut fallback settles it.
  const afterWindow = new Date(
    now.getTime() + WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS + 1,
  );
  assert.equal(WorldCombatEncounterService.resolveEngagedTimeouts(gameState, afterWindow), 1);
  assert.equal(mission.combat.status, 'resolved');
  assert.equal(Boolean(mission.combat.battleReportId), true);
  assert.equal(gameState.worldCombat.recentReports.length, 1);
  const encounter = gameState.worldCombat.encounters.find((e) => e.id === camp.id);
  assert.equal(encounter.status, 'resolved');
});

test('resolveEngagedTimeouts defers when an interactive session is open for that encounter', () => {
  const { gameState, camp, now } = createEngagedGameState();
  const mission = gameState.exploreMissions[0];
  WorldCombatEncounterService.resolveMissionArrival(gameState, mission, now);
  // Simulate an open interactive session on the SAME encounter (player is mid-fight).
  gameState.worldCombat.session = { status: 'open', encounterId: camp.id, battleId: 'wcs_x' };

  const afterWindow = new Date(
    now.getTime() + WorldCombatEncounterService.AUTO_ENGAGE_FALLBACK_MS + 1,
  );
  assert.equal(
    WorldCombatEncounterService.resolveEngagedTimeouts(gameState, afterWindow),
    0,
    'must NOT settle while the player is playing the interactive battle',
  );
  assert.equal(mission.combat.status, 'engaged');
  assert.equal(gameState.worldCombat.recentReports.length, 0);
});

test('an orphaned open session (stale, tab closed) is forfeited and its mission reset to engaged', () => {
  const now = new Date('2026-07-05T12:00:00.000Z');
  const staleStart = new Date(now.getTime() - 6 * 60 * 1000).toISOString(); // 6 min ago (> 5 min)
  const gameState = createCampGameState();
  gameState.exploreMissions = [
    {
      id: 'mission-1',
      status: 'idle',
      combat: { status: 'inBattle', encounterId: 'camp_x', battleId: 'wcs_stale' },
    },
  ];
  gameState.worldCombat.session = {
    schema: 'world-combat-session-v1',
    battleId: 'wcs_stale',
    status: 'open',
    encounterId: 'camp_x',
    missionId: 'mission-1',
    startedAt: staleStart,
  };
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  assert.equal(gameState.worldCombat.session, null, 'stale open session forfeited');
  assert.equal(gameState.exploreMissions[0].combat.status, 'engaged', 'mission reset to engaged');
  assert.equal(gameState.exploreMissions[0].combat.battleId, null);
});

test('a fresh open session (player still fighting) is NOT forfeited', () => {
  const now = new Date('2026-07-05T12:00:00.000Z');
  const freshStart = new Date(now.getTime() - 20 * 1000).toISOString(); // 20s ago
  const gameState = createCampGameState();
  gameState.worldCombat.session = {
    schema: 'world-combat-session-v1',
    battleId: 'wcs_fresh',
    status: 'open',
    missionId: 'mission-1',
    startedAt: freshStart,
  };
  WorldCombatEncounterService.normalizeCombatState(gameState, now);
  assert.ok(gameState.worldCombat.session, 'live session kept');
  assert.equal(gameState.worldCombat.session.battleId, 'wcs_fresh');
});
