const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const TechTreeService = require('../services/TechTreeService');
const AdvanceEraAction = require('../actions/AdvanceEraAction');
const TutorialService = require('../services/TutorialService');
const BuildingActionValidator = require('../validators/BuildingActionValidator');
const { TECHS, TECH_BY_ID, TECH_ROUTE_META } = require('../config/TechTreeConfig');

test('tech tree has shared route nodes for route switching', () => {
  const sharedNodes = TECHS.filter((tech) => (tech.tree?.routes || []).length >= 3 && tech.parents.length >= 2);
  assert.ok(sharedNodes.length >= 4);
  assert.ok(sharedNodes.some((tech) => tech.id === 'settlement_logging_rights'));
  assert.ok(sharedNodes.some((tech) => tech.id === 'city_quarry_survey'));
  assert.ok(sharedNodes.some((tech) => tech.id === 'frontier_bloomery_signs'));
  assert.ok(sharedNodes.some((tech) => tech.id === 'classical_workshop_guilds'));
});

test('科技树配置包含鱼骨图坐标并且父节点都存在', () => {
  assert.ok(TECHS.length > 0);
  TECHS.forEach((tech) => {
    assert.equal(typeof tech.tree?.column, 'number');
    assert.equal(typeof tech.tree?.lane, 'number');
    assert.equal(typeof tech.tree?.row, 'number');
    assert.ok(Array.isArray(tech.tree?.routes));
    assert.ok(Array.isArray(tech.parents));
    tech.parents.forEach((parentId) => {
      assert.ok(TECH_BY_ID[parentId], `${tech.id} references missing parent ${parentId}`);
    });
  });
});

test('科技节点固定在主路线区域，交汇只通过多路线和多连线表达', () => {
  TECHS.forEach((tech) => {
    const expectedLane = TECH_ROUTE_META[tech.route]?.lane;
    assert.equal(tech.tree.lane, expectedLane, `${tech.id} should stay in ${tech.route} lane`);
    assert.equal(tech.tree.routes[0], tech.route, `${tech.id} should keep primary route first`);
  });

  const shared = TECH_BY_ID.settlement_logging_rights;
  assert.equal(shared.route, 'industry');
  assert.equal(shared.tree.lane, TECH_ROUTE_META.industry.lane);
  assert.ok(shared.tree.routes.includes('agriculture'));
  assert.ok(shared.parents.length >= 2);
});

test('科技状态会按当前时代补发已获得科技点', () => {
  const state = gameStateService.createInitialGameState('tech-points-player');
  state.currentEra = 5;

  const normalized = gameStateService.normalizeState(state);

  assert.equal(normalized.techs.points, 7);
  assert.deepEqual(Object.keys(normalized.techs.grants), ['1', '2', '3', '4', '5']);
});

test('时代进阶成功会发放对应科技点', () => {
  const state = gameStateService.createInitialGameState('advance-tech-player');
  state.resources.food = 100;
  state.tutorial = TutorialService.manualAdvance(state.tutorial, 2);

  const result = AdvanceEraAction.execute(state, state.tutorial);

  assert.equal(result.success, true);
  assert.equal(state.currentEra, 1);
  assert.equal(result.techGrant.granted, 1);
  assert.equal(state.techs.points, 1);
});

test('研究科技会消耗科技点并锁定本时代选择', () => {
  const state = gameStateService.createInitialGameState('research-player');
  state.currentEra = 1;
  TechTreeService.grantEarnedEraPoints(state);

  const first = TechTreeService.research(state, 'farming_field_rotation');
  const second = TechTreeService.research(state, 'farming_seed_selection');

  assert.equal(first.success, true);
  assert.equal(state.techs.points, 0);
  assert.equal(state.techs.eraChoices['1'][0], 'farming_field_rotation');
  assert.equal(second.success, false);
  assert.equal(second.error, 'TECH_ERA_CHOICE_FULL');
});

test('进阶科技不能跳过前置科技直接研究', () => {
  const state = gameStateService.createInitialGameState('research-prerequisite-player');
  state.currentEra = 2;
  state.techs.points = 2;

  const blocked = TechTreeService.research(state, 'settlement_logging_rights');
  assert.equal(blocked.success, false);
  assert.equal(blocked.error, 'TECH_PREREQUISITE_MISSING');
  assert.deepEqual(blocked.missingParents, ['farming_field_rotation', 'farming_storehouse_rules']);

  const client = TechTreeService.getClientState(state);
  const settlementTech = client.eras[1].techs.find((tech) => tech.id === 'settlement_logging_rights');
  assert.equal(settlementTech.status, 'missingPrerequisite');
  assert.equal(settlementTech.available, false);
  assert.deepEqual(settlementTech.missingParentNames, ['田块轮作', '储粮约定']);
});

