const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BattleService = require('../services/BattleService');
const BattleConfig = require('../config/BattleConfig');
const Shared = require('../services/battle/BattleShared');
const ConquestBattleService = require('../services/battle/ConquestBattleService');
const { createBattleLeaders } = require('../services/battle/BattleLeaders');
const { createBattleReports } = require('../services/battle/BattleReports');

const serviceRoot = path.join(__dirname, '..', 'services');
const battleRoot = path.join(serviceRoot, 'battle');

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

test('BattleService keeps only current battle facade modules', () => {
  const facadePath = path.join(serviceRoot, 'BattleService.js');
  const moduleFiles = fs.readdirSync(battleRoot)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.ok(lineCount(facadePath) < 180, 'BattleService should stay a small current facade');
  assert.deepEqual(moduleFiles, [
    'BattleLeaders.js',
    'BattleReports.js',
    'BattleShared.js',
    'BattleSimService.js',
    'ConquestBattleService.js',
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

  const attributes = Shared.normalizeAttributes({
    force: 80,
    command: 60,
    intelligence: 70,
    politics: 50,
    charisma: 40,
  });
  assert.equal(attributes.strategy, 70);
  assert.equal(attributes.speed, 58);
  assert.deepEqual(Shared.getBattleVisualGroups(250, 100), [
    { index: 1, soldiers: 100, capacity: 100 },
    { index: 2, soldiers: 100, capacity: 100 },
    { index: 3, soldiers: 50, capacity: 100 },
  ]);
});

test('battle leader module owns current leader snapshots', () => {
  const leaders = createBattleLeaders({ BattleConfig });
  const gameState = {
    famousPeople: [{
      id: 'leader-1',
      name: '先锋',
      title: '破阵者',
      abilityArchetype: 'vanguard',
      quality: 'great',
      attributes: { command: 70, force: 80, intelligence: 55, politics: 40, charisma: 45, speed: 66 },
      abilityKit: { id: 'kit-1', abilities: [{ id: 'active-1' }] },
      skills: [{ id: 'skill-1' }],
      appearance: { portrait: 'x' },
    }],
  };

  const snapshot = leaders.getLeaderSnapshot(gameState, 'leader-1');
  assert.equal(snapshot.name, '先锋');
  assert.equal(snapshot.attributes.force, 80);
  assert.equal(snapshot.abilityKit.abilities[0].id, 'active-1');
  snapshot.abilityKit.abilities[0].id = 'changed';
  assert.equal(gameState.famousPeople[0].abilityKit.abilities[0].id, 'active-1');

  const defender = leaders.getDefenderLeaderSnapshot({
    id: 'camp-1',
    naturalName: 'Forest Camp',
    garrison: { leader: { id: 'def-1', name: '守将', attributes: { force: 44 } } },
  });
  assert.equal(defender.id, 'def-1');
  assert.equal(defender.name, '守将');
});

test('battle reports module owns map and summary report contracts', () => {
  const reports = createBattleReports({
    BattleConfig,
    DEFAULT_SOLDIER_SCALE: BattleService.DEFAULT_SOLDIER_SCALE,
  });
  const territory = {
    id: 'camp-1',
    type: 'camp',
    owner: 'tribe',
    naturalName: 'Forest Camp',
    defense: 160,
  };
  const summary = reports.createConquestSummaryReport(
    {
      expedition: { leader: 'leader-1', leaderSnapshot: { name: '先锋' } },
      soldiersCommitted: 300,
    },
    territory,
    { success: true, casualties: 20 },
    new Date('2026-06-06T00:00:00.000Z'),
  );
  assert.equal(summary.mode, 'summary');
  assert.equal(summary.attacker.leaderName, '先锋');
  assert.equal(summary.visual.groupSize, BattleService.DEFAULT_SOLDIER_SCALE);
  assert.equal(reports.getBattleStageForTerritory(territory).background, 'assets/art/battle/battlefield-forest-camp.png');
});

test('ConquestBattleService resolves territory conquest through entity battle replay data', () => {
  const gameState = {
    activeCityId: 'capital',
    famousPeople: [{
      id: 'leader-1',
      name: '先锋',
      title: '破阵者',
      quality: 'great',
      attributes: { command: 90, force: 95, intelligence: 60, politics: 35, charisma: 45, speed: 80 },
      appearance: {},
    }],
  };
  const mission = {
    id: 'conquest-camp-1',
    sourceCityId: 'capital',
    expedition: { leader: 'leader-1' },
    soldiersCommitted: 500,
    startedAt: '2026-06-06T00:00:00.000Z',
  };
  const territory = {
    id: 'camp-1',
    type: 'camp',
    owner: 'tribe',
    naturalName: 'Forest Camp',
    defense: 100,
  };

  const battle = ConquestBattleService.resolveConquestBattle(
    gameState,
    mission,
    territory,
    new Date('2026-06-06T00:00:00.000Z'),
  );

  assert.equal(typeof battle.success, 'boolean');
  assert.equal(battle.report.mode, 'entity-battle');
  assert.equal(battle.report.system, 'battle-sim-service-v1');
  assert.equal(battle.report.attacker.leaderId, 'leader-1');
  assert.equal(battle.report.replay.setup.sides.length, 2);
  assert.equal(battle.report.replay.inputStream[0].order, 'allOut');
  assert.equal(Array.isArray(battle.report.turns), true);
});

test('BattleService facade exposes no retired turn-based conquest runtime', () => {
  const expectedApi = [
    'DEFAULT_SOLDIER_SCALE',
    'MAX_BATTLE_ROUNDS',
    'MIN_BATTLE_SOLDIERS',
    'createConquestSummaryReport',
    'getBattleMapForTerritory',
    'getBattleStageForTerritory',
    'getBattleVisualGroups',
    'getDefenderLeaderSnapshot',
    'getLeaderSnapshot',
  ];
  assert.deepEqual(Object.keys(BattleService).sort(), expectedApi.sort());
  assert.equal(Object.prototype.hasOwnProperty.call(BattleService, 'simulateConquestBattle'), false);
});
