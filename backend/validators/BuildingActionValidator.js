const BuildingConfig = require('../config/BuildingConfig');
const BuildingState = require('../domain/BuildingState');
const BuildingUnlockService = require('../services/BuildingUnlockService');
const BuildingCostCalculator = require('../calculators/BuildingCostCalculator');
const TutorialService = require('../services/TutorialService');
const GuideTaskService = require('../services/GuideTaskService');

function hasEnoughResources(resources, cost) {
  return Object.entries(cost || {}).every(([key, value]) => (resources?.[key] || 0) >= value);
}

function validateBuild(gameState, tutorialState, buildingId) {
  const payload = { target: buildingId };
  const expectedGuideAction = GuideTaskService.getExpectedAction(gameState);
  const tutorialCheck = GuideTaskService.matchesExpectedAction(expectedGuideAction, 'build', payload)
    ? { allowed: true }
    : TutorialService.validateAction(tutorialState, 'build', payload, gameState);
  if (!tutorialCheck.allowed) return tutorialCheck;
  if (!BuildingConfig.hasBuilding(buildingId)) return { allowed: false, code: 'BUILDING_NOT_FOUND', message: '建筑不存在' };
  if (!BuildingUnlockService.isUnlocked(buildingId, gameState.currentEra, gameState)) return { allowed: false, code: 'ERA_NOT_UNLOCKED', message: '时代未解锁' };
  if (BuildingState.isBuilt(gameState.buildings, buildingId)) return { allowed: false, code: 'BUILDING_ALREADY_EXISTS', message: '建筑已建造' };
  const cost = BuildingCostCalculator.getBuildCost(buildingId);
  if (!hasEnoughResources(gameState.resources, cost)) return { allowed: false, code: 'INSUFFICIENT_RESOURCES', message: '资源不足' };
  return { allowed: true, cost };
}

function validateUpgrade(gameState, tutorialState, buildingId) {
  const payload = { target: buildingId };
  const expectedGuideAction = GuideTaskService.getExpectedAction(gameState);
  const tutorialCheck = GuideTaskService.matchesExpectedAction(expectedGuideAction, 'upgrade', payload)
    ? { allowed: true }
    : TutorialService.validateAction(tutorialState, 'upgrade', payload, gameState);
  if (!tutorialCheck.allowed) return tutorialCheck;
  if (!BuildingConfig.hasBuilding(buildingId)) return { allowed: false, code: 'BUILDING_NOT_FOUND', message: '建筑不存在' };
  if (!BuildingState.isBuilt(gameState.buildings, buildingId)) return { allowed: false, code: 'BUILDING_NOT_BUILT', message: '建筑尚未建造' };
  const currentLevel = BuildingState.getLevel(gameState.buildings, buildingId);
  if (!BuildingConfig.canUpgrade(buildingId, currentLevel)) return { allowed: false, code: 'MAX_LEVEL_REACHED', message: '已达到最高级' };
  const cost = BuildingCostCalculator.getUpgradeCost(buildingId, currentLevel);
  if (!cost) return { allowed: false, code: 'MAX_LEVEL_REACHED', message: '已达到最高级' };
  if (!hasEnoughResources(gameState.resources, cost)) return { allowed: false, code: 'INSUFFICIENT_RESOURCES', message: '资源不足' };
  return { allowed: true, cost, currentLevel };
}

module.exports = {
  validateBuild,
  validateUpgrade,
  hasEnoughResources,
};
