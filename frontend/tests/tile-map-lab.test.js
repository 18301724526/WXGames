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
const oceanTemplateKeys = ['full', ...riverTemplateKeys];
const oceanMouthTemplateKeys = [
  'ne-mouth-ne',
  'ne-se-mouth-ne',
  'ne-se-mouth-se',
  'ne-se-sw-mouth-ne',
  'ne-se-sw-mouth-se',
  'ne-se-sw-mouth-sw',
  'ne-sw-mouth-ne',
  'ne-sw-mouth-sw',
  'nw-mouth-nw',
  'nw-ne-mouth-ne',
  'nw-ne-mouth-nw',
  'nw-ne-se-mouth-ne',
  'nw-ne-se-mouth-nw',
  'nw-ne-se-mouth-se',
  'nw-ne-se-sw-mouth-ne',
  'nw-ne-se-sw-mouth-nw',
  'nw-ne-se-sw-mouth-se',
  'nw-ne-se-sw-mouth-sw',
  'nw-ne-sw-mouth-ne',
  'nw-ne-sw-mouth-nw',
  'nw-ne-sw-mouth-sw',
  'nw-se-mouth-nw',
  'nw-se-mouth-se',
  'nw-se-sw-mouth-nw',
  'nw-se-sw-mouth-se',
  'nw-se-sw-mouth-sw',
  'nw-sw-mouth-nw',
  'nw-sw-mouth-sw',
  'se-mouth-se',
  'se-sw-mouth-se',
  'se-sw-mouth-sw',
  'sw-mouth-sw',
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
    'tile-map/tile-water-river-loop.png',
    'tile-map/tile-water-ocean-loop.png',
    ...riverTemplateKeys.map((key) => `tile-map/river-template/tile-river-bank-uv-${key}.png`),
    ...oceanTemplateKeys.map((key) => `tile-map/ocean-template/tile-ocean-template-${key}.png`),
    ...oceanMouthTemplateKeys.map((key) => `tile-map/ocean-template/tile-ocean-template-${key}.png`),
    'world-site-camp-cutout.png',
    'world-site-city-cutout.png',
    'world-site-outpost-cutout.png',
    'world-site-ruins-cutout.png',
    'world-site-town-cutout.png',
  ];

  assert.match(html, /<canvas id="tileCanvas"/);
  assert.match(html, /tile-map-lab\.js\?v=0\.1\.179-tile-map-lab-ocean-mouth-bridge-v2/);
  assert.match(html, /id="animateWater"/);
  assert.match(js, /ASSET_ROOT = '\.\.\/assets\/art\/'/);
  assert.match(js, /tile-map\/tile-terrain-plains\.png/);
  assert.match(js, /imageMetrics = new Map/);
  assert.match(js, /analyzeAlphaBounds/);
  assert.match(js, /getTileDrawSize/);
  assert.match(js, /syncGridToEffectiveTile/);
  assert.match(js, /effectiveTile/);
  assert.match(js, /effectiveSites/);
  assert.match(js, /FEATURE_ASSETS/);
  assert.match(js, /WATER_TEXTURE_ASSETS/);
  assert.match(js, /tile-map\/tile-water-river-loop\.png/);
  assert.match(js, /tile-map\/tile-water-ocean-loop\.png/);
  assert.match(js, /createWaterMaskCanvas/);
  assert.match(js, /createTransparentRiverWaterMask/);
  assert.match(js, /createColorWaterMaskCanvas/);
  assert.match(js, /isInsideTemplateDiamond/);
  assert.match(js, /isTemplateWaterPixel/);
  assert.match(js, /drawWaterToLayer/);
  assert.match(js, /fillLoopWaterTexture/);
  assert.match(js, /createDryTemplateCanvas/);
  assert.match(js, /ensureStaticBaseLayer/);
  assert.match(js, /ensureWaterLayer/);
  assert.match(js, /WATER_ANIMATION_FPS = 18/);
  assert.match(js, /dryTemplateCanvases/);
  assert.match(js, /staticBaseCanvas/);
  assert.match(js, /waterLayerCanvas/);
  assert.match(js, /lastRenderedWaterFrame/);
  assert.match(js, /destination-in/);
  assert.match(js, /destination-out/);
  assert.match(js, /animateWater/);
  assert.match(js, /drawTreeFeature/);
  assert.match(js, /drawMountainFeature/);
  assert.match(js, /tile-map\/tile-feature-mountain-ridge\.png/);
  assert.match(js, /tile-map\/tile-feature-pond\.png/);
  assert.match(js, /RIVER_TEMPLATE_ASSETS/);
  assert.match(js, /tile-map\/river-template\/tile-river-bank-uv-/);
  assert.match(js, /getRiverTemplateKey/);
  assert.match(js, /getRiverTemplateAsset/);
  assert.match(js, /RIVER_DIRECTIONS/);
  assert.match(js, /RIVER_TEMPLATE_DIRECTION_SIDES/);
  assert.match(js, /RIVER_TEMPLATE_DIRECTION_INDICES/);
  assert.match(js, /OCEAN_TEMPLATE_ASSETS/);
  assert.match(js, /OCEAN_MOUTH_TEMPLATE_ASSETS/);
  assert.match(js, /OCEAN_SIDE_DIRECTIONS/);
  assert.match(js, /findRiverMouthTarget/);
  assert.match(js, /addRiverMouthConnection/);
  assert.match(js, /isOceanPaddingCoord/);
  assert.match(js, /isPadding/);
  assert.match(js, /getOceanTemplateKey/);
  assert.match(js, /getOceanMouthSide/);
  assert.match(js, /getOceanTemplateVariantKey/);
  assert.match(js, /getOceanTemplateAsset/);
  assert.match(js, /isOceanCoord/);
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
  assert.match(js, /effectiveOceanTemplates/);
  assert.match(js, /effectiveOceanMouthTemplates/);
  assert.match(js, /oceanTiles/);
  assert.match(js, /riverMouthOceanTiles/);
  assert.match(js, /oceanPaddingTiles/);
  assert.match(js, /effectiveFeatures/);
  assert.match(js, /effectiveWaterTextures/);
  assert.match(js, /waterMaskTemplates/);
  assert.match(js, /valueNoise/);
  assert.match(js, /drawTerrainFeature/);
  assert.match(js, /TERRAIN_FEATURES/);
  assert.match(js, /drawRegionTint/);
  assert.doesNotMatch(js, /if \(!state\.showDebug\) return;\s*const riverTiles/);
  assert.match(js, /if \(!state\.showDebug\) return;/);
  assert.match(js, /metrics\.x/);
  assert.match(js, /metrics\.height/);
  assert.match(js, /tileSize\.width \* state\.siteScale/);
  assert.match(js, /targetCtx\.ellipse\(baseX/);
  assert.match(js, /targetCtx\.drawImage\(image/);
  assert.doesNotMatch(js, /forest: \{ chance:/);
  assert.match(js, /pointerdown/);
  assert.match(js, /wheel/);
  assert.match(js, /if \(hasRiverNearby\(q, r, 1\)\) return null;/);
  assert.match(js, /if \(ring < 2 \|\| hasRiverNearby\(q, r, 1\)\) return false;/);
  assert.match(js, /if \(hasRiverNearby\(tile\.q, tile\.r, 1\)\) return;/);
  assert.match(js, /getOceanTemplateAsset\(tile\) \|\| getRiverTemplateAsset\(tile\)/);
  assert.match(js, /\.filter\(\(item\) => !isOceanCoord\(item\.q, item\.r, radius\)\)/);
  assert.match(js, /templateAsset \? getImageMetrics\(templateAsset\.file\) : tileSize\.metrics/);
  assert.match(js, /\.filter\(\(item\) => !isRiverBlockedCoord\(item\.q, item\.r\)\)/);
  assert.doesNotMatch(js, /territory-plains-cutout|territory-forest-cutout|territory-hills-cutout|territory-ruins-cutout/);
  assert.doesNotMatch(js, /drawRiverSegments|drawRiverSegmentBetween|drawTiledRiverStrip|drawRiverWaterCaps|shouldDrawRiverJunction|drawRiverNode/);
  assert.doesNotMatch(js, /riverNodeCap|getRiverPiece|tile-river-node-cap|tile-river-straight-water|tile-river-junction-water/);
  assert.doesNotMatch(js, /createRiverGeometryWaterMask|RIVER_TEMPLATE_FILE_KEYS|getTemplateSidePoints/);
  assert.doesNotMatch(js, /tile-river-template-ai-/);

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
    center: [Math.round(centerX), Math.round(centerY)],
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

function countTransparentTerrainNear(rgba, terrainRgba, width, height, centerX, centerY, radius = 14) {
  let count = 0;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const index = (y * width + x) * 4;
      if (terrainRgba[index + 3] > 32 && rgba[index + 3] <= 8) count += 1;
    }
  }
  return count;
}

test('river bank UV templates keep transparent water ports on standard template shapes', () => {
  const plainsFile = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-plains.png');
  const plains = readPngRgba(fs.readFileSync(plainsFile));
  const expectedAlphaBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'river-template');
  for (const key of riverTemplateKeys) {
    const file = path.join(templateDir, `tile-river-bank-uv-${key}.png`);
    const { width, height, rgba } = readPngRgba(fs.readFileSync(file));
    const alphaBounds = getPixelBounds(rgba, width, height, (red, green, blue, alpha) => alpha > 32);
    const waterBounds = getPixelBounds(rgba, width, height, isWaterPixel);
    assert.ok(alphaBounds, key);
    assert.equal(waterBounds, null, `${key} still contains old blue water pixels`);
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
    const connectedSides = new Set(key.split('-'));
    const samples = sideSampleCenters(expectedAlphaBounds);
    for (const [side, [x, y]] of Object.entries(samples).filter(([side]) => side !== 'center')) {
      const waterCount = countTransparentTerrainNear(rgba, plains.rgba, width, height, x, y);
      if (connectedSides.has(side)) {
        assert.ok(waterCount >= 280, `${key} missing ${side} transparent water port`);
      } else {
        assert.ok(waterCount <= 8, `${key} leaks transparent water into ${side} port`);
      }
    }
    const [centerX, centerY] = samples.center;
    const transparentCenter = countTransparentTerrainNear(rgba, plains.rgba, width, height, centerX, centerY, 18);
    const isStraight = key === 'nw-ne' || key === 'se-sw';
    if (isStraight) {
      assert.ok(transparentCenter <= 8, `${key} should not create a center patch`);
    } else {
      assert.ok(transparentCenter >= 700, `${key} missing transparent center water`);
    }
  }
});

