const CityService = require('../CityService');
const TaskDefinitionService = require('../TaskDefinitionService');

function addResources(target, source = {}) {
  Object.entries(source || {}).forEach(([key, value]) => {
    const amount = Number(value) || 0;
    if (amount > 0) {
      target[key] = Math.round(((Number(target[key]) || 0) + amount) * 1000) / 1000;
    }
  });
  return target;
}

function applyTaskReward(gameState, reward = {}) {
  CityService.normalizeCities(gameState);
  const city = CityService.getActiveCity(gameState);
  const hasResolvedResources = reward.resources && Object.keys(reward.resources).length > 0;
  const resolved = hasResolvedResources
    ? { resources: reward.resources, errors: [] }
    : TaskDefinitionService.resolveRewardResources(reward);
  if (resolved.errors?.length) return { success: false, errors: resolved.errors, resources: {} };
  city.resources = addResources(city.resources || {}, resolved.resources);
  CityService.syncActiveCityToLegacyFields(gameState);
  return { success: true, errors: [], resources: resolved.resources };
}

function buildRewardReveal(task, resources) {
  return {
    title: '任务奖励',
    subtitle: task.title,
    rewardText: task.rewardText,
    resources,
    createdAt: Date.now(),
  };
}

module.exports = {
  addResources,
  applyTaskReward,
  buildRewardReveal,
};
