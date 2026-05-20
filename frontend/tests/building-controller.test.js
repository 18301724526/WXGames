const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingController = require('../js/controllers/BuildingController');

test('building controller submits canvas build actions', async () => {
  const busyStates = [];
  let built = null;
  let success = null;
  const controller = new BuildingController({
    api: {
      async build(buildingId) {
        built = buildingId;
        return { success: true, message: 'ok' };
      },
      async upgrade() {
        throw new Error('unexpected upgrade');
      },
    },
    onSuccess(result, action, buildingId) {
      success = { result, action, buildingId };
    },
    onBusy(isBusy) {
      busyStates.push(isBusy);
    },
  });

  await controller.handleAction({ buildingId: 'farm', action: 'build' });

  assert.equal(built, 'farm');
  assert.deepEqual(busyStates, [true, false]);
  assert.equal(success.action, 'build');
  assert.equal(success.buildingId, 'farm');
});

test('building controller submits upgrade actions and forwards errors', async () => {
  const errors = [];
  let upgraded = null;
  const controller = new BuildingController({
    api: {
      async upgrade(buildingId) {
        upgraded = buildingId;
        throw new Error('nope');
      },
      async build() {
        throw new Error('unexpected build');
      },
    },
    onError(error, action, buildingId) {
      errors.push({ error, action, buildingId });
    },
  });

  await controller.handleAction({ buildingId: 'house', action: 'upgrade' });

  assert.equal(upgraded, 'house');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].action, 'upgrade');
  assert.equal(errors[0].buildingId, 'house');
  assert.equal(errors[0].error.message, 'nope');
});

test('building controller ignores duplicate actions while busy', async () => {
  let resolveBuild;
  let buildCount = 0;
  const controller = new BuildingController({
    api: {
      async build() {
        buildCount += 1;
        await new Promise((resolve) => {
          resolveBuild = resolve;
        });
        return { success: true, message: 'ok' };
      },
      async upgrade() {
        throw new Error('unexpected upgrade');
      },
    },
  });

  const first = controller.handleAction({ buildingId: 'farm', action: 'build' });
  await controller.handleAction({ buildingId: 'farm', action: 'build' });
  resolveBuild();
  await first;

  assert.equal(buildCount, 1);
});
