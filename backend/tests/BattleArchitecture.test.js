const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BattleService = require('../services/BattleService');
const BattleConfig = require('../config/BattleConfig');
const Shared = require('../services/battle/BattleShared');
const { createBattleLeaders } = require('../services/battle/BattleLeaders');
const Statuses = require('../services/battle/BattleStatuses');

const serviceRoot = path.join(__dirname, '..', 'services');
const battleRoot = path.join(serviceRoot, 'battle');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('BattleService delegates focused responsibilities to battle modules', () => {
  const facadePath = path.join(serviceRoot, 'BattleService.js');
  const moduleFiles = fs.readdirSync(battleRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 850, 'BattleService should keep shrinking during staged decomposition');
  assert.deepEqual(moduleFiles, [
    'BattleLeaders.js',
    'BattleShared.js',
    'BattleStatuses.js',
  ]);
  for (const fileName of moduleFiles) {
    assert.ok(lineCount(path.join(battleRoot, fileName)) < 500, `${fileName} should stay below 500 lines`);
  }
});

test('battle shared module owns cloning, integer conversion, attributes, and visual groups', () => {
  const source = { nested: { value: 1 } };
  const cloned = Shared.clone(source);
  cloned.nested.value = 2;
  assert.equal(source.nested.value, 1);
  assert.equal(Shared.toInteger('4.9'), 4);
  assert.equal(Shared.clamp(12, 0, 5), 5);

  const attributes = Shared.normalizeAttributes({ force: 80, command: 60, intelligence: 70, politics: 50, charisma: 40 });
  assert.equal(attributes.strategy, 70);
  assert.equal(attributes.speed, 58);
  assert.deepEqual(Shared.getBattleVisualGroups(250, 100), [
    { index: 1, soldiers: 100, capacity: 100 },
    { index: 2, soldiers: 100, capacity: 100 },
    { index: 3, soldiers: 50, capacity: 100 },
  ]);
});

test('battle leader module owns leader snapshots and skill selection contracts', () => {
  const leaders = createBattleLeaders({ BattleConfig });
  const abilityKit = {
    archetype: 'vanguard',
    battlePolicy: 'useBattleSkill',
    abilities: [{
      id: 'skill_active',
      name: 'Active Skill',
      slot: 'activeSkill',
      kind: 'active',
      type: 'battle',
      effects: [{ key: 'directDamage', value: 1.4 }],
    }],
  };
  const gameState = {
    famousPeople: [{
      id: 'leader-1',
      name: '先锋',
      title: '破阵者',
      abilityArchetype: 'vanguard',
      quality: 'great',
      attributes: { command: 70, force: 80, intelligence: 55, politics: 40, charisma: 45, speed: 66 },
      abilityKit,
      skills: [{ id: 'legacy-skill', type: 'battle', effects: [{ key: 'shield', value: 0.1 }] }],
      appearance: { portrait: 'x' },
    }],
  };

  const snapshot = leaders.getLeaderSnapshot(gameState, 'leader-1');
  assert.equal(snapshot.name, '先锋');
  assert.equal(snapshot.attributes.force, 80);
  assert.equal(snapshot.abilityKit.abilities[0].id, 'skill_active');

  const skill = leaders.getBattleSkill({ leader: snapshot }, 'attacker');
  assert.equal(skill.id, 'skill_active');
  assert.equal(skill.damageType, 'blade');
  assert.equal(skill.multiplier, 1.4);
  snapshot.abilityKit.abilities[0].id = 'changed';
  assert.equal(gameState.famousPeople[0].abilityKit.abilities[0].id, 'skill_active');

  const basicOnly = leaders.getBattleSkill({ leader: { id: 'civil', abilityKit: { battlePolicy: 'basicAttackOnly' } } }, 'attacker');
  assert.equal(basicOnly, null);
  assert.equal(leaders.getBattleSkill({}, 'defender').id, BattleConfig.getFallbackSkill('defender').id);
});

test('battle status module owns shield, stacking, and damage-over-time contracts', () => {
  const statusSystem = Statuses.createBattleStatuses({
    defaultSoldierScale: 100,
    calculateDamage: () => 30,
  });
  const defender = {
    side: 'defender',
    name: '守军',
    soldiers: 200,
    maxSoldiers: 200,
    attributes: { intelligence: 50 },
    statuses: [],
  };

  const shield = statusSystem.applyStatusToUnit(defender, { key: 'shield', value: 0.2, turnsRemaining: 2 });
  assert.equal(shield.type, 'statusApplied');
  assert.equal(shield.key, 'shield');
  assert.equal(defender.statuses[0].shieldRemaining, 40);

  const absorbed = statusSystem.applyDamageWithStatuses(defender, 25);
  assert.equal(absorbed.dealt, 0);
  assert.equal(absorbed.absorbed, 25);
  assert.equal(defender.soldiers, 200);
  assert.equal(defender.statuses[0].shieldRemaining, 15);

  const burn = statusSystem.applyStatusToUnit(defender, { key: 'burn', value: 0.12, turnsRemaining: 1 });
  assert.equal(burn.label, Statuses.getStatusLabel('burn'));
  const events = statusSystem.tickStatusesAtActionStart(defender);
  assert.ok(events.some((event) => event.type === 'shieldAbsorb'));
  assert.ok(events.some((event) => event.type === 'statusTick'));
  assert.equal(defender.soldiers, 185);
  assert.equal(Statuses.sanitizeStatuses(defender.statuses).length, 0);
});

test('BattleService facade preserves exported battle API and conquest smoke behavior', () => {
  const expectedApi = [
    'DEFAULT_SOLDIER_SCALE',
    'MAX_BATTLE_ROUNDS',
    'MIN_BATTLE_SOLDIERS',
    '_test',
    'calculateDamage',
    'createLegacyBattleReport',
    'getBattleMapForTerritory',
    'getBattleStageForTerritory',
    'getBattleVisualGroups',
    'getDefenderLeaderSnapshot',
    'getEffectiveAttribute',
    'getLeaderSnapshot',
    'simulateConquestBattle',
  ];
  assert.deepEqual(Object.keys(BattleService).sort(), expectedApi.sort());

  const gameState = {
    famousPeople: [{
      id: 'leader-1',
      name: '先锋',
      title: '破阵者',
      quality: 'great',
      attributes: { command: 70, force: 85, intelligence: 45, politics: 35, charisma: 45, speed: 70 },
      abilityKit: {
        archetype: 'vanguard',
        battlePolicy: 'useBattleSkill',
        abilities: [{
          id: 'skill_active',
          name: '裂阵',
          slot: 'activeSkill',
          kind: 'active',
          type: 'battle',
          damageType: 'blade',
          multiplier: 1.35,
          cooldown: 3,
          effects: [{ key: 'directDamage', value: 1.35 }],
        }],
      },
      skills: [],
      appearance: {},
    }],
  };
  const mission = {
    expedition: { leader: 'leader-1' },
    soldiersCommitted: 500,
  };
  const territory = {
    id: 'camp-1',
    type: 'camp',
    owner: 'tribe',
    naturalName: '林地营地',
    defense: 160,
  };
  const battle = BattleService.simulateConquestBattle(gameState, mission, territory, new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(typeof battle.success, 'boolean');
  assert.equal(battle.report.attacker.leaderId, 'leader-1');
  assert.equal(battle.report.mode, 'auto-round');
  assert.equal(battle.report.turns.length > 0, true);
  assert.equal(battle.report.visual.groupSize, BattleService.DEFAULT_SOLDIER_SCALE);
});
