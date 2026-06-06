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

  const TaskGuidePresenter = (() => {
    if (global.TaskGuidePresenter) return global.TaskGuidePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/TaskGuidePresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const CivilizationPresenter = (() => {
    if (global.CivilizationPresenter) return global.CivilizationPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/CivilizationPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const MilitaryPresenter = (() => {
    if (global.MilitaryPresenter) return global.MilitaryPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/MilitaryPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const WorldRadarPresenter = (() => {
    if (global.WorldRadarPresenter) return global.WorldRadarPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/WorldRadarPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const WorldSitePresenter = (() => {
    if (global.WorldSitePresenter) return global.WorldSitePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/WorldSitePresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const BattleScenePresenter = (() => {
    if (global.BattleScenePresenter) return global.BattleScenePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/BattleScenePresenter');
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
      const text = `${value}`;
      return text.endsWith('.0') ? text.slice(0, -2) : text;
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

    static buildTaskCenterViewState(...args) {
      return TaskGuidePresenter.buildTaskCenterViewState(...args);
    }

    static buildGuidebookViewState(state = {}, options = {}) {
      return TaskGuidePresenter.buildGuidebookViewState(state, {
        ...options,
        buildCityPlanningViewState: (sourceState) => this.buildCityPlanningViewState(sourceState),
      });
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

    static canAdvanceEraByTutorial(...args) {
      return CivilizationPresenter.canAdvanceEraByTutorial(...args);
    }

    static buildEraConditionViewState(...args) {
      return CivilizationPresenter.buildEraConditionViewState(...args);
    }

    static buildCivilizationViewState(...args) {
      return CivilizationPresenter.buildCivilizationViewState(...args);
    }
    static buildMilitaryNavigationViewState(...args) {
      return MilitaryPresenter.buildMilitaryNavigationViewState(...args);
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

    static buildMilitaryViewState(...args) {
      return MilitaryPresenter.buildMilitaryViewState(...args);
    }

    static getScoutMissionRemainingSeconds(...args) {
      return MilitaryPresenter.getScoutMissionRemainingSeconds(...args);
    }

    static formatScoutCountdown(...args) {
      return MilitaryPresenter.formatScoutCountdown(...args);
    }

    static buildScoutControlViewState(...args) {
      return MilitaryPresenter.buildScoutControlViewState(...args);
    }

    static getWorldRadarPosition(...args) {
      return WorldRadarPresenter.getWorldRadarPosition(...args);
    }

    static relativeVisualOffset(...args) {
      return WorldRadarPresenter.relativeVisualOffset(...args);
    }

    static seededNoise(...args) {
      return WorldRadarPresenter.seededNoise(...args);
    }

    static roundOffset(...args) {
      return WorldRadarPresenter.roundOffset(...args);
    }

    static measureWorldRadarSpacing(...args) {
      return WorldRadarPresenter.measureWorldRadarSpacing(...args);
    }

    static resolveWorldRadarPosition(...args) {
      return WorldRadarPresenter.resolveWorldRadarPosition(...args);
    }

    static buildWorldRadarLayout(...args) {
      return WorldRadarPresenter.buildWorldRadarLayout(...args);
    }

    static getWorldMapSignature(...args) {
      return WorldRadarPresenter.getWorldMapSignature(...args);
    }

    static formatWorldSiteEffect(...args) {
      return WorldSitePresenter.formatWorldSiteEffect(...args);
    }

    static formatWorldSiteStatus(...args) {
      return WorldSitePresenter.formatWorldSiteStatus(...args);
    }

    static formatWorldSiteOwner(...args) {
      return WorldSitePresenter.formatWorldSiteOwner(...args);
    }

    static formatWorldDuration(...args) {
      return WorldSitePresenter.formatWorldDuration(...args);
    }

    static getWorldSiteMarchInfo(...args) {
      return WorldSitePresenter.getWorldSiteMarchInfo(...args);
    }

    static buildWorldExpeditionDraftViewState(...args) {
      return WorldSitePresenter.buildWorldExpeditionDraftViewState(...args);
    }

    static buildWorldExpeditionConfigViewState(...args) {
      return WorldSitePresenter.buildWorldExpeditionConfigViewState(...args);
    }

    static makeWorldSiteActionButton(...args) {
      return WorldSitePresenter.makeWorldSiteActionButton(...args);
    }

    static buildWorldSiteActionViewState(...args) {
      return WorldSitePresenter.buildWorldSiteActionViewState(...args);
    }

    static getWorldSiteLastBattleNote(...args) {
      return WorldSitePresenter.getWorldSiteLastBattleNote(...args);
    }

    static getWorldSiteBattleReportLines(...args) {
      return WorldSitePresenter.getWorldSiteBattleReportLines(...args);
    }

    static getWorldSiteDefenderLeaderLine(...args) {
      return WorldSitePresenter.getWorldSiteDefenderLeaderLine(...args);
    }

    static getWorldSiteDefenderSkillLine(...args) {
      return WorldSitePresenter.getWorldSiteDefenderSkillLine(...args);
    }

    static makeVisualGroups(...args) {
      return BattleScenePresenter.makeVisualGroups(...args);
    }

    static getBattleTurnSoldiers(...args) {
      return BattleScenePresenter.getBattleTurnSoldiers(...args);
    }

    static getBattleStatusLabel(...args) {
      return BattleScenePresenter.getBattleStatusLabel(...args);
    }

    static getBattleStatusTone(...args) {
      return BattleScenePresenter.getBattleStatusTone(...args);
    }

    static formatBattleStatusBadge(...args) {
      return BattleScenePresenter.formatBattleStatusBadge(...args);
    }

    static buildBattleStatusBadges(...args) {
      return BattleScenePresenter.buildBattleStatusBadges(...args);
    }

    static buildBattleSkillState(...args) {
      return BattleScenePresenter.buildBattleSkillState(...args);
    }

    static getBattleTurnLines(...args) {
      return BattleScenePresenter.getBattleTurnLines(...args);
    }

    static buildBattleSceneViewState(...args) {
      return BattleScenePresenter.buildBattleSceneViewState(...args);
    }

    static buildWorldSiteDetailViewState(...args) {
      return WorldSitePresenter.buildWorldSiteDetailViewState(...args);
    }

    static buildWorldSiteDialogViewState(...args) {
      return WorldSitePresenter.buildWorldSiteDialogViewState(...args);
    }

    static getWorldSiteDialogContentSignature(...args) {
      return WorldSitePresenter.getWorldSiteDialogContentSignature(...args);
    }

    static buildWorldRadarViewState(...args) {
      return WorldRadarPresenter.buildWorldRadarViewState(...args);
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
