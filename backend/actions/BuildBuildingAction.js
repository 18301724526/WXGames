const BuildingActionService = require('../services/BuildingActionService');

function execute(action, gameState, tutorial, target) {
  return action === 'upgrade'
    ? BuildingActionService.upgrade(gameState, tutorial, target)
    : BuildingActionService.build(gameState, tutorial, target);
}

module.exports = {
  execute,
};
