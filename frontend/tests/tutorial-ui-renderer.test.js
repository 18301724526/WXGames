const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialUIRenderer = require('../js/ui/TutorialUIRenderer');

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

function createRuntime() {
  return {
    innerWidth: 390,
    innerHeight: 844,
    addEventListener() {},
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    cancelAnimationFrame() {},
  };
}

function createRenderer(options = {}) {
  return new TutorialUIRenderer({
    overlay: options.overlay || createElement(),
    bubble: options.bubble || createElement(),
    pointer: options.pointer || createElement(),
    scrollContainer: options.scrollContainer || null,
  }, options.runtime || createRuntime());
}

test('tutorial highlight scrolls target into view and updates spotlight geometry', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();
  const scrollContainer = { addEventListener() {} };
  const renderer = createRenderer({ overlay, bubble, pointer, scrollContainer });
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

  renderer.show(target, 'Advance when food is ready');

  assert.equal(scrollCalls, 1);
  assert.equal(overlay.classList.contains('active'), true);
  assert.equal(bubble.classList.contains('active'), true);
  assert.equal(pointer.classList.contains('active'), true);
  assert.equal(bubble.textContent, 'Advance when food is ready');
  assert.equal(overlay.style.top, '352px');
  assert.equal(overlay.style.left, '16px');
  assert.equal(overlay.style.width, '196px');
  assert.equal(overlay.style.height, '68px');
});

test('tutorial hide clears spotlight and hint positions', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();
  const renderer = createRenderer({ overlay, bubble, pointer });
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

  renderer.show(target, 'Tap here');
  renderer.hide();

  assert.equal(overlay.classList.contains('active'), false);
  assert.equal(bubble.classList.contains('active'), false);
  assert.equal(pointer.classList.contains('active'), false);
  assert.equal(overlay.style.width, '');
  assert.equal(bubble.textContent, '');
  assert.equal(pointer.style.left, '');
});

test('soft guide only updates advisor advice and does not show overlay bubble or pointer', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();
  const renderer = createRenderer({ overlay, bubble, pointer });
  let advisorMessage = '';
  renderer.onSoftGuide = (message) => {
    advisorMessage = message;
  };

  renderer.showSoft('Wait for enough resources');

  assert.equal(overlay.classList.contains('active'), false);
  assert.equal(pointer.classList.contains('active'), false);
  assert.equal(bubble.classList.contains('active'), false);
  assert.equal(bubble.classList.contains('soft'), false);
  assert.equal(bubble.textContent, '');
  assert.equal(advisorMessage, 'Wait for enough resources');
});

test('strong guide after soft guide clears soft state and restores highlight', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();
  const renderer = createRenderer({ overlay, bubble, pointer });
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

  renderer.showSoft('Wait for resources');
  renderer.show(target, 'Advance now');

  assert.equal(overlay.classList.contains('active'), true);
  assert.equal(pointer.classList.contains('active'), true);
  assert.equal(bubble.classList.contains('active'), true);
  assert.equal(bubble.classList.contains('soft'), false);
  assert.equal(bubble.style.maxWidth, '');
  assert.equal(bubble.textContent, 'Advance now');
});

test('tutorial renderer can collect H5 nodes and viewport runtime from document', () => {
  const overlay = createElement();
  const bubble = createElement();
  const pointer = createElement();
  const scrollContainer = { addEventListener() {} };
  const runtime = createRuntime();
  const renderer = TutorialUIRenderer.fromDocument({
    getElementById(id) {
      if (id === 'tutorialOverlay') return overlay;
      if (id === 'tutorialBubble') return bubble;
      if (id === 'tutorialPointer') return pointer;
      return null;
    },
    querySelector(selector) {
      return selector === '.page-container' ? scrollContainer : null;
    },
  }, runtime);

  assert.equal(renderer.overlay, overlay);
  assert.equal(renderer.bubble, bubble);
  assert.equal(renderer.pointer, pointer);
  assert.equal(renderer.scrollContainer, scrollContainer);
  assert.equal(renderer.runtime, runtime);
});
