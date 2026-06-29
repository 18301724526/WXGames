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
    const ShellPresenter = dependencies.ShellPresenter;
    defineStaticMethod(UIStatePresenter, 'toNumber', function toNumber(...args) {
      return ShellPresenter.toNumber(...args);
    });
    defineStaticMethod(UIStatePresenter, 'toInteger', function toInteger(...args) {
      return ShellPresenter.toInteger(...args);
    });
    defineStaticMethod(UIStatePresenter, 'trimDecimal', function trimDecimal(...args) {
      return ShellPresenter.trimDecimal(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatCompactNumber', function formatCompactNumber(...args) {
      return ShellPresenter.formatCompactNumber(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatResourceAmount', function formatResourceAmount(...args) {
      return ShellPresenter.formatResourceAmount(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatRate', function formatRate(...args) {
      return ShellPresenter.formatRate(...args);
    });
    defineStaticMethod(UIStatePresenter, 'toDisplayPopulation', function toDisplayPopulation(...args) {
      return ShellPresenter.toDisplayPopulation(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatNegativeRate', function formatNegativeRate(...args) {
      return ShellPresenter.formatNegativeRate(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildAuthCredentialViewState', function buildAuthCredentialViewState(...args) {
      return ShellPresenter.buildAuthCredentialViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildAuthShellViewState', function buildAuthShellViewState(...args) {
      return ShellPresenter.buildAuthShellViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildTutorialHighlightViewState', function buildTutorialHighlightViewState(...args) {
      return ShellPresenter.buildTutorialHighlightViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildTabNavigationViewState', function buildTabNavigationViewState(...args) {
      return ShellPresenter.buildTabNavigationViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'hasWorldTileMap', function hasWorldTileMap(...args) {
      return ShellPresenter.hasWorldTileMap(...args);
    });
    defineStaticMethod(UIStatePresenter, 'canUseMapHome', function canUseMapHome(...args) {
      return ShellPresenter.canUseMapHome(...args);
    });
    defineStaticMethod(UIStatePresenter, 'resolveMapHomeViewState', function resolveMapHomeViewState(...args) {
      return ShellPresenter.resolveMapHomeViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildTabLockViewState', function buildTabLockViewState(...args) {
      return ShellPresenter.buildTabLockViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildAdvisorViewState', function buildAdvisorViewState(...args) {
      return ShellPresenter.buildAdvisorViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getAdvisorTargetTab', function getAdvisorTargetTab(...args) {
      return ShellPresenter.getAdvisorTargetTab(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildNamingPromptViewState', function buildNamingPromptViewState(...args) {
      return ShellPresenter.buildNamingPromptViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildRecentLogViewState', function buildRecentLogViewState(...args) {
      return ShellPresenter.buildRecentLogViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildRequestLogViewState', function buildRequestLogViewState(...args) {
      return ShellPresenter.buildRequestLogViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildTerritorySummaryViewState', function buildTerritorySummaryViewState(...args) {
      return ShellPresenter.buildTerritorySummaryViewState(...args);
    });
    const HomePresenter = dependencies.HomePresenter;
    defineStaticMethod(UIStatePresenter, 'calculatePopulationGrowthMultiplier', function calculatePopulationGrowthMultiplier(...args) {
      return HomePresenter.calculatePopulationGrowthMultiplier(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatPopulationGrowthStatus', function formatPopulationGrowthStatus(...args) {
      return HomePresenter.formatPopulationGrowthStatus(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildResourceViewState', function buildResourceViewState(...args) {
      return HomePresenter.buildResourceViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getActiveCity', function getActiveCity(...args) {
      return HomePresenter.getActiveCity(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildCityPlanningViewState', function buildCityPlanningViewState(...args) {
      return HomePresenter.buildCityPlanningViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildPopulationViewState', function buildPopulationViewState(...args) {
      return HomePresenter.buildPopulationViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildCitySwitcherViewState', function buildCitySwitcherViewState(...args) {
      return HomePresenter.buildCitySwitcherViewState(...args);
    });
    const TaskGuidePresenter = dependencies.TaskGuidePresenter;
    defineStaticMethod(UIStatePresenter, 'buildTaskCenterViewState', function buildTaskCenterViewState(...args) {
      return TaskGuidePresenter.buildTaskCenterViewState(...args);
    });
    const FamousPersonPresenter = dependencies.FamousPersonPresenter;
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonSource', function formatFamousPersonSource(...args) {
      return FamousPersonPresenter.formatFamousPersonSource(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getFamousPersonEffectLabels', function getFamousPersonEffectLabels(...args) {
      return FamousPersonPresenter.getFamousPersonEffectLabels(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getFamousPersonAttributeLabel', function getFamousPersonAttributeLabel(...args) {
      return FamousPersonPresenter.getFamousPersonAttributeLabel(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonPercent', function formatFamousPersonPercent(...args) {
      return FamousPersonPresenter.formatFamousPersonPercent(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonSkillKind', function formatFamousPersonSkillKind(...args) {
      return FamousPersonPresenter.formatFamousPersonSkillKind(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonCastCondition', function formatFamousPersonCastCondition(...args) {
      return FamousPersonPresenter.formatFamousPersonCastCondition(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonCooldownText', function formatFamousPersonCooldownText(...args) {
      return FamousPersonPresenter.formatFamousPersonCooldownText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonCastRate', function formatFamousPersonCastRate(...args) {
      return FamousPersonPresenter.formatFamousPersonCastRate(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonEffectSentence', function formatFamousPersonEffectSentence(...args) {
      return FamousPersonPresenter.formatFamousPersonEffectSentence(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildFamousPersonSkillDescription', function buildFamousPersonSkillDescription(...args) {
      return FamousPersonPresenter.buildFamousPersonSkillDescription(...args);
    });
    defineStaticMethod(UIStatePresenter, 'sanitizeFamousPersonSkillDescription', function sanitizeFamousPersonSkillDescription(...args) {
      return FamousPersonPresenter.sanitizeFamousPersonSkillDescription(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonSkillDetail', function formatFamousPersonSkillDetail(...args) {
      return FamousPersonPresenter.formatFamousPersonSkillDetail(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousPersonSkill', function formatFamousPersonSkill(...args) {
      return FamousPersonPresenter.formatFamousPersonSkill(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getFamousPersonAbilities', function getFamousPersonAbilities(...args) {
      return FamousPersonPresenter.getFamousPersonAbilities(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getFamousPersonQualityInfo', function getFamousPersonQualityInfo(...args) {
      return FamousPersonPresenter.getFamousPersonQualityInfo(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getNextFamousAttributePointLevel', function getNextFamousAttributePointLevel(...args) {
      return FamousPersonPresenter.getNextFamousAttributePointLevel(...args);
    });
    defineStaticMethod(UIStatePresenter, 'sortFamousPeopleForRoster', function sortFamousPeopleForRoster(...args) {
      return FamousPersonPresenter.sortFamousPeopleForRoster(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatFamousAutoGrowthText', function formatFamousAutoGrowthText(...args) {
      return FamousPersonPresenter.formatFamousAutoGrowthText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildFamousPersonCard', function buildFamousPersonCard(...args) {
      return FamousPersonPresenter.buildFamousPersonCard(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildFamousPersonViewState', function buildFamousPersonViewState(...args) {
      return FamousPersonPresenter.buildFamousPersonViewState(...args);
    });
    const TalentPolicyPresenter = dependencies.TalentPolicyPresenter;
    defineStaticMethod(UIStatePresenter, 'getDefaultTalentPolicyDraft', function getDefaultTalentPolicyDraft(...args) {
      return TalentPolicyPresenter.getDefaultTalentPolicyDraft(...args);
    });
    defineStaticMethod(UIStatePresenter, 'makeTalentPolicyName', function makeTalentPolicyName(...args) {
      return TalentPolicyPresenter.makeTalentPolicyName(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getTalentPolicyAvailableRoles', function getTalentPolicyAvailableRoles(...args) {
      return TalentPolicyPresenter.getTalentPolicyAvailableRoles(...args);
    });
    defineStaticMethod(UIStatePresenter, 'applyTalentPolicyTierModifiers', function applyTalentPolicyTierModifiers(...args) {
      return TalentPolicyPresenter.applyTalentPolicyTierModifiers(...args);
    });
    defineStaticMethod(UIStatePresenter, 'allocateTalentByWeights', function allocateTalentByWeights(...args) {
      return TalentPolicyPresenter.allocateTalentByWeights(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildTalentPolicyDraftPreview', function buildTalentPolicyDraftPreview(...args) {
      return TalentPolicyPresenter.buildTalentPolicyDraftPreview(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildTalentPolicyViewState', function buildTalentPolicyViewState(...args) {
      return TalentPolicyPresenter.buildTalentPolicyViewState(...args);
    });
    const CivilizationPresenter = dependencies.CivilizationPresenter;
    defineStaticMethod(UIStatePresenter, 'canAdvanceEraByTutorial', function canAdvanceEraByTutorial(...args) {
      return CivilizationPresenter.canAdvanceEraByTutorial(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEraConditionViewState', function buildEraConditionViewState(...args) {
      return CivilizationPresenter.buildEraConditionViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildCivilizationViewState', function buildCivilizationViewState(...args) {
      return CivilizationPresenter.buildCivilizationViewState(...args);
    });
    const MilitaryPresenter = dependencies.MilitaryPresenter;
    defineStaticMethod(UIStatePresenter, 'buildMilitaryNavigationViewState', function buildMilitaryNavigationViewState(...args) {
      return MilitaryPresenter.buildMilitaryNavigationViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildMilitaryViewState', function buildMilitaryViewState(...args) {
      return MilitaryPresenter.buildMilitaryViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getScoutMissionRemainingSeconds', function getScoutMissionRemainingSeconds(...args) {
      return MilitaryPresenter.getScoutMissionRemainingSeconds(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatScoutCountdown', function formatScoutCountdown(...args) {
      return MilitaryPresenter.formatScoutCountdown(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildScoutControlViewState', function buildScoutControlViewState(...args) {
      return MilitaryPresenter.buildScoutControlViewState(...args);
    });
    const BuildingPresenter = dependencies.BuildingPresenter;
    defineStaticMethod(UIStatePresenter, 'getBuildingLevel', function getBuildingLevel(...args) {
      return BuildingPresenter.getBuildingLevel(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingActionLabel', function getBuildingActionLabel(...args) {
      return BuildingPresenter.getBuildingActionLabel(...args);
    });
    defineStaticMethod(UIStatePresenter, 'isBuildingOpenEnded', function isBuildingOpenEnded(...args) {
      return BuildingPresenter.isBuildingOpenEnded(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getExtraBuildingEffectEfficiency', function getExtraBuildingEffectEfficiency(...args) {
      return BuildingPresenter.getExtraBuildingEffectEfficiency(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getVisibleBuildingIds', function getVisibleBuildingIds(...args) {
      return BuildingPresenter.getVisibleBuildingIds(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingConfig', function getBuildingConfig(...args) {
      return BuildingPresenter.getBuildingConfig(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingCategoryDefinitions', function getBuildingCategoryDefinitions(...args) {
      return BuildingPresenter.getBuildingCategoryDefinitions(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingCategory', function getBuildingCategory(...args) {
      return BuildingPresenter.getBuildingCategory(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildBuildingCategoryTabs', function buildBuildingCategoryTabs(...args) {
      return BuildingPresenter.buildBuildingCategoryTabs(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildCostViewState', function buildCostViewState(...args) {
      return BuildingPresenter.buildCostViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingEffectSummary', function getBuildingEffectSummary(...args) {
      return BuildingPresenter.getBuildingEffectSummary(...args);
    });
    defineStaticMethod(UIStatePresenter, 'calculateBuildingEffectBonus', function calculateBuildingEffectBonus(...args) {
      return BuildingPresenter.calculateBuildingEffectBonus(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatBuildingEffectValue', function formatBuildingEffectValue(...args) {
      return BuildingPresenter.formatBuildingEffectValue(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatMilitaryEffectParts', function formatMilitaryEffectParts(...args) {
      return BuildingPresenter.formatMilitaryEffectParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatBuildingEffectText', function formatBuildingEffectText(...args) {
      return BuildingPresenter.formatBuildingEffectText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingEffectText', function getBuildingEffectText(...args) {
      return BuildingPresenter.getBuildingEffectText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getResourceDisplayName', function getResourceDisplayName(...args) {
      return BuildingPresenter.getResourceDisplayName(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getMaintenanceResourceKeys', function getMaintenanceResourceKeys(...args) {
      return BuildingPresenter.getMaintenanceResourceKeys(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatHabitabilityPressure', function formatHabitabilityPressure(...args) {
      return BuildingPresenter.formatHabitabilityPressure(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatHabitabilityPressureShort', function formatHabitabilityPressureShort(...args) {
      return BuildingPresenter.formatHabitabilityPressureShort(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatBuildingScale', function formatBuildingScale(...args) {
      return BuildingPresenter.formatBuildingScale(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatMaintenanceRate', function formatMaintenanceRate(...args) {
      return BuildingPresenter.formatMaintenanceRate(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatBuildingMaintenanceText', function formatBuildingMaintenanceText(...args) {
      return BuildingPresenter.formatBuildingMaintenanceText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatBuildingCityImpactText', function formatBuildingCityImpactText(...args) {
      return BuildingPresenter.formatBuildingCityImpactText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBuildingMilitaryLines', function getBuildingMilitaryLines(...args) {
      return BuildingPresenter.getBuildingMilitaryLines(...args);
    });
    defineStaticMethod(UIStatePresenter, 'canAffordCost', function canAffordCost(...args) {
      return BuildingPresenter.canAffordCost(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildBuildingCardViewState', function buildBuildingCardViewState(...args) {
      return BuildingPresenter.buildBuildingCardViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildBuildingViewState', function buildBuildingViewState(...args) {
      return BuildingPresenter.buildBuildingViewState(...args);
    });
    const EventPresenter = dependencies.EventPresenter;
    defineStaticMethod(UIStatePresenter, 'getEventResourceLabel', function getEventResourceLabel(...args) {
      return EventPresenter.getEventResourceLabel(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventResourcePart', function formatEventResourcePart(...args) {
      return EventPresenter.formatEventResourcePart(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventResourcePart', function buildEventResourcePart(...args) {
      return EventPresenter.buildEventResourcePart(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventDuration', function formatEventDuration(...args) {
      return EventPresenter.formatEventDuration(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventBuffEffect', function formatEventBuffEffect(...args) {
      return EventPresenter.formatEventBuffEffect(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventEffect', function formatEventEffect(...args) {
      return EventPresenter.formatEventEffect(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventEffectPart', function buildEventEffectPart(...args) {
      return EventPresenter.buildEventEffectPart(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventEffects', function formatEventEffects(...args) {
      return EventPresenter.formatEventEffects(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventEffectParts', function buildEventEffectParts(...args) {
      return EventPresenter.buildEventEffectParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventRequirements', function formatEventRequirements(...args) {
      return EventPresenter.formatEventRequirements(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventRequirementParts', function buildEventRequirementParts(...args) {
      return EventPresenter.buildEventRequirementParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatEventReward', function formatEventReward(...args) {
      return EventPresenter.formatEventReward(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventRewardParts', function buildEventRewardParts(...args) {
      return EventPresenter.buildEventRewardParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionRewardText', function getEventOptionRewardText(...args) {
      return EventPresenter.getEventOptionRewardText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionRewardParts', function getEventOptionRewardParts(...args) {
      return EventPresenter.getEventOptionRewardParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionCostText', function getEventOptionCostText(...args) {
      return EventPresenter.getEventOptionCostText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionCostParts', function getEventOptionCostParts(...args) {
      return EventPresenter.getEventOptionCostParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionPenaltyText', function getEventOptionPenaltyText(...args) {
      return EventPresenter.getEventOptionPenaltyText(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionPenaltyParts', function getEventOptionPenaltyParts(...args) {
      return EventPresenter.getEventOptionPenaltyParts(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventOptionRows', function buildEventOptionRows(...args) {
      return EventPresenter.buildEventOptionRows(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventOptionPreview', function getEventOptionPreview(...args) {
      return EventPresenter.getEventOptionPreview(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getRemainingSeconds', function getRemainingSeconds(...args) {
      return EventPresenter.getRemainingSeconds(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatRemainingTime', function formatRemainingTime(...args) {
      return EventPresenter.formatRemainingTime(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getEventHint', function getEventHint(...args) {
      return EventPresenter.getEventHint(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventCardViewState', function buildEventCardViewState(...args) {
      return EventPresenter.buildEventCardViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventHistoryItemViewState', function buildEventHistoryItemViewState(...args) {
      return EventPresenter.buildEventHistoryItemViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventViewState', function buildEventViewState(...args) {
      return EventPresenter.buildEventViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildEventModalViewState', function buildEventModalViewState(...args) {
      return EventPresenter.buildEventModalViewState(...args);
    });
    const WorldSitePresenter = dependencies.WorldSitePresenter;
    defineStaticMethod(UIStatePresenter, 'formatWorldSiteEffect', function formatWorldSiteEffect(...args) {
      return WorldSitePresenter.formatWorldSiteEffect(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatWorldSiteStatus', function formatWorldSiteStatus(...args) {
      return WorldSitePresenter.formatWorldSiteStatus(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatWorldSiteOwner', function formatWorldSiteOwner(...args) {
      return WorldSitePresenter.formatWorldSiteOwner(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatWorldDuration', function formatWorldDuration(...args) {
      return WorldSitePresenter.formatWorldDuration(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldSiteMarchInfo', function getWorldSiteMarchInfo(...args) {
      return WorldSitePresenter.getWorldSiteMarchInfo(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildWorldExpeditionDraftViewState', function buildWorldExpeditionDraftViewState(...args) {
      return WorldSitePresenter.buildWorldExpeditionDraftViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildWorldExpeditionConfigViewState', function buildWorldExpeditionConfigViewState(...args) {
      return WorldSitePresenter.buildWorldExpeditionConfigViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'makeWorldSiteActionButton', function makeWorldSiteActionButton(...args) {
      return WorldSitePresenter.makeWorldSiteActionButton(...args);
    });
    defineStaticMethod(UIStatePresenter, 'isGuidedFirstCitySettlement', function isGuidedFirstCitySettlement(...args) {
      return WorldSitePresenter.isGuidedFirstCitySettlement(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildWorldSiteActionViewState', function buildWorldSiteActionViewState(...args) {
      return WorldSitePresenter.buildWorldSiteActionViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldSiteLastBattleNote', function getWorldSiteLastBattleNote(...args) {
      return WorldSitePresenter.getWorldSiteLastBattleNote(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldSiteBattleReportLines', function getWorldSiteBattleReportLines(...args) {
      return WorldSitePresenter.getWorldSiteBattleReportLines(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldSiteDefenderLeaderLine', function getWorldSiteDefenderLeaderLine(...args) {
      return WorldSitePresenter.getWorldSiteDefenderLeaderLine(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldSiteDefenderSkillLine', function getWorldSiteDefenderSkillLine(...args) {
      return WorldSitePresenter.getWorldSiteDefenderSkillLine(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildWorldSiteDetailViewState', function buildWorldSiteDetailViewState(...args) {
      return WorldSitePresenter.buildWorldSiteDetailViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildWorldSiteDialogViewState', function buildWorldSiteDialogViewState(...args) {
      return WorldSitePresenter.buildWorldSiteDialogViewState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldSiteDialogContentSignature', function getWorldSiteDialogContentSignature(...args) {
      return WorldSitePresenter.getWorldSiteDialogContentSignature(...args);
    });
    const BattleScenePresenter = dependencies.BattleScenePresenter;
    defineStaticMethod(UIStatePresenter, 'makeVisualGroups', function makeVisualGroups(...args) {
      return BattleScenePresenter.makeVisualGroups(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBattleTurnSoldiers', function getBattleTurnSoldiers(...args) {
      return BattleScenePresenter.getBattleTurnSoldiers(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBattleStatusLabel', function getBattleStatusLabel(...args) {
      return BattleScenePresenter.getBattleStatusLabel(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBattleStatusTone', function getBattleStatusTone(...args) {
      return BattleScenePresenter.getBattleStatusTone(...args);
    });
    defineStaticMethod(UIStatePresenter, 'formatBattleStatusBadge', function formatBattleStatusBadge(...args) {
      return BattleScenePresenter.formatBattleStatusBadge(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildBattleStatusBadges', function buildBattleStatusBadges(...args) {
      return BattleScenePresenter.buildBattleStatusBadges(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildBattleSkillState', function buildBattleSkillState(...args) {
      return BattleScenePresenter.buildBattleSkillState(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getBattleTurnLines', function getBattleTurnLines(...args) {
      return BattleScenePresenter.getBattleTurnLines(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildBattleSceneViewState', function buildBattleSceneViewState(...args) {
      return BattleScenePresenter.buildBattleSceneViewState(...args);
    });
    const WorldTileMapPresenter = dependencies.WorldTileMapPresenter;
    defineStaticMethod(UIStatePresenter, 'getTileMapManifest', function getTileMapManifest(...args) {
      return WorldTileMapPresenter.getTileMapManifest(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getTileMapGeometry', function getTileMapGeometry(...args) {
      return WorldTileMapPresenter.getTileMapGeometry(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldTileMapSignature', function getWorldTileMapSignature(...args) {
      return WorldTileMapPresenter.getWorldTileMapSignature(...args);
    });
    defineStaticMethod(UIStatePresenter, 'normalizeWorldTile', function normalizeWorldTile(...args) {
      return WorldTileMapPresenter.normalizeWorldTile(...args);
    });
    defineStaticMethod(UIStatePresenter, 'normalizeWorldExplorerMission', function normalizeWorldExplorerMission(...args) {
      return WorldTileMapPresenter.normalizeWorldExplorerMission(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldExplorerMissions', function getWorldExplorerMissions(...args) {
      return WorldTileMapPresenter.getWorldExplorerMissions(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldExplorerPlannedTiles', function getWorldExplorerPlannedTiles(...args) {
      return WorldTileMapPresenter.getWorldExplorerPlannedTiles(...args);
    });
    defineStaticMethod(UIStatePresenter, 'getWorldExplorerPlannedSites', function getWorldExplorerPlannedSites(...args) {
      return WorldTileMapPresenter.getWorldExplorerPlannedSites(...args);
    });
    defineStaticMethod(UIStatePresenter, 'buildWorldTileMapViewState', function buildWorldTileMapViewState(...args) {
      return WorldTileMapPresenter.buildWorldTileMapViewState(...args);
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
