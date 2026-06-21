const DtoMapper = require('./WorldExplorerDtoMapper');

function getClientMission(mission, now = new Date()) {
  return DtoMapper.getMissionDto(mission, now);
}

function getClientState(gameState, now = new Date()) {
  return DtoMapper.getClientStateDto(gameState.exploreMissions || [], {
    now,
    marchVerification: gameState.worldMarchVerification || null,
  });
}

module.exports = {
  getClientMission,
  getClientState,
};
