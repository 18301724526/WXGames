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
    'tile-map/tile-feature-tree-cluster.png',
    'tile-map/tile-feature-mountain-ridge.png',
    'tile-map/tile-river-straight.png',
    'tile-map/tile-river-node-cap.png',
    'world-site-camp-cutout.png',
    'world-site-city-cutout.png',
    'world-site-outpost-cutout.png',
    'world-site-ruins-cutout.png',
    'world-site-town-cutout.png',
  ];

  assert.match(html, /<canvas id="tileCanvas"/);
  assert.match(html, /tile-map-lab\.js\?v=0\.1\.176-tile-map-lab-river-pixel-ports-v1/);
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
  assert.match(js, /tile-map\/tile-river-straight\.png/);
  assert.match(js, /tile-map\/tile-river-node-cap\.png/);
  assert.match(js, /RIVER_DIRECTIONS/);
  assert.match(js, /createRiverConnections/);
  assert.match(js, /buildRiverPath/);
  assert.match(js, /addRiverConnection/);
  assert.match(js, /riverConnections = createRiverConnections/);
  assert.match(js, /getRiverConnections/);
  assert.match(js, /drawRiverSegments/);
  assert.match(js, /drawRiverSegmentBetween/);
  assert.match(js, /drawRiverNode/);
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
  assert.doesNotMatch(js, /territory-plains-cutout|territory-forest-cutout|territory-hills-cutout|territory-ruins-cutout/);

  for (const asset of artAssets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', ...asset.split('/'))), true, asset);
    assert.match(js, new RegExp(asset.replace('.', '\\.')));
  }
});

function getAlphaBounds(alpha, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] <= 32) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX >= minX ? { minX, minY, maxX, maxY } : null;
}

function readPngSizeAndAlpha(buffer) {
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
  const rows = [];
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
    rows.push(out);
    prev = out;
  }
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = rows[y];
    for (let x = 0; x < width; x += 1) {
      alpha[y * width + x] = row[x * 4 + 3];
    }
  }
  return { width, height, alpha };
}

function edgeRun(alpha, width, bbox, side) {
  const coords = [];
  const band = 2;
  if (side === 'left' || side === 'right') {
    const xStart = side === 'left' ? bbox.minX : Math.max(bbox.minX, bbox.maxX - band + 1);
    const xEnd = side === 'left' ? Math.min(bbox.maxX, bbox.minX + band - 1) : bbox.maxX;
    for (let y = bbox.minY; y <= bbox.maxY; y += 1) {
      let touched = false;
      for (let x = xStart; x <= xEnd; x += 1) {
        if (alpha[y * width + x] > 32) touched = true;
      }
      if (touched) coords.push(y);
    }
    const first = coords[0];
    const last = coords[coords.length - 1];
    return {
      width: coords.length,
      center: ((first + last) * 0.5 - bbox.minY) / (bbox.maxY - bbox.minY + 1),
    };
  }
  return { width: 0, center: 0 };
}

test('river straight asset has matching left and right pixel ports', () => {
  const buffer = fs.readFileSync(path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-river-straight.png'));
  const { width, height, alpha } = readPngSizeAndAlpha(buffer);
  const bbox = getAlphaBounds(alpha, width, height);
  assert.ok(bbox);
  const left = edgeRun(alpha, width, bbox, 'left');
  const right = edgeRun(alpha, width, bbox, 'right');
  assert.ok(left.width > 40);
  assert.ok(right.width > 40);
  assert.ok(Math.abs(left.width - right.width) <= 2);
  assert.ok(Math.abs(left.center - right.center) <= 0.02);
  assert.ok(Math.abs(left.center - 0.5) <= 0.04);
});
