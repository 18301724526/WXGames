(function (global) {
  const sharedTileMapManifest = (() => {
    if (global.TileMapAssetManifest) return global.TileMapAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/TileMapAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const sharedTileMapGeometry = (() => {
    if (global.TileMapGeometry) return global.TileMapGeometry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/TileMapGeometry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const TechPresenter = (() => {
    if (global.TechPresenter) return global.TechPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/TechPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const FamousPersonPresenter = (() => {
    if (global.FamousPersonPresenter) return global.FamousPersonPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/FamousPersonPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const TalentPolicyPresenter = (() => {
    if (global.TalentPolicyPresenter) return global.TalentPolicyPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/TalentPolicyPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BuildingPresenter = (() => {
    if (global.BuildingPresenter) return global.BuildingPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/BuildingPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const HomePresenter = (() => {
    if (global.HomePresenter) return global.HomePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/HomePresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const EventPresenter = (() => {
    if (global.EventPresenter) return global.EventPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/EventPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class UIStatePresenter {
    static POPULATION_PER_OFFICIAL = 100;
    static MIN_EXPEDITION_SOLDIERS = 100;

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static trimDecimal(value) {
      return String(value).replace(/\.0$/, '');
    }

    static formatCompactNumber(value, options = {}) {
      const number = this.toNumber(value);
      const floorSmall = options.floorSmall !== false;
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) {
        return floorSmall ? Math.floor(number) : this.trimDecimal(Math.round(number * 100) / 100);
      }
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${this.trimDecimal(scaled.toFixed(1))}${unit.suffix}`;
    }

    static formatResourceAmount(value) {
      return this.formatCompactNumber(value, { floorSmall: true });
    }

    static formatRate(value) {
      const number = this.toNumber(value);
      return `${number >= 0 ? '+' : ''}${this.formatCompactNumber(number, { floorSmall: false })}/s`;
    }

    static calculatePopulationGrowthMultiplier(...args) {
      return HomePresenter.calculatePopulationGrowthMultiplier(...args);
    }

    static formatPopulationGrowthStatus(...args) {
      return HomePresenter.formatPopulationGrowthStatus(...args);
    }

    static toDisplayPopulation(officials) {
      return this.toInteger(officials) * this.POPULATION_PER_OFFICIAL;
    }

    static formatNegativeRate(value) {
      return `-${this.formatCompactNumber(Math.abs(this.toNumber(value)), { floorSmall: false })}/s`;
    }

    static buildAuthCredentialViewState(credentials = {}) {
      const rememberPasswordChecked = Boolean(credentials.rememberEnabled);
      return {
        rememberPasswordChecked,
        usernameValue: credentials.rememberedUsername || credentials.username || '',
        passwordValue: rememberPasswordChecked ? (credentials.rememberedPassword || '') : '',
      };
    }

    static buildAuthShellViewState(options = {}) {
      const authenticated = Boolean(options.authenticated);
      return {
        loginPanelVisible: !authenticated,
        appVisible: authenticated,
        message: authenticated ? '' : (options.message || ''),
      };
    }

    static buildTutorialHighlightViewState(rect = {}, viewport = {}) {
      const innerWidth = Math.max(0, this.toNumber(viewport.innerWidth));
      const innerHeight = Math.max(0, this.toNumber(viewport.innerHeight));
      const target = {
        top: this.toNumber(rect.top),
        left: this.toNumber(rect.left),
        width: this.toNumber(rect.width),
        height: this.toNumber(rect.height),
        bottom: this.toNumber(rect.bottom, this.toNumber(rect.top) + this.toNumber(rect.height)),
      };

      const overlayPadding = 8;
      const overlayTop = Math.max(6, target.top - overlayPadding);
      const overlayLeft = Math.max(6, target.left - overlayPadding);
      const overlayWidth = Math.max(28, Math.min(innerWidth - overlayLeft - 6, target.width + overlayPadding * 2));
      const overlayHeight = Math.max(28, Math.min(innerHeight - overlayTop - 6, target.height + overlayPadding * 2));

      const bubbleWidth = 220;
      const bubbleHeight = 72;
      const horizontalPadding = 12;
      const viewportTopPadding = 12;
      const prefersBelow = target.top < bubbleHeight + 28;
      const bubbleTop = prefersBelow
        ? Math.min(innerHeight - bubbleHeight - viewportTopPadding, target.bottom + 14)
        : Math.max(viewportTopPadding, target.top - bubbleHeight - 14);
      const bubbleLeft = Math.max(
        horizontalPadding,
        Math.min(innerWidth - bubbleWidth - horizontalPadding, target.left + target.width / 2 - bubbleWidth / 2),
      );

      const pointerWidth = 24;
      const pointerHeight = 28;
      const pointerTop = Math.max(
        12,
        Math.min(innerHeight - pointerHeight - 12, target.bottom + 6),
      );
      const pointerLeft = Math.max(
        12,
        Math.min(innerWidth - pointerWidth - 12, target.left + target.width / 2 - pointerWidth / 2),
      );

      return {
        overlay: {
          top: `${overlayTop}px`,
          left: `${overlayLeft}px`,
          width: `${overlayWidth}px`,
          height: `${overlayHeight}px`,
        },
        bubble: {
          top: `${bubbleTop}px`,
          left: `${bubbleLeft}px`,
          maxWidth: '',
        },
        pointer: {
          top: `${pointerTop}px`,
          left: `${pointerLeft}px`,
        },
      };
    }

    static buildTabNavigationViewState(state = {}, options = {}) {
      const requestedTab = options.requestedTab || state.currentTab || 'resources';
      const activeTab = requestedTab === 'territory' ? 'military' : requestedTab;
      const tabs = ['resources', 'civilization', 'buildings', 'events', 'military'];
      const pages = ['resources', 'civilization', 'buildings', 'events', 'military'];
      return {
        activeTab,
        requestedTab,
        tabs: tabs.map((id) => ({
          id,
          isActive: id === activeTab,
        })),
        pages: pages.map((id) => ({
          id,
          isActive: id === activeTab,
        })),
      };
    }

    static hasWorldTileMap(state = {}) {
      const tiles = state?.territoryState?.worldMap?.tiles;
      return Array.isArray(tiles) && tiles.length > 0;
    }

    static canUseMapHome(state = {}) {
      return true;
    }

    static resolveMapHomeViewState(state = {}, options = {}) {
      const requestedTab = options.requestedTab || options.activeTab || state.currentTab || 'resources';
      const activeTab = requestedTab === 'territory' ? 'military' : requestedTab;
      const requestedMilitaryView = ['army', 'scout', 'world'].includes(options.militaryView)
        ? options.militaryView
        : (['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army');
      const canUseMapHome = this.canUseMapHome(state);
      const homeRequested = !requestedTab || requestedTab === 'resources' || requestedTab === 'territory';
      const forceMapHome = Boolean(options.forceMapHome || options.isMapHome);
      const militaryMapRequested = requestedTab === 'military'
        && (forceMapHome || requestedMilitaryView === 'world');
      const shouldUseMapHome = canUseMapHome
        && options.allowDefaultMapHome !== false
        && (forceMapHome || homeRequested || militaryMapRequested);
      const resolvedActiveTab = shouldUseMapHome ? 'military' : activeTab;
      const resolvedMilitaryView = shouldUseMapHome ? 'world' : requestedMilitaryView;
      return {
        activeTab: resolvedActiveTab,
        requestedTab,
        militaryView: resolvedMilitaryView,
        isMapHome: shouldUseMapHome,
        canUseMapHome,
      };
    }

    static buildTabLockViewState(tabs = [], canOpenTab = () => true) {
      return tabs.map((tab) => {
        const id = tab.id || tab.tabId || '';
        const allowed = Boolean(canOpenTab(id));
        return {
          id,
          disabled: !allowed,
          isLocked: !allowed,
        };
      });
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
      const planning = this.buildCityPlanningViewState(state);
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

    static buildResourceViewState(...args) {
      return HomePresenter.buildResourceViewState(...args);
    }

    static getActiveCity(...args) {
      return HomePresenter.getActiveCity(...args);
    }

    static buildCityPlanningViewState(...args) {
      return HomePresenter.buildCityPlanningViewState(...args);
    }

    static buildPopulationViewState(...args) {
      return HomePresenter.buildPopulationViewState(...args);
    }

    static buildHomeFeatureViewState(state = {}, options = {}) {
      return HomePresenter.buildHomeFeatureViewState(state, {
        ...options,
        buildTaskCenterViewState: (sourceState) => this.buildTaskCenterViewState(sourceState),
      });
    }

    static formatFamousPersonSource(...args) {
      return FamousPersonPresenter.formatFamousPersonSource(...args);
    }

    static getFamousPersonEffectLabels(...args) {
      return FamousPersonPresenter.getFamousPersonEffectLabels(...args);
    }

    static getFamousPersonAttributeLabel(...args) {
      return FamousPersonPresenter.getFamousPersonAttributeLabel(...args);
    }

    static formatFamousPersonPercent(...args) {
      return FamousPersonPresenter.formatFamousPersonPercent(...args);
    }

    static formatFamousPersonSkillKind(...args) {
      return FamousPersonPresenter.formatFamousPersonSkillKind(...args);
    }

    static formatFamousPersonCastCondition(...args) {
      return FamousPersonPresenter.formatFamousPersonCastCondition(...args);
    }

    static formatFamousPersonCooldownText(...args) {
      return FamousPersonPresenter.formatFamousPersonCooldownText(...args);
    }

    static formatFamousPersonCastRate(...args) {
      return FamousPersonPresenter.formatFamousPersonCastRate(...args);
    }

    static formatFamousPersonEffectSentence(...args) {
      return FamousPersonPresenter.formatFamousPersonEffectSentence(...args);
    }

    static buildFamousPersonSkillDescription(...args) {
      return FamousPersonPresenter.buildFamousPersonSkillDescription(...args);
    }

    static sanitizeFamousPersonSkillDescription(...args) {
      return FamousPersonPresenter.sanitizeFamousPersonSkillDescription(...args);
    }

    static formatFamousPersonSkillDetail(...args) {
      return FamousPersonPresenter.formatFamousPersonSkillDetail(...args);
    }

    static formatFamousPersonSkill(...args) {
      return FamousPersonPresenter.formatFamousPersonSkill(...args);
    }

    static getFamousPersonAbilities(...args) {
      return FamousPersonPresenter.getFamousPersonAbilities(...args);
    }

    static getFamousPersonQualityInfo(...args) {
      return FamousPersonPresenter.getFamousPersonQualityInfo(...args);
    }

    static getNextFamousAttributePointLevel(...args) {
      return FamousPersonPresenter.getNextFamousAttributePointLevel(...args);
    }

    static sortFamousPeopleForRoster(...args) {
      return FamousPersonPresenter.sortFamousPeopleForRoster(...args);
    }

    static formatFamousAutoGrowthText(...args) {
      return FamousPersonPresenter.formatFamousAutoGrowthText(...args);
    }

    static buildFamousPersonCard(...args) {
      return FamousPersonPresenter.buildFamousPersonCard(...args);
    }

    static buildFamousPersonViewState(...args) {
      return FamousPersonPresenter.buildFamousPersonViewState(...args);
    }

    static getDefaultTalentPolicyDraft(...args) {
      return TalentPolicyPresenter.getDefaultTalentPolicyDraft(...args);
    }

    static makeTalentPolicyName(...args) {
      return TalentPolicyPresenter.makeTalentPolicyName(...args);
    }

    static getTalentPolicyAvailableRoles(...args) {
      return TalentPolicyPresenter.getTalentPolicyAvailableRoles(...args);
    }

    static applyTalentPolicyTierModifiers(...args) {
      return TalentPolicyPresenter.applyTalentPolicyTierModifiers(...args);
    }

    static allocateTalentByWeights(...args) {
      return TalentPolicyPresenter.allocateTalentByWeights(...args);
    }

    static buildTalentPolicyDraftPreview(...args) {
      return TalentPolicyPresenter.buildTalentPolicyDraftPreview(...args);
    }

    static buildTalentPolicyViewState(...args) {
      return TalentPolicyPresenter.buildTalentPolicyViewState(...args);
    }

    static buildCitySwitcherViewState(...args) {
      return HomePresenter.buildCitySwitcherViewState(...args);
    }

    static canAdvanceEraByTutorial(state = {}, tutorial = {}) {
      if (tutorial.completed) return true;
      const step = Number(tutorial.currentStep) || 0;
      if (this.toNumber(state.currentEra) === 0) return step >= 2;
      if (this.toNumber(state.currentEra) === 1) return step >= 9;
      return true;
    }

    static buildEraConditionViewState(condition = {}) {
      return {
        name: condition.name || '',
        met: Boolean(condition.met),
        className: condition.met ? 'met' : 'unmet',
        progressText: `${condition.current}/${condition.required}`,
      };
    }

    static buildCivilizationViewState(state = {}, tutorial = {}, options = {}) {
      const eraName = state.currentEraName || '原始时代';
      const progress = state.eraProgress || { percentage: 0, canAdvance: false, conditions: [] };
      const percentage = Math.max(0, Math.min(100, this.toNumber(progress.percentage)));
      const canAdvanceByTutorial = this.canAdvanceEraByTutorial(state, tutorial);
      const canOpenCivilizationTab = options.canOpenCivilizationTab !== false;
      const canAdvance = Boolean(progress.canAdvance)
        && state.isCapitalCity !== false
        && canAdvanceByTutorial
        && canOpenCivilizationTab;

      let advanceLabel = '条件不足，无法进阶';
      if (state.isCapitalCity === false) advanceLabel = '分城跟随主城时代';
      else if (progress.canAdvance && !canAdvanceByTutorial) advanceLabel = '引导未解锁';
      else if (progress.canAdvance) advanceLabel = '满足条件，可进阶';

      return {
        text: {
          eraName,
          civOverviewEraName: eraName,
          civOverviewDay: `第 ${state.gameDay || 1} 天`,
          civOverviewPop: this.toDisplayPopulation(state.population?.total),
          civOverviewBuildings: this.toInteger(state.totalBuildings),
          civOverviewTechs: `${Object.keys(state.techs || {}).length}/0`,
          civOverviewHappiness: `${state.happiness || 100}%`,
          eraProgressText: `总进度: ${percentage}%`,
          eraTargetName: progress.targetEraName || '时代未开放',
          advanceLabel,
          featureDescription: state.currentEraDescription || `${eraName}：继续建设你的文明。`,
        },
        progress: {
          percentage,
          width: `${percentage}%`,
          canAdvance: Boolean(progress.canAdvance),
        },
        advanceButton: {
          disabled: !canAdvance,
          canAdvance,
          canAdvanceByTutorial,
          canOpenCivilizationTab,
        },
        conditions: (progress.conditions || []).map((condition) => this.buildEraConditionViewState(condition)),
      };
    }

    static buildMilitaryNavigationViewState(state = {}) {
      const requestedView = ['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army';
      const activeView = requestedView;
      const views = ['army', 'scout', 'world'].map((id) => {
        return {
          id,
          isActive: id === activeView,
          disabled: false,
          isLocked: false,
          title: '',
          ariaSelected: String(id === activeView),
        };
      });
      return {
        activeView,
        locked: false,
        views,
      };
    }

    static buildAdvisorViewState(guide = {}) {
      const message = guide?.message || '';
      return {
        hidden: !message,
        activeAdvisor: message ? { message, target: guide?.target || null } : null,
        text: {
          message: message || '暂无建议。',
        },
        goButton: {
          disabled: !message || !guide?.target,
        },
        closeModal: !message,
      };
    }

    static getAdvisorTargetTab(target) {
      if (target === 'scout-action-first') return 'military';
      if (target === 'tab-territory') return 'territory';
      if (typeof target === 'string' && target.startsWith('tab-')) return target.slice(4);
      return null;
    }

    static buildNamingPromptViewState(prompt = {}) {
      const type = prompt?.type || '';
      return {
        title: prompt?.title || '命名',
        message: prompt?.message || '',
        placeholder: type === 'polity' ? '例如：赤火联盟' : '例如：河湾城',
        maxLength: 12,
        key: `${type}:${prompt?.territoryId || 'polity'}`,
        prompt: prompt || null,
      };
    }

    static buildRecentLogViewState(entries = []) {
      const items = (entries || []).slice(0, 20).map((entry) => ({
        text: typeof entry === 'string' ? entry : (entry?.text ?? ''),
      }));
      return {
        isEmpty: items.length === 0,
        emptyText: '暂无日志',
        items,
      };
    }

    static buildRequestLogViewState(logs = []) {
      const items = (logs || []).slice(0, 20).map((log) => {
        const statusCode = this.toInteger(log.statusCode);
        return {
          timestamp: log.timestamp || '',
          endpoint: `${log.method || ''} ${log.path || ''}`.trim(),
          statusCode,
          durationText: `${this.toInteger(log.duration)}ms`,
          isError: statusCode >= 400 || statusCode === 0,
        };
      });
      return {
        isEmpty: items.length === 0,
        emptyText: '暂无请求记录',
        items,
      };
    }

    static buildTerritorySummaryViewState(territoryState = {}) {
      const polityName = territoryState.polity?.name || territoryState.polity?.capitalCityName || '未命名势力';
      return {
        text: {
          polityName,
          territoryCount: `${territoryState.occupiedCount || 0}/${territoryState.discoveredCount || 0} 已控制`,
        },
      };
    }

    static getBuildingLevel(...args) {
      return BuildingPresenter.getBuildingLevel(...args);
    }

    static getBuildingActionLabel(...args) {
      return BuildingPresenter.getBuildingActionLabel(...args);
    }

    static isBuildingOpenEnded(...args) {
      return BuildingPresenter.isBuildingOpenEnded(...args);
    }

    static getExtraBuildingEffectEfficiency(...args) {
      return BuildingPresenter.getExtraBuildingEffectEfficiency(...args);
    }

    static getVisibleBuildingIds(...args) {
      return BuildingPresenter.getVisibleBuildingIds(...args);
    }

    static getBuildingConfig(...args) {
      return BuildingPresenter.getBuildingConfig(...args);
    }

    static getBuildingCategoryDefinitions(...args) {
      return BuildingPresenter.getBuildingCategoryDefinitions(...args);
    }

    static getBuildingCategory(...args) {
      return BuildingPresenter.getBuildingCategory(...args);
    }

    static buildBuildingCategoryTabs(...args) {
      return BuildingPresenter.buildBuildingCategoryTabs(...args);
    }

    static buildCostViewState(...args) {
      return BuildingPresenter.buildCostViewState(...args);
    }

    static getBuildingEffectSummary(...args) {
      return BuildingPresenter.getBuildingEffectSummary(...args);
    }

    static calculateBuildingEffectBonus(...args) {
      return BuildingPresenter.calculateBuildingEffectBonus(...args);
    }

    static formatBuildingEffectValue(...args) {
      return BuildingPresenter.formatBuildingEffectValue(...args);
    }

    static formatMilitaryEffectParts(...args) {
      return BuildingPresenter.formatMilitaryEffectParts(...args);
    }

    static formatBuildingEffectText(...args) {
      return BuildingPresenter.formatBuildingEffectText(...args);
    }

    static getBuildingEffectText(...args) {
      return BuildingPresenter.getBuildingEffectText(...args);
    }

    static getResourceDisplayName(...args) {
      return BuildingPresenter.getResourceDisplayName(...args);
    }

    static getMaintenanceResourceKeys(...args) {
      return BuildingPresenter.getMaintenanceResourceKeys(...args);
    }

    static formatHabitabilityPressure(...args) {
      return BuildingPresenter.formatHabitabilityPressure(...args);
    }

    static formatHabitabilityPressureShort(...args) {
      return BuildingPresenter.formatHabitabilityPressureShort(...args);
    }

    static formatBuildingScale(...args) {
      return BuildingPresenter.formatBuildingScale(...args);
    }

    static formatMaintenanceRate(...args) {
      return BuildingPresenter.formatMaintenanceRate(...args);
    }

    static formatBuildingMaintenanceText(...args) {
      return BuildingPresenter.formatBuildingMaintenanceText(...args);
    }

    static formatBuildingCityImpactText(...args) {
      return BuildingPresenter.formatBuildingCityImpactText(...args);
    }

    static getBuildingMilitaryLines(...args) {
      return BuildingPresenter.getBuildingMilitaryLines(...args);
    }

    static canAffordCost(...args) {
      return BuildingPresenter.canAffordCost(...args);
    }

    static buildBuildingCardViewState(...args) {
      return BuildingPresenter.buildBuildingCardViewState(...args);
    }

    static buildBuildingViewState(...args) {
      return BuildingPresenter.buildBuildingViewState(...args);
    }

    static getEventResourceLabel(...args) {
      return EventPresenter.getEventResourceLabel(...args);
    }

    static formatEventResourcePart(...args) {
      return EventPresenter.formatEventResourcePart(...args);
    }

    static buildEventResourcePart(...args) {
      return EventPresenter.buildEventResourcePart(...args);
    }

    static formatEventDuration(...args) {
      return EventPresenter.formatEventDuration(...args);
    }

    static formatEventBuffEffect(...args) {
      return EventPresenter.formatEventBuffEffect(...args);
    }

    static formatEventEffect(...args) {
      return EventPresenter.formatEventEffect(...args);
    }

    static buildEventEffectPart(...args) {
      return EventPresenter.buildEventEffectPart(...args);
    }

    static formatEventEffects(...args) {
      return EventPresenter.formatEventEffects(...args);
    }

    static buildEventEffectParts(...args) {
      return EventPresenter.buildEventEffectParts(...args);
    }

    static formatEventRequirements(...args) {
      return EventPresenter.formatEventRequirements(...args);
    }

    static buildEventRequirementParts(...args) {
      return EventPresenter.buildEventRequirementParts(...args);
    }

    static formatEventReward(...args) {
      return EventPresenter.formatEventReward(...args);
    }

    static buildEventRewardParts(...args) {
      return EventPresenter.buildEventRewardParts(...args);
    }

    static getEventOptionRewardText(...args) {
      return EventPresenter.getEventOptionRewardText(...args);
    }

    static getEventOptionRewardParts(...args) {
      return EventPresenter.getEventOptionRewardParts(...args);
    }

    static getEventOptionCostText(...args) {
      return EventPresenter.getEventOptionCostText(...args);
    }

    static getEventOptionCostParts(...args) {
      return EventPresenter.getEventOptionCostParts(...args);
    }

    static getEventOptionPenaltyText(...args) {
      return EventPresenter.getEventOptionPenaltyText(...args);
    }

    static getEventOptionPenaltyParts(...args) {
      return EventPresenter.getEventOptionPenaltyParts(...args);
    }

    static buildEventOptionRows(...args) {
      return EventPresenter.buildEventOptionRows(...args);
    }

    static getEventOptionPreview(...args) {
      return EventPresenter.getEventOptionPreview(...args);
    }

    static getRemainingSeconds(...args) {
      return EventPresenter.getRemainingSeconds(...args);
    }

    static formatRemainingTime(...args) {
      return EventPresenter.formatRemainingTime(...args);
    }

    static getEventHint(...args) {
      return EventPresenter.getEventHint(...args);
    }

    static buildEventCardViewState(...args) {
      return EventPresenter.buildEventCardViewState(...args);
    }

    static buildEventHistoryItemViewState(...args) {
      return EventPresenter.buildEventHistoryItemViewState(...args);
    }

    static buildEventViewState(...args) {
      return EventPresenter.buildEventViewState(...args);
    }

    static buildEventModalViewState(...args) {
      return EventPresenter.buildEventModalViewState(...args);
    }

    static buildTechViewState(state = {}) {
      if (TechPresenter && typeof TechPresenter.buildTechViewState === 'function') {
        return TechPresenter.buildTechViewState(state);
      }
      return { points: 0, researchedCount: 0, availableCount: 0, eras: [], nodes: [], links: [], treeEras: [], selectedTech: null };
    }

    static buildMilitaryViewState(state = {}) {
      const military = state.military || {};
      const soldiers = this.toInteger(military.soldiers);
      const cap = this.toInteger(military.soldierCap);
      const defense = this.toInteger((military.defense || 0) + (state.buildingEffects?.threatDefense || 0));
      const interval = this.toInteger(military.trainingIntervalSeconds);
      const progress = this.toInteger(military.trainingProgress);
      const batchSize = this.toInteger(military.trainingBatchSize, 1);
      const availableSoldiers = this.toInteger(state.territoryState?.availableSoldiers ?? military.availableSoldiers ?? soldiers);
      const soldiersOnMission = this.toInteger(state.territoryState?.soldiersOnMission ?? military.soldiersOnMission ?? 0);
      const cityId = state.activeCityId || state.cityState?.activeCityId || 'capital';
      const people = Array.isArray(state.famousPersons?.people) ? state.famousPersons.people : [];
      const peopleById = new Map(people.map((person) => [person.id, person]));
      const rawFormations = military.formations && typeof military.formations === 'object' ? military.formations : {};
      const cityFormations = Array.isArray(rawFormations[cityId]) ? rawFormations[cityId] : [];
      const maxFormationMembers = 5;
      const formationNames = ['部队一', '部队二', '部队三'];
      const formations = [1, 2, 3].map((slot) => {
        const rawFormation = cityFormations.find((item) => Number(item?.slot) === slot) || cityFormations[slot - 1] || {};
        const memberIds = Array.isArray(rawFormation.memberIds) ? rawFormation.memberIds : [];
        const members = memberIds
          .map((personId) => peopleById.get(personId))
          .filter(Boolean)
          .map((person) => this.buildFamousPersonCard(person));
        return {
          slot,
          cityId,
          name: rawFormation.name || formationNames[slot - 1] || `部队${slot}`,
          memberIds: members.map((member) => member.id),
          members,
          leader: members[0] || null,
          memberCount: members.length,
          maxMembers: maxFormationMembers,
          isEmpty: members.length === 0,
        };
      });
      const formationPeople = this.sortFamousPeopleForRoster(people).map((person) => this.buildFamousPersonCard(person));

      let trainingText = `下一批 ${batchSize} 兵 · ${progress}/${interval} 秒`;
      let trainingProgressWidth = interval > 0
        ? `${Math.max(0, Math.min(100, Math.floor((progress / interval) * 100)))}%`
        : '0%';

      if (soldiers >= cap && cap > 0) {
        trainingText = '训练已满';
        trainingProgressWidth = '100%';
      } else if (cap <= 0 || interval <= 0) {
        trainingText = '等待兵营';
        trainingProgressWidth = '0%';
      }

      return {
        text: {
          soldierCount: `${soldiers}/${cap}`,
          militaryDefense: defense,
          availableSoldierCount: availableSoldiers,
          soldiersOnMission,
          soldierTrainingText: trainingText,
        },
        training: {
          progressWidth: trainingProgressWidth,
        },
        formations,
        formationPeople,
        formationMeta: {
          cityId,
          maxSlots: 3,
          maxMembers: maxFormationMembers,
          summary: `3 支部队 · 每队最多 ${maxFormationMembers} 名名人`,
        },
      };
    }

    static getScoutMissionRemainingSeconds(mission, nowMs = Date.now()) {
      if (!mission) return 0;
      if (mission.status === 'ready') return 0;
      const completesAtMs = new Date(mission.completesAt).getTime();
      if (Number.isFinite(completesAtMs)) {
        return Math.max(0, Math.ceil((completesAtMs - nowMs) / 1000));
      }
      return Math.max(0, Math.ceil(Number(mission.remainingSeconds) || 0));
    }

    static formatScoutCountdown(seconds) {
      const value = Math.max(0, Math.ceil(Number(seconds) || 0));
      const minutes = Math.floor(value / 60);
      const rest = value % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    static buildScoutControlViewState(state = {}, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const territoryState = state.territoryState || {};

      const directions = Array.isArray(territoryState.directions) ? territoryState.directions : [];
      const scoutMissions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
      const scoutReports = Array.isArray(territoryState.scoutReports) ? territoryState.scoutReports : [];
      const activeByDirection = new Map(scoutMissions.map((mission) => [mission.direction, mission]));
      const activeScouts = scoutMissions.filter((mission) => mission.status === 'active');
      const activeScout = activeScouts[0];
      const readyCount = scoutMissions.filter((mission) => mission.status === 'ready').length;
      const maxActiveScouts = Math.max(1, this.toInteger(territoryState.maxActiveScouts || 1));

      let statusText = `选择方向派出侦察队；同一时间最多可有 ${maxActiveScouts} 支侦察队在外。`;
      if (readyCount > 0 && activeScouts.length > 0) {
        statusText = `${readyCount} 份报告待查看，另有 ${activeScouts.length} 支侦察队仍在外。`;
      } else if (readyCount > 0) {
        statusText = `${readyCount} 份侦察报告待查看，你仍可继续派出侦察队。`;
      } else if (activeScouts.length > 1) {
        statusText = `${activeScouts.length} 支侦察队在外行动，最早一支约 ${this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(activeScout, nowMs))} 后返回。`;
      } else if (activeScout) {
        const label = directions.find((direction) => direction.id === activeScout.direction)?.label || '外部';
        statusText = `${label}侦察中，预计 ${this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(activeScout, nowMs))} 后返回。`;
      }

      const labels = new Map(directions.map((direction) => [direction.id, direction.label]));
      const order = [
        ['nw', '西北'], ['n', '北'], ['ne', '东北'],
        ['w', '西'], ['center', '本城'], ['e', '东'],
        ['sw', '西南'], ['s', '南'], ['se', '东南'],
      ];
      const cells = order.map(([id, fallbackLabel]) => {
        if (id === 'center') {
          return {
            type: 'center',
            label: '城',
            subLabel: '本城',
          };
        }
        if (!labels.has(id)) return null;
        const label = labels.get(id) || fallbackLabel;
        const mission = activeByDirection.get(id);
        if (mission?.status === 'ready') {
          return {
            type: 'button',
            id,
            direction: id,
            status: 'ready',
            disabled: false,
            action: 'claim',
            actionValue: mission.id,
            ariaLabel: `${label}侦察报告`,
            label,
            actionText: '报告',
          };
        }
        if (mission) {
          return {
            type: 'button',
            id,
            direction: id,
            status: 'active',
            disabled: true,
            action: '',
            actionValue: '',
            ariaLabel: `${label}侦察中`,
            label,
            actionText: this.formatScoutCountdown(this.getScoutMissionRemainingSeconds(mission, nowMs)),
          };
        }
        if (activeScouts.length >= maxActiveScouts) {
          return {
            type: 'button',
            id,
            direction: id,
            status: 'locked',
            disabled: true,
            action: '',
            actionValue: '',
            ariaLabel: `${label}侦察暂不可用`,
            label,
            actionText: '等待',
          };
        }
        return {
          type: 'button',
          id,
          direction: id,
          status: 'available',
          disabled: false,
          action: 'scout',
          actionValue: id,
          ariaLabel: `向${label}派出侦察`,
          label,
          actionText: '派出',
        };
      }).filter(Boolean);

      return {
        statusText,
        cells,
        reports: scoutReports,
      };
    }

    static getWorldRadarPosition(site, maxDistance) {
      const rx = Number(site.relativeX ?? site.x ?? 0);
      const ry = Number(site.relativeY ?? site.y ?? 0);
      const offset = UIStatePresenter.relativeVisualOffset(rx, ry, site.id || '');
      const x = rx + offset.x;
      const y = ry + offset.y;
      const distance = Math.max(0, Math.hypot(x, y));
      const normalized = Math.sqrt(Math.min(1, distance / Math.max(1, maxDistance)));
      const radius = distance > 0 ? 12 + normalized * 30 : 0;
      const angle = Math.atan2(y, x || 0.0001);
      return {
        x,
        y,
        distance,
        angle,
        radius,
      };
    }

    static relativeVisualOffset(x, y, seedHint = '') {
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const seed = Math.abs((x * 92821) + (y * 68917) + String(seedHint).length * 131);
      const distance = Math.max(1, Math.max(Math.abs(x), Math.abs(y)));
      const lateralX = (UIStatePresenter.seededNoise(seed + 11) - 0.5) * 0.44;
      const lateralY = (UIStatePresenter.seededNoise(seed + 23) - 0.5) * 0.44;
      const radial = (UIStatePresenter.seededNoise(seed + 37) - 0.5) * 0.22;
      return {
        x: UIStatePresenter.roundOffset(lateralX + (x / distance) * radial),
        y: UIStatePresenter.roundOffset(lateralY + (y / distance) * radial),
      };
    }

    static seededNoise(seed) {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    }

    static roundOffset(value) {
      return Math.round(value * 100) / 100;
    }

    static measureWorldRadarSpacing(candidate, placed) {
      if (!placed.length) return Infinity;
      return placed.reduce((best, existing) => Math.min(
        best,
        Math.hypot(candidate.left - existing.left, candidate.top - existing.top),
      ), Infinity);
    }

    static resolveWorldRadarPosition(anchor, placed) {
      if (anchor.distance === 0) return { left: 50, top: 50 };
      const angleOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];
      const radiusOffsets = [0, 2.5, -2, 5, -3.5, 7];
      const minSpacing = 9.5;
      let bestCandidate = null;

      for (const radiusOffset of radiusOffsets) {
        for (const angleOffset of angleOffsets) {
          const candidateAngle = anchor.angle + angleOffset * (Math.PI / 18);
          const candidateRadius = Math.max(10, Math.min(40, anchor.radius + radiusOffset + Math.abs(angleOffset) * 0.2));
          const candidate = {
            left: 50 + Math.cos(candidateAngle) * candidateRadius,
            top: 50 + Math.sin(candidateAngle) * candidateRadius,
          };
          if (candidate.left < 8 || candidate.left > 92 || candidate.top < 8 || candidate.top > 92) continue;
          const spacing = this.measureWorldRadarSpacing(candidate, placed);
          if (spacing >= minSpacing) return candidate;
          if (!bestCandidate || spacing > bestCandidate.spacing) {
            bestCandidate = { ...candidate, spacing };
          }
        }
      }

      return bestCandidate || {
        left: Math.max(8, Math.min(92, 50 + Math.cos(anchor.angle) * anchor.radius)),
        top: Math.max(8, Math.min(92, 50 + Math.sin(anchor.angle) * anchor.radius)),
      };
    }

    static buildWorldRadarLayout(territories = []) {
      const maxDistance = Math.max(
        1,
        ...territories.map((site) => Math.hypot(
          Number(site.relativeX ?? site.x ?? 0),
          Number(site.relativeY ?? site.y ?? 0),
        )),
      );
      const sorted = [...territories].sort((a, b) => {
        if (a.id === 'capital') return -1;
        if (b.id === 'capital') return 1;
        const aAnchor = this.getWorldRadarPosition(a, maxDistance);
        const bAnchor = this.getWorldRadarPosition(b, maxDistance);
        return aAnchor.distance - bAnchor.distance || aAnchor.angle - bAnchor.angle || String(a.id).localeCompare(String(b.id));
      });
      const placed = [];
      const layout = new Map();

      sorted.forEach((site) => {
        const anchor = this.getWorldRadarPosition(site, maxDistance);
        const resolved = this.resolveWorldRadarPosition(anchor, placed);
        const position = {
          left: resolved.left.toFixed(2),
          top: resolved.top.toFixed(2),
        };
        placed.push({
          id: site.id,
          left: Number(position.left),
          top: Number(position.top),
        });
        layout.set(site.id, position);
      });

      return layout;
    }

    static getWorldMapSignature(territories = []) {
      return JSON.stringify((territories || []).map((site) => ({
        id: site.id,
        x: site.x,
        y: site.y,
        relativeX: site.relativeX ?? null,
        relativeY: site.relativeY ?? null,
        visualOffset: site.visualOffset || null,
        status: site.status,
        owner: site.owner,
        type: site.type,
        art: site.art,
        name: site.cityName || site.naturalName,
      })));
    }

    static formatWorldSiteEffect(effects = {}) {
      const parts = [];
      if (effects.foodOutputMultiplier) parts.push(`食物 +${Math.round(effects.foodOutputMultiplier * 100)}%`);
      if (effects.woodOutputMultiplier) parts.push(`木材 +${Math.round(effects.woodOutputMultiplier * 100)}%`);
      if (effects.knowledgeOutputMultiplier) parts.push(`知识 +${Math.round(effects.knowledgeOutputMultiplier * 100)}%`);
      if (effects.threatDefense) parts.push(`边境防御 +${effects.threatDefense}`);
      return parts.join('，') || '无';
    }

    static formatWorldSiteStatus(site = {}) {
      const labels = {
        discovered: '已发现',
        contested: '出征中',
        occupied: '已控制',
      };
      return labels[site.status] || site.status || '';
    }

    static formatWorldSiteOwner(site = {}) {
      if (site.owner === 'player') return '我方';
      if (site.owner === 'neutral') return '无主';
      const labels = {
        tribe: '部落',
        city_state: '城邦',
        ruin_guardians: '遗迹守军',
      };
      const ownerLabel = labels[site.owner] || site.owner || '未知势力';
      return `有主 · ${ownerLabel}`;
    }

    static formatWorldDuration(seconds) {
      const value = Math.max(0, Math.ceil(Number(seconds) || 0));
      const minutes = Math.floor(value / 60);
      const rest = value % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    static getWorldSiteMarchInfo(site = {}, territoryState = {}) {
      const mission = site.mission || null;
      const totalSeconds = Math.max(0, Math.floor(mission?.durationSeconds || territoryState.missionDurationSeconds || 0));
      if (site.status === 'contested' && mission?.status === 'ready') {
        return totalSeconds > 0 ? `行军耗时 ${this.formatWorldDuration(totalSeconds)}，已抵达待接管` : '已抵达待接管';
      }
      if (site.status === 'contested') {
        const remaining = this.formatWorldDuration(mission?.remainingSeconds || 0);
        return totalSeconds > 0 ? `行军耗时 ${this.formatWorldDuration(totalSeconds)}，剩余 ${remaining}` : `剩余 ${remaining}`;
      }
      if (site.status === 'discovered' && totalSeconds > 0) {
        return `行军耗时 ${this.formatWorldDuration(totalSeconds)}`;
      }
      return '';
    }

    static buildWorldExpeditionDraftViewState(site = {}, uiState = {}, famousPersons = {}) {
      const recommended = Math.max(this.MIN_EXPEDITION_SOLDIERS, Number(site?.recommendedSoldiers) || Number(site?.defense) || this.MIN_EXPEDITION_SOLDIERS);
      const people = Array.isArray(famousPersons.people) ? famousPersons.people : [];
      const firstLeader = people.find((person) => Array.isArray(person.roles) && person.roles.includes('military')) || null;
      return {
        territoryId: uiState.expeditionConfigSiteId || '',
        troopType: uiState.expeditionTroopType || 'unavailable',
        leader: uiState.expeditionLeader || firstLeader?.id || 'unavailable',
        soldiers: Math.max(this.MIN_EXPEDITION_SOLDIERS, Number(uiState.expeditionSoldiers) || recommended),
        recommended,
      };
    }

    static buildWorldExpeditionConfigViewState(site = {}, territoryState = {}, uiState = {}) {
      const draft = this.buildWorldExpeditionDraftViewState(site, uiState, territoryState.famousPersons || {});
      const availableSoldiers = this.toInteger(territoryState.availableSoldiers);
      const famousPeople = Array.isArray(territoryState.famousPersons?.people) ? territoryState.famousPersons.people : [];
      const militaryLeaders = famousPeople
        .filter((person) => Array.isArray(person.roles) && person.roles.includes('military'))
        .map((person) => ({
          value: person.id,
          label: `${person.name || '无名之士'} · ${person.title || person.archetypeLabel || '名人'}`,
        }));
      const leaderOptions = militaryLeaders.length ? militaryLeaders : [{ value: 'unavailable', label: '无名领队' }];
      const hasLeader = leaderOptions.some((option) => option.value === draft.leader);
      return {
        siteId: site.id || '',
        draft,
        availableSoldiers,
        disabled: availableSoldiers < draft.soldiers || !hasLeader,
        note: `建议 ${site.recommendedSoldiers || site.defense || this.MIN_EXPEDITION_SOLDIERS} 士兵，当前可用 ${availableSoldiers} 士兵`,
        fields: {
          troopType: {
            label: '兵种',
            value: draft.troopType,
            options: [{ value: 'unavailable', label: '暂未开放' }],
            note: '暂未开放',
          },
          leader: {
            label: '领队',
            value: draft.leader,
            options: leaderOptions,
            note: militaryLeaders.length ? '选择一位名人作为领队' : '临时领队可出征，接纳军事名人后会形成战报特色',
          },
          soldiers: {
            label: '出征数量',
            value: draft.soldiers,
            min: this.MIN_EXPEDITION_SOLDIERS,
            step: this.MIN_EXPEDITION_SOLDIERS,
          },
        },
        buttons: {
          cancel: { label: '取消', action: 'close-expedition' },
          launch: { label: '出发', action: 'launch-expedition' },
        },
      };
    }

    static makeWorldSiteActionButton(label, action, territoryId, options = {}) {
      return {
        label,
        action: action || '',
        territoryId: territoryId || '',
        disabled: Boolean(options.disabled),
        secondary: Boolean(options.secondary),
      };
    }

    static buildWorldSiteActionViewState(site = {}, territoryState = {}, uiState = {}) {
      const availableSoldiers = this.toInteger(territoryState.availableSoldiers);
      const mission = site.mission || null;
      if (site.status === 'discovered') {
        const isOwnedTarget = site.occupationMode === 'conquest';
        const expanded = uiState.expeditionConfigSiteId === site.id;
        const directDisabled = availableSoldiers < this.MIN_EXPEDITION_SOLDIERS;
        return {
          kind: 'group',
          buttons: [
            this.makeWorldSiteActionButton('交涉', '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('掠夺', '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('占领', isOwnedTarget ? 'open-expedition' : 'conquer', site.id, {
              disabled: !isOwnedTarget && directDisabled,
            }),
          ],
          hint: isOwnedTarget ? '该地区已有势力，需要先配置出征队伍。' : '该地区无主，派出 100 士兵即可建立据点。',
          expeditionConfig: isOwnedTarget && expanded
            ? this.buildWorldExpeditionConfigViewState(site, territoryState, uiState)
            : null,
        };
      }
      if (site.status === 'contested' && mission?.status === 'ready') {
        const action = mission.mode === 'settlement' ? 'claim' : 'enter-battle';
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton(action === 'claim' ? '完成占领' : '进入战斗', action, site.id)],
          hint: '',
          expeditionConfig: null,
        };
      }
      if (site.status === 'contested') {
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton('行军中', '', site.id, { disabled: true })],
          hint: '',
          expeditionConfig: null,
        };
      }
      if (site.status === 'occupied') {
        return {
          kind: 'city-command',
          buttons: [
            this.makeWorldSiteActionButton('入城', 'enter-city', site.id),
            this.makeWorldSiteActionButton('行军', 'march-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('调动', 'transfer-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('驻守', 'garrison-city', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('佣工', 'labor-city', site.id, { secondary: true }),
            this.makeWorldSiteActionButton('改名', 'rename-city', site.id, { secondary: true }),
          ],
          hint: '选择入城进入建设、人口与驻军管理；行军、调动、驻守后续接军团系统。',
          expeditionConfig: null,
        };
      }
      return {
        kind: 'single',
        buttons: [this.makeWorldSiteActionButton('等待侦察', '', site.id, { disabled: true })],
        hint: '',
        expeditionConfig: null,
      };
    }

    static getWorldSiteLastBattleNote(site = {}) {
      if (!site.lastBattle) return '';
      if (site.lastBattle.mode === 'settlement') return '最近一次行动已顺利建立据点';
      const result = site.lastBattle.success ? '上次占领成功' : '上次占领失败';
      const leader = site.lastBattle.leaderName ? ` · ${site.lastBattle.leaderName}率队` : '';
      return `${result}${leader} · 损失 ${site.lastBattle.casualties || 0} 士兵`;
    }

    static getWorldSiteBattleReportLines(site = {}) {
      const report = site.lastBattle?.report;
      if (!report) return [];
      const lines = [report.summary || '战斗已经结束。'];
      if (['speed-basic-attack-v1', 'speed-skill-cooldown-v1', 'attribute-auto-battle-v1', 'attribute-auto-battle-v2'].includes(report.system)) {
        lines.push(`速度：己方 ${report.attacker?.speed || 0} / 敌方 ${report.defender?.speed || 0}`);
        if (report.moraleEffectEnabled === false) lines.push('士气：已记录，暂不影响伤害');
      } else if (report.skillName) lines.push(`关键技能：${report.skillName}`);
      const lastRound = Array.isArray(report.rounds) && report.rounds.length ? report.rounds[report.rounds.length - 1] : null;
      if (lastRound) {
        lines.push(`终局兵力：己方 ${lastRound.attackerSoldiers || 0} / 敌方 ${lastRound.defenderSoldiers || 0}`);
      } else if (report.attacker || report.defender) {
        lines.push(`终局兵力：己方 ${report.attacker?.soldiersEnd || 0} / 敌方 ${report.defender?.soldiersEnd || 0}`);
      }
      return lines.slice(0, 4);
    }

    static getWorldSiteDefenderLeaderLine(site = {}) {
      const leader = site.garrison?.leader || site.defenderLeader;
      if (!leader || typeof leader !== 'object') return '';
      const title = leader.title ? ` · ${leader.title}` : '';
      const quality = leader.qualityLabel ? ` · ${leader.qualityLabel}` : '';
      return `守将 ${leader.name || '未知'}${title}${quality}`;
    }

    static getWorldSiteDefenderSkillLine(site = {}) {
      const leader = site.garrison?.leader || site.defenderLeader;
      if (!leader || typeof leader !== 'object') return '';
      const active = Array.isArray(leader.abilityKit?.abilities)
        ? leader.abilityKit.abilities.find((ability) => ability?.slot === 'activeSkill' || ability?.kind === 'active')
        : null;
      const fallback = Array.isArray(leader.skills) ? leader.skills[0] : null;
      const skill = active || fallback;
      if (!skill) return '';
      return `敌方战法 ${skill.name || '未知战法'}`;
    }

    static makeVisualGroups(soldiers, groupSize = 100) {
      const total = Math.max(0, this.toInteger(soldiers));
      const size = Math.max(1, this.toInteger(groupSize, 100));
      if (total <= 0) return [];
      return Array.from({ length: Math.ceil(total / size) }, (_, index) => {
        const remaining = total - index * size;
        return {
          index: index + 1,
          soldiers: Math.max(0, Math.min(size, remaining)),
          capacity: size,
          ratio: Math.max(0, Math.min(1, Math.max(0, Math.min(size, remaining)) / size)),
        };
      });
    }

    static getBattleTurnSoldiers(turn = {}, side = 'attacker', timing = 'before', fallback = 0) {
      const nested = turn?.[`soldiers${timing === 'after' ? 'After' : 'Before'}`]?.[side];
      if (nested !== undefined && nested !== null) return this.toInteger(nested);
      const legacyKey = `${side}Soldiers${timing === 'after' ? 'After' : 'Before'}`;
      if (turn?.[legacyKey] !== undefined && turn?.[legacyKey] !== null) return this.toInteger(turn[legacyKey]);
      return this.toInteger(fallback);
    }

    static getBattleStatusLabel(status = {}) {
      const labels = {
        shield: '守御',
        armorBreak: '破甲',
        burn: '灼烧',
        poison: '中毒',
      };
      return status.label || labels[status.key] || status.key || '状态';
    }

    static getBattleStatusTone(status = {}) {
      if (status.key === 'shield') return 'guard';
      if (status.key === 'burn' || status.key === 'poison') return 'dot';
      if (status.key === 'armorBreak') return 'break';
      return 'status';
    }

    static formatBattleStatusBadge(status = {}) {
      const key = status.key || '';
      const label = this.getBattleStatusLabel(status);
      const turns = Math.max(0, this.toInteger(status.turnsRemaining, 0));
      const stacks = Math.max(1, this.toInteger(status.stacks, 1));
      if (key === 'shield') {
        const shield = Math.max(0, this.toInteger(status.shieldRemaining ?? status.value, 0));
        return {
          key,
          label,
          text: shield > 0 ? `${label} ${shield}` : label,
          tone: this.getBattleStatusTone(status),
          turns,
          stacks,
          shield,
        };
      }
      return {
        key,
        label,
        text: `${label}${stacks > 1 ? ` x${stacks}` : ''}${turns > 0 ? ` ${turns}回合` : ''}`,
        tone: this.getBattleStatusTone(status),
        turns,
        stacks,
        shield: 0,
      };
    }

    static buildBattleStatusBadges(statuses = []) {
      if (!Array.isArray(statuses)) return [];
      return statuses
        .map((status) => this.formatBattleStatusBadge(status))
        .filter((badge) => badge.text)
        .slice(0, 4);
    }

    static buildBattleSkillState(report = {}, turns = [], side = 'attacker', activeTurn = null, turnIndex = 0, showActionResult = false, ended = false) {
      const sideReport = report?.[side] || {};
      const skill = sideReport.skill && typeof sideReport.skill === 'object' ? sideReport.skill : {};
      const skillName = skill.name || (activeTurn?.actor === side ? activeTurn.skillName || activeTurn.actionDecision?.skillName : '');
      if (!skillName) return null;
      const isActiveSide = activeTurn?.actor === side;
      let remaining = 0;
      let state = 'ready';
      if (isActiveSide) {
        const before = Math.max(0, this.toInteger(activeTurn.cooldownBefore, 0));
        const after = Math.max(0, this.toInteger(activeTurn.cooldownAfter, before));
        const isSkillTurn = activeTurn.action === 'skill' || activeTurn.actionType === 'skill';
        remaining = showActionResult ? after : before;
        state = isSkillTurn && !showActionResult ? 'casting' : (remaining > 0 ? 'cooldown' : 'ready');
      } else {
        const searchEnd = ended ? turns.length - 1 : Math.max(-1, turnIndex - 1);
        const previousOwnTurn = turns.slice(0, searchEnd + 1).reverse().find((turn) => turn?.actor === side);
        remaining = Math.max(0, this.toInteger(previousOwnTurn?.cooldownAfter, 0));
        state = remaining > 0 ? 'cooldown' : 'ready';
      }
      return {
        skillName,
        cooldown: Math.max(0, this.toInteger(skill.cooldown, activeTurn?.skillCooldown || 0)),
        remaining,
        state,
        stateText: state === 'casting' ? '正在释放' : (remaining > 0 ? `冷却 ${remaining} 回合` : '可释放'),
        active: isActiveSide,
      };
    }

    static getBattleTurnLines(turn = {}, options = {}) {
      const lines = Array.isArray(turn.lines) && turn.lines.length ? turn.lines : [turn.text].filter(Boolean);
      if (!options.active) return lines;
      const phase = options.phase || 'prepare';
      if (phase === 'cutin') {
        const skillLineIndex = lines.findIndex((line) => /发动战法|释放技能|技能|战法/.test(String(line)));
        if (skillLineIndex >= 0) return lines.slice(0, skillLineIndex + 1);
        return lines.slice(0, 1);
      }
      if (phase === 'prepare') return lines.slice(0, 1);
      if (phase === 'move') return lines.slice(0, Math.min(2, lines.length));
      return lines;
    }

    static buildBattleSceneViewState(battle = {}, options = {}) {
      const report = battle.report || battle;
      if (!report || typeof report !== 'object') return { visible: false };
      const turns = Array.isArray(report.turns) ? report.turns : [];
      const requestedTurn = this.toInteger(options.turnIndex, 0);
      const turnIndex = Math.max(0, Math.min(turns.length, requestedTurn));
      const ended = turns.length === 0 || turnIndex >= turns.length;
      const activeTurn = ended ? null : turns[turnIndex] || null;
      const previousTurn = turnIndex > 0 ? turns[turnIndex - 1] : null;
      const groupSize = this.toInteger(report.groupSize || report.visual?.groupSize, 100);
      const phase = options.phase || options.playbackPhase || 'prepare';
      const showActionResult = Boolean(activeTurn && (phase === 'impact' || phase === 'settle'));
      const attackerStart = this.toInteger(report.attacker?.soldiersStart);
      const defenderStart = this.toInteger(report.defender?.soldiersStart);
      const lastTurn = turns[turns.length - 1] || null;
      const attackerFallback = previousTurn
        ? this.getBattleTurnSoldiers(previousTurn, 'attacker', 'after', attackerStart)
        : attackerStart;
      const defenderFallback = previousTurn
        ? this.getBattleTurnSoldiers(previousTurn, 'defender', 'after', defenderStart)
        : defenderStart;
      const attackerSoldiers = ended
        ? (lastTurn ? this.getBattleTurnSoldiers(lastTurn, 'attacker', 'after', this.toInteger(report.attacker?.soldiersEnd, attackerStart)) : this.toInteger(report.attacker?.soldiersEnd, attackerStart))
        : (showActionResult
          ? this.getBattleTurnSoldiers(activeTurn, 'attacker', 'after', attackerFallback)
          : this.getBattleTurnSoldiers(activeTurn, 'attacker', 'before', attackerFallback));
      const defenderSoldiers = ended
        ? (lastTurn ? this.getBattleTurnSoldiers(lastTurn, 'defender', 'after', this.toInteger(report.defender?.soldiersEnd, defenderStart)) : this.toInteger(report.defender?.soldiersEnd, defenderStart))
        : (showActionResult
          ? this.getBattleTurnSoldiers(activeTurn, 'defender', 'after', defenderFallback)
          : this.getBattleTurnSoldiers(activeTurn, 'defender', 'before', defenderFallback));
      const resultText = report.result === 'victory' ? '胜利' : report.result === 'defeat' ? '失败' : '交战中';
      const completedLogEnd = ended ? turns.length : turnIndex;
      const previousLines = turns.slice(Math.max(0, completedLogEnd - 3), completedLogEnd).flatMap((turn) => (
        this.getBattleTurnLines(turn)
      ));
      const activeLines = activeTurn ? this.getBattleTurnLines(activeTurn, { active: true, phase }) : [];
      const fallbackLines = turns.length === 0 && report.summary ? [report.summary] : [];
      const statusesTiming = showActionResult ? 'After' : 'Before';
      const activeStatuses = activeTurn?.[`statuses${statusesTiming}`] || {};
      const previousStatuses = previousTurn?.statusesAfter || {};
      const lastStatuses = lastTurn?.statusesAfter || {};
      const attackerStatuses = ended
        ? (lastStatuses.attacker || [])
        : (activeStatuses.attacker || previousStatuses.attacker || []);
      const defenderStatuses = ended
        ? (lastStatuses.defender || [])
        : (activeStatuses.defender || previousStatuses.defender || []);
      const attackerSkill = this.buildBattleSkillState(report, turns, 'attacker', activeTurn, turnIndex, showActionResult, ended);
      const defenderSkill = this.buildBattleSkillState(report, turns, 'defender', activeTurn, turnIndex, showActionResult, ended);
      return {
        visible: true,
        id: report.id || '',
        title: `${report.attacker?.leaderName || '己方'}队 vs ${report.defender?.leaderName || report.defender?.name || '守军'}队`,
        resultText,
        ended,
        map: report.visual?.map || {
          id: 'frontier-field',
          name: '边境战场',
          background: 'assets/art/battle/battlefield-forest-camp.png',
          soldierSprites: {
            attacker: 'assets/art/battle/units/player',
            defender: 'assets/art/battle/units/enemy',
          },
          palette: ['#2f3d30', '#667245', '#9a7848'],
        },
        turnIndex,
        turnCount: turns.length,
        phase,
        activeTurn,
        logLines: [...previousLines, ...activeLines, ...fallbackLines].filter(Boolean),
        attacker: {
          side: 'attacker',
          name: `${report.attacker?.leaderName || '己方'}队`,
          leaderName: report.attacker?.leaderName || '无名领队',
          leaderTitle: report.attacker?.leaderTitle || '',
          appearance: report.attacker?.appearance || {},
          sprite: report.visual?.map?.soldierSprites?.attacker || 'assets/art/battle/units/player',
          speed: this.toInteger(report.attacker?.speed),
          soldiersStart: this.toInteger(report.attacker?.soldiersStart),
          soldiers: attackerSoldiers,
          groups: this.makeVisualGroups(attackerSoldiers, groupSize),
          statuses: this.buildBattleStatusBadges(attackerStatuses),
          skillState: attackerSkill,
        },
        defender: {
          side: 'defender',
          name: `${report.defender?.leaderName || report.defender?.name || '守军'}队`,
          leaderName: report.defender?.leaderName || report.defender?.name || '守军',
          leaderTitle: report.defender?.leaderTitle || '守军',
          appearance: report.defender?.appearance || {},
          sprite: report.visual?.map?.soldierSprites?.defender || 'assets/art/battle/units/enemy',
          speed: this.toInteger(report.defender?.speed),
          soldiersStart: this.toInteger(report.defender?.soldiersStart),
          soldiers: defenderSoldiers,
          groups: this.makeVisualGroups(defenderSoldiers, groupSize),
          statuses: this.buildBattleStatusBadges(defenderStatuses),
          skillState: defenderSkill,
        },
      };
    }

    static buildWorldSiteDetailViewState(site = {}, territoryState = {}, uiState = {}) {
      const selectedSiteId = uiState.selectedSiteId || '';
      return {
        id: site.id || '',
        visible: site.id === selectedSiteId,
        text: {
          name: site.cityName || site.naturalName || '',
          status: this.formatWorldSiteStatus(site),
          owner: this.formatWorldSiteOwner(site),
          distance: `距 ${site.originDistance ?? site.distance ?? 0}`,
          scale: `规模 ${site.scale || 1}`,
          threat: `威胁 ${site.threat || 0}`,
          summary: site.summary || this.formatWorldSiteEffect(site.effects),
          defense: `防御 ${site.defense || 0}`,
          soldiers: `建议 ${site.recommendedSoldiers || 0} 士兵`,
          defenderLeader: this.getWorldSiteDefenderLeaderLine(site),
          defenderSkill: this.getWorldSiteDefenderSkillLine(site),
          march: this.getWorldSiteMarchInfo(site, territoryState),
          note: this.getWorldSiteLastBattleNote(site),
          battleReport: this.getWorldSiteBattleReportLines(site),
        },
        action: this.buildWorldSiteActionViewState(site, territoryState, uiState),
      };
    }

    static buildWorldSiteDialogViewState(territories = [], territoryState = {}, uiState = {}) {
      const selectedSiteId = uiState.selectedSiteId || '';
      const details = (territories || []).map((site) => this.buildWorldSiteDetailViewState(site, territoryState, uiState));
      const view = {
        selectedSiteId,
        showModal: details.some((detail) => detail.id === selectedSiteId),
        details,
      };
      return {
        ...view,
        signature: JSON.stringify(view),
      };
    }

    static getWorldSiteDialogContentSignature(territories = [], territoryState = {}, uiState = {}) {
      return this.buildWorldSiteDialogViewState(territories, territoryState, uiState).signature;
    }

    static buildWorldRadarViewState(territories = [], options = {}) {
      const layout = this.buildWorldRadarLayout(territories);
      return {
        signature: this.getWorldMapSignature(territories),
        pan: {
          x: this.toNumber(options.panX),
          y: this.toNumber(options.panY),
        },
        sites: territories.map((site) => {
          const position = layout.get(site.id) || { left: '50.00', top: '50.00' };
          return {
            id: site.id || '',
            status: site.status || '',
            owner: site.owner || '',
            type: site.type || '',
            title: site.naturalName || '',
            art: site.art || '',
            alt: site.naturalName || '',
            name: site.cityName || site.naturalName || '',
            position,
          };
        }),
      };
    }

    static getTileMapManifest() {
      return sharedTileMapManifest || {};
    }

    static getTileMapGeometry() {
      return sharedTileMapGeometry || null;
    }

    static getWorldTileMapSignature(territoryState = {}, worldExplorerState = {}) {
      const worldMap = territoryState.worldMap || {};
      const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const sites = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const missions = Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [];
      const explorerMissions = Array.isArray(worldExplorerState.missions)
        ? worldExplorerState.missions
        : [
          worldExplorerState.activeMission,
          ...(Array.isArray(worldExplorerState.readyMissions) ? worldExplorerState.readyMissions : []),
        ].filter(Boolean);
      return JSON.stringify({
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        tiles: tiles.map((tile) => ({
          id: tile.id,
          q: tile.q,
          r: tile.r,
          terrain: tile.terrain,
          discovered: tile.discovered !== false,
          visible: tile.visible !== false,
          visibility: tile.visibility || '',
          discoveredAt: tile.discoveredAt || '',
          lastScoutedAt: tile.lastScoutedAt || '',
          intel: tile.intel && typeof tile.intel === 'object' ? {
            level: this.toInteger(tile.intel.level, 0),
            knownTerrain: Boolean(tile.intel.knownTerrain),
            knownSite: Boolean(tile.intel.knownSite),
            knownOwner: Boolean(tile.intel.knownOwner),
            knownGarrison: Boolean(tile.intel.knownGarrison),
            knownLeader: Boolean(tile.intel.knownLeader),
            knownSkill: Boolean(tile.intel.knownSkill),
          } : null,
          siteId: tile.siteId || null,
          riverPorts: tile.riverPorts || [],
          oceanTemplates: tile.oceanTemplates || [],
          transitionKey: tile.transitionKey || '',
        })),
        sites: sites.map((site) => ({
          id: site.id,
          x: site.x,
          y: site.y,
          status: site.status,
          owner: site.owner,
          type: site.type,
          art: site.art,
          name: site.cityName || site.naturalName,
        })),
        missions: missions.map((mission) => ({
          id: mission.id,
          status: mission.status,
          route: mission.route || [],
          revealArea: mission.revealArea || [],
          revealedTileIds: mission.revealedTileIds || [],
          actionPointsRemaining: mission.actionPointsRemaining,
        })),
        explorerMissions: explorerMissions.map((mission) => ({
          id: mission.id,
          status: mission.status,
          route: mission.route || [],
          plannedTiles: (mission.plannedTiles || []).map((tile) => ({
            id: tile.id,
            q: tile.q,
            r: tile.r,
            terrain: tile.terrain,
            siteId: tile.siteId || null,
            visibility: tile.visibility || '',
            riverPorts: tile.riverPorts || [],
            oceanTemplates: tile.oceanTemplates || [],
            transitionKey: tile.transitionKey || '',
          })),
          plannedSites: mission.plannedSites || [],
          revealedTileIds: mission.revealedTileIds || [],
        })),
      });
    }

    static normalizeWorldTile(tile = {}, siteById = new Map()) {
      const manifest = this.getTileMapManifest();
      const terrain = tile.terrain || 'plains';
      const terrainAsset = manifest.getTerrainAsset?.(terrain) || manifest.terrain?.[terrain] || manifest.terrain?.plains || {};
      const featureAsset = terrainAsset.feature ? manifest.getFeatureAsset?.(terrainAsset.feature) : null;
      const templateAssets = manifest.getTileTemplateAssets?.(tile) || [];
      const site = tile.siteId ? siteById.get(tile.siteId) : null;
      const siteAsset = site ? manifest.getSiteAsset?.(site.type || 'town') : null;
      const mountainNeighbors = terrain === 'mountain'
        ? [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
          .filter(([dq, dr]) => {
            const id = `tile_${this.toInteger(tile.q) + dq}_${this.toInteger(tile.r) + dr}`;
            return siteById.__tileTerrainById?.get(id) === 'mountain';
          }).length
        : 0;
      return {
        id: tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`,
        q: this.toInteger(tile.q),
        r: this.toInteger(tile.r),
        terrain,
        terrainLabel: terrainAsset.label || terrain,
        terrainAsset: terrainAsset.path || '',
        waterAsset: terrainAsset.water ? manifest.getWaterAsset?.(terrainAsset.water)?.path || '' : '',
        templateAssets: templateAssets.map((asset) => ({
          label: asset.label || '',
          key: asset.key || '',
          type: asset.templateType || '',
          asset: asset.path || '',
        })).filter((asset) => asset.asset),
        water: terrainAsset.water ? {
          kind: terrainAsset.water,
          asset: manifest.getWaterAsset?.(terrainAsset.water)?.path || '',
          uvScale: manifest.getWaterAsset?.(terrainAsset.water)?.uvScale || 1,
          speedX: manifest.getWaterAsset?.(terrainAsset.water)?.speedX || 0,
          speedY: manifest.getWaterAsset?.(terrainAsset.water)?.speedY || 0,
          alpha: manifest.getWaterAsset?.(terrainAsset.water)?.alpha || 1,
        } : null,
        riverPorts: Array.isArray(tile.riverPorts) ? tile.riverPorts.filter(Boolean) : [],
        oceanTemplates: Array.isArray(tile.oceanTemplates) ? tile.oceanTemplates.filter(Boolean) : [],
        transitionKey: typeof tile.transitionKey === 'string' ? tile.transitionKey : '',
        mountainNeighbors,
        feature: featureAsset ? {
          key: terrainAsset.feature,
          asset: featureAsset.path || '',
          overlayKey: featureAsset.overlayKey || '',
          scale: featureAsset.scale || 0.5,
          offset: manifest.getOverlayOffset?.(featureAsset.overlayKey) || { x: 0, y: 0 },
        } : null,
        discovered: tile.discovered !== false,
        visible: tile.visible !== false,
        visibility: tile.visibility || (tile.discovered === false ? 'unknown' : 'scouted'),
        discoveredAt: tile.discoveredAt || '',
        lastScoutedAt: tile.lastScoutedAt || '',
        intel: tile.intel && typeof tile.intel === 'object' ? {
          level: this.toInteger(tile.intel.level, 0),
          knownTerrain: Boolean(tile.intel.knownTerrain),
          knownSite: Boolean(tile.intel.knownSite),
          knownOwner: Boolean(tile.intel.knownOwner),
          knownGarrison: Boolean(tile.intel.knownGarrison),
          knownLeader: Boolean(tile.intel.knownLeader),
          knownSkill: Boolean(tile.intel.knownSkill),
        } : null,
        siteId: tile.siteId || null,
        site: site ? {
          id: site.id || '',
          type: site.type || '',
          status: site.status || '',
          owner: site.owner || '',
          name: site.cityName || site.naturalName || '',
          title: site.naturalName || site.cityName || '',
          art: site.art || siteAsset?.path || '',
          overlayKey: siteAsset?.overlayKey || manifest.getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`,
          offset: manifest.getOverlayOffset?.(siteAsset?.overlayKey || manifest.getSiteOverlayKey?.(site.type) || `site:${site.type || 'town'}`) || { x: 0, y: 0 },
          scale: siteAsset?.scale || 0.46,
        } : null,
      };
    }

    static normalizeWorldExplorerMission(mission = {}) {
      if (!mission || typeof mission !== 'object') return null;
      const route = (Array.isArray(mission.route) ? mission.route : []).map((step, index) => ({
        q: this.toInteger(step.q),
        r: this.toInteger(step.r),
        step: this.toInteger(step.step, index + 1),
        tileId: step.tileId || `tile_${this.toInteger(step.q)}_${this.toInteger(step.r)}`,
        revealed: Boolean(step.revealed),
      }));
      if (!route.length) return null;
      return {
        id: mission.id || '',
        kind: 'worldExplore',
        direction: mission.mode || 'random',
        status: mission.status || '',
        actionPoints: route.length,
        actionPointsRemaining: route.filter((step) => !step.revealed).length,
        route,
        revealArea: route,
        revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.map(String) : [],
      };
    }

    static getWorldExplorerMissions(worldExplorerState = {}) {
      const fromList = Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : [];
      const fromSlots = [
        worldExplorerState.activeMission,
        ...(Array.isArray(worldExplorerState.readyMissions) ? worldExplorerState.readyMissions : []),
      ].filter(Boolean);
      const byId = new Map();
      [...fromList, ...fromSlots].forEach((mission) => {
        if (!mission || typeof mission !== 'object') return;
        const id = mission.id || `explore-${byId.size}`;
        byId.set(id, mission);
      });
      return [...byId.values()];
    }

    static getWorldExplorerPlannedTiles(worldExplorerState = {}) {
      const byId = new Map();
      this.getWorldExplorerMissions(worldExplorerState).forEach((mission) => {
        (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => {
          if (!tile || typeof tile !== 'object') return;
          const q = this.toInteger(tile.q);
          const r = this.toInteger(tile.r);
          const id = tile.id || `tile_${q}_${r}`;
          byId.set(id, {
            ...tile,
            id,
            q,
            r,
            visibility: tile.visibility || 'scouted',
            discovered: tile.discovered !== false,
            visible: tile.visible !== false,
          });
        });
      });
      return [...byId.values()];
    }

    static buildWorldTileMapViewState(territoryState = {}, options = {}) {
      const worldMap = territoryState.worldMap || {};
      const rawTiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
      const worldExplorerState = options.worldExplorerState || {};
      const plannedTiles = this.getWorldExplorerPlannedTiles(worldExplorerState);
      const rawTileById = new Map(rawTiles.map((tile) => [tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`, tile]));
      plannedTiles.forEach((tile) => {
        const existing = rawTileById.get(tile.id);
        rawTileById.set(tile.id, existing ? { ...tile, ...existing } : tile);
      });
      const mergedTiles = [...rawTileById.values()];
      const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
      const siteById = new Map(territories.map((site) => [site.id, site]));
      siteById.__tileTerrainById = new Map(mergedTiles.map((tile) => [tile.id || `tile_${this.toInteger(tile.q)}_${this.toInteger(tile.r)}`, tile.terrain || 'plains']));
      const geometry = this.getTileMapGeometry();
      const normalizedTiles = mergedTiles.map((tile) => this.normalizeWorldTile(tile, siteById));
      const sortedTiles = geometry?.sortTilesForIsoDraw
        ? geometry.sortTilesForIsoDraw(normalizedTiles)
        : normalizedTiles;
      const terrainPriority = { ocean: 0, river: 1 };
      const drawTiles = [...sortedTiles].sort((a, b) => {
        const terrainDelta = (terrainPriority[a.terrain] ?? 2) - (terrainPriority[b.terrain] ?? 2);
        if (terrainDelta) return terrainDelta;
        return 0;
      });
      const activeScouts = (Array.isArray(territoryState.scoutMissions) ? territoryState.scoutMissions : [])
        .filter((mission) => mission.kind === 'scout' && ['active', 'ready'].includes(mission.status))
        .map((mission) => ({
          id: mission.id || '',
          direction: mission.direction || '',
          status: mission.status || '',
          actionPoints: this.toInteger(mission.actionPoints),
          actionPointsRemaining: this.toInteger(mission.actionPointsRemaining),
          route: (Array.isArray(mission.route) ? mission.route : []).map((step) => ({
            q: this.toInteger(step.q),
            r: this.toInteger(step.r),
            step: this.toInteger(step.step),
            tileId: step.tileId || `tile_${this.toInteger(step.q)}_${this.toInteger(step.r)}`,
            revealed: Boolean(step.revealed),
          })),
          revealArea: (Array.isArray(mission.revealArea) ? mission.revealArea : []).map((coord) => ({
            q: this.toInteger(coord.q),
            r: this.toInteger(coord.r),
            step: this.toInteger(coord.step),
            kind: coord.kind === 'branch' ? 'branch' : 'main',
            tileId: coord.tileId || `tile_${this.toInteger(coord.q)}_${this.toInteger(coord.r)}`,
            revealed: Boolean(coord.revealed),
          })),
          revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.map(String) : [],
        }));
      const explorerScouts = this.getWorldExplorerMissions(worldExplorerState)
        .filter((mission) => ['active', 'ready'].includes(mission.status))
        .map((mission) => this.normalizeWorldExplorerMission(mission))
        .filter(Boolean);
      const scoutAreas = (Array.isArray(territoryState.scoutAreas) ? territoryState.scoutAreas : [])
        .map((area) => ({
          id: area.id || '',
          missionId: area.missionId || null,
          direction: area.direction || null,
          result: area.result === 'site' ? 'site' : 'empty',
          siteId: area.siteId || null,
          targetX: this.toInteger(area.targetX),
          targetY: this.toInteger(area.targetY),
          tileIds: Array.isArray(area.tileIds) ? area.tileIds.map(String) : [],
          coords: (Array.isArray(area.coords) ? area.coords : []).map((coord) => ({
            q: this.toInteger(coord.q),
            r: this.toInteger(coord.r),
            tileId: coord.tileId || `tile_${this.toInteger(coord.q)}_${this.toInteger(coord.r)}`,
          })),
          scoutedAt: area.scoutedAt || '',
        }));
      const bounds = geometry?.getBounds ? geometry.getBounds(sortedTiles) : { width: 0, height: 0 };
      return {
        signature: this.getWorldTileMapSignature(territoryState, worldExplorerState),
        version: worldMap.version || 0,
        seed: worldMap.seed || '',
        pan: {
          x: this.toNumber(options.panX),
          y: this.toNumber(options.panY),
        },
        geometry: geometry?.DEFAULT_GEOMETRY || { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
        bounds,
        tiles: drawTiles,
        sites: drawTiles.filter((tile) => tile.site).map((tile) => ({
          ...tile.site,
          tileId: tile.id,
          q: tile.q,
          r: tile.r,
        })),
        activeScouts: [...activeScouts, ...explorerScouts],
        scoutAreas,
      };
    }
  }

  global.UIStatePresenter = UIStatePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
