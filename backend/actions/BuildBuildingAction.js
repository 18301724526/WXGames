const BuildingActionService = require('../services/BuildingActionService');

function execute(action, gameState, target) {
  return action === 'upgrade'
    ? BuildingActionService.upgrade(gameState, target)
    : BuildingActionService.build(gameState, target);
}

module.exports = {
  execute,
};
