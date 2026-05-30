const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..', '..');
const htmlPath = path.join(projectRoot, 'frontend', 'tools', 'tile-map-lab.html');
const jsPath = path.join(projectRoot, 'frontend', 'tools', 'tile-map-lab.js');
const riverTemplateKeys = [
  'nw',
  'ne',
  'se',
  'sw',
  'nw-ne',
  'nw-se',
  'nw-sw',
  'ne-se',
  'ne-sw',
  'se-sw',
  'nw-ne-se',
  'nw-ne-sw',
  'nw-se-sw',
  'ne-se-sw',
  'nw-ne-se-sw',
];

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
    'tile-map/tile-feature-tree-cluster.png',
    'tile-map/tile-feature-mountain-ridge.png',
    'tile-map/tile-feature-pond.png',
    ...riverTemplateKeys.map((key) => `tile-map/river-template/tile-river-template-ai-${key}.png`),
    'world-site-camp-cutout.png',
    'world-site-city-cutout.png',
    'world-site-outpost-cutout.png',
    'world-site-ruins-cutout.png',
    'world-site-town-cutout.png',
  ];

  assert.match(html, /<canvas id="tileCanvas"/);
  assert.match(html, /tile-map-lab\.js\?v=0\.1\.179-tile-map-lab-river-ai-mask-v2/);
  assert.match(js, /ASSET_ROOT = '\.\.\/assets\/art\/'/);
  assert.match(js, /tile-map\/tile-terrain-plains\.png/);
  assert.match(js, /imageMetrics = new Map/);
  assert.match(js, /analyzeAlphaBounds/);
  assert.match(js, /getTileDrawSize/);
  assert.match(js, /syncGridToEffectiveTile/);
  assert.match(js, /effectiveTile/);
  assert.match(js, /effectiveSites/);
  assert.match(js, /FEATURE_ASSETS/);
  assert.match(js, /drawTreeFeature/);
  assert.match(js, /drawMountainFeature/);
  assert.match(js, /tile-map\/tile-feature-mountain-ridge\.png/);
  assert.match(js, /tile-map\/tile-feature-pond\.png/);
  assert.match(js, /RIVER_TEMPLATE_ASSETS/);
  assert.match(js, /getRiverTemplateKey/);
  assert.match(js, /getRiverTemplateAsset/);
  assert.match(js, /RIVER_DIRECTIONS/);
  assert.match(js, /RIVER_TEMPLATE_DIRECTION_SIDES/);
  assert.match(js, /RIVER_TEMPLATE_DIRECTION_INDICES/);
  assert.match(js, /hasRiverNearby/);
  assert.match(js, /isRiverBlockedCoord/);
  assert.match(js, /createRiverConnections/);
  assert.match(js, /buildRiverPath/);
  assert.match(js, /addRiverConnection/);
  assert.match(js, /riverConnections = createRiverConnections/);
  assert.match(js, /choosePond/);
  assert.match(js, /drawPond/);
  assert.match(js, /getRiverConnections/);
  assert.match(js, /drawRiverTemplatePorts/);
  assert.match(js, /effectiveFeatures/);
  assert.match(js, /valueNoise/);
  assert.match(js, /drawTerrainFeature/);
  assert.match(js, /TERRAIN_FEATURES/);
  assert.match(js, /drawRegionTint/);
  assert.doesNotMatch(js, /if \(!state\.showDebug\) return;\s*const riverTiles/);
  assert.match(js, /if \(!state\.showDebug\) return;/);
  assert.match(js, /metrics\.x/);
  assert.match(js, /metrics\.height/);
  assert.match(js, /tileSize\.width \* state\.siteScale/);
  assert.match(js, /ctx\.ellipse\(baseX/);
  assert.match(js, /ctx\.drawImage\(image/);
  assert.doesNotMatch(js, /forest: \{ chance:/);
  assert.match(js, /pointerdown/);
  assert.match(js, /wheel/);
  assert.match(js, /if \(hasRiverNearby\(q, r, 1\)\) return null;/);
  assert.match(js, /if \(ring < 2 \|\| hasRiverNearby\(q, r, 1\)\) return false;/);
  assert.match(js, /if \(hasRiverNearby\(tile\.q, tile\.r, 1\)\) return;/);
  assert.match(js, /templateAsset \? getImageMetrics\(templateAsset\.file\) : tileSize\.metrics/);
  assert.match(js, /\.filter\(\(item\) => !isRiverBlockedCoord\(item\.q, item\.r\)\)/);
  assert.doesNotMatch(js, /territory-plains-cutout|territory-forest-cutout|territory-hills-cutout|territory-ruins-cutout/);
  assert.doesNotMatch(js, /drawRiverSegments|drawRiverSegmentBetween|drawTiledRiverStrip|drawRiverWaterCaps|shouldDrawRiverJunction|drawRiverNode/);
  assert.doesNotMatch(js, /riverNodeCap|getRiverPiece|tile-river-node-cap|tile-river-straight-water|tile-river-junction-water/);

  for (const asset of artAssets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', ...asset.split('/'))), true, asset);
    assert.match(js, new RegExp(asset.replace('.', '\\.')));
  }
});

function getPixelBounds(rgba, width, height, predicate) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (!predicate(rgba[index], rgba[index + 1], rgba[index + 2], rgba[index + 3])) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= minX ? { minX, minY, maxX, maxY, count } : null;
}

