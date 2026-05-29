const test = require('node:test');
const assert = require('node:assert/strict');

const BattleConfig = require('../config/BattleConfig');
const BattleService = require('../services/BattleService');

function createLeaderState() {
  return {
    famousPeople: [
      {
        id: 'fp_luxiao',
        name: '陆骁',
        title: '山道突骑',
        archetype: 'vanguard',
        attributes: { command: 72, force: 88, strategy: 46, charisma: 60 },
        appearance: { version: 'famous-portrait-v3.0', layers: {} },
        abilityKit: {
          archetype: 'vanguard',
          domain: 'battle',
          battlePolicy: 'useBattleSkill',
          abilities: [
            {
              id: 'skill_blood_assault',
              name: '血刃破阵',
              slot: 'activeSkill',
              kind: 'active',
              type: 'battle',
              category: 'blade',
              damageType: 'blade',
              multiplier: 1.42,
              cooldown: 3,
              castPolicy: 'conditional',
              castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }],
              effects: [{ key: 'directDamage', value: 1.42 }, { key: 'lifesteal', value: 0.12 }],
            },
          ],
        },
        skills: [
          {
            id: 'skill_blood_assault',
            name: '血刃破阵',
            type: 'battle',
            damageType: 'blade',
            multiplier: 1.42,
            cooldown: 3,
            castPolicy: 'conditional',
            castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }],
            effects: [{ key: 'directDamage', value: 1.42 }, { key: 'lifesteal', value: 0.12 }],
          },
        ],
      },
    ],
  };
}

function createMission(overrides = {}) {
  return {
    id: 'conquest_test',
    expedition: { leader: 'fp_luxiao', soldiers: 501 },
    soldiersCommitted: 501,
    ...overrides,
  };
}

function createTerritory(overrides = {}) {
  return {
    id: 'tribe_site',
    type: 'camp',
    owner: 'tribe',
    naturalName: '林地部落',
    defense: 500,
    ...overrides,
  };
}

test('simulateConquestBattle emits attribute battle report without mutating inputs', () => {
  const gameState = createLeaderState();
  const mission = createMission();
  const territory = createTerritory();
  const result = BattleService.simulateConquestBattle(
    gameState,
    mission,
    territory,
    new Date('2026-05-29T12:00:00.000Z'),
  );

  assert.equal(result.success, true);
  assert.ok(result.casualties >= 0);
  assert.equal(result.report.system, 'attribute-auto-battle-v2');
  assert.equal(result.report.ruleVersion, 'battle-rules-v3');
  assert.deepEqual(result.report.actionOrder, ['attacker', 'defender']);
  assert.equal(result.report.attacker.leaderName, '陆骁');
  assert.equal(result.report.attacker.soldiersStart, 501);
  assert.equal(result.report.attacker.groupsStart.length, 6);
  assert.equal(result.report.attacker.groupsStart[5].soldiers, 1);
  assert.equal(result.report.turns[0].action, 'skill');
  assert.equal(result.report.turns[0].skillName, '血刃破阵');
  assert.equal(result.report.turns[0].damageType, 'blade');
  assert.equal(result.report.turns[0].presentation.cutIn, true);
  assert.equal(result.report.turns[0].presentation.showSkillName, true);
  assert.deepEqual(result.report.turns.find((turn) => turn.action === 'basicAttack').presentation.cutIn, false);
  assert.equal(result.report.moraleEffectEnabled, false);
  assert.ok(result.report.preparation[0].lines.some((line) => line.includes('士气影响：未启用')));
  assert.ok(result.report.detailEvents[0].lines.some((line) => line.includes('开始行动')));
  assert.equal(result.report.experience.enemyLoss, 500);
  assert.ok(result.report.experience.total >= 500);
  assert.equal(result.report.skillRules.cooldownTicksOnOwnTurnOnly, true);
  assert.equal(result.report.skillRules.speedSortPerRound, true);
  assert.equal(result.report.skillRules.strategyDefenseAttribute, 'intelligence');
  assert.equal(result.report.skillRules.randomTriggerEnabled, false);
  assert.equal(result.report.skillRules.statusSystemEnabled, true);
  assert.equal(mission.soldiersCommitted, 501);
  assert.equal(territory.owner, 'tribe');
});

