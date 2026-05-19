const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UIStatePresenter = require('../js/state/UIStatePresenter');
const ResourceRenderer = require('../js/ui/ResourceRenderer');

function createClassList() {
  return {
    values: new Set(),
    toggle(name, enabled) {
      if (enabled) this.values.add(name);
      else this.values.delete(name);
    },
    contains(name) {
      return this.values.has(name);
    },
  };
}

test('wood resource card becomes visible in settlement era despite initial inline display none', () => {
  const elements = new Map();
  elements.set('resourcePanel', { classList: createClassList() });
  elements.set('woodCard', {
    hidden: true,
    style: { display: 'none' },
    classList: createClassList(),
  });
  elements.set('woodDetailCard', {
    hidden: true,
    style: { display: 'none' },
    classList: createClassList(),
  });
  elements.set('foodNetRate', { classList: createClassList(), style: {}, textContent: '' });

  const texts = new Map();
  const renderer = ResourceRenderer.fromDocument({
    getElementById(id) {
      return elements.get(id) || null;
    },
  }, (id, value) => texts.set(id, value), { presenter: UIStatePresenter });

  renderer.render({
    currentEra: 2,
    resources: {
      food: 10,
      knowledge: 5,
      wood: 20,
      foodOutputPerSecond: 1,
      foodConsumptionPerSecond: 0.2,
      foodNetPerSecond: 0.8,
      knowledgePerSecond: 0.5,
      woodPerSecond: 0,
    },
    happiness: 100,
    gameDay: 1,
  });

  const panel = elements.get('resourcePanel');
  const woodCard = elements.get('woodCard');
  const woodDetailCard = elements.get('woodDetailCard');
  assert.equal(panel.classList.contains('has-era-two'), true);
  assert.equal(woodCard.hidden, false);
  assert.equal(woodCard.classList.contains('is-hidden'), false);
  assert.equal(woodCard.style.display, '');
  assert.equal(woodDetailCard.hidden, false);
  assert.equal(woodDetailCard.classList.contains('is-hidden'), false);
  assert.equal(woodDetailCard.style.display, '');
  assert.equal(texts.get('woodValue'), 20);
  assert.equal(texts.get('woodRate'), '+0/s');
  assert.equal(texts.get('foodDetailValue'), 10);
  assert.equal(texts.get('knowledgeDetailValue'), 5);
  assert.equal(texts.get('woodDetailValue'), 20);
  assert.equal(texts.get('foodOutputRate'), '+1/s');
  assert.equal(texts.get('foodConsumptionRate'), '-0.2/s');
  assert.equal(texts.get('foodNetRate'), '+0.8/s');
  assert.equal(texts.get('knowledgeDetailRate'), '+0.5/s');
  assert.equal(texts.get('woodDetailRate'), '+0/s');
});

test('resource renderer receives compact resource amounts from view state', () => {
  const elements = new Map();
  elements.set('resourcePanel', { classList: createClassList() });
  elements.set('woodCard', { hidden: false, style: {}, classList: createClassList() });
  elements.set('woodDetailCard', { hidden: false, style: {}, classList: createClassList() });
  elements.set('foodNetRate', { classList: createClassList(), style: {}, textContent: '' });

  const texts = new Map();
  const renderer = new ResourceRenderer((id, value) => texts.set(id, value), {
    panel: elements.get('resourcePanel'),
    woodCard: elements.get('woodCard'),
    woodDetailCard: elements.get('woodDetailCard'),
    foodNetRate: elements.get('foodNetRate'),
  }, { presenter: UIStatePresenter });

  renderer.render({
    currentEra: 2,
    resources: {
      food: 1100,
      knowledge: 1250000,
      wood: 999,
      foodNetPerSecond: 1200,
    },
  });

  assert.equal(texts.get('foodValue'), '1.1k');
  assert.equal(texts.get('knowledgeValue'), '1.2M');
  assert.equal(texts.get('woodValue'), 999);
  assert.equal(texts.get('foodRate'), '+1.2k/s');
});

test('resource renderer uses injected presenter instead of global presenter', () => {
  const calls = [];
  const renderer = new ResourceRenderer(() => {}, {
    panel: { classList: createClassList() },
  }, {
    presenter: {
      buildResourceViewState(state) {
        calls.push(state);
        return {
          classState: {
            resourcePanel: { 'has-era-two': false },
            foodNetRate: { 'is-positive': false, 'is-negative': false },
          },
          visibility: { woodCard: false, woodDetailCard: false },
          text: {},
        };
      },
    },
  });

  renderer.render({ currentEra: 1 });

  assert.deepEqual(calls, [{ currentEra: 1 }]);
});

test('resource renderer source does not read global presenter', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'ResourceRenderer.js'), 'utf8');

  assert.match(source, /this\.presenter\.buildResourceViewState/);
  assert.doesNotMatch(source, /global\.UIStatePresenter|globalThis\.UIStatePresenter|window\.UIStatePresenter/);
});
