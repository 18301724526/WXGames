const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialIntroOverlay = require('./TutorialIntroOverlay');

test('TutorialIntroOverlay delays enter-city completion until the fade transition ends', async () => {
  let currentTime = 1000;
  const timers = [];
  const renders = [];
  let completed = 0;
  const overlay = new TutorialIntroOverlay({
    runtime: {
      performance: { now: () => currentTime },
      setTimeout(callback, delayMs) {
        timers.push({ callback, delayMs });
        return timers.length;
      },
      clearTimeout() {},
    },
    storage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    game: {
      hasServerState: true,
      state: {
        gameDay: 1,
        totalBuildings: 0,
        cityState: { capitalCityId: 'capital' },
        territoryState: { territories: [{ id: 'capital' }] },
      },
      canvasShell: {
        renderActive(options) {
          renders.push(options);
        },
      },
    },
  });

  assert.equal(overlay.start(), true);
  assert.equal(overlay.getViewState().marchDurationMs, 4800);
  currentTime = 3400;
  assert.equal(overlay.finishMarch(), true);
  assert.equal(overlay.advanceFromAction({ type: 'openWorldSite', siteId: 'capital' }), true);
  assert.equal(overlay.beginEnterCityTransition({ type: 'enterCity', cityId: 'capital' }, () => { completed += 1; }), true);

  const entering = overlay.getViewState();
  assert.equal(entering.step, 'entering');
  assert.equal(entering.enterDurationMs, 1560);
  assert.equal(completed, 0);
  assert.equal(timers.at(-1).delayMs, 1560);

  currentTime = entering.enterEndedAt;
  assert.equal(overlay.completeEnterCityTransition(), true);
  await Promise.resolve();
  assert.equal(overlay.running, false);
  assert.equal(completed, 1);
  assert.ok(renders.length > 0);
});
