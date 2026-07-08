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

test('UnitSpriteManifest separates tutorial and scout unit resource identities', () => {
  const tutorial = UnitSpriteManifest.getUnitDefinition('tutorial_intro_soldier');
  const scout = UnitSpriteManifest.getUnitDefinition('scout_squad_default');

  assert.equal(tutorial.id, 'tutorial_intro_soldier');
  assert.equal(scout.id, 'scout_squad_default');
  assert.equal(UnitSpriteManifest.getFramePaths('tutorial_intro_soldier', 'move').length, 11);
  assert.equal(UnitSpriteManifest.getFramePaths('scout_squad_default', 'move').length, 11);
  assert.notEqual(tutorial, scout);
});

test('UnitSpriteManifest returns empty values for unknown unit animations', () => {
  assert.deepEqual(UnitSpriteManifest.getFramePaths('unknown', 'move'), []);
  assert.equal(UnitSpriteManifest.getFramePath('spearman', 'unknown', 0), '');
});

test('UnitSpriteManifest exposes the single default march unit key with a definition', () => {
  assert.equal(UnitSpriteManifest.DEFAULT_MARCH_UNIT_KEY, 'scout_squad_default');
  assert.ok(UnitSpriteManifest.getUnitDefinition(UnitSpriteManifest.DEFAULT_MARCH_UNIT_KEY));
});

test('UnitSpriteManifest resolves the barbarian infantry spine descriptor for march units', () => {
  const descriptor = UnitSpriteManifest.getSpineDescriptor('scout_squad_default');
  assert.ok(descriptor);
  assert.equal(descriptor.id, 'barbarian_infantry');
  assert.equal(descriptor.assetBase, 'assets/art/spine/march/barbarian/infantry/');
  assert.equal(descriptor.jsonFile, 'barbarian_infantry.json');
  assert.equal(descriptor.atlasFile, 'barbarian_infantry.atlas');
  // Every march-capable unit currently shares the one barbarian infantry skeleton.
  assert.equal(UnitSpriteManifest.getSpineDescriptor('hostile_squad_default'), descriptor);
  assert.equal(UnitSpriteManifest.getSpineDescriptor('tutorial_intro_soldier'), descriptor);
  assert.equal(UnitSpriteManifest.getSpineDescriptor('barbarian_infantry'), descriptor);
  assert.equal(UnitSpriteManifest.hasSpine('scout_squad_default'), true);
});

test('UnitSpriteManifest returns no spine descriptor for unknown units', () => {
  assert.equal(UnitSpriteManifest.getSpineDescriptor('unknown'), null);
  assert.equal(UnitSpriteManifest.hasSpine('unknown'), false);
  assert.equal(UnitSpriteManifest.getDirectionAnimation('unknown', '1'), '');
});

test('UnitSpriteManifest maps the four grid facings to spine animation names', () => {
  assert.equal(UnitSpriteManifest.getDirectionAnimation('scout_squad_default', '1'), '1');
  assert.equal(UnitSpriteManifest.getDirectionAnimation('scout_squad_default', '2'), '2');
  // The export swapped the downward walks: facing '3' (右下) plays anim '4', '4' (左下) plays '3'.
  assert.equal(UnitSpriteManifest.getDirectionAnimation('scout_squad_default', '3'), '4');
  assert.equal(UnitSpriteManifest.getDirectionAnimation('scout_squad_default', '4'), '3');
  // Empty / unknown facing falls back to the descriptor's default direction (facing '3' -> '4').
  assert.equal(UnitSpriteManifest.getDirectionAnimation('scout_squad_default', ''), '4');
  assert.equal(UnitSpriteManifest.getDirectionAnimation('scout_squad_default', '9'), '4');
});

test('UnitSpriteManifest keeps the 2D fallback frame animation for spine units', () => {
  // Spine units must still resolve 2D frames so the renderer can fall back when the spine
  // runtime or asset is unavailable.
  assert.equal(UnitSpriteManifest.getFramePaths('barbarian_infantry', 'move').length, 11);
  assert.equal(
    UnitSpriteManifest.getFramePath('barbarian_infantry', 'move', 0),
    'assets/art/units/spearman/move/001.png',
  );
});
