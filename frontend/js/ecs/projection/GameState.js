(function (global) {
  // Resolved at call time (not module load) to stay immune to script load order.
  function resolveLocaleText() {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  const TutorialFlowShared = (() => {
    if (global.TutorialFlowShared) return global.TutorialFlowShared;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../../shared/tutorialFlowConfig');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    const localeText = resolveLocaleText();
    return localeText ? localeText.t(key, params) : key;
  }
  function normalizeTutorialState(apiResponse) {
    const tutorial = apiResponse && apiResponse.tutorial;
    return {
      completed: Boolean(tutorial && tutorial.completed),
      currentStep:
        TutorialFlowShared.stepName(tutorial && tutorial.currentStep) ||
        TutorialFlowShared.TUTORIAL_STEPS.initial,
      phaseCompleted:
        tutorial && tutorial.phaseCompleted
          ? {
              newbie: Boolean(tutorial.phaseCompleted.newbie),
              era2: Boolean(tutorial.phaseCompleted.era2),
            }
          : { newbie: false, era2: false },
    };
  }

  function normalizeGameState(apiResponse) {
    const gameState = (apiResponse && apiResponse.gameState) || {};
    return {
      resources: gameState.resources || {},
      tutorial: normalizeTutorialState(apiResponse),
      buildings: gameState.buildings || {},
      buildingCosts: gameState.buildingCosts || {},
      buildingDefinitions: gameState.buildingDefinitions || {},
      buildingCategories: gameState.buildingCategories || {},
      buildingEffects: gameState.buildingEffects || {},
      military: gameState.military || {},
      territoryState: gameState.territoryState || {},
      worldExplorerState: gameState.worldExplorerState || {},
      cityState: gameState.cityState || {},
      activeCityId: gameState.activeCityId || 'capital',
      isCapitalCity: gameState.isCapitalCity !== false,
      unlockedBuildings: gameState.unlockedBuildings || [],
      currentEra: Number.isFinite(gameState.currentEra) ? gameState.currentEra : 0,
      currentEraName: gameState.currentEraName || t('era.primitiveName'),
      currentEraDescription: gameState.currentEraDescription || '',
      softGuide: (apiResponse && apiResponse.softGuide) || null,
      guideTasks: (apiResponse && apiResponse.guideTasks) ||
        gameState.guideTasks || { visible: false, tasks: [] },
      taskCenter: (apiResponse && apiResponse.taskCenter) || gameState.taskCenter || null,
      talentPolicies: gameState.talentPolicies || {},
      famousPersons: gameState.famousPersons || {},
      guidebook: gameState.guidebook || {},
      population: gameState.population || {},
      happiness: Number.isFinite(gameState.happiness) ? gameState.happiness : 100,
      techs: gameState.techs || {},
      techEffects: gameState.techEffects || {},
      gameDay: gameState.gameDay || 1,
      totalBuildings: gameState.totalBuildings || 0,
      eraHistory: gameState.eraHistory || [],
      eventQueue: gameState.eventQueue || [],
      eventHistory: gameState.eventHistory || [],
      regularEventState: gameState.regularEventState || null,
      threatEventState: gameState.threatEventState || null,
      activeBuffs: gameState.activeBuffs || [],
      eraProgress: (apiResponse && apiResponse.eraProgress) || {
        percentage: 0,
        canAdvance: false,
        conditions: [],
      },
    };
  }

  const api = { normalizeGameState, normalizeTutorialState };
  global.FrontendGameState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
