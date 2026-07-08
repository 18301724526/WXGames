const TaskCenterService = require('../../services/TaskCenterService');

function buildGameActionView(gameState, tutorial, gameStateService, projection = {}) {
  const clientState = gameStateService.getClientGameStateFromNormalized
    ? gameStateService.getClientGameStateFromNormalized(gameState, projection)
    : gameStateService.getClientGameState(gameState, projection);
  const eraProgress = gameStateService.calculateEraProgressFromNormalized
    ? gameStateService.calculateEraProgressFromNormalized(gameState)
    : gameStateService.calculateEraProgress(gameState);
  const taskCenter = TaskCenterService.getTaskCenter(gameState);
  return {
    gameState: clientState,
    tutorial,
    softGuide: null,
    guideTasks: { visible: false, tasks: [] },
    taskCenter,
    eraProgress,
  };
}

module.exports = {
  buildGameActionView,
};
