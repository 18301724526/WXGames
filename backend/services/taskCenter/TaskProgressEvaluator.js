const CityService = require('../CityService');
const TaskRewardGrantLedger = require('./TaskRewardGrantLedger');

function getTaskProgress(gameState) {
  if (!gameState.taskProgress || typeof gameState.taskProgress !== 'object') {
    gameState.taskProgress = { claimed: {} };
  }
  if (!gameState.taskProgress.claimed || typeof gameState.taskProgress.claimed !== 'object') {
    gameState.taskProgress.claimed = {};
  }
  return gameState.taskProgress;
}

function getBuildingLevel(gameState, buildingId) {
  const city = CityService.getActiveCity(gameState);
  const entry = city?.buildings?.[buildingId] || gameState?.buildings?.[buildingId];
  return Math.max(0, Number(entry?.level || entry || 0) || 0);
}

function isTaskConditionMet(gameState, condition = {}) {
  if (!condition || condition.type === 'always') return true;
  if (condition.type === 'all' || condition.type === 'and') {
    return (condition.conditions || []).every((item) => isTaskConditionMet(gameState, item));
  }
  if (condition.type === 'any' || condition.type === 'or') {
    return (condition.conditions || []).some((item) => isTaskConditionMet(gameState, item));
  }
  if (condition.type === 'buildingLevel') {
    return getBuildingLevel(gameState, condition.buildingId) >= Math.max(1, Number(condition.count) || 1);
  }
  if (condition.type === 'eraAtLeast') {
    return Math.max(0, Number(gameState.currentEra) || 0) >= Math.max(0, Number(condition.era) || 0);
  }
  if (condition.type === 'taskRewardGranted') {
    const grantType = String(condition.grantType || '').trim();
    const grantKey = String(condition.grantKey || '').trim();
    if (!grantKey) return false;
    if (grantType === 'soldiers') return Boolean(TaskRewardGrantLedger.getSoldierGrant(gameState, grantKey));
    if (grantType === 'famousPersons') return Boolean(TaskRewardGrantLedger.getFamousPersonGrant(gameState, grantKey));
    return false;
  }
  if (condition.type === 'eventClaimed') {
    return (gameState.eventHistory || []).some((event) => event?.id === condition.eventId);
  }
  return false;
}

module.exports = {
  getBuildingLevel,
  getTaskProgress,
  isTaskConditionMet,
};
