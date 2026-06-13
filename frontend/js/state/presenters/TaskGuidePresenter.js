(function (global) {
  const CityResourcePresenter = (() => {
    if (global.CityResourcePresenter) return global.CityResourcePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CityResourcePresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class TaskGuidePresenter {
    static buildCityPlanningViewState(state = {}) {
      if (CityResourcePresenter && typeof CityResourcePresenter.buildCityPlanningViewState === 'function') {
        return CityResourcePresenter.buildCityPlanningViewState(state);
      }
      return { terrainLabel: '', text: { habitabilityStatus: '', populationGrowthStatus: '', note: '' } };
    }

    static buildTaskCenterViewState(state = {}, options = {}) {
      const fallbackTabs = [
        { id: 'daily', label: '每日任务', emptyText: '暂无每日任务' },
        { id: 'main', label: '主线任务', emptyText: '暂无主线任务' },
        { id: 'season', label: '赛季任务', emptyText: '暂无赛季任务' },
        { id: 'challenge', label: '挑战任务', emptyText: '暂无挑战任务' },
      ];
      const source = state.taskCenter && typeof state.taskCenter === 'object'
        ? state.taskCenter
        : null;
      const guideTasks = state.guideTasks || {};
      const guideTaskItems = Array.isArray(guideTasks.tasks) ? guideTasks.tasks : [];
      const sourceCategories = source?.categories || {};
      const categories = fallbackTabs.reduce((result, tab) => {
        const sourceCategory = sourceCategories[tab.id] || {};
        const tasks = Array.isArray(sourceCategory.tasks)
          ? sourceCategory.tasks
          : (tab.id === 'main' ? guideTaskItems : []);
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
              actionLabel: task.actionLabel || (completed ? '已完成' : (claimable ? '领取' : '前往')),
              action: completed
                ? null
                : (claimable
                ? { type: 'claimTaskReward', taskId: task.id, category: tab.id }
                : (task.action || { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target })),
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
        visible: source ? source.visible !== false : Boolean(guideTasks.visible && guideTaskItems.length),
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

  global.TaskGuidePresenter = TaskGuidePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TaskGuidePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
