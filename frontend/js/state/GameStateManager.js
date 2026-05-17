(function (global) {
  class GameStateManager {
    constructor(initialState) {
      this.state = initialState || {};
    }

    sync(serverState, eraProgress) {
      this.state = {
        ...this.state,
        ...serverState,
        currentEra: serverState.currentEra,
        currentEraName: serverState.currentEraName,
        eraProgress: eraProgress || serverState.eraProgress || { percentage: 0, canAdvance: false, conditions: [] },
        currentTab: this.state.currentTab,
      };
      this.state.era = this.state.currentEra;
      this.state.food = this.state.resources.food || 0;
      this.state.knowledge = this.state.resources.knowledge || 0;
      this.state.wood = this.state.resources.wood || 0;
      this.state.softGuide = serverState.softGuide || null;
      this.state.workshopCount = global.FrontendBuildingState.getLevel(this.state.buildings, 'workshop');
      this.state.lumbermillCount = global.FrontendBuildingState.getLevel(this.state.buildings, 'lumbermill');
      this.state.military = {
        soldiers: 0,
        soldierCap: 0,
        trainingProgress: 0,
        trainingIntervalSeconds: 0,
        defensePerSoldier: 1,
        defense: 0,
        ...(this.state.military || {}),
      };
      this.state.territoryState = {
        polity: { name: null, capitalCityName: '首都', namePrompted: false },
        territories: [],
        warMissions: [],
        scoutMissions: [],
        scoutReports: [],
        directions: [],
        availableSoldiers: this.state.military.availableSoldiers || 0,
        soldiersOnMission: this.state.military.soldiersOnMission || 0,
        occupiedCount: 0,
        discoveredCount: 0,
        namingPrompt: null,
        ...(this.state.territoryState || {}),
      };
      this.state.population = {
        ...this.state.population,
        maxPop: this.state.population.max || this.state.population.maxPop || 3,
      };
      return this.state;
    }

    getState() {
      return this.state;
    }
  }

  global.GameStateManager = GameStateManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = GameStateManager;
})(typeof window !== 'undefined' ? window : globalThis);
