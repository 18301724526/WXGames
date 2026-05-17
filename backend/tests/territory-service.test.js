const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const TerritoryService = require('../services/TerritoryService');

function createClassicalState() {
  const state = gameStateService.createInitialGameState('territory-player');
  state.currentEra = 5;
  state.tutorial.completed = true;
  state.buildings.barracks = { level: 2 };
  state.buildings.watchtower = { level: 1 };
  state.military = { soldiers: 8 };
  return gameStateService.normalizeState(state);
}

test('古典时代会开放首个可侦察领土', () => {
  const state = createClassicalState();
  const territoryState = TerritoryService.getClientTerritoryState(state);

  assert.equal(territoryState.occupiedCount, 1);
  assert.equal(territoryState.territories.find((item) => item.id === 'capital').status, 'occupied');
  assert.equal(territoryState.territories.find((item) => item.id === 'river_plain').status, 'scoutable');
});

test('侦察、出征、完成占领会产生待命名城市并解锁后续领土', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');

  const scout = TerritoryService.scoutTerritory(state, 'river_plain', now);
  assert.equal(scout.success, true);
  assert.equal(TerritoryService.getClientTerritoryState(state).territories.find((item) => item.id === 'river_plain').status, 'scouted');

  const start = TerritoryService.startConquest(state, 'river_plain', 4, now);
  assert.equal(start.success, true);
  assert.equal(TerritoryService.getAvailableSoldiers(state), 4);

  const mission = state.warMissions[0];
  mission.completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  const claim = TerritoryService.claimConquest(state, 'river_plain', now);

  assert.equal(claim.success, true);
  assert.equal(claim.outcome, 'success');
  assert.equal(claim.namingPrompt.type, 'city');
  assert.equal(state.territories.find((item) => item.id === 'river_plain').status, 'occupied');
  assert.equal(state.territories.find((item) => item.id === 'north_forest').status, 'scoutable');
  assert.equal(state.territories.find((item) => item.id === 'hill_outpost').status, 'scoutable');
});

test('城市命名后第二块领土会提示命名势力', () => {
  const state = createClassicalState();
  const now = new Date('2026-05-17T08:00:00.000Z');
  TerritoryService.scoutTerritory(state, 'river_plain', now);
  TerritoryService.startConquest(state, 'river_plain', 4, now);
  state.warMissions[0].completesAt = now.toISOString();
  TerritoryService.updateMissionReadiness(state, now);
  TerritoryService.claimConquest(state, 'river_plain', now);

  const city = TerritoryService.renameCity(state, 'river_plain', '河湾城');
  assert.equal(city.success, true);
  assert.equal(city.namingPrompt.type, 'polity');

  const polity = TerritoryService.renamePolity(state, '赤火联盟');
  assert.equal(polity.success, true);
  assert.equal(state.polity.name, '赤火联盟');
  assert.equal(TerritoryService.getClientTerritoryState(state).namingPrompt, null);
});

test('占领领土效果会汇总到资源和防御加成', () => {
  const state = createClassicalState();
  state.territories.find((item) => item.id === 'river_plain').status = 'occupied';
  state.territories.find((item) => item.id === 'north_forest').status = 'occupied';
  state.territories.find((item) => item.id === 'hill_outpost').status = 'occupied';
  state.territories.find((item) => item.id === 'old_ruins').status = 'occupied';

  const normalized = gameStateService.normalizeState(state);

  assert.equal(normalized.buildingEffects.territoryFoodOutputBonus, 0.05);
  assert.equal(normalized.buildingEffects.territoryWoodOutputBonus, 0.08);
  assert.equal(normalized.buildingEffects.territoryKnowledgeOutputBonus, 0.06);
  assert.equal(normalized.buildingEffects.threatDefense, 4);
});
