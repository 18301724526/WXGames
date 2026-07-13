const Population = require('../services/population/PopulationAssignment');
const CityService = require('../services/CityService');

function execute(gameState, payload) {
  const city = CityService.getActiveCity(gameState);
  const result = Population.reassign(city.population || {}, payload.target, payload.count);
  if (result.error) {
    return { success: false, error: result.error, message: result.message };
  }

  city.population = result.population;
  CityService.applyDerivedStatsToCity(city, gameState);
  return {
    success: true,
    message: result.message,
  };
}

module.exports = {
  execute,
};
