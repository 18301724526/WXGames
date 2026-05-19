const test = require('node:test');
const assert = require('node:assert/strict');

const BuildingController = require('../js/controllers/BuildingController');

test('building controller delegates H5 loading state and submits build actions', async () => {
  const loadingStates = [];
  const busyStates = [];
  let boundHandler = null;
  let built = null;
  let success = null;
  const controller = new BuildingController({
    actionAdapter: {
      bindClick(handler) {
        boundHandler = handler;
      },
      setLoading(button, isLoading) {
        loadingStates.push([button.id, isLoading]);
      },
    },
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

  controller.bind();
  await boundHandler({ buildingId: 'farm', action: 'build', button: { id: 'btnFarm' } });

  assert.equal(built, 'farm');
  assert.deepEqual(loadingStates, [['btnFarm', true], ['btnFarm', false]]);
  assert.deepEqual(busyStates, [true, false]);
  assert.equal(success.action, 'build');
  assert.equal(success.buildingId, 'farm');
});

test('building controller submits upgrade actions and forwards errors', async () => {
  const errors = [];
  let upgraded = null;
  const controller = new BuildingController({
    actionAdapter: {
      setLoading() {},
    },
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

  await controller.handleAction({ buildingId: 'house', action: 'upgrade', button: {} });

  assert.equal(upgraded, 'house');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].action, 'upgrade');
  assert.equal(errors[0].buildingId, 'house');
  assert.equal(errors[0].error.message, 'nope');
});
