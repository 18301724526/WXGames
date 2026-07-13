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
    tutorialConfigFiles: [],
    sourceOverride: {
      [rendererFile]: "renderer.addHitTarget(rect, { type: 'renamedTarget' });",
      [tutorialFile]: "host.showHighlight('originalTarget');",
    },
  });
  assert.deepEqual(inventory.missingTypes, ['originalTarget']);
});

test('StepScript target fields stay in the tutorial hit-target inventory', () => {
  const rendererFile = 'probe/Renderer.js';
  const configFile = 'probe/StepScripts.js';
  const inventory = buildInventory({
    rendererFiles: [rendererFile],
    tutorialFiles: [],
    tutorialConfigFiles: [configFile],
    sourceOverride: {
      [rendererFile]: [
        "renderer.addHitTarget(rect, { type: 'openTaskCenter' });",
        "renderer.addHitTarget(rect, { type: 'claimTaskReward' });",
      ].join('\n'),
      [configFile]: [
        "const config = { target: 'openTaskCenter' };",
        "const claim = { target: 'claimTaskReward:main_first_supplies' };",
        "const descriptor = { target: 'hitTarget:claimTaskReward' };",
      ].join('\n'),
    },
  });

  assert.deepEqual(inventory.missingTypes, []);
  assert.deepEqual(inventory.tutorialTypes.map((entry) => entry.type), [
    'claimTaskReward',
    'openTaskCenter',
  ]);
  assert.equal(inventory.counts.tutorialConfigFiles, 1);
});
