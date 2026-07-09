const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BattleService = require('../services/BattleService');
const BattleConfig = require('../config/BattleConfig');
const Shared = require('../services/battle/BattleShared');
const { createBattleLeaders } = require('../services/battle/BattleLeaders');
const Statuses = require('../services/battle/BattleStatuses');
const SkillRuntime = require('../services/battle/BattleSkillRuntime');
const { createBattleReports } = require('../services/battle/BattleReports');

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

  assert.ok(lineCount(facadePath) < 500, 'BattleService should keep the facade below 500 lines');
  assert.deepEqual(moduleFiles, [
    'BattleLeaders.js',
    'BattleReports.js',
    'BattleShared.js',
    'BattleSimService.js',
    'BattleSkillRuntime.js',
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

test('battle skill runtime module owns cast conditions and side-effect contracts', () => {
  const statusSystem = Statuses.createBattleStatuses({ defaultSoldierScale: 100, calculateDamage: () => 20 });
  const runtime = SkillRuntime.createBattleSkillRuntime({
    getPassiveTraitsFromAbilityKit: () => [{
      id: 'passive-1',
      name: '守备整训',
      effects: [{ key: 'attributeBonus', attribute: 'command', value: 8 }],
    }],
    healSoldiers: statusSystem.healSoldiers,
    applyStatusToUnit: statusSystem.applyStatusToUnit,
  });
  const unit = {
    side: 'attacker',
    name: '先锋',
    soldiers: 80,
    maxSoldiers: 100,
    morale: 100,
    skillCooldownRemaining: 0,
    ownActionCount: 0,
    attributes: { command: 50, force: 60, intelligence: 40 },
    statuses: [],
    leader: { abilityKit: {} },
  };
  const target = { side: 'defender', name: '守军', soldiers: 90, maxSoldiers: 100, statuses: [] };
  const skill = {
    id: 'skill-1',
    name: '火袭',
    castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }, { type: 'firstOwnAction' }],
    effects: [
      { key: 'shield', value: 0.1, turns: 2 },
      { key: 'burn', value: 0.12, turns: 1 },
    ],
  };

  assert.equal(runtime.canCastSkill(unit, target, skill), true);
  assert.equal(runtime.describeActionDecision(unit, target, skill).reason, 'castSkill');
  const passiveEvents = runtime.applyPreBattlePassives(unit);
  assert.equal(unit.attributes.command, 58);
  assert.equal(passiveEvents[0].type, 'passiveTrait');
  const sideEffects = runtime.applySkillSideEffects(unit, target, skill, 30);
  assert.ok(sideEffects.structured.some((effect) => effect.key === 'shield'));
  assert.ok(sideEffects.structured.some((effect) => effect.key === 'burn'));
  assert.equal(Statuses.sanitizeStatuses(unit.statuses).length, 1);
  assert.equal(Statuses.sanitizeStatuses(target.statuses).length, 1);
});

test('battle reports module owns map, unit snapshot, legacy report, and experience contracts', () => {
  const reports = createBattleReports({
    BattleConfig,
    DEFAULT_SOLDIER_SCALE: BattleService.DEFAULT_SOLDIER_SCALE,
    MIN_BATTLE_SOLDIERS: BattleService.MIN_BATTLE_SOLDIERS,
    MORALE_EFFECT_ENABLED: BattleConfig.MORALE_EFFECT_ENABLED,
    DAMAGE_TYPE_LABELS: { blade: '兵刃伤害' },
    getBattleSkill: () => ({ id: 'fallback-skill' }),
    getDefenderLeaderSnapshot: () => null,
    getBattleSpeed: () => 66,
    getBattleVisualGroups: (soldiers) => Shared.getBattleVisualGroups(soldiers, BattleService.DEFAULT_SOLDIER_SCALE),
  });
  const territory = { id: 'camp-1', type: 'camp', owner: 'tribe', naturalName: '林地营地', defense: 160 };
  const legacy = reports.createLegacyBattleReport(
    { expedition: { leader: 'leader-1' }, soldiersCommitted: 300 },
    territory,
    { success: true, casualties: 20 },
    new Date('2026-06-06T00:00:00.000Z'),
  );
  assert.equal(legacy.mode, 'legacy');
  assert.equal(legacy.visual.groupSize, BattleService.DEFAULT_SOLDIER_SCALE);
  assert.equal(reports.formatDamageLine('守军', 'blade', 12, 88), '[守军] 受到兵刃伤害 12（88）');

  const unit = reports.makeUnit('attacker', {
    name: '先锋',
    soldiers: 180,
    maxSoldiers: 200,
    morale: 95,
    attributes: { force: 80 },
    leader: { id: 'leader-1', appearance: { portrait: 'x' } },
    skill: { id: 'skill-1' },
  });
  const snapshot = reports.buildReportUnitSnapshot(unit, { leaderId: 'leader-1', leaderTitle: '破阵者' });
  assert.equal(snapshot.speed, 66);
  assert.equal(snapshot.groupsStart.length, 2);
  assert.equal(reports.createExperienceSummary(unit, { maxSoldiers: 100, soldiers: 0 }, true).victoryBonus, 20);
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

test('BattleService turns carry structured actionLineIndex pointing at the action line', () => {
  const gameState = { famousPeople: [] };
  const mission = { expedition: {}, soldiersCommitted: 400 };
  const territory = {
    id: 'camp-action-line',
    type: 'camp',
    owner: 'tribe',
    naturalName: '边地营寨',
    defense: 200,
  };
  const battle = BattleService.simulateConquestBattle(gameState, mission, territory, new Date('2026-06-06T00:00:00.000Z'));
  assert.equal(battle.report.turns.length > 0, true);
  battle.report.turns.forEach((turn) => {
    assert.equal(Number.isInteger(turn.actionLineIndex), true);
    if (turn.action === 'statusTick') {
      assert.equal(turn.actionLineIndex, -1);
      return;
    }
    const actionLine = String(turn.lines[turn.actionLineIndex] || '');
    const expectedMarker = turn.action === 'skill' ? '发动战法' : '发动普通攻击';
    assert.equal(actionLine.includes(expectedMarker), true, `turn ${turn.index} actionLineIndex 应指向动作行：${actionLine}`);
  });
  battle.report.detailEvents.forEach((event) => {
    assert.equal(Number.isInteger(event.actionLineIndex), true);
  });
});
