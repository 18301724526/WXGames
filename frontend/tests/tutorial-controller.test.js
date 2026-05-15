const test = require('node:test');
const assert = require('node:assert/strict');

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('step 0 时即使本地残留 autoStarted 也会重新触发自动引导', async () => {
  const localStorage = createStorage({ tutorialAutoStarted: 'true' });
  const renderer = {
    hideCalls: 0,
    hide() {
      this.hideCalls += 1;
    },
    show() {},
  };
  const warnings = [];
  const originalLocalStorage = global.localStorage;
  const originalGameConfig = global.GameConfig;
  const originalSetTimeout = global.setTimeout;
  const originalConsoleWarn = console.warn;

  try {
    global.localStorage = localStorage;
    global.GameConfig = { TUTORIAL_START_DELAY_MS: 0 };
    global.setTimeout = (callback) => {
      callback();
      return 1;
    };
    console.warn = (...args) => warnings.push(args.join(' '));

    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');

    let advancedTo = null;
    const controller = new TutorialController({
      api: {
        async advanceTutorial(step) {
          advancedTo = step;
          return { tutorial: { completed: false, currentStep: step } };
        },
      },
      renderer,
      getTarget: () => null,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 0 });
    await Promise.resolve();

    assert.equal(advancedTo, 1);
    assert.equal(localStorage.getItem('tutorialAutoStarted'), 'true');
    assert.equal(localStorage.getItem('tutorialStep'), '1');
    assert.equal(renderer.hideCalls > 0, true);
    assert.equal(warnings.length, 0);
  } finally {
    global.localStorage = originalLocalStorage;
    global.GameConfig = originalGameConfig;
    global.setTimeout = originalSetTimeout;
    console.warn = originalConsoleWarn;
  }
});
