const test = require('node:test');
const assert = require('node:assert/strict');

function createStorage() {
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  };
}

test('guide task overlay keeps tutorial controller from replacing the strong highlight', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const renderer = {
      hideCalls: 0,
      showCalls: [],
      softCalls: [],
      hide() {
        this.hideCalls += 1;
      },
      show(target, message) {
        this.showCalls.push({ target, message });
      },
      showSoft(message) {
        this.softCalls.push(message);
      },
    };
    const state = {
      guideTasks: {
        visible: true,
        tasks: [{ id: 'lumbermill_supplies', status: 'claimable' }],
      },
      resources: { food: 50, wood: 15 },
      buildingCosts: { lumbermill: { food: 50, wood: 15 } },
    };
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step } }; } },
      renderer,
      getTarget: (key) => key,
      getCurrentTab: () => 'buildings',
      getState: () => state,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 13, phaseCompleted: { newbie: true, era2: false } });

    assert.equal(renderer.hideCalls, 0);
    assert.deepEqual(renderer.showCalls, []);
    assert.deepEqual(renderer.softCalls, []);
  } finally {
    global.localStorage = originalLocalStorage;
  }
});
