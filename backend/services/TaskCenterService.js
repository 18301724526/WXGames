const GuideTaskService = require('./GuideTaskService');

const TAB_DEFINITIONS = Object.freeze([
  { id: 'daily', label: '每日任务', emptyText: '暂无每日任务' },
  { id: 'main', label: '主线任务', emptyText: '暂无主线任务' },
  { id: 'season', label: '赛季任务', emptyText: '暂无赛季任务' },
  { id: 'challenge', label: '挑战任务', emptyText: '暂无挑战任务' },
]);

function normalizeCategory(category) {
  return TAB_DEFINITIONS.some((tab) => tab.id === category) ? category : 'main';
}

function buildMainTask(task) {
  const canClaim = task?.status === 'claimable' && !task?.claimed;
  return {
    ...task,
    category: 'main',
    source: 'guide',
    action: canClaim
      ? { type: 'claimTaskReward', taskId: task.id, category: 'main' }
      : task.action,
  };
}

function buildCategories(gameState) {
  const guideTasks = GuideTaskService.getGuideTasks(gameState);
  const mainTasks = Array.isArray(guideTasks.tasks)
    ? guideTasks.tasks.map(buildMainTask)
    : [];
  return TAB_DEFINITIONS.reduce((result, tab) => {
    result[tab.id] = {
      id: tab.id,
      label: tab.label,
      emptyText: tab.emptyText,
      tasks: tab.id === 'main' ? mainTasks : [],
    };
    return result;
  }, {});
}

function summarize(categories) {
  const tasks = Object.values(categories)
    .flatMap((category) => Array.isArray(category.tasks) ? category.tasks : []);
  return {
    claimableCount: tasks.filter((task) => task.status === 'claimable' && !task.claimed).length,
    activeCount: tasks.filter((task) => ['active', 'claimable'].includes(task.status)).length,
    totalCount: tasks.length,
  };
}

function getTaskCenter(gameState, options = {}) {
  const categories = buildCategories(gameState);
  const summary = summarize(categories);
  const tabs = TAB_DEFINITIONS.map((tab) => {
    const tasks = categories[tab.id]?.tasks || [];
    return {
      id: tab.id,
      label: tab.label,
      badge: tasks.filter((task) => task.status === 'claimable' && !task.claimed).length,
      count: tasks.length,
    };
  });
  return {
    visible: true,
    activeTab: normalizeCategory(options.activeTab),
    tabs,
    categories,
    summary,
  };
}

function claimTask(gameState, taskId, category = 'main') {
  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory !== 'main') {
    return {
      success: false,
      error: 'TASK_CATEGORY_EMPTY',
      message: '该分类暂无可领取任务',
    };
  }
  return GuideTaskService.claimReward(gameState, taskId);
}

module.exports = {
  TAB_DEFINITIONS,
  getTaskCenter,
  claimTask,
  normalizeCategory,
};
