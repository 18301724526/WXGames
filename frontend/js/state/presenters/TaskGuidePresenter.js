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

  const HomePresenter = (() => {
    if (global.HomePresenter) return global.HomePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./HomePresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class TaskGuidePresenter {
    static t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static buildCityPlanningViewState(state = {}) {
      if (HomePresenter && typeof HomePresenter.buildCityPlanningViewState === 'function') {
        return HomePresenter.buildCityPlanningViewState(state);
      }
      return { terrainLabel: '', text: { habitabilityStatus: '', populationGrowthStatus: '', note: '' } };
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
              actionLabel: task.actionLabel || (completed
                ? this.t('task.action.completed', {})
                : (claimable ? this.t('task.action.claim', {}) : this.t('task.action.go', {}))),
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

    static buildGuidebookViewState(state = {}, options = {}) {
      const fallbackCategories = [
        {
          id: 'resources',
          label: this.t('guidebook.resources.label', {}),
          title: this.t('guidebook.resources.title', {}),
          lines: [this.t('guidebook.resources.line', {})],
        },
        {
          id: 'planning',
          label: this.t('guidebook.planning.label', {}),
          title: this.t('guidebook.planning.title', {}),
          lines: [this.t('guidebook.planning.line', {})],
        },
        {
          id: 'policy',
          label: this.t('guidebook.policy.label', {}),
          title: this.t('guidebook.policy.title', {}),
          lines: [this.t('guidebook.policy.line', {})],
        },
        {
          id: 'military',
          label: this.t('guidebook.military.label', {}),
          title: this.t('guidebook.military.title', {}),
          lines: [this.t('guidebook.military.line', {})],
        },
        {
          id: 'events',
          label: this.t('guidebook.events.label', {}),
          title: this.t('guidebook.events.title', {}),
          lines: [this.t('guidebook.events.line', {})],
        },
      ];
      const sourceCategories = Array.isArray(state.guidebook?.categories) && state.guidebook.categories.length
        ? state.guidebook.categories
        : fallbackCategories;
      const activeTab = sourceCategories.some((category) => category.id === options.activeTab)
        ? options.activeTab
        : (sourceCategories.some((category) => category.id === state.guidebook?.activeTab) ? state.guidebook.activeTab : 'planning');
      const planningBuilder = typeof options.buildCityPlanningViewState === 'function'
        ? options.buildCityPlanningViewState
        : this.buildCityPlanningViewState;
      const planning = planningBuilder(state);
      const categories = sourceCategories.map((category) => ({
        id: category.id,
        label: category.label || category.id,
        title: category.title || category.label || category.id,
        lines: Array.isArray(category.lines) ? category.lines : [],
        isActive: category.id === activeTab,
      }));
      return {
        activeTab,
        title: this.t('guidebook.title', {}),
        subtitle: `${planning.terrainLabel} · ${planning.text.habitabilityStatus}`,
        planning,
        categories,
        activeCategory: categories.find((category) => category.id === activeTab) || categories[0] || fallbackCategories[1],
      };
    }
  }

  global.TaskGuidePresenter = TaskGuidePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = TaskGuidePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
