const test = require('node:test');
const assert = require('node:assert/strict');

const DefenderLeaderService = require('../services/DefenderLeaderService');

function createTerritory(overrides = {}) {
  return {
    id: 'site_enemy_camp',
    naturalName: '林地部落',
    type: 'camp',
    owner: 'tribe',
    scale: 2,
    threat: 4,
    defense: 500,
    ...overrides,
  };
}

test('defender leader generation is deterministic and carries a battle ability kit', () => {
  const territory = createTerritory();
  const first = DefenderLeaderService.createDefenderLeader(territory);
  const second = DefenderLeaderService.createDefenderLeader(territory);

  assert.equal(first.id, second.id);
  assert.equal(first.name, second.name);
  assert.equal(first.source.type, 'defender');
  assert.equal(first.source.territoryId, territory.id);
  assert.equal(first.quality, 'good');
  assert.equal(first.level, DefenderLeaderService.getLevelForTerritory(territory));
  assert.equal(first.abilityKit.source, 'defender');
  assert.equal(first.abilityKit.battlePolicy, 'useBattleSkill');
  assert.equal(first.skills.length, 1);
  assert.equal(first.skills[0].slot, 'activeSkill');
  assert.match(first.appearance.layers.face, /assets\/art\/famous-person\/layers\/fp-layer-v3-face-\d\d\.png$/);
});

test('neutral settlement targets do not receive defender leaders', () => {
  const leader = DefenderLeaderService.ensureDefenderLeader(createTerritory({
    owner: 'neutral',
    type: 'town',
    threat: 2,
  }));

  assert.equal(leader, null);
});

test('normalizing a stored defender leader backfills current ability shape', () => {
  const territory = createTerritory({ owner: 'ruin_guardians', threat: 6 });
  const normalized = DefenderLeaderService.normalizeDefenderLeader({
    id: 'df_old',
    name: '旧守将',
    source: { type: 'defender', seed: 'old-seed' },
    abilityArchetype: 'strategist',
    quality: 'great',
    attributes: { command: 60, force: 62, strategy: 70, politics: 42, charisma: 40, speed: 51 },
    abilityKit: null,
  }, territory);

  assert.equal(normalized.id, 'df_old');
  assert.equal(normalized.abilityKit.archetype, 'strategist');
  assert.equal(normalized.abilityKit.source, 'defender');
  assert.equal(normalized.skills.length, 1);
  assert.equal(normalized.attributes.intelligence, 70);
  assert.equal(normalized.attributes.strategy, 70);
});
