const TerritoryService = require('../services/TerritoryService');
const WorldExplorerService = require('../services/WorldExplorerService');
const CityService = require('../services/CityService');

function execute(action, gameState, payload = {}) {
  if (action === 'scoutTerritory') {
    return TerritoryService.scoutTerritory(gameState, payload.direction || payload.territoryId);
  }
  if (action === 'startExplore') {
    return WorldExplorerService.startExplore(gameState, payload);
  }
  if (action === 'claimExplore') {
    return WorldExplorerService.claimExplore(gameState, payload.missionId);
  }
  if (action === 'claimScout') {
    return TerritoryService.claimScout(gameState, payload.missionId);
  }
  if (action === 'startConquest') {
    return TerritoryService.startConquest(gameState, payload.territoryId, payload.expedition || payload.soldiers);
  }
  if (action === 'claimConquest') {
    const result = TerritoryService.claimConquest(gameState, payload.territoryId);
    if (result.success && result.outcome === 'success') CityService.normalizeCities(gameState);
    return result;
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
