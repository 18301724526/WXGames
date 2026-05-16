const Population = require('../domain/Population');
const TutorialService = require('../services/TutorialService');

function execute(gameState, tutorial, payload) {
  const result = Population.reassign(gameState.population || {}, payload.target, payload.count);
  if (result.error) {
    return { success: false, error: result.error, message: result.message, tutorial };
  }

  gameState.population = result.population;
  const nextTutorial = payload.target === 'craftsman' && (Number.parseInt(payload.count, 10) || 0) > 0
    ? TutorialService.advanceTutorial(tutorial, 'craftsmanAssigned')
    : tutorial;

  return {
    success: true,
    message: result.message,
    tutorial: nextTutorial,
  };
}

module.exports = {
  execute,
};
