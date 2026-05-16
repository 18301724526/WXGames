const test = require('node:test');
const assert = require('node:assert/strict');

const gameStateService = require('../services/GameStateService');
const EventService = require('../services/EventService');

test('进入聚落时代会生成森林低语事件，领取后发放木材并移除事件', () => {
  const state = gameStateService.createInitialGameState('event-player');
  state.currentEra = 2;

  const created = EventService.generateSpecialEvent(state, 2);
  assert.equal(created.id, EventService.SETTLEMENT_EVENT_ID);
  assert.equal(state.eventQueue.length, 1);

  const result = EventService.claimEvent(state, EventService.SETTLEMENT_EVENT_ID, EventService.SETTLEMENT_OPTION_ID);
  assert.equal(result.success, true);
  assert.equal(result.reward.wood, 20);
  assert.equal(state.resources.wood, 20);
  assert.equal(state.eventQueue.length, 0);
  assert.equal(state.eventHistory[0].status, 'claimed');
});
