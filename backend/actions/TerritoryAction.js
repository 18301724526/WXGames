const TerritoryService = require('../services/TerritoryService');
const WorldExplorerService = require('../services/WorldExplorerService');
const CityService = require('../services/CityService');
const TutorialService = require('../services/TutorialService');
const { CommandAuthorityContract } = require('../services/realtime');

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

function attachTerritoryAuthority(result = {}, gameState = {}, action = '', payload = {}) {
  return CommandAuthorityContract.attach(result, {
    type: action,
    actorId: payload.missionId || payload.territoryId || payload.cityId || payload.direction || '',
    playerId: gameState.playerId || '',
    clientSequence: payload.clientSequence || null,
    serverTime: new Date().toISOString(),
  });
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
    return attachTerritoryAuthority(
      TerritoryService.scoutTerritory(gameState, payload.direction || payload.territoryId),
      gameState,
      action,
      payload,
    );
  }
  if (action === 'startWorldMarch') {
    return WorldExplorerService.startWorldMarch(gameState, payload);
  }
  if (action === 'returnWorldMarch') {
    return WorldExplorerService.returnWorldMarch(gameState, payload.missionId, payload);
  }
  if (action === 'stopWorldMarch') {
    return WorldExplorerService.stopWorldMarch(gameState, payload.missionId, payload);
  }
  if (action === 'claimScout') {
    return attachTerritoryAuthority(TerritoryService.claimScout(gameState, payload.missionId), gameState, action, payload);
  }
  if (action === 'startConquest') {
    const result = TerritoryService.startConquest(gameState, payload.territoryId, payload.expedition || payload.soldiers);
    if (result.success) markTutorialSettlementMissionReady(gameState, payload.territoryId);
    return attachTerritoryAuthority(
      advanceTutorialAfterTerritoryAction(gameState, result, TutorialService.TUTORIAL_STEPS.firstCityConquestStarted),
      gameState,
      action,
      payload,
    );
  }
  if (action === 'claimConquest') {
    const result = TerritoryService.claimConquest(gameState, payload.territoryId);
    if (result.success && result.outcome === 'success') CityService.normalizeCities(gameState);
    return attachTerritoryAuthority(
      advanceTutorialAfterTerritoryAction(gameState, result, TutorialService.TUTORIAL_STEPS.firstCityOccupied),
      gameState,
      action,
      payload,
    );
  }
  if (action === 'resolveCapture') {
    return TerritoryService.resolveCapture(gameState, payload.decisionId, payload.choice);
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
