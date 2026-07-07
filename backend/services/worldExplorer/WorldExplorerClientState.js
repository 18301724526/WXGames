const DtoMapper = require('./WorldExplorerDtoMapper');
const WorldCombatEncounterService = require('../worldCombat/WorldCombatEncounterService');

function getClientMission(mission, now = new Date()) {
  return DtoMapper.getMissionDto(mission, now);
}

function getClientState(gameState, now = new Date(), projection = {}) {
  return {
    ...DtoMapper.getClientStateDto(gameState.exploreMissions || [], {
      now,
      marchVerification: gameState.worldMarchVerification || null,
    }),
    combat: WorldCombatEncounterService.getClientState(gameState, now, {
      sharedWorldEncounters: projection.sharedWorldEncounters,
      worldEncounterRepo: projection.worldEncounterRepo,
    }),
  };
}

module.exports = {
  getClientMission,
  getClientState,
};
