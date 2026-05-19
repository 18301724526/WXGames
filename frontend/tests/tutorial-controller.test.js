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

test('时代2引导步骤会按规则锁定标签页', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: () => null,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 11, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.canOpenTab('events'), true);
    assert.equal(controller.canOpenTab('buildings'), false);
    assert.equal(controller.canOpenTab('civilization'), false);
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('事件弹窗打开后会把引导切到领取按钮', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    let modalOpen = false;
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: (key) => key,
      isEventModalOpen: () => modalOpen,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 11, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.getTargetKey(), 'event-card-special');
    assert.equal(controller.getMessage(), '打开森林低语，领取你的第一批木材');

    modalOpen = true;
    assert.equal(controller.getTargetKey(), 'btn-claim-event');
    assert.equal(controller.getMessage(), '点击按钮领取木材奖励');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('农田建成后会锁在建筑页并高亮民居', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: (key) => key,
      getCurrentTab: () => 'buildings',
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 7, phaseCompleted: { newbie: false, era2: false } });
    assert.equal(controller.canOpenTab('buildings'), true);
    assert.equal(controller.canOpenTab('civilization'), false);
    assert.equal(controller.getTargetKey(), 'card-house');
    assert.equal(controller.getMessage(), '人口在增长，先建造民居为新居民腾出空间');

    controller.setState({ completed: false, currentStep: 8, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.canOpenTab('buildings'), true);
    assert.equal(controller.canOpenTab('resources'), true);
    assert.equal(controller.canOpenTab('events'), true);
    assert.equal(controller.canOpenTab('civilization'), true);
    assert.equal(controller.getTargetKey(), 'tab-resources');
    assert.equal(controller.getMessage(), '民居已建好，可以继续积累进阶所需资源');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('民居建成后在资源页显示等待人口增长的软目标', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: (key) => key,
      getCurrentTab: () => 'resources',
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 8, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.getTargetKey(), 'food-value');
    assert.equal(controller.getMessage(), '民居已建好，继续积累进阶所需食物和知识');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('民居建成等待阶段使用软引导，不阻止普通游玩', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const renderer = {
      softMessage: '',
      showSoft(message) {
        this.softMessage = message;
      },
      show() {
        throw new Error('should not show hard guide');
      },
      hide() {},
    };
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step } }; } },
      renderer,
      getTarget: () => null,
      getCurrentTab: () => 'resources',
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 8, phaseCompleted: { newbie: true, era2: false } });

    assert.equal(controller.canOpenTab('resources'), true);
    assert.equal(controller.canOpenTab('civilization'), true);
    assert.equal(controller.canOpenTab('events'), true);
    assert.equal(renderer.softMessage, '民居已建好，继续积累进阶所需食物和知识');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('时代2进阶完成后允许点击事件标签进入下一步', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: () => null,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 10, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.canOpenTab('events'), true);
    assert.equal(controller.canOpenTab('civilization'), true);
    assert.equal(controller.canOpenTab('buildings'), false);
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('领取事件奖励后允许切到建筑标签进入下一步', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: () => null,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 12, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.canOpenTab('events'), true);
    assert.equal(controller.canOpenTab('buildings'), true);
    assert.equal(controller.canOpenTab('civilization'), false);
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('伐木场建成后会先引导回资源页，再引导分配工匠', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    let currentTab = 'buildings';
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: (key) => key,
      getCurrentTab: () => currentTab,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 14, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.canOpenTab('resources'), true);
    assert.equal(controller.canOpenTab('buildings'), true);
    assert.equal(controller.canOpenTab('events'), false);
    assert.equal(controller.getTargetKey(), 'tab-resources');
    assert.equal(controller.getMessage(), '伐木场建好了，回到资源页面分配工匠');

    currentTab = 'resources';
    assert.equal(controller.getTargetKey(), 'card-craftsman');
    assert.equal(controller.getMessage(), '分配 1 名工匠去伐木场工作');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('伐木场资源不足时会先引导查看食物，资源足够后再引导建造', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    let currentTab = 'buildings';
    const state = {
      resources: { food: 20, wood: 20 },
      buildingCosts: { lumbermill: { food: 50, wood: 15 } },
    };
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: (key) => key,
      getCurrentTab: () => currentTab,
      getState: () => state,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 13, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.canOpenTab('resources'), true);
    assert.equal(controller.canOpenTab('buildings'), true);
    assert.equal(controller.getTargetKey(), 'tab-resources');
    assert.equal(controller.getMessage(), '建造伐木场还缺食物，先回资源页面积累');

    currentTab = 'resources';
    assert.equal(controller.getTargetKey(), 'food-value');
    assert.equal(controller.getMessage(), '食物还不够，先积累到 50 食物再建造伐木场');

    state.resources.food = 50;
    assert.equal(controller.getTargetKey(), 'tab-buildings');
    assert.equal(controller.getMessage(), '资源已满足，回到建筑页面建造伐木场');

    currentTab = 'buildings';
    assert.equal(controller.getTargetKey(), 'card-lumbermill');
    assert.equal(controller.getMessage(), '伐木场产出木材，先把它建起来');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('伐木场资源不足时会转成软引导并允许自由切换标签', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    const state = {
      resources: { food: 20, wood: 20 },
      buildingCosts: { lumbermill: { food: 50, wood: 15 } },
    };
    const renderer = {
      softMessage: '',
      showSoft(message) {
        this.softMessage = message;
      },
      show() {
        throw new Error('should use soft guide');
      },
      hide() {},
    };
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer,
      getTarget: () => null,
      getCurrentTab: () => 'resources',
      getState: () => state,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 13, phaseCompleted: { newbie: true, era2: false } });

    assert.equal(controller.canOpenTab('resources'), true);
    assert.equal(controller.canOpenTab('buildings'), true);
    assert.equal(controller.canOpenTab('events'), true);
    assert.equal(controller.canOpenTab('civilization'), true);
    assert.equal(renderer.softMessage, '食物还不够，先积累到 50 食物再建造伐木场');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('时代2可进阶时先引导进入文明页，再引导点击进阶按钮', async () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    let currentTab = 'resources';
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: { hide() {}, show() {} },
      getTarget: (key) => key,
      getCurrentTab: () => currentTab,
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 9, phaseCompleted: { newbie: true, era2: false } });
    assert.equal(controller.getTargetKey(), 'tab-civilization');
    assert.equal(controller.getMessage(), '资源已满足，先打开文明页面查看时代进阶');

    currentTab = 'civilization';
    assert.equal(controller.getTargetKey(), 'btn-advance-era');
    assert.equal(controller.getMessage(), '条件已满足，点击进阶进入聚落时代');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('时代2可进阶时如果已在文明页会直接高亮进阶按钮', () => {
  const originalLocalStorage = global.localStorage;
  try {
    global.localStorage = createStorage();
    delete require.cache[require.resolve('../js/controllers/TutorialController')];
    const TutorialController = require('../js/controllers/TutorialController');
    let showTarget = null;
    let showMessage = null;
    const controller = new TutorialController({
      api: { async advanceTutorial(step) { return { tutorial: { completed: false, currentStep: step, phaseCompleted: { newbie: true, era2: false } } }; } },
      renderer: {
        hide() {},
        show(target, message) {
          showTarget = target;
          showMessage = message;
        },
      },
      getTarget: (key) => key,
      getCurrentTab: () => 'civilization',
      onTabLockChange: () => {},
    });

    controller.setState({ completed: false, currentStep: 9, phaseCompleted: { newbie: true, era2: false } });

    assert.equal(controller.getTargetKey(), 'btn-advance-era');
    assert.equal(controller.getMessage(), '条件已满足，点击进阶进入聚落时代');
    assert.equal(showTarget, 'btn-advance-era');
    assert.equal(showMessage, '条件已满足，点击进阶进入聚落时代');
  } finally {
    global.localStorage = originalLocalStorage;
  }
});

test('事件弹窗会切换 show 类而不是失效的 active 类', () => {
  const originalDocument = global.document;
  try {
    const modal = {
      classList: {
        values: new Set(),
        add(name) { this.values.add(name); },
        remove(name) { this.values.delete(name); },
        contains(name) { return this.values.has(name); },
      },
    };
    global.document = {
      getElementById(id) {
        if (id === 'eventModal') return modal;
        return { textContent: '' };
      },
    };

    global.UIStatePresenter = require('../js/state/UIStatePresenter');
    delete require.cache[require.resolve('../js/ui/EventUIRenderer')];
    const EventUIRenderer = require('../js/ui/EventUIRenderer');
    const renderer = new EventUIRenderer(() => {});
    renderer.open({ title: '森林低语', description: 'desc', options: [{ reward: { wood: 10 } }] });
    assert.equal(modal.classList.contains('show'), true);

    renderer.close();
    assert.equal(modal.classList.contains('show'), false);
  } finally {
    global.document = originalDocument;
  }
});
