const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameApp = require('./CanvasGameApp');

test('CanvasGameApp advanceEra submits even when local era display state is ineligible', async () => {
  const calls = [];
  const app = Object.create(CanvasGameApp.prototype);
  app.state = { isCapitalCity: false };
  app.canAdvanceEraNow = () => false;
  app.getGameApi = () => ({
    async advanceEra() {
      calls.push(['advanceEra']);
      throw Object.assign(new Error('capital only'), { payload: { message: 'capital only' } });
    },
  });
  app.applyApiState = () => calls.push(['applyApiState']);
  app.renderMilitary = () => calls.push(['renderMilitary']);
  app.log = (message) => calls.push(['log', message]);

  assert.equal(await app.advanceEra(), false);
  assert.deepEqual(calls.map((item) => item[0]), ['advanceEra', 'log', 'renderMilitary']);
});
