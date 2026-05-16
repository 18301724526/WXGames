const BuildingActionService = require('../services/BuildingActionService');
const TutorialService = require('../services/TutorialService');

function execute(action, gameState, tutorial, target) {
  const result = action === 'upgrade'
    ? BuildingActionService.upgrade(gameState, tutorial, target)
    : BuildingActionService.build(gameState, tutorial, target);

  if (!result.success) return result;

  if (action === 'build' && target === 'lumbermill') {
    return {
      ...result,
      tutorial: TutorialService.advanceTutorial(result.tutorial || tutorial, 'lumbermillBuilt'),
    };
  }

  return result;
}

module.exports = {
  execute,
};
