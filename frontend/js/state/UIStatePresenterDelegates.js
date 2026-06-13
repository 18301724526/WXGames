(function (global) {
  const DEPENDENCY_DEFINITIONS = Object.freeze({
    TechPresenter: './presenters/TechPresenter',
    FamousPersonPresenter: './presenters/FamousPersonPresenter',
    TalentPolicyPresenter: './presenters/TalentPolicyPresenter',
    BuildingPresenter: './presenters/BuildingPresenter',
    HomePresenter: './presenters/HomePresenter',
    EventPresenter: './presenters/EventPresenter',
    TaskGuidePresenter: './presenters/TaskGuidePresenter',
    CivilizationPresenter: './presenters/CivilizationPresenter',
    MilitaryPresenter: './presenters/MilitaryPresenter',
    WorldRadarPresenter: './presenters/WorldRadarPresenter',
    WorldSitePresenter: './presenters/WorldSitePresenter',
    BattleScenePresenter: './presenters/BattleScenePresenter',
    WorldTileMapPresenter: './presenters/WorldTileMapPresenter',
    ShellPresenter: './presenters/ShellPresenter',
  });

  const DELEGATE_METHODS = Object.freeze({
    ShellPresenter: Object.freeze([
      'toNumber',
      'toInteger',
      'trimDecimal',
      'formatCompactNumber',
      'formatResourceAmount',
      'formatRate',
      'toDisplayPopulation',
      'formatNegativeRate',
      'buildAuthCredentialViewState',
      'buildAuthShellViewState',
      'buildTutorialHighlightViewState',
      'buildTabNavigationViewState',
      'hasWorldTileMap',
      'canUseMapHome',
      'resolveMapHomeViewState',
      'buildTabLockViewState',
      'buildAdvisorViewState',
      'getAdvisorTargetTab',
      'buildNamingPromptViewState',
      'buildRecentLogViewState',
      'buildRequestLogViewState',
      'buildTerritorySummaryViewState',
    ]),
    HomePresenter: Object.freeze([
      'calculatePopulationGrowthMultiplier',
      'formatPopulationGrowthStatus',
      'buildResourceViewState',
      'getActiveCity',
      'buildCityPlanningViewState',
      'buildPopulationViewState',
      'buildCitySwitcherViewState',
    ]),
    TaskGuidePresenter: Object.freeze([
      'buildTaskCenterViewState',
    ]),
    FamousPersonPresenter: Object.freeze([
      'formatFamousPersonSource',
      'getFamousPersonEffectLabels',
      'getFamousPersonAttributeLabel',
      'formatFamousPersonPercent',
      'formatFamousPersonSkillKind',
      'formatFamousPersonCastCondition',
      'formatFamousPersonCooldownText',
      'formatFamousPersonCastRate',
      'formatFamousPersonEffectSentence',
      'buildFamousPersonSkillDescription',
      'sanitizeFamousPersonSkillDescription',
      'formatFamousPersonSkillDetail',
      'formatFamousPersonSkill',
      'getFamousPersonAbilities',
      'getFamousPersonQualityInfo',
      'getNextFamousAttributePointLevel',
      'sortFamousPeopleForRoster',
      'formatFamousAutoGrowthText',
      'buildFamousPersonCard',
      'buildFamousPersonViewState',
    ]),
    TalentPolicyPresenter: Object.freeze([
      'getDefaultTalentPolicyDraft',
      'makeTalentPolicyName',
      'getTalentPolicyAvailableRoles',
      'applyTalentPolicyTierModifiers',
      'allocateTalentByWeights',
      'buildTalentPolicyDraftPreview',
      'buildTalentPolicyViewState',
    ]),
    CivilizationPresenter: Object.freeze([
      'canAdvanceEraByTutorial',
      'buildEraConditionViewState',
      'buildCivilizationViewState',
    ]),
    MilitaryPresenter: Object.freeze([
      'buildMilitaryNavigationViewState',
      'buildMilitaryViewState',
      'getScoutMissionRemainingSeconds',
      'formatScoutCountdown',
      'buildScoutControlViewState',
    ]),
    BuildingPresenter: Object.freeze([
      'getBuildingLevel',
      'getBuildingActionLabel',
      'isBuildingOpenEnded',
      'getExtraBuildingEffectEfficiency',
      'getVisibleBuildingIds',
      'getBuildingConfig',
      'getBuildingCategoryDefinitions',
      'getBuildingCategory',
      'buildBuildingCategoryTabs',
      'buildCostViewState',
      'getBuildingEffectSummary',
      'calculateBuildingEffectBonus',
      'formatBuildingEffectValue',
      'formatMilitaryEffectParts',
      'formatBuildingEffectText',
      'getBuildingEffectText',
      'getResourceDisplayName',
      'getMaintenanceResourceKeys',
      'formatHabitabilityPressure',
      'formatHabitabilityPressureShort',
      'formatBuildingScale',
      'formatMaintenanceRate',
      'formatBuildingMaintenanceText',
      'formatBuildingCityImpactText',
      'getBuildingMilitaryLines',
      'canAffordCost',
      'buildBuildingCardViewState',
      'buildBuildingViewState',
    ]),
    EventPresenter: Object.freeze([
      'getEventResourceLabel',
      'formatEventResourcePart',
      'buildEventResourcePart',
      'formatEventDuration',
      'formatEventBuffEffect',
      'formatEventEffect',
      'buildEventEffectPart',
      'formatEventEffects',
      'buildEventEffectParts',
      'formatEventRequirements',
      'buildEventRequirementParts',
      'formatEventReward',
      'buildEventRewardParts',
      'getEventOptionRewardText',
      'getEventOptionRewardParts',
      'getEventOptionCostText',
      'getEventOptionCostParts',
      'getEventOptionPenaltyText',
      'getEventOptionPenaltyParts',
      'buildEventOptionRows',
      'getEventOptionPreview',
      'getRemainingSeconds',
      'formatRemainingTime',
      'getEventHint',
      'buildEventCardViewState',
      'buildEventHistoryItemViewState',
      'buildEventViewState',
      'buildEventModalViewState',
    ]),
    WorldRadarPresenter: Object.freeze([
      'getWorldRadarPosition',
      'relativeVisualOffset',
      'seededNoise',
      'roundOffset',
      'measureWorldRadarSpacing',
      'resolveWorldRadarPosition',
      'buildWorldRadarLayout',
      'getWorldMapSignature',
      'buildWorldRadarViewState',
    ]),
    WorldSitePresenter: Object.freeze([
      'formatWorldSiteEffect',
      'formatWorldSiteStatus',
      'formatWorldSiteOwner',
      'formatWorldDuration',
      'getWorldSiteMarchInfo',
      'buildWorldExpeditionDraftViewState',
      'buildWorldExpeditionConfigViewState',
      'makeWorldSiteActionButton',
      'isGuidedFirstCitySettlement',
      'buildWorldSiteActionViewState',
      'getWorldSiteLastBattleNote',
      'getWorldSiteBattleReportLines',
      'getWorldSiteDefenderLeaderLine',
      'getWorldSiteDefenderSkillLine',
      'buildWorldSiteDetailViewState',
      'buildWorldSiteDialogViewState',
      'getWorldSiteDialogContentSignature',
    ]),
    BattleScenePresenter: Object.freeze([
      'makeVisualGroups',
      'getBattleTurnSoldiers',
      'getBattleStatusLabel',
      'getBattleStatusTone',
      'formatBattleStatusBadge',
      'buildBattleStatusBadges',
      'buildBattleSkillState',
      'getBattleTurnLines',
      'buildBattleSceneViewState',
    ]),
    WorldTileMapPresenter: Object.freeze([
      'getTileMapManifest',
      'getTileMapGeometry',
      'getWorldTileMapSignature',
      'normalizeWorldTile',
      'normalizeWorldExplorerMission',
      'getWorldExplorerMissions',
      'getWorldExplorerPlannedTiles',
      'getWorldExplorerPlannedSites',
      'buildWorldTileMapViewState',
    ]),
  });

  function loadDependency(name, modulePath) {
    if (global[name]) return global[name];
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require(modulePath);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function createDependencies(overrides = {}) {
    const dependencies = {};
    Object.entries(DEPENDENCY_DEFINITIONS).forEach(([name, modulePath]) => {
      dependencies[name] = overrides[name] || loadDependency(name, modulePath);
    });
    return dependencies;
  }

  function defineStaticMethod(target, methodName, method) {
    Object.defineProperty(target, methodName, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: method,
    });
  }

  function installDirectDelegates(UIStatePresenter, dependencies) {
    Object.entries(DELEGATE_METHODS).forEach(([dependencyName, methodNames]) => {
      const dependency = dependencies[dependencyName];
      methodNames.forEach((methodName) => {
        defineStaticMethod(UIStatePresenter, methodName, function delegatePresenterMethod(...args) {
          return dependency[methodName](...args);
        });
      });
    });
  }

  function installCustomDelegates(UIStatePresenter, dependencies) {
    const { TaskGuidePresenter, TechPresenter } = dependencies;
    defineStaticMethod(UIStatePresenter, 'buildGuidebookViewState', function buildGuidebookViewState(state = {}, options = {}) {
      return TaskGuidePresenter.buildGuidebookViewState(state, {
        ...options,
        buildCityPlanningViewState: (sourceState) => UIStatePresenter.buildCityPlanningViewState(sourceState),
      });
    });
    defineStaticMethod(UIStatePresenter, 'buildTechViewState', function buildTechViewState(state = {}) {
      if (TechPresenter && typeof TechPresenter.buildTechViewState === 'function') {
        return TechPresenter.buildTechViewState(state);
      }
      return { points: 0, researchedCount: 0, availableCount: 0, eras: [], nodes: [], links: [], treeEras: [], selectedTech: null };
    });
  }

  function install(UIStatePresenter, overrides = {}) {
    if (!UIStatePresenter) return null;
    const dependencies = createDependencies(overrides);
    installDirectDelegates(UIStatePresenter, dependencies);
    installCustomDelegates(UIStatePresenter, dependencies);
    return UIStatePresenter;
  }

  const UIStatePresenterDelegates = Object.freeze({
    DEPENDENCY_DEFINITIONS,
    DELEGATE_METHODS,
    createDependencies,
    install,
  });

  global.UIStatePresenterDelegates = UIStatePresenterDelegates;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenterDelegates;
})(typeof window !== 'undefined' ? window : globalThis);
