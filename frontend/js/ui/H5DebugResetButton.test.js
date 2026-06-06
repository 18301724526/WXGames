const test = require('node:test');
const assert = require('node:assert/strict');

const H5DebugResetButton = require('./H5DebugResetButton');

function createDocument() {
  const elements = new Map();
  const body = {
    children: [],
    appendChild(element) {
      this.children.push(element);
      if (element.id) elements.set(element.id, element);
      return element;
    },
  };
  return {
    readyState: 'complete',
    body,
    createElement(tagName) {
      const listeners = {};
      return {
        tagName: String(tagName || '').toUpperCase(),
        style: {},
        disabled: false,
        textContent: '',
        addEventListener(type, handler) {
          listeners[type] = handler;
        },
        dispatch(type) {
          return listeners[type]?.();
        },
        setAttribute(name, value) {
          this[name] = value;
        },
      };
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
  };
}

test('H5DebugResetButton mounts above canvas guidance layers beside the 9:16 frame', () => {
  const doc = createDocument();
  const runtime = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener() {},
  };

  const button = H5DebugResetButton.mount(runtime);

  assert.equal(button.id, H5DebugResetButton.BUTTON_ID);
  assert.equal(button.textContent, '重置账号');
  assert.equal(button.style.zIndex, '2147483647');
  assert.equal(button.style.top, '68px');
  assert.equal(button.style.left, '853px');
  assert.equal(button.style.right, 'auto');
  assert.equal(button.style.pointerEvents, 'auto');
});

test('H5DebugResetButton falls back inside the viewport on narrow screens', () => {
  const doc = createDocument();
  const runtime = {
    document: doc,
    innerWidth: 390,
    innerHeight: 844,
    addEventListener() {},
  };

  const button = H5DebugResetButton.mount(runtime);

  assert.equal(button.style.left, 'auto');
  assert.equal(button.style.right, '10px');
});

test('H5DebugResetButton invokes the current game reset flow and restores state', async () => {
  const doc = createDocument();
  let resetCount = 0;
  const runtime = {
    document: doc,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener() {},
    Game: {
      token: 'token',
      async resetGame() {
        resetCount += 1;
        return true;
      },
    },
  };
  const button = H5DebugResetButton.mount(runtime);

  const result = await button.dispatch('click');

  assert.equal(result, true);
  assert.equal(resetCount, 1);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '重置账号');
  assert.equal(button.style.cursor, 'pointer');
});
