const TAB_DEFINITIONS = Object.freeze([
  { id: 'daily', label: '每日任务', emptyText: '暂无每日任务' },
  { id: 'main', label: '主线任务', emptyText: '暂无主线任务' },
  { id: 'season', label: '赛季任务', emptyText: '暂无赛季任务' },
  { id: 'challenge', label: '挑战任务', emptyText: '暂无挑战任务' },
]);

function normalizeCategory(category) {
  return TAB_DEFINITIONS.some((tab) => tab.id === category) ? category : 'main';
}

module.exports = {
  TAB_DEFINITIONS,
  normalizeCategory,
};
