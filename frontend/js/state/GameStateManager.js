(function (global) {
  class GameStateManager {
    constructor(initialState, options = {}) {
      this.state = initialState || {};
      this.buildingState = options.buildingState || { getLevel: () => 0 };
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
      this.state.iron = this.state.resources.iron ?? this.state.resources.metal ?? 0;
      this.state.stone = this.state.resources.stone || 0;
      this.state.softGuide = serverState.softGuide || null;
      this.state.guideTasks = serverState.guideTasks || { visible: false, tasks: [] };
      this.state.taskCenter = serverState.taskCenter || null;
      this.state.talentPolicies = serverState.talentPolicies || this.state.talentPolicies || {};
      this.state.famousPersons = serverState.famousPersons || this.state.famousPersons || {};
      this.state.guidebook = serverState.guidebook || this.state.guidebook || {};
      this.state.workshopCount = this.buildingState.getLevel(this.state.buildings, 'workshop');
      this.state.lumbermillCount = this.buildingState.getLevel(this.state.buildings, 'lumbermill');
      this.state.military = {
        soldiers: 0,
        soldierCap: 0,
        trainingProgress: 0,
        trainingIntervalSeconds: 0,
        trainingBatchSize: 0,
        defensePerSoldier: 0.01,
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
      this.state.worldExplorerState = {
        missions: [],
        activeMission: null,
        readyMissions: [],
        maxActiveMissions: 1,
        ...(this.state.worldExplorerState || {}),
      };
      this.state.cityState = {
        activeCityId: this.state.activeCityId || 'capital',
        capitalCityId: 'capital',
        cities: [],
        ...(this.state.cityState || {}),
      };
      this.state.activeCityId = this.state.cityState.activeCityId || this.state.activeCityId || 'capital';
      this.state.isCapitalCity = this.state.activeCityId === (this.state.cityState.capitalCityId || 'capital');
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
