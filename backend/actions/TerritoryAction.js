const TerritoryService = require('../services/TerritoryService');
const CityService = require('../services/CityService');
const WorldExplorerService = require('../services/WorldExplorerService');
const { CommandAuthorityContract } = require('../services/realtime');

function getOccupiedCityCount(gameState = {}) {
  return (Array.isArray(gameState.territories) ? gameState.territories : [])
    .filter((territory) => (
      territory?.status === 'occupied'
      && territory.type !== 'capital'
      && (territory.owner === 'player' || territory.ownerPlayerId === gameState.playerId)
    )).length;
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

function markFirstSettlementMissionReady(gameState = {}, territoryId = '') {
  if (getOccupiedCityCount(gameState) !== 0) return;
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

function withWorldContext(payload = {}, context = {}) {
  return {
    ...payload,
    planningContext: context.planningContext || payload.planningContext || null,
    worldEncounterRepo: context.worldEncounterRepo || payload.worldEncounterRepo || null,
    sharedWorldEncounters:
      context.sharedWorldEncounters
      || payload.sharedWorldEncounters
      || context.planningContext?.sharedWorldEncounters
      || payload.planningContext?.sharedWorldEncounters
      || null,
  };
}

function execute(action, gameState, payload = {}, context = {}) {
  if (action === 'startWorldMarch') {
    return WorldExplorerService.startWorldMarch(gameState, withWorldContext(payload, context));
  }
  if (action === 'returnWorldMarch') {
    return WorldExplorerService.returnWorldMarch(gameState, payload.missionId, withWorldContext(payload, context));
  }
  if (action === 'stopWorldMarch') {
    return WorldExplorerService.stopWorldMarch(gameState, payload.missionId, withWorldContext(payload, context));
  }
  if (action === 'startConquest') {
    const result = TerritoryService.startConquest(gameState, payload.territoryId, payload.expedition || payload.soldiers);
    if (result.success) markFirstSettlementMissionReady(gameState, payload.territoryId);
    return attachTerritoryAuthority(
      result,
      gameState,
      action,
      payload,
    );
  }
  if (action === 'claimConquest') {
    const result = TerritoryService.claimConquest(gameState, payload.territoryId);
    if (result.success && result.outcome === 'success') CityService.normalizeCities(gameState);
    return attachTerritoryAuthority(
      result,
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
    return result;
  }
  if (action === 'renamePolity') {
    return TerritoryService.renamePolity(gameState, payload.name);
  }
  if (action === 'switchCity') {
    return CityService.setActiveCity(gameState, payload.territoryId || payload.cityId || CityService.CAPITAL_CITY_ID);
  }
  return { success: false, error: 'UNKNOWN_TERRITORY_ACTION', message: '未知疆域操作' };
}

module.exports = { execute };
