const test = require('node:test');
const assert = require('node:assert/strict');

const WorldCombatEncounterService = require('../services/worldCombat/WorldCombatEncounterService');

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