test('客户端科技状态返回完整时代鱼骨图元数据', () => {
  const state = gameStateService.createInitialGameState('client-tech-tree-player');
  state.currentEra = 1;
  TechTreeService.grantEarnedEraPoints(state);

  const client = TechTreeService.getClientState(state);

  assert.equal(client.eras.length, 5);
  const firstEraTech = client.eras[0].techs.find((tech) => tech.id === 'farming_field_rotation');
  const futureTech = client.eras[1].techs.find((tech) => tech.id === 'settlement_logging_rights');
  assert.equal(firstEraTech.status, 'available');
  assert.equal(firstEraTech.tree.column, 1);
  assert.equal(firstEraTech.tree.lane, -4);
  assert.deepEqual(firstEraTech.tree.routes, ['agriculture']);
  assert.equal(futureTech.status, 'locked');
  assert.deepEqual(futureTech.parents, ['farming_field_rotation', 'farming_storehouse_rules']);
  assert.ok(futureTech.tree.routes.includes('industry'));
});

test('交汇科技满足任一前置后可继续转型研究', () => {
  const state = gameStateService.createInitialGameState('research-route-switch-player');
  state.currentEra = 2;
  state.techs.points = 2;

  const base = TechTreeService.research(state, 'farming_field_rotation');
  assert.equal(base.success, true);

  state.techs.points += 1;
  const switched = TechTreeService.research(state, 'settlement_logging_rights');
  assert.equal(switched.success, true);
  assert.equal(state.techs.researched.settlement_logging_rights.id, 'settlement_logging_rights');
});

test('古典时代允许用三个科技点形成组合', () => {
  const state = gameStateService.createInitialGameState('classical-tech-player');
  state.currentEra = 5;
  TechTreeService.grantEarnedEraPoints(state);

  assert.equal(TechTreeService.research(state, 'farming_field_rotation').success, true);
  assert.equal(TechTreeService.research(state, 'settlement_logging_rights').success, true);
  assert.equal(TechTreeService.research(state, 'city_quarry_survey').success, true);
  assert.equal(TechTreeService.research(state, 'frontier_bloomery_signs').success, true);
  assert.equal(TechTreeService.research(state, 'classical_workshop_guilds').success, true);
  assert.equal(TechTreeService.research(state, 'classical_masonry_contracts').success, true);
  assert.equal(TechTreeService.research(state, 'classical_iron_tools').success, true);

  const blocked = TechTreeService.research(state, 'classical_border_codes');
  assert.equal(blocked.success, false);
  assert.equal(blocked.error, 'TECH_ERA_CHOICE_FULL');
  assert.deepEqual(state.techs.eraChoices['5'], [
    'classical_workshop_guilds',
    'classical_masonry_contracts',
    'classical_iron_tools',
  ]);
});

test('古典科技可以解锁后续建筑建造校验', () => {
  const state = gameStateService.createInitialGameState('tech-unlock-building-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.resources = { food: 999, knowledge: 999, wood: 999, iron: 0, stone: 0, metal: 0 };
  TechTreeService.grantEarnedEraPoints(state);

  const locked = BuildingActionValidator.validateBuild(state, state.tutorial, 'workshop');
  assert.equal(locked.allowed, false);

  assert.equal(TechTreeService.research(state, 'farming_field_rotation').success, true);
  assert.equal(TechTreeService.research(state, 'settlement_logging_rights').success, true);
  assert.equal(TechTreeService.research(state, 'city_quarry_survey').success, true);
  assert.equal(TechTreeService.research(state, 'frontier_bloomery_signs').success, true);
  const research = TechTreeService.research(state, 'classical_workshop_guilds');
  assert.equal(research.success, true);

  const unlocked = BuildingActionValidator.validateBuild(state, state.tutorial, 'workshop');
  assert.equal(unlocked.allowed, true);
});

test('石料和铁矿生产建筑通过科技树解锁', () => {
  const state = gameStateService.createInitialGameState('tech-resource-buildings-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.resources = { food: 9999, knowledge: 9999, wood: 9999, stone: 9999, iron: 0, metal: 0 };
  state.techs.points = 5;

  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'quarry').allowed, false);
  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'mine').allowed, false);

  assert.equal(TechTreeService.research(state, 'farming_field_rotation').success, true);
  assert.equal(TechTreeService.research(state, 'settlement_logging_rights').success, true);
  const quarryTech = TechTreeService.research(state, 'city_quarry_survey');
  assert.equal(quarryTech.success, true);
  assert.deepEqual(quarryTech.tech.unlockedBuildings, ['quarry']);
  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'quarry').allowed, true);

  const mineTech = TechTreeService.research(state, 'frontier_bloomery_signs');
  assert.equal(mineTech.success, true);
  assert.deepEqual(mineTech.tech.unlockedBuildings, ['mine']);
  assert.equal(BuildingActionValidator.validateBuild(state, state.tutorial, 'mine').allowed, true);
});

test('主线时代建筑不再作为科技解锁项重复展示', () => {
  const mainlineBuildings = new Set(['farm', 'house', 'lumbermill', 'barracks', 'watchtower']);
  TECHS.forEach((tech) => {
    const unlocked = tech.effects?.unlockedBuildings || [];
    unlocked.forEach((buildingId) => {
      assert.equal(mainlineBuildings.has(buildingId), false, `${tech.id} should not unlock mainline ${buildingId}`);
    });
  });
});
