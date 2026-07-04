const test = require('node:test');
const assert = require('node:assert/strict');

const TileMapAssetManifest = require('./TileMapAssetManifest');

// Pixel-equivalence lock for the 'shore' terrain (passable coastline reclassified from
// 'ocean'): shore must render exactly like ocean — same water animation base, same
// shoreline template overlays — with only the display label key differing.

test('TileMapAssetManifest shore terrain asset equals ocean field-by-field except labelKey', () => {
  const ocean = TileMapAssetManifest.getTerrainAsset('ocean');
  const shore = TileMapAssetManifest.getTerrainAsset('shore');

  // Guard the silent plains fallback in getTerrainAsset: a missing entry would strip
  // the water animation and swap the base art.
  assert.notDeepEqual(shore, TileMapAssetManifest.getTerrainAsset('plains'));

  assert.equal(shore.labelKey, 'home.planning.terrain.shore');
  assert.equal(ocean.labelKey, 'home.planning.terrain.ocean');
  const { labelKey: _shoreLabelKey, ...shoreRest } = shore;
  const { labelKey: _oceanLabelKey, ...oceanRest } = ocean;
  assert.deepEqual(shoreRest, oceanRest);
  assert.equal(shore.path, ocean.path);
  assert.equal(shore.water, 'ocean');
});

test('TileMapAssetManifest resolves the same template assets for shore and ocean tiles', () => {
  const oceanTemplates = ['nw', 'corner-e', 'se-sw'];
  const shoreAssets = TileMapAssetManifest.getTileTemplateAssets({
    terrain: 'shore',
    oceanTemplates,
  });
  const oceanAssets = TileMapAssetManifest.getTileTemplateAssets({
    terrain: 'ocean',
    oceanTemplates,
  });

  assert.equal(shoreAssets.length, oceanTemplates.length);
  assert.deepEqual(shoreAssets, oceanAssets);
  shoreAssets.forEach((asset) => assert.equal(asset.templateType, 'ocean'));
});

test('TileMapAssetManifest keeps river/transition template resolution for land tiles', () => {
  const riverTile = { terrain: 'plains', riverPorts: ['nw', 'se'] };
  const [riverAsset] = TileMapAssetManifest.getTileTemplateAssets(riverTile);
  assert.equal(riverAsset.templateType, 'river');
  assert.equal(riverAsset.key, 'nw-se');

  const transitionTile = { terrain: 'plains', transitionKey: 'ne' };
  const [transitionAsset] = TileMapAssetManifest.getTileTemplateAssets(transitionTile);
  assert.equal(transitionAsset.templateType, 'transition');
  assert.equal(transitionAsset.key, 'ne');
});
