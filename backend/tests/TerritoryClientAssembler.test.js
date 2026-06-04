const test = require('node:test');
const assert = require('node:assert/strict');

const GameStateNormalizer = require('../services/GameStateNormalizer');
const TerritoryService = require('../services/TerritoryService');
const TerritoryClientAssembler = require('../services/TerritoryClientAssembler');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('TerritoryService facade still returns the expected client territory contract', () => {
  const state = GameStateNormalizer.createInitialGameState('territory-client-test');
  const now = new Date('2026-06-04T00:00:00.000Z');
  TerritoryService.normalizeTerritoryState(state, now);

  const clientState = TerritoryService.getClientTerritoryState(clone(state), now);

  assert.ok(Array.isArray(clientState.territories));
  assert.ok(clientState.worldMap);
  assert.ok(clientState.mapBounds);
  assert.deepEqual(clientState.directions.map((item) => item.id), Object.keys(TerritoryService.DIRECTIONS));
  assert.equal(clientState.scoutDurationSeconds, Math.floor(TerritoryService.SCOUT_DURATION_MS / 1000));
  assert.equal(clientState.missionDurationSeconds, Math.floor(TerritoryService.CONQUEST_DURATION_MS / 1000));
});

test('redacts garrison leader skills according to territory intel', () => {
  const garrison = {
    id: 'garrison-1',
    owner: 'npc',
    soldiers: 120,
    leader: {
      id: 'leader-1',
      name: 'Hidden Leader',
      abilityKit: { abilities: [{ id: 'skill-1' }] },
      skills: [{ id: 'legacy-skill' }],
    },
  };

  const partial = TerritoryClientAssembler.redactGarrisonForIntel(garrison, {
    knownGarrison: true,
    knownLeader: true,
    knownSkill: false,
  });
  const full = TerritoryClientAssembler.redactGarrisonForIntel(garrison, {
    knownGarrison: true,
    knownLeader: true,
    knownSkill: true,
  });
  const hidden = TerritoryClientAssembler.redactGarrisonForIntel(garrison, {
    knownGarrison: false,
    knownLeader: false,
    knownSkill: false,
  });

  assert.equal(partial.leader.name, 'Hidden Leader');
  assert.equal(partial.leader.abilityKit, null);
  assert.deepEqual(partial.leader.skills, []);
  assert.deepEqual(full.leader.abilityKit, { abilities: [{ id: 'skill-1' }] });
  assert.deepEqual(full.leader.skills, [{ id: 'legacy-skill' }]);
  assert.equal(hidden, null);
});
