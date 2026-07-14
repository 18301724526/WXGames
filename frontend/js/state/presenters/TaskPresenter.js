(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class TaskPresenter {
    static t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static buildTaskCenterViewState(state = {}, options = {}) {
      const fallbackTabs = [
        { id: 'daily', label: this.t('task.daily', {}), emptyText: this.t('task.empty.daily', {}) },
        { id: 'main', label: this.t('task.main', {}), emptyText: this.t('task.empty.main', {}) },
        { id: 'season', label: this.t('task.season', {}), emptyText: this.t('task.empty.season', {}) },
        { id: 'challenge', label: this.t('task.challenge', {}), emptyText: this.t('task.empty.challenge', {}) },
      ];
      const source = state.taskCenter && typeof state.taskCenter === 'object'
        ? state.taskCenter
        : null;
      const sourceCategories = source?.categories || {};
      const categories = fallbackTabs.reduce((result, tab) => {
        const sourceCategory = sourceCategories[tab.id] || {};
        const tasks = Array.isArray(sourceCategory.tasks) ? sourceCategory.tasks : [];
        result[tab.id] = {
          id: tab.id,
          label: sourceCategory.label || tab.label,
          emptyText: sourceCategory.emptyText || tab.emptyText,
          tasks: tasks.map((task) => {
            const claimable = task.status === 'claimable' && !task.claimed;
            const completed = task.status === 'completed';
            return {
              ...task,
              category: task.category || tab.id,
              actionLabel: completed
                ? this.t('task.action.completed', {})
                : (claimable ? this.t('task.action.claim', {}) : ''),
              action: completed
                ? null
                : (claimable
                  ? { type: 'claimTaskReward', taskId: task.id, category: tab.id }
                  : null),
            };
          }),
        };
        return result;
      }, {});

      const summaryTasks = Object.values(categories)
        .flatMap((category) => category.tasks || []);
      const summary = source?.summary || {
        claimableCount: summaryTasks.filter((task) => task.status === 'claimable' && !task.claimed).length,
        activeCount: summaryTasks.filter((task) => ['active', 'claimable'].includes(task.status)).length,
        totalCount: summaryTasks.length,
      };
      const sourceTabs = Array.isArray(source?.tabs) && source.tabs.length ? source.tabs : fallbackTabs;
      const activeTab = fallbackTabs.some((tab) => tab.id === options.activeTab)
        ? options.activeTab
        : (fallbackTabs.some((tab) => tab.id === source?.activeTab) ? source.activeTab : 'main');

      return {
        visible: Boolean(source && source.visible !== false),
        activeTab,
        tabs: sourceTabs.map((tab) => ({
          id: tab.id,
          label: tab.label || fallbackTabs.find((item) => item.id === tab.id)?.label || tab.id,
          badge: Number(tab.badge) || 0,
          count: Number(tab.count) || categories[tab.id]?.tasks?.length || 0,
          isActive: tab.id === activeTab,
        })),
        categories,
        activeCategory: categories[activeTab] || categories.main,
        summary,
      };
    }

  }

  global.TaskPresenter = TaskPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TaskPresenter;
})(typeof window !== 'undefined' ? window : globalThis);
