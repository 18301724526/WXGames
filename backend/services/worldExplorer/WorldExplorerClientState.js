const DtoMapper = require('./WorldExplorerDtoMapper');
const WorldCombatEncounterService = require('../worldCombat/WorldCombatEncounterService');

function getClientMission(mission, now = new Date()) {
  return DtoMapper.getMissionDto(mission, now);
}

function getClientState(gameState, now = new Date()) {
  return {
    ...DtoMapper.getClientStateDto(gameState.exploreMissions || [], {
      now,
      marchVerification: gameState.worldMarchVerification || null,
    }),
    combat: WorldCombatEncounterService.getClientState(gameState, now),
  };
}

module.exports = {
  getClientMission,
  getClientState,
};