test('getLeaderSnapshot supports live famous people and maps strategy to intelligence', () => {
  const gameState = createLeaderState();
  const snapshot = BattleService.getLeaderSnapshot(gameState, 'fp_luxiao');

  assert.equal(snapshot.name, '陆骁');
  assert.equal(snapshot.attributes.force, 88);
  assert.equal(snapshot.attributes.intelligence, 46);
  assert.equal(snapshot.attributes.strategy, 46);
  assert.ok(snapshot.attributes.speed > 0);
  assert.equal(snapshot.skills[0].name, '血刃破阵');
  assert.equal(snapshot.abilityKit.battlePolicy, 'useBattleSkill');
  assert.equal(BattleService.getLeaderSnapshot(gameState, 'unavailable'), null);
});

test('conditional skill falls back to basic attack when conditions fail', () => {
  const gameState = createLeaderState();
  const active = gameState.famousPeople[0].abilityKit.abilities[0];
  active.name = '收割追击';
  active.castConditions = [
    { type: 'cooldownReady' },
    { type: 'targetAlive' },
    { type: 'targetSoldierBelowPct', value: 0.2 },
  ];
  gameState.famousPeople[0].skills[0] = active;
  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission(),
    createTerritory(),
    new Date('2026-05-29T12:02:00.000Z'),
  );

  assert.equal(result.report.turns[0].actor, 'attacker');
  assert.equal(result.report.turns[0].action, 'basicAttack');
  assert.equal(result.report.turns[0].skillName, '');
  assert.equal(result.report.turns[0].presentation.cutIn, false);
  assert.equal(result.report.turns[0].actionDecision.reason, 'conditionNotMet:targetSoldierBelowPct');
  assert.equal(result.report.turns[0].actionDecision.canCast, false);
  assert.ok(result.report.turns.some((turn) => turn.action === 'skill' && turn.skillName === '收割追击'));
});

test('skill cooldown only ticks on the actor own turns and recasts when ready', () => {
  const gameState = createLeaderState();
  gameState.famousPeople[0].abilityKit.abilities[0].cooldown = 2;
  gameState.famousPeople[0].skills[0].cooldown = 2;
  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission({ soldiersCommitted: 1000 }),
    createTerritory({ defense: 1400 }),
    new Date('2026-05-29T12:02:30.000Z'),
  );
  const attackerTurns = result.report.turns.filter((turn) => turn.actor === 'attacker').slice(0, 4);
  const defenderTurnsBetween = result.report.turns.filter((turn) => turn.actor === 'defender' && turn.index < attackerTurns[1].index);

  assert.equal(attackerTurns[0].action, 'skill');
  assert.equal(attackerTurns[0].cooldownBefore, 0);
  assert.equal(attackerTurns[0].cooldownAfter, 2);
  assert.equal(attackerTurns[0].ownActionCountBefore, 0);
  assert.equal(attackerTurns[1].action, 'basicAttack');
  assert.equal(attackerTurns[1].actionDecision.reason, 'cooldownNotReady');
  assert.equal(attackerTurns[1].cooldownBefore, 2);
  assert.equal(attackerTurns[1].cooldownAfter, 1);
  assert.equal(attackerTurns[2].cooldownBefore, 1);
  assert.equal(attackerTurns[2].cooldownAfter, 0);
  assert.equal(attackerTurns[3].action, 'skill');
  assert.equal(attackerTurns[3].cooldownBefore, 0);
  assert.equal(attackerTurns[3].actionDecision.canCast, true);
  assert.equal(defenderTurnsBetween.length, 1);
  assert.equal(attackerTurns[1].cooldownBefore, attackerTurns[0].cooldownAfter);
});

