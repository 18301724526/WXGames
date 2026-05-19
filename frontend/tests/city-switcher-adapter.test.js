const test = require('node:test');
const assert = require('node:assert/strict');

const CitySwitcherAdapter = require('../js/ui/CitySwitcherAdapter');

function createClassList() {
  const classes = new Set();
  return {
    toggle(name, force) {
      if (force) classes.add(name);
      else classes.delete(name);
    },
    remove(name) {
      classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function createElement(id) {
  return {
    id,
    hidden: id === 'menu',
    textContent: '',
    innerHTML: '',
    dataset: {},
    attrs: {},
    listeners: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    contains(target) {
      return target === this;
    },
  };
}

test('city switcher adapter owns H5 rendering and menu interactions', () => {
  const wrapper = createElement('wrapper');
  const trigger = createElement('trigger');
  const name = createElement('name');
  const menu = createElement('menu');
  const doc = createElement('document');
  const selected = [];
  const adapter = new CitySwitcherAdapter({ wrapper, trigger, name, menu, document: doc });

  adapter.bind({ onSelect: (cityId) => selected.push(cityId) });
  adapter.render({
    hidden: false,
    activeCityName: '北京',
    signature: 'capital|river',
    options: [
      { id: 'capital', name: '北京', tag: '首都', metaText: '人口 8', isActive: true },
      { id: 'site_river', name: '河湾城', tag: '分城', metaText: '人口 3', isActive: false },
    ],
  });

  assert.equal(wrapper.hidden, false);
  assert.equal(name.textContent, '北京');
  assert.match(menu.innerHTML, /data-city-id="site_river"/);
  assert.match(menu.innerHTML, /分城/);

  trigger.listeners.click({ stopPropagation() {} });
  assert.equal(menu.hidden, false);
  assert.equal(wrapper.classList.contains('is-open'), true);
  assert.equal(trigger.attrs['aria-expanded'], 'true');

  menu.listeners.click({
    target: {
      closest: () => ({ disabled: false, dataset: { cityId: 'site_river' } }),
    },
    stopPropagation() {},
  });
  assert.deepEqual(selected, ['site_river']);

  doc.listeners.click({ target: {} });
  assert.equal(menu.hidden, true);
  assert.equal(trigger.attrs['aria-expanded'], 'false');
});

test('city switcher adapter hides and closes empty view', () => {
  const wrapper = createElement('wrapper');
  const trigger = createElement('trigger');
  const name = createElement('name');
  const menu = createElement('menu');
  const adapter = new CitySwitcherAdapter({ wrapper, trigger, name, menu });

  menu.hidden = false;
  adapter.render({ hidden: true });

  assert.equal(wrapper.hidden, true);
  assert.equal(menu.hidden, true);
  assert.equal(trigger.attrs['aria-expanded'], 'false');
});
