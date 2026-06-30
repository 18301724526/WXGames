const Population = require('../services/population/PopulationAssignment');
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
  const normalizedTutorial = TutorialService.normalizeTutorialState(tutorial);
  const amount = Number.parseInt(payload.count, 10) || 0;
  const nextTutorial = normalizedTutorial.currentStep === TutorialService.TUTORIAL_STEPS.talentPolicyApplied && amount !== 0
    ? TutorialService.advanceTutorial(normalizedTutorial, 'manualTalentAssigned')
    : payload.target === 'craftsman' && amount > 0
      ? TutorialService.advanceTutorial(normalizedTutorial, 'craftsmanAssigned')
      : normalizedTutorial;

  return {
    success: true,
    message: result.message,
    tutorial: nextTutorial,
  };
}

module.exports = {
  execute,
};