test('slower famous leader acts after faster defender each round', () => {
  const gameState = createLeaderState();
  gameState.famousPeople[0].attributes.speed = 20;
  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission(),
    createTerritory(),
    new Date('2026-05-29T12:02:45.000Z'),
  );

  assert.deepEqual(result.report.actionOrder, ['defender', 'attacker']);
  assert.equal(result.report.firstActor, 'defender');
  assert.equal(result.report.turns[0].actor, 'defender');
});

test('pre-battle passive traits apply before speed and damage are reported', () => {
  const gameState = createLeaderState();
  gameState.famousPeople[0].abilityKit.abilities.push({
    id: 'trait_vanguard_speed_drill',
    name: '疾斗',
    slot: 'passiveTrait',
    kind: 'passive',
    trigger: 'preBattle',
    effects: [{ key: 'attributeBonus', attribute: 'speed', value: 40 }],
  });
  gameState.famousPeople[0].attributes.speed = 20;
  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission(),
    createTerritory(),
    new Date('2026-05-29T12:02:50.000Z'),
  );

  assert.equal(result.report.firstActor, 'attacker');
  assert.equal(result.report.attacker.attributes.speed, 60);
  assert.ok(result.report.preparation.some((event) => (
    event.type === 'passiveTrait'
    && event.traitName === '疾斗'
    && event.lines.some((line) => line.includes('speed +40'))
  )));
});

test('basicAttackOnly famous leader never receives fallback battle skill', () => {
  const gameState = createLeaderState();
  gameState.famousPeople[0].abilityKit = {
    archetype: 'governor',
    domain: 'civil',
    battlePolicy: 'basicAttackOnly',
    abilities: [
      { id: 'civil_governor_field_admin', name: '督田理赋', slot: 'civilPrimary', kind: 'civil', effects: [{ key: 'resourceOutputPct', value: 0.1 }] },
      { id: 'civil_governor_granary_order', name: '仓廪整备', slot: 'civilSecondary', kind: 'civil', effects: [{ key: 'populationCapPct', value: 0.06 }] },
    ],
  };
  gameState.famousPeople[0].skills = [];

  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission(),
    createTerritory(),
    new Date('2026-05-29T12:03:00.000Z'),
  );

  const attackerTurns = result.report.turns.filter((turn) => turn.actor === 'attacker');
  assert.ok(attackerTurns.length > 0);
  assert.equal(attackerTurns.every((turn) => turn.action === 'basicAttack'), true);
  assert.equal(result.report.attacker.skill.id, undefined);
});

test('firstOwnAction skill only casts on the first own action', () => {
  const gameState = createLeaderState();
  const active = {
    id: 'skill_scout_first_probe',
    name: '先机穿插',
    slot: 'activeSkill',
    kind: 'active',
    type: 'battle',
    category: 'strategy',
    damageType: 'strategy',
    multiplier: 1.18,
    cooldown: 2,
    castPolicy: 'conditional',
    castConditions: [{ type: 'cooldownReady' }, { type: 'targetAlive' }, { type: 'firstOwnAction' }],
    effects: [{ key: 'firstStrike', value: 0.22 }, { key: 'directDamage', value: 1.18 }],
  };
  gameState.famousPeople[0].abilityKit = {
    archetype: 'scout',
    domain: 'hybrid',
    battlePolicy: 'useBattleSkill',
    abilities: [active, { id: 'trait_scout_trail_reader', name: '识径', slot: 'scoutTrait', kind: 'passive', effects: [{ key: 'scoutReportBonusPct', value: 0.08 }] }],
  };
  gameState.famousPeople[0].skills = [active];

  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission(),
    createTerritory({ defense: 900 }),
    new Date('2026-05-29T12:04:00.000Z'),
  );
  const skillTurns = result.report.turns.filter((turn) => turn.actor === 'attacker' && turn.action === 'skill');

  assert.equal(skillTurns.length, 1);
  assert.equal(skillTurns[0].skillName, '先机穿插');
  assert.ok(skillTurns[0].extraHits.some((hit) => hit.key === 'firstStrike'));
  assert.equal(skillTurns[0].presentation.cutIn, true);
});

