const test = require('node:test');
const assert = require('node:assert/strict');

global.UIStatePresenter = require('../js/state/UIStatePresenter');
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
  const originalDocument = global.document;
  try {
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
    global.document = {
      getElementById(id) {
        if (!elements.has(id)) {
          elements.set(id, { classList: createClassList(), style: {}, textContent: '' });
        }
        return elements.get(id);
      },
    };

    const texts = new Map();
    const renderer = new ResourceRenderer((id, value) => texts.set(id, value));

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
  } finally {
    global.document = originalDocument;
  }
});
