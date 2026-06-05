const ProgressEvaluator = require('./TaskProgressEvaluator');
const { TAB_DEFINITIONS, normalizeCategory } = require('./TaskCenterTabs');

function buildTaskView(gameState, task) {
  const progress = ProgressEvaluator.getTaskProgress(gameState);
  const claimed = Boolean(progress.claimed[task.id]);
  const conditionMet = ProgressEvaluator.isTaskConditionMet(gameState, task.condition);
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

function buildCategories(gameState, definitions = {}) {
  return TAB_DEFINITIONS.reduce((result, tab) => {
    const tasks = (definitions.tasks || [])
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

function buildTabs(categories) {
  return TAB_DEFINITIONS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    badge: categories[tab.id].tasks.filter((task) => task.status === 'claimable' && !task.claimed).length,
    count: categories[tab.id].tasks.length,
  }));
}

function getTaskCenter(gameState, definitions, options = {}) {
  const categories = buildCategories(gameState, definitions);
  const tabs = buildTabs(categories);
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

module.exports = {
  buildCategories,
  buildTabs,
  buildTaskView,
  getTaskCenter,
};
