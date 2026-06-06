const TerritoryService = require('../services/TerritoryService');
const WorldExplorerService = require('../services/WorldExplorerService');
const CityService = require('../services/CityService');
const TutorialService = require('../services/TutorialService');

function isTutorialFirstCity(gameState = {}, territoryId = '') {
  const siteId = gameState.tutorial?.grants?.[WorldExplorerService.TUTORIAL_FIRST_SITE_GRANT_KEY]?.siteId;
  return Boolean(siteId && String(siteId) === String(territoryId || ''));
}

function advanceTutorialAfterTerritoryAction(gameState = {}, result = {}, nextStep = 0) {
  if (!result?.success || !nextStep) return result;
  gameState.tutorial = TutorialService.manualAdvance(gameState.tutorial, nextStep);
  return {
    ...result,
    tutorial: gameState.tutorial,
  };
}

function ensureTutorialSettlementSoldiers(gameState = {}, territoryId = '') {
  if (!isTutorialFirstCity(gameState, territoryId)) return;
  const activeCityId = gameState.activeCityId || CityService.CAPITAL_CITY_ID;
  const city = gameState.cities?.[activeCityId] || gameState.cities?.[CityService.CAPITAL_CITY_ID] || null;
  const military = city?.military || gameState.military || {};
  const required = TerritoryService.MIN_EXPEDITION_SOLDIERS;
  if ((Number(military.soldiers) || 0) < required) military.soldiers = required;
  if ((Number(military.soldierCap) || 0) < required) military.soldierCap = required;
  if (city) city.military = military;
  gameState.military = military;
}

function markTutorialSettlementMissionReady(gameState = {}, territoryId = '') {
  if (!isTutorialFirstCity(gameState, territoryId)) return;
  const mission = (gameState.warMissions || []).find((item) => (
    item?.kind === 'conquest'
    && item.territoryId === territoryId
    && item.status === 'active'
  ));
  if (!mission || mission.mode !== 'settlement') return;
  const now = new Date().toISOString();
  mission.status = 'ready';
  mission.completesAt = now;
  mission.returnedAt = now;
}

function execute(action, gameState, payload = {}) {
  if (action === 'scoutTerritory') {
    return TerritoryService.scoutTerritory(gameState, payload.direction || payload.territoryId);
  }
  if (action === 'startExplore') {
    return WorldExplorerService.startExplore(gameState, payload);
  }
  if (action === 'startWorldMarch') {
    return WorldExplorerService.startWorldMarch(gameState, payload);
  }
  if (action === 'returnWorldMarch') {
    return WorldExplorerService.returnWorldMarch(gameState, payload.missionId);
  }
  if (action === 'stopWorldMarch') {
    return WorldExplorerService.stopWorldMarch(gameState, payload.missionId, payload);
  }
  if (action === 'claimExplore') {
    return WorldExplorerService.claimExplore(gameState, payload.missionId);
  }
  if (action === 'claimScout') {
    return TerritoryService.claimScout(gameState, payload.missionId);
  }
  if (action === 'startConquest') {
    ensureTutorialSettlementSoldiers(gameState, payload.territoryId);
    const result = TerritoryService.startConquest(gameState, payload.territoryId, payload.expedition || payload.soldiers);
    if (result.success) markTutorialSettlementMissionReady(gameState, payload.territoryId);
    return advanceTutorialAfterTerritoryAction(gameState, result, TutorialService.TUTORIAL_STEPS.firstCityConquestStarted);
  }
  if (action === 'claimConquest') {
    const result = TerritoryService.claimConquest(gameState, payload.territoryId);
    if (result.success && result.outcome === 'success') CityService.normalizeCities(gameState);
    return advanceTutorialAfterTerritoryAction(gameState, result, TutorialService.TUTORIAL_STEPS.firstCityOccupied);
  }
  if (action === 'renameCity') {
    const result = TerritoryService.renameCity(gameState, payload.territoryId, payload.name);
    if (result.success) CityService.updateCityName(gameState, payload.territoryId, result.territory.cityName);
    return advanceTutorialAfterTerritoryAction(gameState, result, TutorialService.TUTORIAL_STEPS.firstCityNamed);
  }
  if (action === 'renamePolity') {
    const result = TerritoryService.renamePolity(gameState, payload.name);
    return advanceTutorialAfterTerritoryAction(gameState, result, TutorialService.TUTORIAL_STEPS.polityNamed);
  }
  if (action === 'switchCity') {
    return CityService.setActiveCity(gameState, payload.territoryId || payload.cityId || CityService.CAPITAL_CITY_ID);
  }
  return { success: false, error: 'UNKNOWN_TERRITORY_ACTION', message: '未知疆域操作' };
}

module.exports = { execute };
