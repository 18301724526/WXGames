(function (global) {

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }
  class GameStateManager {
    constructor(initialState, options = {}) {
      this.state = initialState || {};
      this.buildingState = options.buildingState || { getLevel: () => 0 };
    }

    // Stateless normalizer: builds the canonical state from the CURRENT state
    // passed in (the single source of truth) + the server payload, instead of
    // reading an internally-mirrored `this.state` buffer. `this.state` is kept
    // only as a cache of the last result; it is never an independent mirror.
    sync(currentState, serverState, eraProgress) {
      const base = currentState || {};
      const state = {
        ...base,
        ...serverState,
        currentEra: serverState.currentEra,
        currentEraName: serverState.currentEraName,
        eraProgress: eraProgress || serverState.eraProgress || { percentage: 0, canAdvance: false, conditions: [] },
        currentTab: base.currentTab,
      };
      state.era = state.currentEra;
      state.food = state.resources.food || 0;
      state.knowledge = state.resources.knowledge || 0;
      state.wood = state.resources.wood || 0;
      state.iron = state.resources.iron ?? state.resources.metal ?? 0;
      state.stone = state.resources.stone || 0;
      state.softGuide = serverState.softGuide || null;
      state.guideTasks = serverState.guideTasks || { visible: false, tasks: [] };
      state.taskCenter = serverState.taskCenter || null;
      state.talentPolicies = serverState.talentPolicies || state.talentPolicies || {};
      state.famousPersons = serverState.famousPersons || state.famousPersons || {};
      state.guidebook = serverState.guidebook || state.guidebook || {};
      state.workshopCount = this.buildingState.getLevel(state.buildings, 'workshop');
      state.lumbermillCount = this.buildingState.getLevel(state.buildings, 'lumbermill');
      state.military = {
        soldiers: 0,
        soldierCap: 0,
        trainingProgress: 0,
        trainingIntervalSeconds: 0,
        trainingBatchSize: 0,
        defensePerSoldier: 0.01,
        defense: 0,
        ...(state.military || {}),
      };
      state.territoryState = {
        polity: { name: null, capitalCityName: t('city.capitalName'), namePrompted: false },
        territories: [],
        warMissions: [],
        scoutMissions: [],
        scoutReports: [],
        directions: [],
        availableSoldiers: state.military.availableSoldiers || 0,
        soldiersOnMission: state.military.soldiersOnMission || 0,
        occupiedCount: 0,
        discoveredCount: 0,
        namingPrompt: null,
        ...(state.territoryState || {}),
      };
      state.worldExplorerState = {
        missions: [],
        activeMission: null,
        maxActiveMissions: 1,
        ...(state.worldExplorerState || {}),
      };
      state.cityState = {
        activeCityId: state.activeCityId || 'capital',
        capitalCityId: 'capital',
        cities: [],
        ...(state.cityState || {}),
      };
      state.activeCityId = state.cityState.activeCityId || state.activeCityId || 'capital';
      state.isCapitalCity = state.activeCityId === (state.cityState.capitalCityId || 'capital');
      state.population = {
        ...state.population,
        maxPop: state.population.max || state.population.maxPop || 3,
      };
      this.state = state;
      return state;
    }

    getState() {
      return this.state;
    }
  }

  global.GameStateManager = GameStateManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameStateManager;
})(typeof window !== 'undefined' ? window : globalThis);
