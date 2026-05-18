const Population = require('../domain/Population');
const TutorialService = require('../services/TutorialService');
const CityService = require('../services/CityService');

function execute(gameState, tutorial, payload) {
  const city = CityService.getActiveCity(gameState);
  const result = Population.reassign(city.population || {}, payload.target, payload.count);
  if (result.error) {
    return { success: false, error: result.error, message: result.message, tutorial };
  }

  city.population = result.population;
  CityService.applyDerivedStatsToCity(city, gameState);
  CityService.syncActiveCityToLegacyFields(gameState);
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
