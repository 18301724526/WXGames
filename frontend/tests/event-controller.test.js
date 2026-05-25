const test = require('node:test');
const assert = require('node:assert/strict');

const EventController = require('../js/controllers/EventController');

test('事件控制器按玩家点击的 optionId 提交选择', async () => {
  let claimed = null;
  let applied = null;
  const controller = new EventController({
    api: {
      async claimEvent(eventId, optionId) {
        claimed = { eventId, optionId };
        return { success: true, reward: { food: 70 }, tutorial: { completed: true } };
      },
    },
    renderer: {
      open() {},
      close() {},
      formatReward(reward) {
        return `food:${reward.food}`;
      },
    },
    getState: () => ({
      eventQueue: [
        {
          id: 'evt_regular_hunter',
          options: [
            { id: 'bring_meat', label: '带回肉食' },
            { id: 'study_trail', label: '研究兽径' },
          ],
        },
      ],
    }),
    onStateApplied(result) { applied = result; },
    onTutorialUpdated() {},
    onFloatingText() {},
    onLog() {},
  });

  controller.open('evt_regular_hunter');
  const result = await controller.claimActive('study_trail');

  assert.deepEqual(claimed, { eventId: 'evt_regular_hunter', optionId: 'study_trail' });
  assert.equal(applied.success, true);
  assert.equal(result.success, true);
  assert.equal(controller.activeEventId, null);
});
