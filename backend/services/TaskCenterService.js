const TAB_DEFINITIONS = Object.freeze([
  { id: 'daily', label: '每日任务', emptyText: '0.2 任务系统开发中' },
  { id: 'main', label: '主线任务', emptyText: '0.2 主线系统开发中' },
  { id: 'season', label: '赛季任务', emptyText: '0.2 赛季系统开发中' },
  { id: 'challenge', label: '挑战任务', emptyText: '0.2 挑战系统开发中' },
]);

function normalizeCategory(category) {
  return TAB_DEFINITIONS.some((tab) => tab.id === category) ? category : 'main';
}

function buildCategories() {
  return TAB_DEFINITIONS.reduce((result, tab) => {
    result[tab.id] = {
      id: tab.id,
      label: tab.label,
      emptyText: tab.emptyText,
      tasks: [],
    };
    return result;
  }, {});
}

function getTaskCenter(gameState, options = {}) {
  const categories = buildCategories(gameState);
  const tabs = TAB_DEFINITIONS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    badge: 0,
    count: 0,
  }));
  return {
    visible: true,
    activeTab: normalizeCategory(options.activeTab),
    tabs,
    categories,
    summary: {
      claimableCount: 0,
      activeCount: 0,
      totalCount: 0,
    },
  };
}

function claimTask() {
  return {
    success: false,
    error: 'TASK_SYSTEM_DISABLED',
    message: '0.2 task system is under development.',
  };
}

module.exports = {
  TAB_DEFINITIONS,
  getTaskCenter,
  claimTask,
  normalizeCategory,
};
