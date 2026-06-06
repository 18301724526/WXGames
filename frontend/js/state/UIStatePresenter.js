(function (global) {
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

  const WorldTileMapPresenter = (() => {
    if (global.WorldTileMapPresenter) return global.WorldTileMapPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/WorldTileMapPresenter');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const ShellPresenter = (() => {
    if (global.ShellPresenter) return global.ShellPresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./presenters/ShellPresenter');
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
      return ShellPresenter.toNumber(value, fallback);
    }

    static toInteger(value, fallback = 0) {
      return ShellPresenter.toInteger(value, fallback);
    }

    static trimDecimal(value) {
      return ShellPresenter.trimDecimal(value);
    }

    static formatCompactNumber(...args) {
      return ShellPresenter.formatCompactNumber(...args);
    }

    static formatResourceAmount(...args) {
      return ShellPresenter.formatResourceAmount(...args);
    }

    static formatRate(...args) {
      return ShellPresenter.formatRate(...args);
    }

    static calculatePopulationGrowthMultiplier(...args) {
      return HomePresenter.calculatePopulationGrowthMultiplier(...args);
    }

    static formatPopulationGrowthStatus(...args) {
      return HomePresenter.formatPopulationGrowthStatus(...args);
    }

    static toDisplayPopulation(...args) {
      return ShellPresenter.toDisplayPopulation(...args);
    }

    static formatNegativeRate(...args) {
      return ShellPresenter.formatNegativeRate(...args);
    }

    static buildAuthCredentialViewState(...args) {
      return ShellPresenter.buildAuthCredentialViewState(...args);
    }

    static buildAuthShellViewState(...args) {
      return ShellPresenter.buildAuthShellViewState(...args);
    }

    static buildTutorialHighlightViewState(...args) {
      return ShellPresenter.buildTutorialHighlightViewState(...args);
    }

    static buildTabNavigationViewState(...args) {
      return ShellPresenter.buildTabNavigationViewState(...args);
    }

    static hasWorldTileMap(...args) {
      return ShellPresenter.hasWorldTileMap(...args);
    }

    static canUseMapHome(...args) {
      return ShellPresenter.canUseMapHome(...args);
    }

    static resolveMapHomeViewState(...args) {
      return ShellPresenter.resolveMapHomeViewState(...args);
    }

    static buildTabLockViewState(...args) {
      return ShellPresenter.buildTabLockViewState(...args);
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

    static buildAdvisorViewState(...args) {
      return ShellPresenter.buildAdvisorViewState(...args);
    }

    static getAdvisorTargetTab(...args) {
      return ShellPresenter.getAdvisorTargetTab(...args);
    }

    static buildNamingPromptViewState(...args) {
      return ShellPresenter.buildNamingPromptViewState(...args);
    }

    static buildRecentLogViewState(...args) {
      return ShellPresenter.buildRecentLogViewState(...args);
    }

    static buildRequestLogViewState(...args) {
      return ShellPresenter.buildRequestLogViewState(...args);
    }

    static buildTerritorySummaryViewState(...args) {
      return ShellPresenter.buildTerritorySummaryViewState(...args);
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

    static getTileMapManifest(...args) {
      return WorldTileMapPresenter.getTileMapManifest(...args);
    }

    static getTileMapGeometry(...args) {
      return WorldTileMapPresenter.getTileMapGeometry(...args);
    }

    static getWorldTileMapSignature(...args) {
      return WorldTileMapPresenter.getWorldTileMapSignature(...args);
    }

    static normalizeWorldTile(...args) {
      return WorldTileMapPresenter.normalizeWorldTile(...args);
    }

    static normalizeWorldExplorerMission(...args) {
      return WorldTileMapPresenter.normalizeWorldExplorerMission(...args);
    }

    static getWorldExplorerMissions(...args) {
      return WorldTileMapPresenter.getWorldExplorerMissions(...args);
    }

    static getWorldExplorerPlannedTiles(...args) {
      return WorldTileMapPresenter.getWorldExplorerPlannedTiles(...args);
    }

    static getWorldExplorerPlannedSites(...args) {
      return WorldTileMapPresenter.getWorldExplorerPlannedSites(...args);
    }

    static buildWorldTileMapViewState(...args) {
      return WorldTileMapPresenter.buildWorldTileMapViewState(...args);
    }
  }

  global.UIStatePresenter = UIStatePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIStatePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
