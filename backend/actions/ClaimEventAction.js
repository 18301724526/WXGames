const EventService = require('../services/EventService');

function execute(gameState, payload) {
  return EventService.claimEvent(gameState, payload.eventId, payload.optionId);
}

module.exports = {
  execute,
};
