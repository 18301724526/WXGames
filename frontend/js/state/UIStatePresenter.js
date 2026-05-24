(function (global) {
  class UIStatePresenter {
    static POPULATION_PER_OFFICIAL = 100;

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

    static calculatePopulationGrowthMultiplier(habitability = 0) {
      const score = this.toNumber(habitability);
      return Math.round(Math.max(0.5, Math.min(1.5, 1 + score / 100)) * 100) / 100;
    }

    static formatPopulationGrowthStatus(growthMultiplier = 1) {
      const multiplier = this.toNumber(growthMultiplier, 1);
      if (multiplier <= 0.55) return '人口成长停滞';
      if (multiplier < 0.9) return '人口成长缓慢';
      if (multiplier < 1.08) return '人口成长平稳';
      if (multiplier < 1.25) return '人口成长良好';
      return '人口成长旺盛';
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

    static buildResourceViewState(state = {}) {
      const resources = state.resources || {};
      const population = state.population || {};
      const capacity = population.capacity || {};
      const foodOutput = this.toNumber(resources.foodOutputPerSecond);
      const foodConsumption = this.toNumber(resources.foodConsumptionPerSecond);
      const knowledgeRate = this.toNumber(resources.knowledgePerSecond);
      const woodRate = this.toNumber(resources.woodPerSecond);
      const ironRate = this.toNumber(resources.ironPerSecond ?? resources.metalPerSecond);
      const stoneRate = this.toNumber(resources.stonePerSecond);
      const foodNet = Object.prototype.hasOwnProperty.call(resources, 'foodNetPerSecond')
        ? this.toNumber(resources.foodNetPerSecond)
        : this.toNumber(resources.foodPerSecond);
      const hasWood = true;
      const food = this.formatResourceAmount(resources.food);
      const knowledge = this.formatResourceAmount(resources.knowledge);
      const wood = this.formatResourceAmount(resources.wood);
      const iron = this.formatResourceAmount(resources.iron ?? resources.metal);
      const stone = this.formatResourceAmount(resources.stone);
      const populationTotal = this.toInteger(population.total ?? state.totalPop);
      const eraCap = this.toInteger(capacity.eraCap ?? population.eraCap);
      const housingCap = this.toInteger(capacity.housingCap ?? population.housingCap);
      const populationAtEraCap = Boolean(
        capacity.active
        && capacity.limitingSource === 'era'
        && eraCap > 0
        && housingCap > 0
        && populationTotal >= eraCap
        && eraCap <= housingCap,
      );

      return {
        hasWood,
        hasIron: true,
        hasStone: true,
        foodNet,
        population: {
          total: populationTotal,
          display: this.toDisplayPopulation(populationTotal),
          atEraCap: populationAtEraCap,
        },
        text: {
          foodValue: food,
          knowledgeValue: knowledge,
          woodValue: wood,
          ironValue: iron,
          stoneValue: stone,
          foodDetailValue: food,
          knowledgeDetailValue: knowledge,
          woodDetailValue: wood,
          ironDetailValue: iron,
          stoneDetailValue: stone,
          foodRate: this.formatRate(foodNet),
          foodOutputRate: this.formatRate(foodOutput),
          foodConsumptionRate: this.formatNegativeRate(foodConsumption),
          foodNetRate: this.formatRate(foodNet),
          knowledgeRate: this.formatRate(knowledgeRate),
          woodRate: this.formatRate(woodRate),
          ironRate: this.formatRate(ironRate),
          stoneRate: this.formatRate(stoneRate),
          knowledgeDetailRate: this.formatRate(knowledgeRate),
          woodDetailRate: this.formatRate(woodRate),
          ironDetailRate: this.formatRate(ironRate),
          stoneDetailRate: this.formatRate(stoneRate),
          happinessValue: state.happiness || 100,
          gameTime: `第 ${state.gameDay || 1} 天`,
          populationValue: this.toDisplayPopulation(populationTotal),
          populationStatus: populationAtEraCap ? '人口已无法增长，请推进时代' : '',
        },
        classState: {
          foodNetRate: {
            'is-positive': foodNet >= 0,
            'is-negative': foodNet < 0,
          },
        },
      };
    }

    static getActiveCity(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const activeCityId = state.activeCityId || cityState.activeCityId || cityState.capitalCityId || 'capital';
      return cities.find((city) => city.id === activeCityId) || cities[0] || null;
    }

    static buildCityPlanningViewState(state = {}) {
      const activeCity = this.getActiveCity(state) || {};
      const planning = activeCity.planning || {};
      const habitability = this.toInteger(
        planning.habitability ?? activeCity.habitability,
        0,
      );
      const label = planning.habitabilityLabel || activeCity.habitabilityLabel || '平稳';
      const terrainLabel = planning.terrainLabel || activeCity.terrainLabel || '平原';
      const notes = Array.isArray(planning.habitabilityNotes) ? planning.habitabilityNotes : [];
      const growthMultiplier = this.toNumber(
        planning.populationGrowthMultiplier ?? activeCity.populationGrowthMultiplier ?? state.population?.growthMultiplier,
        this.calculatePopulationGrowthMultiplier(habitability),
      );
      return {
        terrainId: planning.terrainId || activeCity.terrain || 'plains',
        terrainLabel,
        terrainSummary: planning.terrainSummary || '适合均衡建设。',
        terrainHint: planning.terrainHint || '保持建筑搭配，会让城市更稳定。',
        habitability,
        habitabilityLabel: label,
        habitabilityTone: planning.habitabilityTone || 'neutral',
        populationGrowthMultiplier: growthMultiplier,
        habitabilitySummary: planning.habitabilitySummary || `${terrainLabel}城市规划${label}`,
        habitabilityNotes: notes,
        text: {
          terrain: terrainLabel,
          habitability: `${habitability >= 0 ? '+' : ''}${habitability}`,
          habitabilityLabel: label,
          habitabilityStatus: `宜居度${label}`,
          populationGrowthStatus: this.formatPopulationGrowthStatus(growthMultiplier),
          summary: planning.habitabilitySummary || `${terrainLabel}城市规划${label}`,
          note: notes[0] || planning.terrainHint || '保持建筑搭配，会让城市更稳定。',
        },
      };
    }

    static buildPopulationViewState(state = {}) {
      const pop = state.population || {};
      const currentEra = this.toNumber(state.currentEra);
      const unassigned = this.toInteger(pop.unassigned);
      const counts = {
        farmer: this.toInteger(pop.farmers ?? state.farmers),
        scholar: this.toInteger(pop.scholars ?? state.scholars),
        craftsman: this.toInteger(pop.craftsmen ?? state.craftsmen),
      };
      const jobs = [
        { id: 'farmer', count: counts.farmer, visible: true },
        { id: 'scholar', count: counts.scholar, visible: true },
        { id: 'craftsman', count: counts.craftsman, visible: currentEra >= 2 },
      ].map((job) => ({
        ...job,
        canIncrease: unassigned > 0,
        canDecrease: job.count > 0,
      }));
      const totalOfficials = this.toInteger(pop.total ?? state.totalPop);
      const maxOfficials = this.toInteger(pop.maxPop ?? pop.max ?? state.maxPop);

      return {
        showCraftsman: currentEra >= 2,
        unassigned,
        jobs,
        planning: this.buildCityPlanningViewState(state),
        text: {
          title: '人才分配',
          subtitle: '核心岗位',
          total: totalOfficials,
          max: maxOfficials,
          unassigned,
          population: this.toDisplayPopulation(totalOfficials),
          maxPopulation: this.toDisplayPopulation(maxOfficials),
        },
      };
    }

    static getDefaultTalentPolicyDraft(state = {}, uiState = {}) {
      const source = state.talentPolicies || {};
      const systemPolicies = Array.isArray(source.systemPolicies) ? source.systemPolicies : [];
      const customPolicies = Array.isArray(source.customPolicies) ? source.customPolicies : [];
      const activeIsSystem = systemPolicies.some((policy) => policy.id === source.activePolicyId);
      const activeCustom = customPolicies.find((policy) => policy.id === source.activePolicyId) || null;
      const activeDraft = source.activePolicyId === 'draft' && source.activeDraft ? source.activeDraft : null;
      const selected = uiState.selectedBasePolicyId
        || uiState.basePolicyId
        || activeDraft?.basePolicyId
        || activeCustom?.basePolicyId
        || (activeIsSystem ? source.activePolicyId : null)
        || 'balanced';
      const fallbackTiers = source.defaultTiers || { agriculture: 2, knowledge: 2, industry: 2 };
      const activeTiers = activeDraft?.tiers || activeCustom?.tiers || fallbackTiers;
      return {
        basePolicyId: selected,
        tiers: {
          agriculture: this.toInteger(uiState.tiers?.agriculture ?? activeTiers.agriculture, 2),
          knowledge: this.toInteger(uiState.tiers?.knowledge ?? activeTiers.knowledge, 2),
          industry: this.toInteger(uiState.tiers?.industry ?? activeTiers.industry, 2),
        },
      };
    }

    static makeTalentPolicyName(basePolicy = {}, tiers = {}) {
      const baseLabel = basePolicy.label || '均衡发展';
      const labels = {
        agriculture: '农业',
        knowledge: '知识',
        industry: '工业',
      };
      const high = Object.entries(labels)
        .filter(([key]) => this.toInteger(tiers[key], 2) === 3)
        .map(([, label]) => label);
      if (high.length) return `${baseLabel}·偏${high.slice(0, 2).join('与')}`;
      const low = Object.entries(labels)
        .filter(([key]) => this.toInteger(tiers[key], 2) === 1)
        .map(([, label]) => label);
      if (low.length) return `${baseLabel}·轻${low.slice(0, 2).join('与')}`;
      return `${baseLabel}·微调`;
    }

    static getTalentPolicyAvailableRoles(state = {}) {
      const currentEra = this.toNumber(state.currentEra);
      return [
        { id: 'farmer', minEra: 0 },
        { id: 'scholar', minEra: 0 },
        { id: 'craftsman', minEra: 2 },
      ].filter((role) => currentEra >= role.minEra).map((role) => role.id);
    }

    static applyTalentPolicyTierModifiers(weights = {}, tiers = {}, tendencies = [], state = {}) {
      const nextWeights = { ...weights };
      (Array.isArray(tendencies) ? tendencies : []).forEach((tendency) => {
        if (tendency.disabled) return;
        const role = tendency.role || ({ agriculture: 'farmer', knowledge: 'scholar', industry: 'craftsman' }[tendency.id]);
        if (!role || !Object.prototype.hasOwnProperty.call(nextWeights, role)) return;
        const tier = Math.max(1, Math.min(3, this.toInteger(tiers[tendency.id], 2)));
        const modifier = tier === 3 ? 2 : (tier === 1 ? -1 : 0);
        nextWeights[role] = Math.max(1, this.toNumber(nextWeights[role], 1) + modifier);
      });
      return this.getTalentPolicyAvailableRoles(state).reduce((result, roleId) => {
        result[roleId] = Math.max(1, this.toNumber(nextWeights[roleId], 1));
        return result;
      }, {});
    }

    static allocateTalentByWeights(total, weights = {}, priority = []) {
      const amount = Math.max(0, this.toInteger(total));
      const roles = Object.keys(weights);
      const allocation = roles.reduce((result, role) => {
        result[role] = 0;
        return result;
      }, {});
      const weightSum = roles.reduce((sum, role) => sum + Math.max(1, this.toNumber(weights[role], 1)), 0);
      if (amount <= 0 || !roles.length || weightSum <= 0) return allocation;

      const raw = roles.map((role) => {
        const weight = Math.max(1, this.toNumber(weights[role], 1));
        const exact = (amount * weight) / weightSum;
        return {
          role,
          weight,
          floor: Math.floor(exact),
          remainder: exact - Math.floor(exact),
          priority: priority.indexOf(role) >= 0 ? priority.indexOf(role) : priority.length,
        };
      });
      raw.forEach((item) => {
        allocation[item.role] = item.floor;
      });
      let remaining = amount - Object.values(allocation).reduce((sum, value) => sum + value, 0);
      raw
        .sort((a, b) => b.weight - a.weight || b.remainder - a.remainder || a.priority - b.priority || a.role.localeCompare(b.role))
        .forEach((item) => {
          if (remaining <= 0) return;
          allocation[item.role] += 1;
          remaining -= 1;
        });
      return allocation;
    }

    static buildTalentPolicyDraftPreview(state = {}, draft = {}, basePolicy = {}, tendencies = []) {
      const activeCity = (state.cityState?.cities || []).find((city) => city.id === (state.activeCityId || state.cityState?.activeCityId));
      const total = activeCity?.population?.total ?? state.population?.total ?? state.totalPop ?? 0;
      const baseWeights = basePolicy.weights || {};
      if (!Object.keys(baseWeights).length) return null;
      const weights = this.applyTalentPolicyTierModifiers(baseWeights, draft.tiers || {}, tendencies, state);
      const allocation = this.allocateTalentByWeights(total, weights, basePolicy.priority || []);
      const label = this.makeTalentPolicyName(basePolicy, draft.tiers || {});
      return {
        policyId: draft.basePolicyId || basePolicy.id || 'balanced',
        policyLabel: label,
        weights,
        allocation: {
          farmer: allocation.farmer || 0,
          scholar: allocation.scholar || 0,
          craftsman: allocation.craftsman || 0,
        },
      };
    }

    static buildTalentPolicyViewState(state = {}, uiState = {}) {
      const source = state.talentPolicies || {};
      const systemPolicies = Array.isArray(source.systemPolicies) ? source.systemPolicies : [];
      const customPolicies = Array.isArray(source.customPolicies) ? source.customPolicies : [];
      const activePolicyId = source.activePolicyId || 'balanced';
      const draft = this.getDefaultTalentPolicyDraft(state, uiState);
      const activeSystemPolicy = systemPolicies.find((policy) => policy.id === activePolicyId) || null;
      const activeCustomPolicy = customPolicies.find((policy) => policy.id === activePolicyId) || null;
      const activeDraftPolicy = activePolicyId === 'draft' && source.activeDraft ? source.activeDraft : null;
      const basePolicy = systemPolicies.find((policy) => policy.id === draft.basePolicyId)
        || systemPolicies.find((policy) => policy.id === activePolicyId)
        || systemPolicies[0]
        || { id: 'balanced', label: '均衡发展', description: '维持稳定分工' };
      const tendencies = Array.isArray(source.tendencies) ? source.tendencies : [
        { id: 'agriculture', label: '农业', role: 'farmer', disabled: false },
        { id: 'knowledge', label: '知识', role: 'scholar', disabled: false },
        { id: 'industry', label: '工业', role: 'craftsman', disabled: this.toNumber(state.currentEra) < 2 },
      ];
      const activePreview = source.preview || {};
      const preview = this.buildTalentPolicyDraftPreview(state, draft, basePolicy, tendencies) || activePreview;
      const allocation = preview.allocation || {};
      const jobLabels = { farmer: '农民', scholar: '学者', craftsman: '工匠' };
      const allocationText = ['farmer', 'scholar', 'craftsman']
        .filter((job) => job !== 'craftsman' || this.toNumber(state.currentEra) >= 2 || this.toNumber(allocation[job]) > 0)
        .map((job) => `${jobLabels[job]} ${this.toInteger(allocation[job])}`)
        .join(' / ');
      const tierLabels = {
        1: '低',
        2: '稳',
        3: '高',
      };
      const activePolicyLabel = activeDraftPolicy?.displayName
        || activeCustomPolicy?.displayName
        || activeCustomPolicy?.label
        || activeSystemPolicy?.label
        || source.activePolicyLabel
        || activePreview.policyLabel
        || basePolicy.label;
      const draftPolicyLabel = basePolicy.label || preview.policyLabel || '均衡发展';
      const isDefaultDraft = ['agriculture', 'knowledge', 'industry']
        .every((key) => this.toInteger(draft.tiers[key], 2) === this.toInteger(source.defaultTiers?.[key], 2));
      const previewPolicyLabel = isDefaultDraft ? draftPolicyLabel : this.makeTalentPolicyName(basePolicy, draft.tiers);
      const hasPendingPreview = previewPolicyLabel !== activePolicyLabel;
      const subtitle = hasPendingPreview
        ? `当前：${activePolicyLabel || '均衡发展'} / 预览：${previewPolicyLabel}`
        : `当前：${activePolicyLabel || '均衡发展'}`;

      return {
        activePolicyId,
        activePolicyLabel,
        systemPolicies: systemPolicies.map((policy) => ({
          ...policy,
          active: policy.id === activePolicyId,
          selected: policy.id === draft.basePolicyId,
        })),
        customPolicies: customPolicies.map((policy) => ({
          ...policy,
          label: policy.displayName || policy.label || '自定义方针',
          active: policy.id === activePolicyId,
        })),
        tendencies: tendencies.map((tendency) => ({
          ...tendency,
          tier: Math.max(1, Math.min(3, this.toInteger(draft.tiers[tendency.id], 2))),
          tierLabel: tierLabels[Math.max(1, Math.min(3, this.toInteger(draft.tiers[tendency.id], 2)))],
        })),
        draft: {
          ...draft,
          displayName: this.makeTalentPolicyName(basePolicy, draft.tiers),
        },
        preview: {
          ...activePreview,
          ...preview,
          allocationText: allocationText || '暂无人才',
        },
        text: {
          title: '人才方针',
          subtitle,
          presetTitle: '系统方针',
          customTitle: '自定义微调',
          customName: this.makeTalentPolicyName(basePolicy, draft.tiers),
          emptyCustom: '暂无自定义方针',
          applyDraft: '确认方针',
          saveDraft: '保存微调',
        },
      };
    }

    static buildCitySwitcherViewState(state = {}) {
      const cityState = state.cityState || {};
      const cities = Array.isArray(cityState.cities) ? cityState.cities : [];
      const hidden = cities.length <= 1;
      const activeCityId = state.activeCityId || cityState.activeCityId || cityState.capitalCityId || 'capital';
      const activeCity = this.getActiveCity(state);
      const options = cities.map((city) => {
        const isActive = city.id === activeCityId;
        const officials = this.toInteger(city.population?.total);
        const population = this.toDisplayPopulation(officials);
        const buildings = this.toInteger(city.totalBuildings);
        const planning = city.planning || {};
        const terrainLabel = planning.terrainLabel || city.terrainLabel || '平原';
        const habitabilityLabel = planning.habitabilityLabel || city.habitabilityLabel || '平稳';
        return {
          id: city.id || '',
          name: city.name || '未命名城市',
          tag: city.isCapital ? '主城' : '分城',
          officials,
          population,
          buildings,
          terrainLabel,
          habitabilityLabel,
          metaText: `人口 ${population} · ${terrainLabel} · 宜居${habitabilityLabel}`,
          isActive,
        };
      });

      return {
        hidden,
        activeCityId,
        activeCityName: activeCity?.name || '首都',
        activeTerrainLabel: activeCity?.planning?.terrainLabel || activeCity?.terrainLabel || '平原',
        activeHabitabilityLabel: activeCity?.planning?.habitabilityLabel || activeCity?.habitabilityLabel || '平稳',
        options,
        signature: JSON.stringify(options),
      };
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
      const locked = this.toNumber(state.currentEra) < 5;
      const requestedView = ['army', 'scout', 'world'].includes(state.militaryView) ? state.militaryView : 'army';
      const activeView = locked && requestedView !== 'army' ? 'army' : requestedView;
      const views = ['army', 'scout', 'world'].map((id) => {
        const disabled = locked && id !== 'army';
        return {
          id,
          isActive: id === activeView,
          disabled,
          isLocked: disabled,
          title: disabled ? '进入古典时代后解锁' : '',
          ariaSelected: String(id === activeView),
        };
      });
      return {
        activeView,
        locked,
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

    static getBuildingLevel(buildings, id) {
      const entry = buildings?.[id];
      return entry && typeof entry === 'object' ? this.toInteger(entry.level) : this.toInteger(entry);
    }

    static getBuildingActionLabel(cost, level) {
      if (cost === null) return '已满级';
      return level > 0 ? '升级' : '建造';
    }

    static isBuildingOpenEnded(config = {}) {
      return Boolean(config?.scalePlan?.openEnded);
    }

    static getExtraBuildingEffectEfficiency(curve, extraIndex) {
      if (curve === 'linear') return 1;
      if (curve === 'step') return 0.5;
      const floor = 0.05;
      return floor + (1 - floor) / Math.sqrt(extraIndex + 2);
    }

    static getVisibleBuildingIds(state = {}) {
      const unlocked = Array.isArray(state.unlockedBuildings) ? state.unlockedBuildings : [];
      const built = Object.entries(state.buildings || {})
        .filter(([, entry]) => (entry && typeof entry === 'object' ? entry.level : entry) > 0)
        .map(([id]) => id);
      return Array.from(new Set([...unlocked, ...built]));
    }

    static getBuildingConfig(state = {}, buildingConfig = {}, id) {
      return state.buildingDefinitions?.[id] || buildingConfig[id] || null;
    }

    static getBuildingCategoryDefinitions(state = {}, buildingConfig = {}) {
      const source = state.buildingCategories || buildingConfig.categories || {};
      const fallback = {
        agriculture: { label: '农业', order: 1 },
        livelihood: { label: '民生', order: 2 },
        production: { label: '生产', order: 3 },
        culture: { label: '文化', order: 4 },
        entertainment: { label: '娱乐', order: 5 },
        military: { label: '军事', order: 6 },
      };
      return { ...fallback, ...(source && typeof source === 'object' ? source : {}) };
    }

    static getBuildingCategory(config = {}) {
      return config.category || 'production';
    }

    static buildBuildingCategoryTabs(cards = [], activeCategory = 'all', definitions = {}) {
      const counts = cards.reduce((result, card) => {
        const category = card.category || 'production';
        result[category] = (result[category] || 0) + 1;
        return result;
      }, {});
      const categoryTabs = Object.entries(definitions)
        .map(([id, definition]) => ({
          id,
          label: definition?.label || id,
          order: Number(definition?.order) || 99,
          count: counts[id] || 0,
        }))
        .filter((tab) => tab.count > 0)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
      const tabs = [
        { id: 'all', label: '全部', count: cards.length, active: activeCategory === 'all' },
        ...categoryTabs,
      ];
      const hasActive = tabs.some((tab) => tab.id === activeCategory && tab.count > 0);
      const resolvedActiveCategory = hasActive ? activeCategory : 'all';
      return tabs.map((tab) => ({
        ...tab,
        active: tab.id === resolvedActiveCategory,
      }));
    }

    static buildCostViewState(cost) {
      if (cost === null) return { text: '已满级', parts: [], isMax: true };
      if (!cost) return { text: '免费建造', parts: [], isMax: false };
      const parts = ['wood', 'iron', 'stone', 'food', 'knowledge', 'metal']
        .filter((resource) => cost[resource])
        .map((resource) => ({
          resource,
          value: cost[resource],
          text: this.formatResourceAmount(cost[resource]),
        }));
      return {
        text: parts.length ? '' : '免费建造',
        parts,
        isMax: false,
      };
    }

    static getBuildingEffectSummary(config = {}, level = 0) {
      const currentLevel = Math.max(0, this.toInteger(level));
      const perLevel = config.effects?.perLevel || {};
      const summary = { level: currentLevel };
      if (perLevel.foodOutputMultiplier) summary.foodOutputBonus = this.calculateBuildingEffectBonus(config, 'foodOutputMultiplier', currentLevel);
      if (perLevel.populationCap) summary.populationCapBonus = this.calculateBuildingEffectBonus(config, 'populationCap', currentLevel);
      if (perLevel.knowledgeOutputMultiplier) summary.knowledgeOutputBonus = this.calculateBuildingEffectBonus(config, 'knowledgeOutputMultiplier', currentLevel);
      if (perLevel.craftsmanOutputMultiplier) summary.craftsmanOutputBonus = this.calculateBuildingEffectBonus(config, 'craftsmanOutputMultiplier', currentLevel);
      if (perLevel.woodOutputBase) summary.woodOutputBase = this.calculateBuildingEffectBonus(config, 'woodOutputBase', currentLevel);
      if (perLevel.stoneOutputBase) summary.stoneOutputBase = this.calculateBuildingEffectBonus(config, 'stoneOutputBase', currentLevel);
      if (perLevel.ironOutputBase) summary.ironOutputBase = this.calculateBuildingEffectBonus(config, 'ironOutputBase', currentLevel);
      if (perLevel.offlineEfficiency) summary.offlineEfficiencyBonus = this.calculateBuildingEffectBonus(config, 'offlineEfficiency', currentLevel);
      if (perLevel.defense) summary.defenseLevel = this.calculateBuildingEffectBonus(config, 'defense', currentLevel);
      if (perLevel.threatDefense) summary.threatDefenseBonus = this.calculateBuildingEffectBonus(config, 'threatDefense', currentLevel);
      if (perLevel.globalOutputMultiplier) summary.globalOutputBonus = this.calculateBuildingEffectBonus(config, 'globalOutputMultiplier', currentLevel);
      return summary;
    }

    static calculateBuildingEffectBonus(config = {}, field = '', level = 0) {
      const currentLevel = Math.max(0, this.toInteger(level));
      const perLevel = this.toNumber(config.effects?.perLevel?.[field]);
      if (currentLevel <= 0 || perLevel <= 0) return 0;
      const configuredMaxLevel = this.toInteger(config.maxLevel);
      if (configuredMaxLevel <= 0) return Math.round(currentLevel * perLevel * 1000) / 1000;
      const maxLevel = Math.max(1, configuredMaxLevel);
      let total = Math.min(currentLevel, maxLevel) * perLevel;
      if (this.isBuildingOpenEnded(config) && currentLevel > maxLevel) {
        const curve = config.scalePlan?.effectCurve || 'diminishing';
        for (let index = 0; index < currentLevel - maxLevel; index += 1) {
          total += perLevel * this.getExtraBuildingEffectEfficiency(curve, index);
        }
      }
      return Math.round(total * 1000000) / 1000000;
    }

    static formatBuildingEffectValue(template, value, previousValue = null) {
      if (!template?.field || !template?.label || typeof value !== 'number' || value <= 0) return '';
      let totalText = '';
      let deltaText = '';
      const previous = typeof previousValue === 'number' ? previousValue : null;
      const delta = previous === null ? 0 : value - previous;
      if (template.field === 'populationCapBonus') {
        totalText = `${template.label} ${this.toDisplayPopulation(value)}`;
        if (delta > 0) deltaText = `提升 ${this.toDisplayPopulation(delta)}`;
      } else if (template.format === 'percent') {
        totalText = `${template.label}效率 ${Math.round((1 + value) * 100)}%`;
        if (delta > 0) {
          const deltaPercent = delta * 100;
          deltaText = `提升 ${deltaPercent < 1 ? '<1' : Math.round(deltaPercent)}%`;
        }
      } else {
        totalText = `${template.label} ${this.formatCompactNumber(value, { floorSmall: false })}`;
        if (delta > 0) deltaText = `提升 ${this.formatCompactNumber(delta, { floorSmall: false })}`;
      }
      return deltaText ? `${totalText}（${deltaText}）` : totalText;
    }

    static formatMilitaryEffectParts(config = {}, level = 0, previousLevel = null) {
      const military = config.military || {};
      const currentLevel = Math.max(0, this.toInteger(level));
      const previous = previousLevel === null ? null : Math.max(0, this.toInteger(previousLevel));
      const parts = [];
      const soldierCaps = Array.isArray(military.soldierCapByLevel) ? military.soldierCapByLevel : [];
      const intervals = Array.isArray(military.trainingIntervalSecondsByLevel) ? military.trainingIntervalSecondsByLevel : [];
      const cap = this.toInteger(soldierCaps[currentLevel]);
      const previousCap = previous === null ? null : this.toInteger(soldierCaps[previous]);
      if (cap > 0) {
        const delta = previousCap === null ? 0 : cap - previousCap;
        parts.push(delta > 0 ? `士兵容量 ${cap}（提升 ${delta}）` : `士兵容量 ${cap}`);
      }
      const interval = this.toInteger(intervals[currentLevel]);
      const previousInterval = previous === null ? null : this.toInteger(intervals[previous]);
      if (interval > 0) {
        const faster = previousInterval && previousInterval > interval ? previousInterval - interval : 0;
        parts.push(faster > 0 ? `训练速度 ${interval}秒/人（加快 ${faster}秒）` : `训练速度 ${interval}秒/人`);
      }
      return parts;
    }

    static formatBuildingEffectText(config = {}, level = 0, previousLevel = null, effectOverride = null) {
      const effect = effectOverride || this.getBuildingEffectSummary(config, level);
      const previousEffect = previousLevel === null ? null : this.getBuildingEffectSummary(config, previousLevel);
      const templates = config?.ui?.effectText || [];
      const parts = templates
        .map((template) => this.formatBuildingEffectValue(
          template,
          effect?.[template.field],
          previousEffect?.[template.field],
        ))
        .filter(Boolean);
      parts.push(...this.formatMilitaryEffectParts(config, level, previousLevel));
      return parts.join('，');
    }

    static getBuildingEffectText(config, buildingEffects = {}) {
      const effect = buildingEffects?.byBuilding?.[config?.id] || {};
      const level = this.toInteger(effect.level);
      return this.formatBuildingEffectText(config, level);
    }

    static getResourceDisplayName(resource) {
      return {
        food: '食物',
        knowledge: '知识',
        wood: '木材',
        iron: '铁矿',
        stone: '石料',
        metal: '铁矿',
      }[resource] || resource;
    }

    static getMaintenanceResourceKeys(maintenance = {}) {
      return Object.entries(maintenance.perLevelPerMinute || {})
        .filter(([, value]) => this.toNumber(value) > 0)
        .map(([resource]) => resource);
    }

    static formatHabitabilityPressure(value) {
      const pressure = this.toNumber(value);
      if (pressure <= 0) return '宜居压力平稳';
      if (pressure <= 1) return '宜居压力轻微';
      if (pressure <= 2) return '宜居压力较高';
      return '宜居压力沉重';
    }

    static formatHabitabilityPressureShort(value) {
      const pressure = this.toNumber(value);
      if (pressure <= 0) return '平稳';
      if (pressure <= 1) return '轻微';
      if (pressure <= 2) return '较高';
      return '沉重';
    }

    static formatBuildingScale(level = 0) {
      const currentLevel = this.toInteger(level);
      if (currentLevel <= 0) return '未建造';
      if (currentLevel <= 2) return '小';
      if (currentLevel <= 4) return '中';
      return '大';
    }

    static formatMaintenanceRate(value) {
      const perSecond = this.toNumber(value) / 60;
      if (perSecond <= 0) return '';
      const rounded = perSecond < 0.01
        ? Math.round(perSecond * 1000) / 1000
        : Math.round(perSecond * 100) / 100;
      return this.trimDecimal(rounded);
    }

    static formatBuildingMaintenanceText(config = {}, level = 0) {
      const maintenance = config.maintenance || {};
      const currentLevel = this.toInteger(level);
      if (currentLevel <= 0) return '维护所需：无';
      const parts = Object.entries(maintenance.perLevelPerMinute || {})
        .map(([resource, value]) => {
          const rate = this.formatMaintenanceRate(this.toNumber(value) * currentLevel);
          return rate ? `${this.getResourceDisplayName(resource)} ${rate}/s` : '';
        })
        .filter(Boolean);
      return `维护所需：${parts.join('，') || '无'}`;
    }

    static formatBuildingCityImpactText(config = {}) {
      return `城市影响：${this.formatHabitabilityPressure(config.maintenance?.habitabilityPressure)}`;
    }

    static getBuildingMilitaryLines(id, military = {}, buildingEffects = {}) {
      if (id !== 'barracks' || !military || !military.soldierCap) return [];
      const soldiers = this.toInteger(military.soldiers);
      const cap = this.toInteger(military.soldierCap);
      const progress = this.toInteger(military.trainingProgress);
      const interval = this.toInteger(military.trainingIntervalSeconds);
      const defense = this.toInteger((military.defense || 0) + (buildingEffects?.threatDefense || 0));
      return [
        `士兵 ${soldiers}/${cap} · 防御 ${defense}`,
        soldiers >= cap ? '训练已满' : `下一名 ${progress}/${interval}秒`,
      ];
    }

    static canAffordCost(resources = {}, cost) {
      if (!cost || cost === null) return true;
      return ['wood', 'iron', 'stone', 'food', 'knowledge', 'metal']
        .every((resource) => this.toNumber(resources?.[resource]) >= this.toNumber(cost?.[resource]));
    }

    static buildBuildingCardViewState(state = {}, tutorial = {}, buildingConfig = {}, id) {
      const config = this.getBuildingConfig(state, buildingConfig, id);
      if (!config) return null;
      const level = this.getBuildingLevel(state.buildings, id);
      const cost = state.buildingCosts && Object.prototype.hasOwnProperty.call(state.buildingCosts, id)
        ? state.buildingCosts[id]
        : undefined;
      const actionLabel = this.getBuildingActionLabel(cost, level);
      const disabledByTutorial = Boolean(tutorial && !tutorial.completed && (
        (tutorial.currentStep === 5 && id !== 'farm')
        || (tutorial.currentStep === 7 && id !== 'house')
        || (tutorial.currentStep >= 13 && tutorial.currentStep <= 14 && id !== 'lumbermill')
      ));
      const isMax = cost === null || actionLabel === '已满级' || actionLabel === '宸叉弧绾?' || actionLabel === 'max';
      const canAfford = this.canAffordCost(state.resources, cost);
      const disabledByCost = !isMax && !canAfford;
      const disabled = disabledByTutorial || isMax || disabledByCost;
      const maxLevel = this.toInteger(config.maxLevel);
      const nextLevel = isMax ? null : level + 1;
      const currentEffectSummary = state.buildingEffects?.byBuilding?.[id] || this.getBuildingEffectSummary(config, level);
      const currentEffectText = this.formatBuildingEffectText(config, level, null, currentEffectSummary) || '无';
      const nextEffectValue = nextLevel === null
        ? '当前时代暂不可继续扩建'
        : (this.formatBuildingEffectText(config, nextLevel, level) || '无');
      const nextEffectLabel = level > 0 ? '下一级效果' : '建成后效果';
      const effectText = currentEffectText === '无' ? '' : currentEffectText;
      const militaryLines = this.getBuildingMilitaryLines(id, state.military, state.buildingEffects);
      const descText = config?.ui?.description || '';

      return {
        id,
        name: config.name || id,
        art: config.art || '',
        icon: config.icon || '',
        level,
        levelText: `等级 ${level}`,
        category: this.getBuildingCategory(config),
        maxLevel,
        scaleText: `规模：${this.formatBuildingScale(level)}`,
        metaText: `等级：${level}　规模：${this.formatBuildingScale(level)}`,
        isMuted: disabledByTutorial,
        effectText,
        currentEffectText: `当前效果：${currentEffectText}`,
        nextEffectText: `${nextEffectLabel}：${nextEffectValue}`,
        maintenanceText: this.formatBuildingMaintenanceText(config, level),
        cityImpactText: this.formatBuildingCityImpactText(config),
        costTitle: level > 0 ? '升级所需' : '建造所需',
        descText,
        militaryLines,
        button: {
          action: level ? 'upgrade' : 'build',
          disabled,
          label: disabledByTutorial ? '引导中锁定' : disabledByCost ? '资源不足' : actionLabel,
        },
        cost: this.buildCostViewState(cost),
        structure: {
          hasEffect: currentEffectText !== '无' || nextEffectValue !== '无',
          hasMilitary: Boolean(config.military),
          hasDescription: Boolean(descText),
          hasPlanning: true,
        },
      };
    }

    static buildBuildingViewState(state = {}, tutorial = {}, buildingConfig = {}, options = {}) {
      const ids = this.getVisibleBuildingIds(state);
      const allCards = ids
        .map((id) => this.buildBuildingCardViewState(state, tutorial, buildingConfig, id))
        .filter(Boolean);
      const activeCategory = options.activeCategory || 'all';
      const categoryDefinitions = this.getBuildingCategoryDefinitions(state, buildingConfig);
      const categoryTabs = this.buildBuildingCategoryTabs(allCards, activeCategory, categoryDefinitions);
      const resolvedActiveCategory = categoryTabs.find((tab) => tab.active)?.id || 'all';
      const cards = resolvedActiveCategory === 'all'
        ? allCards
        : allCards.filter((card) => card.category === resolvedActiveCategory);
      return {
        ids: allCards.map((card) => card.id),
        filteredIds: cards.map((card) => card.id),
        isEmpty: cards.length === 0,
        emptyText: allCards.length === 0 ? '当前时代暂无可建造建筑' : '当前分类暂无可建造建筑',
        activeCategory: resolvedActiveCategory,
        categoryTabs,
        cards,
        structureSignature: JSON.stringify(cards.map((card) => ({
          id: card.id,
          name: card.name,
          art: card.art,
          icon: card.icon,
          structure: card.structure,
        }))),
      };
    }

    static getEventResourceLabel(resource) {
      return {
        food: '食物',
        knowledge: '知识',
        wood: '木材',
        iron: '铁矿',
        stone: '石料',
        metal: '铁矿',
      }[resource] || resource;
    }

    static formatEventResourcePart(resource, value) {
      const amount = this.toNumber(value);
      if (!amount) return '';
      const sign = amount > 0 ? '+' : '-';
      return `${this.getEventResourceLabel(resource)} ${sign}${this.formatResourceAmount(Math.abs(amount))}`;
    }

    static buildEventResourcePart(resource, value) {
      const amount = this.toNumber(value);
      if (!amount) return null;
      const sign = amount > 0 ? '+' : '-';
      return {
        type: 'resource',
        resource: resource === 'metal' ? 'iron' : resource,
        text: `${sign}${this.formatResourceAmount(Math.abs(amount))}`,
      };
    }

    static formatEventDuration(seconds) {
      const total = this.toInteger(seconds);
      if (total <= 0) return '';
      if (total < 60) return `${total}秒`;
      const minutes = Math.floor(total / 60);
      const rest = total % 60;
      return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
    }

    static formatEventBuffEffect(effect = {}) {
      const value = this.toNumber(effect.value);
      const duration = this.formatEventDuration(effect.durationSeconds);
      const prefix = duration ? `${duration} ` : '';
      if (effect.buffType === 'resourceMultiplier') {
        return `${prefix}${this.getEventResourceLabel(effect.target)}产出 ${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
      }
      if (effect.buffType === 'offlineEfficiencyBonus') {
        return `${prefix}离线收益效率 ${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`;
      }
      if (effect.buffType === 'happinessFlat') {
        return `${prefix}幸福度 ${value >= 0 ? '+' : ''}${this.formatCompactNumber(value, { floorSmall: false })}`;
      }
      return effect.label ? `${prefix}${effect.label}` : `${prefix}临时加成`;
    }

    static formatEventEffect(effect = {}) {
      const value = this.toNumber(effect.value);
      if (effect.type === 'resource') return this.formatEventResourcePart(effect.key, value);
      if (effect.type === 'soldiers') {
        if (!value) return '';
        return `士兵 ${value > 0 ? '+' : '-'}${this.formatResourceAmount(Math.abs(value))}`;
      }
      if (effect.type === 'buff') return this.formatEventBuffEffect(effect);
      return '';
    }

    static buildEventEffectPart(effect = {}) {
      const value = this.toNumber(effect.value);
      if (!value) return null;
      if (effect.type === 'resource') return this.buildEventResourcePart(effect.key, value);
      if (effect.type === 'soldiers') {
        const sign = value > 0 ? '+' : '-';
        return { type: 'resource', resource: 'soldier', text: `${sign}${this.formatResourceAmount(Math.abs(value))}` };
      }
      if (effect.type === 'buff') return { type: 'text', text: this.formatEventBuffEffect(effect) };
      return null;
    }

    static formatEventEffects(effects = [], filter = 'all') {
      return (effects || [])
        .map((effect) => {
          const value = this.toNumber(effect?.value);
          const isBuff = effect?.type === 'buff';
          const isPositive = isBuff ? value >= 0 : value > 0;
          const isNegative = value < 0;
          if (filter === 'positive' && !isPositive) return '';
          if (filter === 'negative' && !isNegative) return '';
          return this.formatEventEffect(effect);
        })
        .filter(Boolean)
        .join(' ');
    }

    static buildEventEffectParts(effects = [], filter = 'all') {
      return (effects || [])
        .map((effect) => {
          const value = this.toNumber(effect?.value);
          const isBuff = effect?.type === 'buff';
          const isPositive = isBuff ? value >= 0 : value > 0;
          const isNegative = value < 0;
          if (filter === 'positive' && !isPositive) return null;
          if (filter === 'negative' && !isNegative) return null;
          return this.buildEventEffectPart(effect);
        })
        .filter(Boolean);
    }

    static formatEventRequirements(requirements = {}) {
      if (!requirements || typeof requirements !== 'object') return '';
      const parts = [];
      const defense = Number(requirements.defense);
      const soldiers = Number(requirements.soldiers);
      if (Number.isFinite(defense)) parts.push(`防御 ${this.formatResourceAmount(defense)}`);
      if (Number.isFinite(soldiers)) parts.push(`士兵 ${this.formatResourceAmount(soldiers)}`);
      return parts.join('，');
    }

    static buildEventRequirementParts(requirements = {}) {
      if (!requirements || typeof requirements !== 'object') return [];
      const parts = [];
      const defense = Number(requirements.defense);
      const soldiers = Number(requirements.soldiers);
      if (Number.isFinite(defense)) parts.push({ type: 'text', text: `防御 ${this.formatResourceAmount(defense)}` });
      if (Number.isFinite(soldiers)) parts.push({ type: 'resource', resource: 'soldier', text: String(this.formatResourceAmount(soldiers)) });
      return parts;
    }

    static formatEventReward(reward) {
      if (!reward) return '事件已完成';
      const parts = [];
      if (reward.food) parts.push(this.formatEventResourcePart('food', reward.food));
      if (reward.knowledge) parts.push(this.formatEventResourcePart('knowledge', reward.knowledge));
      if (reward.wood) parts.push(this.formatEventResourcePart('wood', reward.wood));
      if (reward.iron || reward.metal) parts.push(this.formatEventResourcePart('iron', reward.iron || reward.metal));
      if (reward.stone) parts.push(this.formatEventResourcePart('stone', reward.stone));
      return parts.join(' ') || '事件已完成';
    }

    static buildEventRewardParts(reward = {}) {
      if (!reward || typeof reward !== 'object') return [];
      return ['food', 'wood', 'iron', 'stone', 'knowledge']
        .map((resource) => this.buildEventResourcePart(resource, reward[resource] ?? (resource === 'iron' ? reward.metal : undefined)))
        .filter(Boolean);
    }

    static getEventOptionRewardText(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      const effectReward = this.formatEventEffects(option.requirements ? successEffects : directEffects, 'positive');
      const explicitReward = option.reward ? this.formatEventReward(option.reward) : '';
      return effectReward || explicitReward;
    }

    static getEventOptionRewardParts(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      const effectParts = this.buildEventEffectParts(option.requirements ? successEffects : directEffects, 'positive');
      const explicitParts = option.reward ? this.buildEventRewardParts(option.reward) : [];
      return effectParts.length ? effectParts : explicitParts;
    }

    static getEventOptionCostText(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      return this.formatEventEffects(option.requirements ? successEffects : directEffects, 'negative');
    }

    static getEventOptionCostParts(option = {}) {
      const successEffects = Array.isArray(option.successEffects) ? option.successEffects : [];
      const directEffects = Array.isArray(option.effects) ? option.effects : [];
      return this.buildEventEffectParts(option.requirements ? successEffects : directEffects, 'negative');
    }

    static getEventOptionPenaltyText(option = {}) {
      const failureEffects = Array.isArray(option.failureEffects) ? option.failureEffects : [];
      const timeoutEffects = Array.isArray(option.timeoutEffects) ? option.timeoutEffects : [];
      return this.formatEventEffects(failureEffects.length ? failureEffects : timeoutEffects, 'negative');
    }

    static getEventOptionPenaltyParts(option = {}) {
      const failureEffects = Array.isArray(option.failureEffects) ? option.failureEffects : [];
      const timeoutEffects = Array.isArray(option.timeoutEffects) ? option.timeoutEffects : [];
      return this.buildEventEffectParts(failureEffects.length ? failureEffects : timeoutEffects, 'negative');
    }

    static buildEventOptionRows(option = {}) {
      const requirementText = this.formatEventRequirements(option.requirements);
      const rewardText = this.getEventOptionRewardText(option);
      const costText = this.getEventOptionCostText(option);
      const penaltyText = this.getEventOptionPenaltyText(option);
      return [
        { label: '需求', text: requirementText || '无', tone: 'requirement', parts: this.buildEventRequirementParts(option.requirements), empty: !requirementText },
        { label: '奖励', text: rewardText || '无', tone: 'reward', parts: this.getEventOptionRewardParts(option), empty: !rewardText },
        { label: '消耗', text: costText || '无', tone: 'cost', parts: this.getEventOptionCostParts(option), empty: !costText },
        { label: '惩罚', text: penaltyText || '无', tone: 'penalty', parts: this.getEventOptionPenaltyParts(option), empty: !penaltyText },
      ];
    }

    static getEventOptionPreview(option) {
      if (option?.preview) return option.preview;
      if (option?.reward) return this.formatEventReward(option.reward);
      const rows = this.buildEventOptionRows(option);
      const visibleRows = rows.filter((row) => !row.empty);
      if (visibleRows.length) return visibleRows.map((row) => `${row.label} ${row.text}`).join('；');
      return this.formatEventReward(option?.reward);
    }

    static getRemainingSeconds(expiresAt, nowMs = Date.now()) {
      const expiresAtMs = new Date(expiresAt).getTime();
      if (!Number.isFinite(expiresAtMs)) return null;
      return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
    }

    static formatRemainingTime(expiresAt, nowMs = Date.now()) {
      const seconds = this.getRemainingSeconds(expiresAt, nowMs);
      if (seconds === null) return '';
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      return `${minutes}:${String(rest).padStart(2, '0')}`;
    }

    static getEventHint(event, nowMs = Date.now()) {
      const remaining = this.formatRemainingTime(event?.expiresAt, nowMs);
      if (event?.type === 'threat') {
        if (!remaining) return '超时将按失败处理';
        return `剩余 ${remaining}，超时将按失败处理`;
      }
      if (event?.type === 'regular') {
        if (!remaining) return '超时将自动失效';
        return `剩余 ${remaining}，超时将自动失效`;
      }
      return '点击查看详情';
    }

    static buildEventCardViewState(event = {}, nowMs = Date.now()) {
      return {
        id: event.id || '',
        icon: event.icon || '📜',
        iconAsset: 'assets/art/icon-event-cutout.webp',
        title: event.title || '',
        description: event.description || '',
        hint: this.getEventHint(event, nowMs),
        classState: {
          'is-special': event.type === 'special',
          'is-threat': event.type === 'threat',
        },
      };
    }

    static buildEventHistoryItemViewState(event = {}) {
      const selectedOption = event.selectedOptionId
        ? event.options?.find((item) => item.id === event.selectedOptionId)
        : null;
      return {
        icon: event.icon || '📜',
        iconAsset: 'assets/art/icon-event-cutout.webp',
        title: event.title || '',
        result: event.resultSummary || this.formatEventReward(selectedOption?.reward),
        className: event.type === 'threat' ? 'threat' : 'positive',
      };
    }

    static buildEventViewState(state = {}, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const eventQueue = Array.isArray(state.eventQueue) ? state.eventQueue : [];
      const eventHistory = Array.isArray(state.eventHistory) ? state.eventHistory : [];
      const pendingCards = eventQueue.map((event) => this.buildEventCardViewState(event, nowMs));
      const historyItems = eventHistory.map((event) => this.buildEventHistoryItemViewState(event));
      return {
        badge: {
          hidden: !eventQueue.length,
          text: eventQueue.length > 9 ? '9+' : String(eventQueue.length),
        },
        pending: {
          isEmpty: !pendingCards.length,
          emptyText: '暂无待处理事件',
          cards: pendingCards,
        },
        history: {
          isEmpty: !historyItems.length,
          emptyText: '暂无事件记录',
          items: historyItems,
        },
      };
    }

    static buildTechViewState(state = {}) {
      const techs = state.techs || {};
      const eras = Array.isArray(techs.eras) ? techs.eras : [];
      const points = this.toInteger(techs.points);
      const researchedCount = this.toInteger(techs.researchedCount || Object.keys(techs.researched || {}).length);
      const availableCount = eras.reduce((sum, era) => (
        sum + (Array.isArray(era.techs) ? era.techs.filter((tech) => tech.available).length : 0)
      ), 0);
      const statusLabels = {
        available: '可研究',
        researched: '已研究',
        locked: '时代未解锁',
        missingPrerequisite: '需先研究前置科技',
        eraChoiceFull: '本时代已确定',
        noPoints: '科技点不足',
      };
      const resourceDirectionLabels = {
        food: '粮食生产',
        wood: '木材采集',
        stone: '石料工程',
        iron: '铁矿利用',
        metal: '铁矿利用',
        knowledge: '知识积累',
      };
      const resourceDirectionByText = {
        粮食: '粮食生产',
        木材: '木材采集',
        石料: '石料工程',
        铁矿: '铁矿利用',
        知识: '知识积累',
      };
      const buildingEffectById = {
        farm: '农田提供稳定粮食生产。',
        house: '民居提升文明人口承载能力。',
        lumbermill: '伐木场提供稳定木材生产。',
        barracks: '兵营训练士兵，开启基础军事力量。',
        watchtower: '瞭望台提升边境防御能力。',
        quarry: '采石场提供稳定石料生产。',
        mine: '矿场提供稳定铁矿生产。',
        workshop: '工坊强化工业生产与后续制造。',
        academy: '学院强化知识积累。',
        temple: '神庙服务后续文化与精神建设。',
      };
      const buildingEffectByName = {
        农田: buildingEffectById.farm,
        民居: buildingEffectById.house,
        伐木场: buildingEffectById.lumbermill,
        兵营: buildingEffectById.barracks,
        瞭望台: buildingEffectById.watchtower,
        采石场: buildingEffectById.quarry,
        矿场: buildingEffectById.mine,
        工坊: buildingEffectById.workshop,
        学院: buildingEffectById.academy,
        神庙: buildingEffectById.temple,
      };
      const splitDisplayList = (value) => {
        if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
        return String(value || '')
          .split(/[、/,，\s]+/)
          .map((item) => item.trim())
          .filter(Boolean);
      };
      const uniqueList = (items = []) => Array.from(new Set(items.filter(Boolean)));
      const makeTechEffectRows = (tech = {}) => {
        const buildingNames = uniqueList(splitDisplayList(tech.unlockText));
        const buildingEffects = uniqueList([
          ...(Array.isArray(tech.unlockedBuildings) ? tech.unlockedBuildings.map((id) => buildingEffectById[id]) : []),
          ...buildingNames.map((name) => buildingEffectByName[name]),
        ]);
        const resourceDirections = uniqueList(
          Array.isArray(tech.resourceEntrances) && tech.resourceEntrances.length
            ? tech.resourceEntrances.map((key) => resourceDirectionLabels[key] || key)
            : splitDisplayList(tech.resourceText).map((label) => resourceDirectionByText[label] || label),
        );
        const rows = [];
        if (buildingNames.length) rows.push({ label: '解锁建筑', text: buildingNames.join('、') });
        if (buildingEffects.length) rows.push({ label: '研究后', text: buildingEffects.join('；') });
        if (resourceDirections.length) rows.push({ label: '发展方向', text: resourceDirections.join('、') });
        if (!rows.length) rows.push({ label: '发展方向', text: tech.routeLabel || '文明路线' });
        return rows;
      };
      const visibleEras = eras.map((era) => ({
        era: era.era,
        name: era.name || `时代 ${era.era}`,
        summary: era.summary || '',
        choiceText: `${this.toInteger(era.choicesUsed)}/${this.toInteger(era.choiceLimit, 1)}`,
        closed: Boolean(era.closed),
        techs: (era.techs || []).map((tech) => {
          let buttonLabel = '研究';
          if (tech.status === 'researched') buttonLabel = '已研究';
          else if (tech.status === 'locked') buttonLabel = '未解锁';
          else if (tech.status === 'missingPrerequisite') buttonLabel = '需前置';
          else if (tech.status === 'eraChoiceFull') buttonLabel = '本时代已确定';
          else if (tech.status === 'noPoints') buttonLabel = '点数不足';
          const effectRows = makeTechEffectRows(tech);
          const parentNames = Array.isArray(tech.parentNames) ? tech.parentNames.filter(Boolean) : [];
          const missingParentNames = Array.isArray(tech.missingParentNames) ? tech.missingParentNames.filter(Boolean) : [];
          return {
            ...tech,
            title: tech.name || '',
            routeLabel: tech.routeLabel || '路线',
            summary: tech.summary || '',
            core: tech.core || '',
            tree: tech.tree || { column: era.era, lane: 0, parents: tech.parents || [] },
            parents: Array.isArray(tech.parents) ? [...tech.parents] : [],
            parentNames,
            missingParentNames,
            effectRows,
            unlockSummary: effectRows.map((row) => `${row.label}：${row.text}`).join(' / '),
            prerequisiteText: parentNames.length ? parentNames.join(' / ') : '无',
            missingPrerequisiteText: missingParentNames.length ? missingParentNames.join(' / ') : '',
            statusLabel: statusLabels[tech.status] || buttonLabel,
            buttonLabel,
            disabled: !tech.available,
            researched: Boolean(tech.researched || tech.status === 'researched'),
          };
        }),
      }));
      const nodes = visibleEras.flatMap((era) => (
        (era.techs || []).map((tech, index) => ({
          ...tech,
          era: era.era,
          eraName: era.name,
          eraChoiceText: era.choiceText,
          tree: {
            column: this.toInteger(tech.tree?.column, era.era),
            lane: this.toNumber(tech.tree?.lane ?? (index - Math.floor((era.techs || []).length / 2))),
            row: this.toNumber(tech.tree?.row ?? tech.tree?.column ?? era.era),
            routes: Array.isArray(tech.tree?.routes) ? [...tech.tree.routes] : [],
            parents: Array.isArray(tech.tree?.parents) ? [...tech.tree.parents] : [...(tech.parents || [])],
          },
        }))
      ));
      const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
      const links = nodes.flatMap((node) => (
        (node.tree?.parents || [])
          .filter((parentId) => nodesById[parentId])
          .map((parentId) => {
            const parent = nodesById[parentId] || {};
            return {
              from: parentId,
              to: node.id,
              researched: Boolean(parent.researched && node.researched),
              active: Boolean(parent.researched && node.available),
              locked: node.status === 'locked',
            };
          })
      ));
      const treeEras = visibleEras.map((era) => ({
        era: era.era,
        name: era.name,
        choiceText: era.choiceText,
        closed: era.closed,
        column: era.era,
      }));
      const selectedTechId = state.techUiState?.selectedTechId
        || state.selectedTechId
        || nodes.find((node) => node.available)?.id
        || nodes.find((node) => !node.researched)?.id
        || nodes[0]?.id
        || '';
      const selectedTech = nodesById[selectedTechId] || nodes[0] || null;
      const routeLabelsById = {};
      visibleEras.forEach((era) => {
        (era.techs || []).forEach((tech) => {
          if (tech.route) routeLabelsById[tech.route] = tech.routeLabel || tech.route;
          (Array.isArray(tech.tree?.routes) ? tech.tree.routes : []).forEach((route) => {
            if (!routeLabelsById[route]) routeLabelsById[route] = tech.routeLabel || route;
          });
        });
      });
      const selectedRoutes = selectedTech
        ? (Array.isArray(selectedTech.tree?.routes) && selectedTech.tree.routes.length
          ? selectedTech.tree.routes
          : (selectedTech.route ? [selectedTech.route] : []))
        : [];
      const detail = selectedTech
        ? {
          empty: false,
          id: selectedTech.id,
          title: selectedTech.title || selectedTech.name || '科技',
          eraName: selectedTech.eraName || visibleEras.find((era) => era.era === selectedTech.era)?.name || '',
          routeId: selectedTech.route || selectedRoutes[0] || '',
          routes: selectedRoutes,
          routeLabel: selectedRoutes.length > 1
            ? selectedRoutes.map((route) => routeLabelsById[route] || route).join(' / ')
            : (selectedTech.routeLabel || '路线'),
          statusLabel: selectedTech.statusLabel || '未解锁',
          summary: selectedTech.summary || selectedTech.core || '选择科技查看效果。',
          unlockSummary: selectedTech.unlockSummary || '路线倾向',
          effectRows: Array.isArray(selectedTech.effectRows) ? selectedTech.effectRows : [],
          prerequisiteText: selectedTech.prerequisiteText || '无',
          missingPrerequisiteText: selectedTech.missingPrerequisiteText || '',
          pointsText: `科技点 ${points}`,
          buttonLabel: selectedTech.researched ? '已研究' : '研究',
          canResearch: Boolean(selectedTech.available),
          disabledReason: selectedTech.available ? '' : (selectedTech.statusLabel || selectedTech.buttonLabel || '暂不可研究'),
        }
        : {
          empty: true,
          title: '选择一个科技',
          summary: '点击科技节点查看效果。',
          statusLabel: '未选择',
          buttonLabel: '研究',
          canResearch: false,
        };

      return {
        points,
        researchedCount,
        availableCount,
        eras: visibleEras,
        selectedTechId,
        detail,
        tree: {
          eras: treeEras,
          nodes,
          links,
          laneMin: nodes.reduce((min, node) => Math.min(min, Number(node.tree?.lane) || 0), 0),
          laneMax: nodes.reduce((max, node) => Math.max(max, Number(node.tree?.lane) || 0), 0),
        },
        text: {
          knowledgeRate: `${this.toNumber(state.resources?.knowledgePerSecond)}/s`,
          title: '科技树',
          points: `科技点 ${points}`,
          researched: `已研究 ${researchedCount}`,
          available: availableCount > 0 ? `可研究 ${availableCount}` : '暂无可研究',
          placeholder: '进入新时代后获得科技点',
          subtitle: '前期科技用于选择文明路线，古典时代开始解锁关键建筑。',
        },
      };
    }

    static buildEventModalViewState(eventData = {}, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const eventOptions = Array.isArray(eventData.options) ? eventData.options : [];
      const optionViews = eventOptions.map((option) => {
        const rows = this.buildEventOptionRows(option);
        return {
          id: option.id || '',
          label: option.label || '处理事件',
          preview: this.getEventOptionPreview(option),
          rows,
        };
      });
      const firstOption = optionViews[0];
      const singleOptionPreview = optionViews.length === 1
        ? optionViews[0].preview
        : '选择一种处理方式';
      const expiryHint = ['threat', 'regular'].includes(eventData?.type)
        ? this.getEventHint(eventData, nowMs)
        : '';

      const metaRows = [];
      if (expiryHint) {
        metaRows.push({
          label: '时限',
          text: expiryHint,
          tone: eventData?.type === 'threat' ? 'penalty' : 'time',
        });
      }
      if (optionViews.length > 1) {
        metaRows.push({ label: '选项', text: '选择一种处理方式', tone: 'neutral' });
      }

      return {
        iconAsset: 'assets/art/icon-event-cutout.webp',
        text: {
          title: eventData.title || '',
          description: eventData.description || '',
          reward: expiryHint ? `${singleOptionPreview} | ${expiryHint}` : singleOptionPreview,
        },
        metaRows,
        options: optionViews,
        claimButton: {
          optionId: firstOption?.id || '',
          label: firstOption?.label || '处理事件',
          hidden: optionViews.length !== 1,
        },
        showModal: true,
      };
    }

    static buildMilitaryViewState(state = {}) {
      const military = state.military || {};
      const soldiers = this.toInteger(military.soldiers);
      const cap = this.toInteger(military.soldierCap);
      const defense = this.toInteger((military.defense || 0) + (state.buildingEffects?.threatDefense || 0));
      const interval = this.toInteger(military.trainingIntervalSeconds);
      const progress = this.toInteger(military.trainingProgress);
      const availableSoldiers = this.toInteger(state.territoryState?.availableSoldiers ?? military.availableSoldiers ?? soldiers);
      const soldiersOnMission = this.toInteger(state.territoryState?.soldiersOnMission ?? military.soldiersOnMission ?? 0);

      let trainingText = `下一名 ${progress}/${interval} 秒`;
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
      const currentEra = this.toNumber(state.currentEra);
      if (currentEra < 5) {
        return {
          statusText: '进入古典时代后可派出侦察队。',
          cells: [],
        };
      }

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

    static buildWorldExpeditionDraftViewState(site = {}, uiState = {}) {
      const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
      return {
        territoryId: uiState.expeditionConfigSiteId || '',
        troopType: uiState.expeditionTroopType || 'unavailable',
        leader: uiState.expeditionLeader || 'unavailable',
        soldiers: Math.max(1, Number(uiState.expeditionSoldiers) || recommended),
        recommended,
      };
    }

    static buildWorldExpeditionConfigViewState(site = {}, territoryState = {}, uiState = {}) {
      const draft = this.buildWorldExpeditionDraftViewState(site, uiState);
      const availableSoldiers = this.toInteger(territoryState.availableSoldiers);
      return {
        siteId: site.id || '',
        draft,
        availableSoldiers,
        disabled: availableSoldiers < draft.soldiers,
        note: `建议 ${site.recommendedSoldiers || site.defense || 1} 人，当前可用 ${availableSoldiers} 人`,
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
            options: [{ value: 'unavailable', label: '暂未开放' }],
            note: '暂未开放',
          },
          soldiers: {
            label: '出征数量',
            value: draft.soldiers,
            min: 1,
            step: 1,
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
        const directDisabled = availableSoldiers < 1;
        return {
          kind: 'group',
          buttons: [
            this.makeWorldSiteActionButton('交涉', '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('掠夺', '', site.id, { disabled: true, secondary: true }),
            this.makeWorldSiteActionButton('占领', isOwnedTarget ? 'open-expedition' : 'conquer', site.id, {
              disabled: !isOwnedTarget && directDisabled,
            }),
          ],
          hint: isOwnedTarget ? '该地区已有势力，需要先配置出征队伍。' : '该地区无主，派 1 人即可建立据点。',
          expeditionConfig: isOwnedTarget && expanded
            ? this.buildWorldExpeditionConfigViewState(site, territoryState, uiState)
            : null,
        };
      }
      if (site.status === 'contested' && mission?.status === 'ready') {
        return {
          kind: 'single',
          buttons: [this.makeWorldSiteActionButton('完成占领', 'claim', site.id)],
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
          kind: 'row',
          buttons: [
            this.makeWorldSiteActionButton('管理', 'manage-city', site.id),
            this.makeWorldSiteActionButton('改名', 'rename-city', site.id, { secondary: true }),
          ],
          hint: '',
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
      return `${result} · 损失 ${site.lastBattle.casualties || 0} 士兵`;
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
          march: this.getWorldSiteMarchInfo(site, territoryState),
          note: this.getWorldSiteLastBattleNote(site),
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
  }

  global.UIStatePresenter = UIStatePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