test('createLegacyBattleReport remains available for historical fallback', () => {
  const report = BattleService.createLegacyBattleReport(
    createMission({ expedition: { leader: 'unavailable' }, soldiersCommitted: 300 }),
    createTerritory({ defense: 400 }),
    { success: false, casualties: 150 },
    new Date('2026-05-29T12:05:00.000Z'),
  );

  assert.equal(report.mode, 'legacy');
  assert.equal(report.result, 'defeat');
  assert.equal(report.visual.groupSize, BattleService.DEFAULT_SOLDIER_SCALE);
  assert.equal(report.attacker.soldiersEnd, 150);
});

test('attribute damage uses force vs command and intelligence vs intelligence defense', () => {
  const blade = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 90, intelligence: 30 } },
    { soldiers: 500, morale: 100, attributes: { command: 50, intelligence: 50 } },
    { damageType: 'blade', multiplier: 1 },
  );
  const strategy = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 30, intelligence: 90 } },
    { soldiers: 500, morale: 100, attributes: { command: 50, intelligence: 50 } },
    { damageType: 'strategy', multiplier: 1 },
  );
  const defended = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 90, intelligence: 30 } },
    { soldiers: 500, morale: 100, attributes: { command: 120, intelligence: 50 } },
    { damageType: 'blade', multiplier: 1 },
  );
  const strategyDefended = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 30, intelligence: 90 } },
    { soldiers: 500, morale: 100, attributes: { command: 50, intelligence: 120 } },
    { damageType: 'strategy', multiplier: 1 },
  );

  assert.ok(blade > defended);
  assert.equal(blade, strategy);
  assert.ok(strategy > strategyDefended);
  assert.ok(BattleService.getEffectiveAttribute(200) < 200);
});

test('shield status absorbs incoming battle damage and records status events', () => {
  const gameState = createLeaderState();
  const active = gameState.famousPeople[0].abilityKit.abilities[0];
  active.name = '固阵压前';
  active.damageType = 'blade';
  active.multiplier = 1.1;
  active.cooldown = 2;
  active.effects = [{ key: 'directDamage', value: 1.1 }, { key: 'shield', value: 0.12 }];
  gameState.famousPeople[0].skills[0] = active;

  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission({ soldiersCommitted: 700 }),
    createTerritory({ defense: 900 }),
    new Date('2026-05-30T08:00:00.000Z'),
  );
  const shieldApplyTurn = result.report.turns.find((turn) => (
    turn.actor === 'attacker'
    && turn.statusEvents?.some((event) => event.key === 'shield' && event.type === 'statusApplied')
  ));
  const shieldAbsorbTurn = result.report.turns.find((turn) => (
    turn.statusEvents?.some((event) => event.type === 'shieldAbsorb' && event.target === 'attacker')
  ));

  assert.ok(shieldApplyTurn);
  assert.ok(shieldApplyTurn.floatingTexts.some((item) => /守御 \+/.test(item.text)));
  assert.ok(shieldAbsorbTurn);
  assert.ok(shieldAbsorbTurn.lines.some((line) => line.includes('守御抵消')));
  assert.ok(shieldAbsorbTurn.statusesBefore.attacker.some((status) => status.key === 'shield'));
});

