const test = require('node:test');
const assert = require('node:assert/strict');

const TutorialTargetAdapter = require('../js/ui/TutorialTargetAdapter');

test('tutorial target adapter maps tutorial keys to H5 elements', () => {
  const elements = new Map();
  const doc = {
    getElementById(id) {
      const element = { id };
      elements.set(id, element);
      return element;
    },
  };
  const adapter = TutorialTargetAdapter.fromDocument(doc);

  assert.equal(adapter.getTarget('tab-resources'), elements.get('tabResources'));
  assert.equal(adapter.getTarget('tab-territory'), elements.get('tabMilitary'));
  assert.equal(adapter.getTarget('btn-advance-era'), null);
  assert.equal(adapter.getTarget('card-house'), null);
  assert.equal(adapter.getTarget('card-craftsman'), null);
  assert.equal(elements.has('card-house'), false);
  assert.equal(elements.has('craftsmanCard'), false);
  assert.equal(elements.has('btnAdvanceEra'), false);
  assert.equal(adapter.getTarget('missing'), null);
});
