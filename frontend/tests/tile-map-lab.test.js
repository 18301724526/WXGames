const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..', '..');
const htmlPath = path.join(projectRoot, 'frontend', 'tools', 'tile-map-lab.html');
const jsPath = path.join(projectRoot, 'frontend', 'tools', 'tile-map-lab.js');

test('tile map lab is an art-resource stitching page', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  const artAssets = [
    'tile-map/tile-terrain-plains.png',
    'tile-map/tile-terrain-forest.png',
    'tile-map/tile-terrain-hills.png',
    'tile-map/tile-terrain-river.png',
    'tile-map/tile-terrain-waste.png',
    'tile-map/tile-terrain-mountain.png',
    'world-site-camp-cutout.png',
    'world-site-city-cutout.png',
    'world-site-outpost-cutout.png',
    'world-site-ruins-cutout.png',
    'world-site-town-cutout.png',
  ];

  assert.match(html, /<canvas id="tileCanvas"/);
  assert.match(html, /tile-map-lab\.js\?v=0\.1\.171-tile-map-lab-regions-v2/);
  assert.match(js, /ASSET_ROOT = '\.\.\/assets\/art\/'/);
  assert.match(js, /tile-map\/tile-terrain-plains\.png/);
  assert.match(js, /valueNoise/);
  assert.match(js, /drawTerrainFeature/);
  assert.match(js, /TERRAIN_FEATURES/);
  assert.match(js, /drawRegionTint/);
  assert.match(js, /if \(!state\.showDebug\) return;/);
  assert.match(js, /ctx\.drawImage\(image/);
  assert.match(js, /pointerdown/);
  assert.match(js, /wheel/);
  assert.doesNotMatch(js, /territory-plains-cutout|territory-forest-cutout|territory-hills-cutout|territory-ruins-cutout/);

  for (const asset of artAssets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', ...asset.split('/'))), true, asset);
    assert.match(js, new RegExp(asset.replace('.', '\\.')));
  }
});
