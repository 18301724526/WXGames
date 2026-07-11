const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildInventory } = require('./generate-tutorial-rule-inventory');

test('tutorial rule inventory matches registry factory products and source locations', () => {
  const inventory = buildInventory();
  assert.ok(inventory.counts.flowRules > 0);
  assert.ok(inventory.counts.eventHandlers > 0);
  assert.equal(inventory.flowRules.length, inventory.counts.flowRules);
  assert.equal(inventory.eventHandlers.length, inventory.counts.eventHandlers);
  assert.ok(inventory.flowRules.some((entry) => entry.source === 'factory:makeTabOpenRule'));
  assert.ok(inventory.flowRules.some((entry) => entry.source === 'factory:makeBuildRule'));
  assert.ok(inventory.flowRules.some((entry) => entry.source === 'factory:makeTaskClaimPairRules'));

  for (const entry of [...inventory.flowRules, ...inventory.eventHandlers]) {
    assert.match(entry.location, /^frontend\/js\/tutorial\/TutorialGuide(?:Flow|Event)Registry\.js:\d+$/);
    const [file, lineText] = entry.location.split(':');
    const line = Number(lineText);
    const sourceLine = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8').split(/\r?\n/)[line - 1];
    assert.ok(sourceLine, `missing source line for ${entry.location}`);
  }
});

test('tutorial rule inventory generation is deterministic', () => {
  assert.deepEqual(buildInventory(), buildInventory());
});
