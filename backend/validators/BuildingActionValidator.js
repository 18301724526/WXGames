const { BuildingConfig } = require('../services/config/GameplayConfigRuntime');
const { TUTORIAL_STEPS, stepBefore } = require('../../shared/tutorialFlowConfig');
const BuildingState = require('../modules/BuildingState');
const BuildingUnlockService = require('../services/BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const CityService = require('../services/CityService');

function hasEnoughResources(resources, cost) {
  return Object.entries(cost || {}).every(([key, value]) => (resources?.[key] || 0) >= value);
}

function getActiveCityBuildings(gameState) {
  return CityService.getActiveCity(gameState)?.buildings || gameState.buildings;
}

function getActiveCityResources(gameState) {
  return CityService.getActiveCity(gameState)?.resources || gameState.resources;
}

function isTutorialHouseBuild(tutorialState, buildingId) {
  return buildingId === 'house'
    && !tutorialState?.completed
    && !tutorialState?.disabled
    && stepBefore(tutorialState?.currentStep, TUTORIAL_STEPS.houseBuilt);
}

function validateBuild(gameState, tutorialState, buildingId) {
  if (!BuildingConfig.hasBuilding(buildingId)) {
    return { allowed: false, code: 'BUILDING_NOT_FOUND', message: '建筑不存在' };
  }
  if (!isTutorialHouseBuild(tutorialState, buildingId) && !BuildingUnlockService.isUnlocked(buildingId, gameState.currentEra, gameState)) {
    return { allowed: false, code: 'ERA_NOT_UNLOCKED', message: '时代尚未解锁' };
  }
  if (BuildingState.isBuilt(getActiveCityBuildings(gameState), buildingId)) {
    return { allowed: false, code: 'BUILDING_ALREADY_EXISTS', message: '建筑已存在' };
  }
  const cost = BuildingCostCalculator.getBuildCost(buildingId);
  if (!hasEnoughResources(getActiveCityResources(gameState), cost)) {
    return { allowed: false, code: 'INSUFFICIENT_RESOURCES', message: '资源不足' };
  }
  return { allowed: true, cost };
}

function validateUpgrade(gameState, tutorialState, buildingId) {
  if (!BuildingConfig.hasBuilding(buildingId)) {
    return { allowed: false, code: 'BUILDING_NOT_FOUND', message: '建筑不存在' };
  }
  if (!BuildingState.isBuilt(getActiveCityBuildings(gameState), buildingId)) {
    return { allowed: false, code: 'BUILDING_NOT_BUILT', message: '建筑尚未建造' };
  }
  const currentLevel = BuildingState.getLevel(getActiveCityBuildings(gameState), buildingId);
  if (!BuildingConfig.canUpgrade(buildingId, currentLevel)) {
    return { allowed: false, code: 'MAX_LEVEL_REACHED', message: '已达到最高级' };
  }
  const cost = BuildingCostCalculator.getUpgradeCost(buildingId, currentLevel);
  if (!cost) return { allowed: false, code: 'MAX_LEVEL_REACHED', message: '已达到最高级' };
  if (!hasEnoughResources(getActiveCityResources(gameState), cost)) {
    return { allowed: false, code: 'INSUFFICIENT_RESOURCES', message: '资源不足' };
  }
  return { allowed: true, cost, currentLevel };
}

module.exports = {
  validateBuild,
  validateUpgrade,
  hasEnoughResources,
};
