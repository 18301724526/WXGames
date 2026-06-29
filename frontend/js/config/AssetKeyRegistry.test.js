const test = require('node:test');
const assert = require('node:assert/strict');

const AssetKeyRegistry = require('./AssetKeyRegistry');

test('AssetKeyRegistry resolves stable keys to current asset paths', () => {
  assert.equal(AssetKeyRegistry.getAssetPath('background:civilization'), 'assets/art/civilization-bg.webp');
  assert.equal(AssetKeyRegistry.getAssetPath('ui:icon:food'), 'assets/art/icon-food-cutout.webp');
  assert.equal(AssetKeyRegistry.getAssetPath('world-site:city'), 'assets/art/world-site-city-cutout.png');
  assert.equal(AssetKeyRegistry.getAssetPath('battle:background:forest-camp'), 'assets/art/battle/battlefield-forest-camp.png');
});

test('AssetKeyRegistry returns fallback paths for unknown keys without mutating registry', () => {
  assert.equal(AssetKeyRegistry.getAssetPath('unknown:key'), '');
  assert.equal(AssetKeyRegistry.getAssetPath('unknown:key', 'assets/art/fallback.png'), 'assets/art/fallback.png');
  assert.equal(AssetKeyRegistry.getAssetDefinition('unknown:key'), null);
  assert.equal(AssetKeyRegistry.keys.includes('unknown:key'), false);
});

test('AssetKeyRegistry exposes grouped preload keys and deduped paths', () => {
  const keys = AssetKeyRegistry.getPreloadAssetKeys('base');
  const paths = AssetKeyRegistry.getPreloadAssetPaths('base');

  assert.equal(keys.includes('ui:icon:home'), true);
  assert.equal(keys.includes('world-site:town'), true);
  assert.equal(paths.includes('assets/art/icon-home-cutout.png'), true);
  assert.equal(paths.includes('assets/art/world-site-town-cutout.png'), true);
  assert.equal(new Set(paths).size, paths.length);

  keys.length = 0;
  assert.equal(AssetKeyRegistry.getPreloadAssetKeys('base').length > 0, true);
});

test('AssetKeyRegistry can create extension registries without editing base definitions', () => {
  const extended = AssetKeyRegistry.extend([
    {
      key: 'fx:test-spark',
      group: 'fx',
      path: 'assets/art/fx/test-spark.png',
      preloadGroups: ['battle'],
    },
    {
      key: 'ui:icon:food',
      group: 'ui',
      path: 'assets/art/icon-food-v2.webp',
      preloadGroups: ['base'],
    },
  ]);

  assert.equal(extended.getAssetPath('fx:test-spark'), 'assets/art/fx/test-spark.png');
  assert.deepEqual(extended.getGroupAssetKeys('fx'), ['fx:test-spark']);
  assert.deepEqual(extended.getPreloadAssetPaths('battle'), ['assets/art/fx/test-spark.png']);
  assert.equal(extended.getAssetPath('ui:icon:food'), 'assets/art/icon-food-v2.webp');
  assert.equal(AssetKeyRegistry.getAssetPath('ui:icon:food'), 'assets/art/icon-food-cutout.webp');
});