test('burn and poison tick on the target own action before it acts', () => {
  const gameState = createLeaderState();
  const active = gameState.famousPeople[0].abilityKit.abilities[0];
  active.name = '火毒奇策';
  active.damageType = 'strategy';
  active.multiplier = 1.05;
  active.cooldown = 2;
  active.effects = [
    { key: 'directDamage', value: 1.05 },
    { key: 'burn', value: 0.16, turns: 2 },
    { key: 'poison', value: 0.14, turns: 2 },
  ];
  gameState.famousPeople[0].attributes.intelligence = 90;
  gameState.famousPeople[0].attributes.strategy = 90;
  gameState.famousPeople[0].skills[0] = active;

  const result = BattleService.simulateConquestBattle(
    gameState,
    createMission({ soldiersCommitted: 800 }),
    createTerritory({ defense: 1000 }),
    new Date('2026-05-30T08:01:00.000Z'),
  );
  const applyTurn = result.report.turns.find((turn) => (
    turn.actor === 'attacker'
    && turn.statusEvents?.some((event) => event.key === 'burn' && event.type === 'statusApplied')
    && turn.statusEvents?.some((event) => event.key === 'poison' && event.type === 'statusApplied')
  ));
  const defenderStatusTurn = result.report.turns.find((turn) => (
    turn.actor === 'defender'
    && turn.statusEvents?.some((event) => event.type === 'statusTick' && event.key === 'burn')
    && turn.statusEvents?.some((event) => event.type === 'statusTick' && event.key === 'poison')
  ));

  assert.ok(applyTurn);
  assert.ok(applyTurn.statusesAfter.defender.some((status) => status.key === 'burn'));
  assert.ok(defenderStatusTurn);
  assert.equal(defenderStatusTurn.lines[0], '[林地部落] 开始行动');
  assert.ok(defenderStatusTurn.lines.some((line) => line.includes('灼烧造成')));
  assert.ok(defenderStatusTurn.lines.some((line) => line.includes('中毒造成')));
  assert.ok(defenderStatusTurn.floatingTexts.some((item) => /灼烧 -/.test(item.text)));
  assert.ok(defenderStatusTurn.damage > 0);
});

test('armorBreak increases following blade damage while active', () => {
  const attacker = BattleService._test.makeUnit('attacker', {
    name: '测试攻击方',
    soldiers: 500,
    maxSoldiers: 500,
    morale: 100,
    attributes: { force: 80, command: 50, intelligence: 50, speed: 50 },
  });
  const normalTarget = BattleService._test.makeUnit('defender', {
    name: '普通目标',
    soldiers: 500,
    maxSoldiers: 500,
    morale: 100,
    attributes: { command: 60, force: 50, intelligence: 50, speed: 50 },
  });
  const brokenTarget = BattleService._test.makeUnit('defender', {
    name: '破甲目标',
    soldiers: 500,
    maxSoldiers: 500,
    morale: 100,
    attributes: { command: 60, force: 50, intelligence: 50, speed: 50 },
  });

  const applied = BattleService._test.applyStatusToUnit(brokenTarget, {
    key: 'armorBreak',
    value: 0.2,
    turnsRemaining: 2,
    sourceSide: 'attacker',
    targetSide: 'defender',
  });
  const normalDamage = BattleService.calculateDamage(attacker, normalTarget, { damageType: 'blade', multiplier: 1 });
  const brokenDamage = BattleService.calculateDamage(attacker, brokenTarget, { damageType: 'blade', multiplier: 1 });
  const strategyDamage = BattleService.calculateDamage(attacker, brokenTarget, { damageType: 'strategy', multiplier: 1 });
  const normalStrategyDamage = BattleService.calculateDamage(attacker, normalTarget, { damageType: 'strategy', multiplier: 1 });

  assert.equal(applied.key, 'armorBreak');
  assert.ok(brokenDamage > normalDamage);
  assert.equal(strategyDamage, normalStrategyDamage);
});

test('battle config owns defender, visual, and fallback skill templates', () => {
  const fallbackSkill = BattleConfig.getFallbackSkill('defender');
  fallbackSkill.name = 'mutated';

  assert.equal(BattleConfig.getFallbackSkill('defender').name, '守势突刺');
  assert.equal(BattleConfig.getDefenderProfileForOwner('city_state', '').name, '城邦守军');
  assert.equal(BattleConfig.getDefenderProfileForOwner('city_state', '').intelligence, 52);
  assert.equal(BattleService.getBattleMapForTerritory({ type: 'camp' }).id, 'forest-camp');
  assert.equal(
    BattleService.getBattleStageForTerritory({ type: 'camp' }).soldierSprites.attacker,
    'assets/art/battle/units/player',
  );
});
