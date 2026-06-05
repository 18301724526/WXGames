const { TUTORIAL_STEPS } = require('../config/TutorialFlowConfig');
const CityService = require('./CityService');
const TaskDefinitionService = require('./TaskDefinitionService');

const TAB_DEFINITIONS = Object.freeze([
  { id: 'daily', label: '每日任务', emptyText: '暂无每日任务' },
  { id: 'main', label: '主线任务', emptyText: '暂无主线任务' },
  { id: 'season', label: '赛季任务', emptyText: '暂无赛季任务' },
  { id: 'challenge', label: '挑战任务', emptyText: '暂无挑战任务' },
]);

function normalizeCategory(category) {
  return TAB_DEFINITIONS.some((tab) => tab.id === category) ? category : 'main';
}

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
  if (condition.type === 'tutorialStepAtLeast') {
    return Math.max(0, Number(gameState.tutorial?.currentStep) || 0) >= Math.max(0, Number(condition.step) || 0);
  }
  if (condition.type === 'eventClaimed') {
    return (gameState.eventHistory || []).some((event) => event?.id === condition.eventId);
  }
  return false;
}

function buildTaskView(gameState, task) {
  const progress = getTaskProgress(gameState);
  const claimed = Boolean(progress.claimed[task.id]);
  const conditionMet = isTaskConditionMet(gameState, task.condition);
  const status = claimed ? 'completed' : (conditionMet ? 'claimable' : 'active');
  return {
    id: task.id,
    category: task.category,
    title: task.title,
    description: task.description,
    target: task.target,
    status,
    claimed,
    progress: conditionMet ? 1 : 0,
    progressText: conditionMet ? '已达成' : '进行中',
    reward: task.reward,
    rewardText: task.rewardText,
    action: status === 'claimable'
      ? { type: 'claimTaskReward', taskId: task.id, category: task.category }
      : (task.action || { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }),
  };
}

function buildCategories(gameState, definitions = TaskDefinitionService.loadDefinitions()) {
  return TAB_DEFINITIONS.reduce((result, tab) => {
    const tasks = definitions.tasks
      .filter((task) => task.category === tab.id)
      .map((task) => buildTaskView(gameState, task));
    result[tab.id] = {
      id: tab.id,
      label: tab.label,
      emptyText: tab.emptyText,
      tasks,
    };
    return result;
  }, {});
}

function getTaskCenter(gameState, options = {}) {
  const definitions = TaskDefinitionService.loadDefinitions();
  const categories = buildCategories(gameState, definitions);
  const tabs = TAB_DEFINITIONS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    badge: categories[tab.id].tasks.filter((task) => task.status === 'claimable' && !task.claimed).length,
    count: categories[tab.id].tasks.length,
  }));
  const allTasks = Object.values(categories).flatMap((category) => category.tasks);
  return {
    visible: true,
    activeTab: normalizeCategory(options.activeTab),
    tabs,
    categories,
    definitions: {
      version: definitions.version,
      hash: definitions.hash,
      importedAt: definitions.importedAt,
      importedBy: definitions.importedBy,
      source: definitions.source,
    },
    summary: {
      claimableCount: allTasks.filter((task) => task.status === 'claimable' && !task.claimed).length,
      activeCount: allTasks.filter((task) => ['active', 'claimable'].includes(task.status)).length,
      totalCount: allTasks.length,
    },
  };
}

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

function maybeAdvanceTutorialAfterClaim(gameState, taskId) {
  const tutorial = gameState.tutorial || {};
  if (tutorial.completed || tutorial.disabled) return tutorial;
  let nextStep = null;
  if (taskId === 'main_first_supplies') nextStep = TUTORIAL_STEPS.farmPrepReserved;
  if (taskId === 'main_lumbermill_supplies') nextStep = TUTORIAL_STEPS.era3AdvanceReady;
  if (!Number.isFinite(nextStep) || (Number(tutorial.currentStep) || 0) >= nextStep) return tutorial;
  gameState.tutorial = {
    ...tutorial,
    currentStep: nextStep,
    phaseCompleted: {
      ...(tutorial.phaseCompleted || {}),
      newbie: true,
      era2: nextStep >= TUTORIAL_STEPS.era3AdvanceReady || Boolean(tutorial.phaseCompleted?.era2),
    },
    updatedAt: new Date().toISOString(),
  };
  return gameState.tutorial;
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

function findTaskView(taskCenter, taskId, category) {
  const normalizedCategory = normalizeCategory(category);
  return taskCenter.categories[normalizedCategory]?.tasks?.find((item) => item.id === taskId)
    || Object.values(taskCenter.categories).flatMap((item) => item.tasks).find((item) => item.id === taskId);
}

function claimTask(gameState, taskId, category = 'main') {
  const definitions = TaskDefinitionService.loadDefinitions();
  const definitionTask = definitions.tasks.find((item) => item.id === taskId);
  const taskCenter = getTaskCenter(gameState, { activeTab: category });
  const task = findTaskView(taskCenter, taskId, category);
  if (!task || !definitionTask) {
    return { success: false, error: 'TASK_NOT_FOUND', message: '任务不存在' };
  }
  if (task.claimed) {
    return { success: false, error: 'TASK_ALREADY_CLAIMED', message: '任务奖励已领取' };
  }
  if (task.status !== 'claimable') {
    return { success: false, error: 'TASK_NOT_COMPLETED', message: '任务尚未完成' };
  }

  const reward = applyTaskReward(gameState, definitionTask.reward || task.reward);
  if (!reward.success) {
    return {
      success: false,
      error: 'TASK_REWARD_INVALID',
      message: '任务奖励配置异常',
      rewardErrors: reward.errors,
    };
  }

  const progress = getTaskProgress(gameState);
  const claimedAt = new Date().toISOString();
  progress.claimed[task.id] = {
    claimedAt,
    category: task.category,
    reward: { resources: reward.resources },
  };
  const nextTutorial = maybeAdvanceTutorialAfterClaim(gameState, task.id);

  return {
    success: true,
    message: '任务奖励已领取',
    taskId: task.id,
    category: task.category,
    reward: { resources: reward.resources },
    rewardText: task.rewardText,
    rewardReveal: buildRewardReveal(task, reward.resources),
    claimedAt,
    tutorial: nextTutorial,
  };
}

module.exports = {
  TAB_DEFINITIONS,
  buildCategories,
  buildTaskView,
  getTaskCenter,
  getTaskProgress,
  isTaskConditionMet,
  claimTask,
  normalizeCategory,
};
