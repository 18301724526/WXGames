const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingController = require('./BuildingController');

test('BuildingController waits for async success handling before clearing busy state', async () => {
  const calls = [];
  let releaseSuccess;
  const controller = new BuildingController({
    api: {
      async build(buildingId) {
        calls.push(['build', buildingId]);
        return { success: true, buildingId };
      },
    },
    onBusy(isBusy) {
      calls.push(['busy', isBusy]);
    },
    onSuccess(result, action, buildingId) {
      calls.push(['success:start', result.buildingId, action, buildingId, controller.busy]);
      return new Promise((resolve) => {
        releaseSuccess = () => {
          calls.push(['success:done', controller.busy]);
          resolve();
        };
      });
    },
  });

  const pending = controller.handleAction({ buildingId: 'house', action: 'build' });
  await Promise.resolve();

  assert.equal(controller.busy, true);
  assert.deepEqual(calls, [
    ['busy', true],
    ['build', 'house'],
    ['success:start', 'house', 'build', 'house', true],
  ]);

  releaseSuccess();
  assert.deepEqual(await pending, { success: true, buildingId: 'house' });

  assert.equal(controller.busy, false);
  assert.deepEqual(calls.at(-2), ['success:done', true]);
  assert.deepEqual(calls.at(-1), ['busy', false]);
});
