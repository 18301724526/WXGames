const test = require('node:test');
const assert = require('node:assert/strict');

const FloatingTextAdapter = require('../floating-text');

test('floating text adapter owns H5 floating text node creation', () => {
  const removed = [];
  const appended = [];
  const created = [];
  const layer = {
    ownerDocument: {
      createElement(tag) {
        const element = {
          tag,
          className: '',
          textContent: '',
          style: {},
          remove() { removed.push(this); },
        };
        created.push(element);
        return element;
      },
    },
    appendChild(element) {
      appended.push(element);
    },
  };
  const target = {
    getBoundingClientRect() {
      return { left: 20, top: 40, width: 80 };
    },
  };
  const adapter = new FloatingTextAdapter({
    layer,
    resolveTarget: (selector) => (selector === '.food-card' ? target : null),
    durationMs: 1,
  });

  const shown = adapter.show('food +10', { selector: '.food-card', color: '#fff' });

  assert.equal(shown, true);
  assert.equal(created.length, 1);
  assert.equal(appended[0].className, 'floating-text');
  assert.equal(appended[0].textContent, 'food +10');
  assert.equal(appended[0].style.color, '#fff');
  assert.equal(appended[0].style.left, '60px');
  assert.equal(appended[0].style.top, '40px');
});

test('floating text adapter returns false without a target or layer', () => {
  const adapter = new FloatingTextAdapter({
    layer: null,
    resolveTarget: () => null,
  });

  assert.equal(adapter.show('hidden'), false);
});

test('floating text adapter can collect H5 hooks from document without render-time document access', () => {
  const created = [];
  const appended = [];
  const target = {
    getBoundingClientRect() {
      return { left: 4, top: 8, width: 12 };
    },
  };
  const layer = {
    appendChild(element) {
      appended.push(element);
    },
  };
  const adapter = FloatingTextAdapter.fromDocument({
    getElementById(id) {
      return id === 'fxLayer' ? layer : null;
    },
    querySelector(selector) {
      return selector === '.food-card' ? target : null;
    },
    createElement(tag) {
      const element = { tag, style: {}, remove() {} };
      created.push(element);
      return element;
    },
  }, { durationMs: 1 });

  assert.equal(adapter.show('food +1'), true);
  assert.equal(created[0].tag, 'div');
  assert.equal(appended[0].style.left, '10px');
  assert.equal(appended[0].style.top, '8px');
});
