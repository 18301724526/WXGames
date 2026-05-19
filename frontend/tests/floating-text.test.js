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

  const shown = adapter.show('食物 +10', { selector: '.food-card', color: '#fff' });

  assert.equal(shown, true);
  assert.equal(created.length, 1);
  assert.equal(appended[0].className, 'floating-text');
  assert.equal(appended[0].textContent, '食物 +10');
  assert.equal(appended[0].style.color, '#fff');
  assert.equal(appended[0].style.left, '60px');
  assert.equal(appended[0].style.top, '40px');
});

test('floating text adapter returns false without a target or layer', () => {
  const adapter = new FloatingTextAdapter({
    layer: null,
    resolveTarget: () => null,
  });

  assert.equal(adapter.show('隐藏'), false);
});
