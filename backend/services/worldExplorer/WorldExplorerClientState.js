const DtoMapper = require('./WorldExplorerDtoMapper');
const { normalizeExploreState } = require('./WorldExplorerProgression');

function getClientMission(mission, now = new Date()) {
  return DtoMapper.getMissionDto(mission, now);
}

function getClientState(gameState, now = new Date()) {
  normalizeExploreState(gameState, now);
  return DtoMapper.getClientStateDto(gameState.exploreMissions || [], { now });
}

module.exports = {
  getClientMission,
  getClientState,
};