function readPngRgba(buffer) {
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const zlib = require('node:zlib');
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const inflated = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rgba = new Uint8Array(width * height * 4);
  let cursor = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const raw = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    const out = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? out[x - 4] : 0;
      const up = prev[x];
      const upLeft = x >= 4 ? prev[x - 4] : 0;
      if (filter === 0) out[x] = raw[x];
      else if (filter === 1) out[x] = (raw[x] + left) & 255;
      else if (filter === 2) out[x] = (raw[x] + up) & 255;
      else if (filter === 3) out[x] = (raw[x] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        out[x] = (raw[x] + predictor) & 255;
      } else {
        throw new Error(`unsupported PNG filter ${filter}`);
      }
    }
    rgba.set(out, y * stride);
    prev = out;
  }
  return { width, height, rgba };
}

function isWaterPixel(red, green, blue, alpha) {
  return alpha > 80 && blue > red + 18 && blue > green + 4 && blue > 70;
}

function sideSampleCenters(alphaBounds) {
  const centerX = (alphaBounds.minX + alphaBounds.maxX) * 0.5;
  const centerY = (alphaBounds.minY + alphaBounds.maxY) * 0.5;
  const halfW = (alphaBounds.maxX - alphaBounds.minX) * 0.5;
  const halfH = (alphaBounds.maxY - alphaBounds.minY) * 0.5;
  return {
    nw: [Math.round(centerX - halfW * 0.5), Math.round(centerY - halfH * 0.5)],
    ne: [Math.round(centerX + halfW * 0.5), Math.round(centerY - halfH * 0.5)],
    se: [Math.round(centerX + halfW * 0.5), Math.round(centerY + halfH * 0.5)],
    sw: [Math.round(centerX - halfW * 0.5), Math.round(centerY + halfH * 0.5)],
  };
}

function countWaterNear(rgba, width, height, centerX, centerY, radius = 14) {
  let count = 0;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const index = (y * width + x) * 4;
      if (isWaterPixel(rgba[index], rgba[index + 1], rgba[index + 2], rgba[index + 3])) count += 1;
    }
  }
  return count;
}

test('AI river template assets keep water ports on diamond side centers', () => {
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'river-template');
  let expectedAlphaBounds = null;
  for (const key of riverTemplateKeys) {
    const file = path.join(templateDir, `tile-river-template-ai-${key}.png`);
    const { width, height, rgba } = readPngRgba(fs.readFileSync(file));
    const alphaBounds = getPixelBounds(rgba, width, height, (red, green, blue, alpha) => alpha > 32);
    const waterBounds = getPixelBounds(rgba, width, height, isWaterPixel);
    assert.ok(alphaBounds, key);
    assert.ok(waterBounds, key);
    assert.ok(waterBounds.count >= 120, key);
    if (!expectedAlphaBounds) {
      expectedAlphaBounds = alphaBounds;
    } else {
      assert.deepEqual(
        {
          minX: alphaBounds.minX,
          minY: alphaBounds.minY,
          maxX: alphaBounds.maxX,
          maxY: alphaBounds.maxY,
        },
        {
          minX: expectedAlphaBounds.minX,
          minY: expectedAlphaBounds.minY,
          maxX: expectedAlphaBounds.maxX,
          maxY: expectedAlphaBounds.maxY,
        },
        key
      );
    }
    const connectedSides = new Set(key.split('-'));
    const samples = sideSampleCenters(alphaBounds);
    for (const [side, [x, y]] of Object.entries(samples)) {
      const waterCount = countWaterNear(rgba, width, height, x, y);
      if (connectedSides.has(side)) {
        assert.ok(waterCount >= 80, `${key} missing ${side} water port`);
      } else {
        assert.ok(waterCount <= 8, `${key} leaks water into ${side} port`);
      }
    }
  }
});
