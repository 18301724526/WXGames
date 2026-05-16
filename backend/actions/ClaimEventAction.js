const EventService = require('../services/EventService');
const TutorialService = require('../services/TutorialService');

function execute(gameState, tutorial, payload) {
  const result = EventService.claimEvent(gameState, payload.eventId, payload.optionId);
  if (!result.success) return { ...result, tutorial };

  return {
    ...result,
    tutorial: TutorialService.advanceTutorial(tutorial, 'specialEventClaimed'),
  };
}

module.exports = {
  execute,
};
