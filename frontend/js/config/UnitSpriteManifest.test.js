const test = require('node:test');
const assert = require('node:assert/strict');

const UnitSpriteManifest = require('./UnitSpriteManifest');

test('UnitSpriteManifest exposes extensible spearman move frame paths', () => {
  const frames = UnitSpriteManifest.getFramePaths('spearman', 'move');

  assert.equal(frames.length, 11);
  assert.equal(frames[0], 'assets/art/units/spearman/move/001.png');
  assert.equal(frames[10], 'assets/art/units/spearman/move/011.png');
  assert.equal(UnitSpriteManifest.getFrameDurationMs('spearman', 'move'), 80);

  frames.length = 0;
  assert.equal(UnitSpriteManifest.getFramePaths('spearman', 'move').length, 11);
});

test('UnitSpriteManifest returns empty values for unknown unit animations', () => {
  assert.deepEqual(UnitSpriteManifest.getFramePaths('unknown', 'move'), []);
  assert.equal(UnitSpriteManifest.getFramePath('spearman', 'unknown', 0), '');
});