test('ocean template assets share the same diamond alpha bounds as terrain tiles', () => {
  const plainsFile = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-plains.png');
  const { width, height, rgba } = readPngRgba(fs.readFileSync(plainsFile));
  const expectedBounds = getPixelBounds(rgba, width, height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedBounds);
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'ocean-template');
  for (const key of [...oceanTemplateKeys, ...oceanMouthTemplateKeys]) {
    const file = path.join(templateDir, `tile-ocean-template-${key}.png`);
    const image = readPngRgba(fs.readFileSync(file));
    const alphaBounds = getPixelBounds(image.rgba, image.width, image.height, (red, green, blue, alpha) => alpha > 32);
    assert.deepEqual(
      {
        minX: alphaBounds.minX,
        minY: alphaBounds.minY,
        maxX: alphaBounds.maxX,
        maxY: alphaBounds.maxY,
      },
      {
        minX: expectedBounds.minX,
        minY: expectedBounds.minY,
        maxX: expectedBounds.maxX,
        maxY: expectedBounds.maxY,
      },
      key
    );
  }
});

test('ocean mouth template set covers every coastal side variant', () => {
  const expectedMouthKeys = riverTemplateKeys.flatMap((key) => key.split('-').map((side) => `${key}-mouth-${side}`));
  assert.deepEqual([...oceanMouthTemplateKeys].sort(), expectedMouthKeys.sort());
});

