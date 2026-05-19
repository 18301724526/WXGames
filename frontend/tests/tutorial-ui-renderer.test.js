const test = require('node:test');
const assert = require('node:assert/strict');
const UIStatePresenter = require('../js/state/UIStatePresenter');

function createElement() {
  return {
    style: {},
    textContent: '',
    classList: {
      values: new Set(),
      add(name) {
        this.values.add(name);
      },
      remove(name) {
        this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      },
    },
  };
}

test('教程高亮会把目标滚动到可视区并更新 spotlight 位置', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();
  const scrollContainer = { addEventListener() {} };

  const originalWindow = global.window;
  const originalDocument = global.document;

  try {
    global.window = {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener() {},
      requestAnimationFrame(callback) {
        callback();
        return 1;
      },
      cancelAnimationFrame() {},
    };
    global.document = {
      getElementById(id) {
        if (id === 'tutorialOverlay') return overlay;
        if (id === 'tutorialBubble') return bubble;
        if (id === 'tutorialPointer') return pointer;
        return null;
      },
      querySelector(selector) {
        if (selector === '.page-container') return scrollContainer;
        return null;
      },
    };

    delete require.cache[require.resolve('../js/ui/TutorialUIRenderer')];
    const TutorialUIRenderer = require('../js/ui/TutorialUIRenderer');
    const renderer = new TutorialUIRenderer();

    let currentRect = {
      top: 920,
      left: 24,
      width: 180,
      height: 52,
      bottom: 972,
      right: 204,
    };
    let scrollCalls = 0;
    const target = {
      getBoundingClientRect() {
        return currentRect;
      },
      scrollIntoView() {
        scrollCalls += 1;
        currentRect = {
          top: 360,
          left: 24,
          width: 180,
          height: 52,
          bottom: 412,
          right: 204,
        };
      },
    };

    renderer.show(target, '食物足够了！进阶到农耕时代');

    assert.equal(scrollCalls, 1);
    assert.equal(overlay.classList.contains('active'), true);
    assert.equal(bubble.classList.contains('active'), true);
    assert.equal(pointer.classList.contains('active'), true);
    assert.equal(bubble.textContent, '食物足够了！进阶到农耕时代');
    assert.equal(overlay.style.top, '352px');
    assert.equal(overlay.style.left, '16px');
    assert.equal(overlay.style.width, '196px');
    assert.equal(overlay.style.height, '68px');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('教程隐藏时会清理 spotlight 与提示位置', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();

  const originalWindow = global.window;
  const originalDocument = global.document;

  try {
    global.window = {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener() {},
      requestAnimationFrame(callback) {
        callback();
        return 1;
      },
      cancelAnimationFrame() {},
    };
    global.document = {
      getElementById(id) {
        if (id === 'tutorialOverlay') return overlay;
        if (id === 'tutorialBubble') return bubble;
        if (id === 'tutorialPointer') return pointer;
        return null;
      },
      querySelector() {
        return null;
      },
    };

    delete require.cache[require.resolve('../js/ui/TutorialUIRenderer')];
    const TutorialUIRenderer = require('../js/ui/TutorialUIRenderer');
    const renderer = new TutorialUIRenderer();

    const target = {
      getBoundingClientRect() {
        return {
          top: 100,
          left: 24,
          width: 120,
          height: 44,
          bottom: 144,
          right: 144,
        };
      },
      scrollIntoView() {},
    };

    renderer.show(target, '点击这里，查看文明进展');
    renderer.hide();

    assert.equal(overlay.classList.contains('active'), false);
    assert.equal(bubble.classList.contains('active'), false);
    assert.equal(pointer.classList.contains('active'), false);
    assert.equal(overlay.style.width, '');
    assert.equal(bubble.textContent, '');
    assert.equal(pointer.style.left, '');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('软引导只更新顾问建议，不显示黑屏、手指或常驻气泡', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();

  const originalWindow = global.window;
  const originalDocument = global.document;

  try {
    global.window = {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener() {},
      requestAnimationFrame(callback) {
        callback();
        return 1;
      },
      cancelAnimationFrame() {},
    };
    global.document = {
      getElementById(id) {
        if (id === 'tutorialOverlay') return overlay;
        if (id === 'tutorialBubble') return bubble;
        if (id === 'tutorialPointer') return pointer;
        return null;
      },
      querySelector() {
        return null;
      },
    };

    delete require.cache[require.resolve('../js/ui/TutorialUIRenderer')];
    const TutorialUIRenderer = require('../js/ui/TutorialUIRenderer');
    const renderer = new TutorialUIRenderer();
    let advisorMessage = '';
    renderer.onSoftGuide = (message) => {
      advisorMessage = message;
    };

    renderer.showSoft('食物还不够，先积累到 50 食物再建造伐木场');

    assert.equal(overlay.classList.contains('active'), false);
    assert.equal(pointer.classList.contains('active'), false);
    assert.equal(bubble.classList.contains('active'), false);
    assert.equal(bubble.classList.contains('soft'), false);
    assert.equal(bubble.textContent, '');
    assert.equal(advisorMessage, '食物还不够，先积累到 50 食物再建造伐木场');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test('软引导切回强引导时会清理 soft 样式并恢复高亮', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();

  const originalWindow = global.window;
  const originalDocument = global.document;

  try {
    global.window = {
      innerWidth: 390,
      innerHeight: 844,
      addEventListener() {},
      requestAnimationFrame(callback) {
        callback();
        return 1;
      },
      cancelAnimationFrame() {},
    };
    global.document = {
      getElementById(id) {
        if (id === 'tutorialOverlay') return overlay;
        if (id === 'tutorialBubble') return bubble;
        if (id === 'tutorialPointer') return pointer;
        return null;
      },
      querySelector() {
        return null;
      },
    };

    delete require.cache[require.resolve('../js/ui/TutorialUIRenderer')];
    const TutorialUIRenderer = require('../js/ui/TutorialUIRenderer');
    const renderer = new TutorialUIRenderer();
    const target = {
      getBoundingClientRect() {
        return {
          top: 120,
          left: 40,
          width: 180,
          height: 48,
          bottom: 168,
          right: 220,
        };
      },
      scrollIntoView() {},
    };

    renderer.showSoft('等待资源和人口满足进阶条件');
    renderer.show(target, '条件已满足，点击进阶进入聚落时代');

    assert.equal(overlay.classList.contains('active'), true);
    assert.equal(pointer.classList.contains('active'), true);
    assert.equal(bubble.classList.contains('active'), true);
    assert.equal(bubble.classList.contains('soft'), false);
    assert.equal(bubble.style.maxWidth, '');
    assert.equal(bubble.textContent, '条件已满足，点击进阶进入聚落时代');
  } finally {
    global.window = originalWindow;
    global.document = originalDocument;
  }
});
