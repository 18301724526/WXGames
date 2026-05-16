const EventDomain = require('../domain/Event');
const EventRewardCalculator = require('../calculators/EventRewardCalculator');

function hasPendingEvent(gameState, eventId) {
  return (gameState.eventQueue || []).some((event) => event.id === eventId && event.status !== 'claimed');
}

function generateSpecialEvent(gameState, toEra) {
  if (toEra !== 2 || hasPendingEvent(gameState, EventDomain.SETTLEMENT_EVENT_ID)) {
    return null;
  }
  const event = EventDomain.createSettlementEvent();
  gameState.eventQueue = [...(gameState.eventQueue || []), event];
  return event;
}

function claimEvent(gameState, eventId, optionId) {
  const queue = [...(gameState.eventQueue || [])];
  const index = queue.findIndex((event) => event.id === eventId);
  if (index < 0) {
    return { success: false, error: 'EVENT_NOT_FOUND', message: '事件不存在或已完成' };
  }

  const event = queue[index];
  const option = (event.options || []).find((item) => item.id === optionId);
  if (!option) {
    return { success: false, error: 'OPTION_NOT_FOUND', message: '事件选项不存在' };
  }

  const reward = EventRewardCalculator.calculateReward(option);
  Object.entries(reward).forEach(([key, value]) => {
    gameState.resources[key] = (gameState.resources[key] || 0) + value;
  });

  const claimedEvent = {
    ...event,
    status: 'claimed',
    claimedAt: new Date().toISOString(),
    selectedOptionId: optionId,
  };
  queue.splice(index, 1);
  gameState.eventQueue = queue;
  gameState.eventHistory = [claimedEvent, ...(gameState.eventHistory || [])].slice(0, 20);

  return {
    success: true,
    message: `获得了 ${reward.wood || 0} 木材！`,
    reward,
    event: claimedEvent,
  };
}

module.exports = {
  SETTLEMENT_EVENT_ID: EventDomain.SETTLEMENT_EVENT_ID,
  SETTLEMENT_OPTION_ID: EventDomain.SETTLEMENT_OPTION_ID,
  generateSpecialEvent,
  claimEvent,
};
