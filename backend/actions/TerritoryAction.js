const TerritoryService = require('../services/TerritoryService');

function execute(action, gameState, payload = {}) {
  if (action === 'scoutTerritory') {
    return TerritoryService.scoutTerritory(gameState, payload.territoryId);
  }
  if (action === 'startConquest') {
    return TerritoryService.startConquest(gameState, payload.territoryId, payload.soldiers);
  }
  if (action === 'claimConquest') {
    return TerritoryService.claimConquest(gameState, payload.territoryId);
  }
  if (action === 'renameCity') {
    return TerritoryService.renameCity(gameState, payload.territoryId, payload.name);
  }
  if (action === 'renamePolity') {
    return TerritoryService.renamePolity(gameState, payload.name);
  }
  return { success: false, error: 'UNKNOWN_TERRITORY_ACTION', message: '未知疆域操作' };
}

module.exports = { execute };
