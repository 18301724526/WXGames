const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_OUTPUT,
  buildInventory,
} = require('./generate-tutorial-hit-target-types');

test('generated tutorial hit-target inventory is fresh and fully registered', () => {
  const generated = buildInventory();
  const artifact = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', DEFAULT_OUTPUT), 'utf8'));
  assert.deepEqual(artifact, generated);
  assert.deepEqual(generated.missingTypes, []);
  assert.ok(generated.counts.tutorialTypes > 0);
});

test('renderer type rename probe fires without changing tutorial references', () => {
  const rendererFile = 'probe/Renderer.js';
  const tutorialFile = 'probe/Tutorial.js';
  const inventory = buildInventory({
    rendererFiles: [rendererFile],
    tutorialFiles: [tutorialFile],
    sourceOverride: {
      [rendererFile]: "renderer.addHitTarget(rect, { type: 'renamedTarget' });",
      [tutorialFile]: "host.showHighlight('originalTarget');",
    },
  });
  assert.deepEqual(inventory.missingTypes, ['originalTarget']);
});
