const test = require('node:test');
const assert = require('node:assert/strict');

const PopulationPanelAdapter = require('../js/ui/PopulationPanelAdapter');

function createClassList(names = []) {
  const classes = new Set(names);
  return {
    contains(name) {
      return classes.has(name);
    },
  };
}

function createButton(job, classes = []) {
  return {
    dataset: { job },
    classList: createClassList(classes),
    disabled: false,
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
  };
}

test('population panel adapter renders job button states and binds custom controls', () => {
  const farmerPlus = createButton('farmer', ['btn-plus']);
  const farmerMinus = createButton('farmer', ['btn-minus']);
  const craftsmanPlus = createButton('craftsman', ['btn-plus']);
  const craftsmanCard = { style: {} };
  const adapter = new PopulationPanelAdapter({
    jobButtons: [farmerPlus, farmerMinus, craftsmanPlus],
    craftsmanCard,
  });

  adapter.render({
    showCraftsman: false,
    jobs: [
      { id: 'farmer', canIncrease: false, canDecrease: true },
      { id: 'craftsman', canIncrease: true, canDecrease: false },
    ],
  });

  assert.equal(farmerPlus.disabled, true);
  assert.equal(farmerMinus.disabled, false);
  assert.equal(craftsmanPlus.disabled, false);
  assert.equal(craftsmanCard.style.display, 'none');

  const assignments = [];
  adapter.bind((job, delta) => assignments.push([job, delta]));
  farmerPlus.listeners.click({
    target: {
      closest() { return farmerPlus; },
    },
  });
  farmerMinus.listeners.click({
    target: {
      closest() { return farmerMinus; },
    },
  });

  assert.deepEqual(assignments, [['farmer', 1], ['farmer', -1]]);
  assert.equal(farmerPlus.dataset.popBound, 'true');
});
