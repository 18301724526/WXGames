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
        skills: [
          {
            id: 'skill_blood_combo',
            name: '血刃连袭',
            type: 'battle',
            cooldown: 3,
            effects: [{ key: 'lifesteal', value: 0.12 }, { key: 'combo', chance: 0.2, times: 1 }],
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
  assert.equal(result.report.system, 'attribute-auto-battle-v1');
  assert.equal(result.report.attacker.leaderName, '陆骁');
  assert.equal(result.report.attacker.soldiersStart, 501);
  assert.equal(result.report.attacker.groupsStart.length, 6);
  assert.equal(result.report.attacker.groupsStart[5].soldiers, 1);
  assert.equal(result.report.turns[0].action, 'skill');
  assert.equal(result.report.turns[0].skillName, '血刃连袭');
  assert.equal(result.report.turns[0].damageType, 'blade');
  assert.equal(result.report.moraleEffectEnabled, false);
  assert.ok(result.report.preparation[0].lines.some((line) => line.includes('士气影响：未启用')));
  assert.ok(result.report.detailEvents[0].lines.some((line) => line.includes('开始行动')));
  assert.equal(result.report.experience.enemyLoss, 500);
  assert.ok(result.report.experience.total >= 500);
  assert.equal(result.report.skillRules.cooldownTicksOnOwnTurnOnly, true);
  assert.equal(result.report.skillRules.randomTriggerEnabled, false);
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
  assert.equal(snapshot.skills[0].name, '血刃连袭');
  assert.equal(BattleService.getLeaderSnapshot(gameState, 'unavailable'), null);
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

test('attribute damage uses force and intelligence against command defense', () => {
  const blade = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 90, intelligence: 30 } },
    { soldiers: 500, morale: 100, attributes: { command: 50 } },
    { damageType: 'blade', multiplier: 1 },
  );
  const strategy = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 30, intelligence: 90 } },
    { soldiers: 500, morale: 100, attributes: { command: 50 } },
    { damageType: 'strategy', multiplier: 1 },
  );
  const defended = BattleService.calculateDamage(
    { soldiers: 500, morale: 100, attributes: { force: 90, intelligence: 30 } },
    { soldiers: 500, morale: 100, attributes: { command: 120 } },
    { damageType: 'blade', multiplier: 1 },
  );

  assert.ok(blade > defended);
  assert.equal(blade, strategy);
  assert.ok(BattleService.getEffectiveAttribute(200) < 200);
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
    'assets/art/battle/soldier-player-sheet.png',
  );
});
