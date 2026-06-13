(function (global) {
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
    static buildCityPlanningViewState(state = {}) {
      if (HomePresenter && typeof HomePresenter.buildCityPlanningViewState === 'function') {
        return HomePresenter.buildCityPlanningViewState(state);
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

    static buildGuidebookViewState(state = {}, options = {}) {
      const fallbackCategories = [
        {
          id: 'resources',
          label: '资源',
          title: '资源产出',
          lines: ['粮食支撑人口，木材支撑建设，知识推动时代。'],
        },
        {
          id: 'planning',
          label: '规划',
          title: '城市规划',
          lines: ['宜居度来自建筑搭配与城市地理，不同城市适合不同建设方向。'],
        },
        {
          id: 'policy',
          label: '方针',
          title: '人才方针',
          lines: ['方针会按照当前已解锁职业重新分配人才。'],
        },
        {
          id: 'military',
          label: '军事',
          title: '军事扩张',
          lines: ['兵营会训练士兵，侦察与占领会逐步打开更大的世界。'],
        },
        {
          id: 'events',
          label: '事件',
          title: '事件威胁',
          lines: ['普通事件提供机会，威胁事件考验城市守备。'],
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
        title: '攻略',
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
