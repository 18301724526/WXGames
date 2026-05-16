const test = require('node:test');
const assert = require('node:assert/strict');

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
    assert.equal(panel.classList.contains('has-era-two'), true);
    assert.equal(woodCard.hidden, false);
    assert.equal(woodCard.classList.contains('is-hidden'), false);
    assert.equal(woodCard.style.display, '');
    assert.equal(texts.get('woodValue'), 20);
    assert.equal(texts.get('woodRate'), '+0/s');
  } finally {
    global.document = originalDocument;
  }
});