test('water loop textures are seamless on opposite edges', () => {
  const files = ['tile-water-river-loop.png', 'tile-water-ocean-loop.png'];
  for (const name of files) {
    const file = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', name);
    const { width, height, rgba } = readPngRgba(fs.readFileSync(file));
    assert.equal(width, 256, name);
    assert.equal(height, 256, name);
    let horizontalDelta = 0;
    let verticalDelta = 0;
    for (let y = 0; y < height; y += 1) {
      const left = (y * width) * 4;
      const right = (y * width + width - 1) * 4;
      horizontalDelta += Math.abs(rgba[left] - rgba[right]);
      horizontalDelta += Math.abs(rgba[left + 1] - rgba[right + 1]);
      horizontalDelta += Math.abs(rgba[left + 2] - rgba[right + 2]);
    }
    for (let x = 0; x < width; x += 1) {
      const top = x * 4;
      const bottom = ((height - 1) * width + x) * 4;
      verticalDelta += Math.abs(rgba[top] - rgba[bottom]);
      verticalDelta += Math.abs(rgba[top + 1] - rgba[bottom + 1]);
      verticalDelta += Math.abs(rgba[top + 2] - rgba[bottom + 2]);
    }
    assert.ok(horizontalDelta / height < 36, `${name} horizontal seam too visible`);
    assert.ok(verticalDelta / width < 36, `${name} vertical seam too visible`);
  }
});
