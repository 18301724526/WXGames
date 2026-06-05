const TaskDefinitionService = require('./TaskDefinitionService');
const CityService = require('./CityService');

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

function claimTask(gameState, taskId, category = 'main') {
  const taskCenter = getTaskCenter(gameState, { activeTab: category });
  const normalizedCategory = normalizeCategory(category);
  const task = taskCenter.categories[normalizedCategory]?.tasks?.find((item) => item.id === taskId)
    || Object.values(taskCenter.categories).flatMap((item) => item.tasks).find((item) => item.id === taskId);
  if (!task) {
    return { success: false, error: 'TASK_NOT_FOUND', message: '任务不存在' };
  }
  if (task.claimed) {
    return { success: false, error: 'TASK_ALREADY_CLAIMED', message: '任务奖励已领取' };
  }
  if (task.status !== 'claimable') {
    return { success: false, error: 'TASK_NOT_COMPLETED', message: '任务尚未完成' };
  }
  return {
    success: false,
    error: 'TASK_REWARD_PIPELINE_PENDING',
    message: '任务定义已启用，奖励发放链路将在后续强引导步骤接入。',
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
