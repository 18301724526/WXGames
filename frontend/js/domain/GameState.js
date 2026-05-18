(function (global) {
  function normalizeTutorialState(apiResponse) {
    const tutorial = apiResponse && apiResponse.tutorial;
    return {
      completed: Boolean(tutorial && tutorial.completed),
      currentStep: Number.isFinite(tutorial && tutorial.currentStep) ? tutorial.currentStep : 0,
      phaseCompleted: tutorial && tutorial.phaseCompleted
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
      buildings: gameState.buildings || {},
      buildingCosts: gameState.buildingCosts || {},
      buildingDefinitions: gameState.buildingDefinitions || {},
      buildingEffects: gameState.buildingEffects || {},
      military: gameState.military || {},
      territoryState: gameState.territoryState || {},
      cityState: gameState.cityState || {},
      activeCityId: gameState.activeCityId || 'capital',
      isCapitalCity: gameState.isCapitalCity !== false,
      unlockedBuildings: gameState.unlockedBuildings || [],
      currentEra: Number.isFinite(gameState.currentEra) ? gameState.currentEra : 0,
      currentEraName: gameState.currentEraName || '原始时代',
      currentEraDescription: gameState.currentEraDescription || '',
      softGuide: (apiResponse && apiResponse.softGuide) || null,
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
      eraProgress: (apiResponse && apiResponse.eraProgress) || { percentage: 0, canAdvance: false, conditions: [] },
    };
  }

  const api = { normalizeGameState, normalizeTutorialState };
  global.FrontendGameState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
