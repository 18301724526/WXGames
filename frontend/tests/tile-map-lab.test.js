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
const oceanTemplateKeys = ['full'];
const coastTemplateKeys = riverTemplateKeys;
const coastCornerTemplateKeys = ['n', 'e', 's', 'w'];
const transitionTemplateKeys = riverTemplateKeys;
const coastalRiverTemplateKeys = coastTemplateKeys.flatMap((coastKey) => riverTemplateKeys.map((riverKey) => `coast-${coastKey}-river-${riverKey}`));

test('tile map lab is an art-resource stitching page', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  const staticArtAssets = [
    'tile-map/tile-terrain-plains.png',
    'tile-map/tile-terrain-beach.png',
    'tile-map/tile-terrain-desert.png',
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
    ...coastTemplateKeys.map((key) => `tile-map/coast-template/tile-coast-template-${key}.png`),
    ...coastCornerTemplateKeys.map((key) => `tile-map/coast-corner-template/tile-coast-corner-template-${key}.png`),
    ...transitionTemplateKeys.map((key) => `tile-map/transition-template/tile-transition-plains-desert-${key}.png`),
    'world-site-camp-cutout.png',
    'world-site-city-cutout.png',
    'world-site-outpost-cutout.png',
    'world-site-ruins-cutout.png',
    'world-site-town-cutout.png',
  ];
  const generatedArtAssets = [
    ...coastalRiverTemplateKeys.map((key) => `tile-map/coastal-river-template/tile-coastal-river-${key}.png`),
  ];

  assert.match(html, /<canvas id="tileCanvas"/);
  assert.match(html, /tile-map-lab\.js\?v=0\.1\.182-coast-corner-template-v1/);
  assert.match(html, /id="mapPreset"/);
  assert.match(html, /id="animateWater"/);
  assert.match(js, /ASSET_ROOT = '\.\.\/assets\/art\/'/);
  assert.match(js, /tile-map\/tile-terrain-plains\.png/);
  assert.match(js, /tile-map\/tile-terrain-beach\.png/);
  assert.match(js, /tile-map\/tile-terrain-desert\.png/);
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
  assert.doesNotMatch(js, /OCEAN_MOUTH_TEMPLATE_ASSETS/);
  assert.match(js, /COAST_TEMPLATE_ASSETS/);
  assert.match(js, /tile-map\/coast-template\/tile-coast-template-/);
  assert.match(js, /COAST_CORNER_TEMPLATE_ASSETS/);
  assert.match(js, /tile-map\/coast-corner-template\/tile-coast-corner-template-/);
  assert.match(js, /getCoastCornerKeys/);
  assert.match(js, /drawCoastCornerOverlays/);
  assert.match(js, /drawCoastCornerWaterToLayer/);
  assert.match(js, /TERRAIN_TRANSITION_TEMPLATE_ASSETS/);
  assert.match(js, /tile-map\/transition-template\/tile-transition-plains-desert-/);
  assert.match(js, /COASTAL_RIVER_TEMPLATE_ASSETS/);
  assert.match(js, /tile-map\/coastal-river-template\/tile-coastal-river-/);
  assert.match(js, /mapPreset: 'micro'/);
  assert.match(js, /MICRO_RIVER_PATHS/);
  assert.match(js, /MICRO_OCEAN_OVERRIDES/);
  assert.match(js, /OCEAN_SIDE_DIRECTIONS/);
  assert.match(js, /findCoastalRiverTarget/);
  assert.match(js, /addCoastalRiverOutletConnection/);
  assert.match(js, /createMicroRiverConnections/);
  assert.match(js, /getRiverPorts/);
  assert.match(js, /getCoastPorts/);
  assert.match(js, /getCoastTemplateKey/);
  assert.match(js, /getCoastTemplateAsset/);
  assert.match(js, /getTerrainTransitionTemplateKey/);
  assert.match(js, /getCoastalRiverTemplateKey/);
  assert.match(js, /getTileTemplateAsset/);
  assert.match(js, /getOceanTemplateKey/);
  assert.doesNotMatch(js, /getOceanMouthSide|getOceanTemplateVariantKey/);
  assert.match(js, /getOceanTemplateAsset/);
  assert.match(js, /return tile\.terrain === 'ocean' \? 'full' : ''/);
  assert.match(js, /return OCEAN_TEMPLATE_ASSETS\.full/);
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
  assert.doesNotMatch(js, /effectiveOceanMouthTemplates/);
  assert.match(js, /effectiveCoastTemplates/);
  assert.match(js, /effectiveCoastCornerTemplates/);
  assert.match(js, /effectiveTerrainTransitions/);
  assert.match(js, /effectiveCoastalRiverTemplates/);
  assert.match(js, /oceanTiles/);
  assert.match(js, /coastalRiverTiles/);
  assert.match(js, /coastCornerTiles/);
  assert.doesNotMatch(js, /riverMouthLandTiles/);
  assert.match(js, /beachTiles/);
  assert.match(js, /desertTiles/);
  assert.match(js, /terrainTransitionTiles/);
  assert.match(js, /landCoastTiles/);
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
  assert.match(js, /getOceanTemplateAsset\(tile\)[\s\S]*getCoastalRiverTemplateAsset\(tile\)[\s\S]*getRiverTemplateAsset\(tile\)[\s\S]*getCoastTemplateAsset\(tile\)[\s\S]*getTerrainTransitionTemplateAsset\(tile\)/);
  assert.match(js, /\.filter\(\(item\) => !isOceanCoord\(item\.q, item\.r, radius\)\)/);
  assert.match(js, /getTemplateDrawMetrics/);
  assert.match(js, /templateAsset \? getTemplateDrawMetrics\(templateAsset\) : tileSize\.metrics/);
  assert.match(js, /\.filter\(\(item\) => !isRiverBlockedCoord\(item\.q, item\.r\)\)/);
  assert.doesNotMatch(js, /territory-plains-cutout|territory-forest-cutout|territory-hills-cutout|territory-ruins-cutout/);
  assert.doesNotMatch(js, /drawRiverSegments|drawRiverSegmentBetween|drawTiledRiverStrip|drawRiverWaterCaps|shouldDrawRiverJunction|drawRiverNode/);
  assert.doesNotMatch(js, /riverNodeCap|getRiverPiece|tile-river-node-cap|tile-river-straight-water|tile-river-junction-water/);
  assert.doesNotMatch(js, /createRiverGeometryWaterMask|RIVER_TEMPLATE_FILE_KEYS|getTemplateSidePoints/);
  assert.doesNotMatch(js, /tile-river-template-ai-/);
  assert.doesNotMatch(js, /isOceanPaddingCoord|isPadding|oceanPaddingTiles/);

  for (const asset of staticArtAssets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', ...asset.split('/'))), true, asset);
    assert.match(js, new RegExp(asset.replace('.', '\\.')));
  }
  for (const asset of generatedArtAssets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', ...asset.split('/'))), true, asset);
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

function cornerSampleCenters(alphaBounds) {
  const centerX = (alphaBounds.minX + alphaBounds.maxX) * 0.5;
  const centerY = (alphaBounds.minY + alphaBounds.maxY) * 0.5;
  const halfW = (alphaBounds.maxX - alphaBounds.minX) * 0.5;
  const halfH = (alphaBounds.maxY - alphaBounds.minY) * 0.5;
  return {
    n: [Math.round(centerX), Math.round(centerY - halfH * 0.78)],
    e: [Math.round(centerX + halfW * 0.78), Math.round(centerY)],
    s: [Math.round(centerX), Math.round(centerY + halfH * 0.78)],
    w: [Math.round(centerX - halfW * 0.78), Math.round(centerY)],
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

function assertSameAlphaBounds(file, expectedBounds, label) {
  const image = readPngRgba(fs.readFileSync(file));
  const alphaBounds = getPixelBounds(image.rgba, image.width, image.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(alphaBounds, label);
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
    label
  );
  return image;
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
  for (const key of oceanTemplateKeys) {
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

test('land coast templates share terrain alpha bounds and carry water on declared sides', () => {
  const plainsFile = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-plains.png');
  const plains = readPngRgba(fs.readFileSync(plainsFile));
  const expectedBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedBounds);
  const samples = sideSampleCenters(expectedBounds);
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'coast-template');
  for (const key of coastTemplateKeys) {
    const file = path.join(templateDir, `tile-coast-template-${key}.png`);
    const { width, height, rgba } = readPngRgba(fs.readFileSync(file));
    const alphaBounds = getPixelBounds(rgba, width, height, (red, green, blue, alpha) => alpha > 32);
    const waterBounds = getPixelBounds(rgba, width, height, isWaterPixel);
    assert.ok(waterBounds, key);
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
    const connectedSides = new Set(key.split('-'));
    for (const [side, [x, y]] of Object.entries(samples).filter(([side]) => side !== 'center')) {
      const waterCount = countWaterNear(rgba, width, height, x, y, 18);
      if (connectedSides.has(side)) {
        assert.ok(waterCount >= 420, `${key} missing ${side} ocean water edge`);
      } else {
        assert.ok(waterCount <= 120, `${key} leaks ocean water into ${side} land edge`);
      }
    }
  }
});

test('land coast corner templates add water only near declared diamond corners', () => {
  const plainsFile = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-plains.png');
  const plains = readPngRgba(fs.readFileSync(plainsFile));
  const expectedBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedBounds);
  const corners = cornerSampleCenters(expectedBounds);
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'coast-corner-template');
  for (const key of coastCornerTemplateKeys) {
    const file = path.join(templateDir, `tile-coast-corner-template-${key}.png`);
    const image = readPngRgba(fs.readFileSync(file));
    const alphaBounds = getPixelBounds(image.rgba, image.width, image.height, (red, green, blue, alpha) => alpha > 32);
    const waterBounds = getPixelBounds(image.rgba, image.width, image.height, isWaterPixel);
    assert.ok(alphaBounds, key);
    assert.ok(waterBounds, key);
    const [cornerX, cornerY] = corners[key];
    assert.ok(countWaterNear(image.rgba, image.width, image.height, cornerX, cornerY, 26) >= 120, `${key} missing corner water`);
    for (const [otherKey, [x, y]] of Object.entries(corners)) {
      if (otherKey === key) continue;
      assert.ok(countWaterNear(image.rgba, image.width, image.height, x, y, 22) <= 30, `${key} leaks water into ${otherKey} corner`);
    }
  }
});

test('new beach, desert, and plains-desert transition templates use real terrain alpha bounds', () => {
  const tileMapDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map');
  const plains = readPngRgba(fs.readFileSync(path.join(tileMapDir, 'tile-terrain-plains.png')));
  const expectedBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedBounds);
  for (const name of ['tile-terrain-beach.png', 'tile-terrain-desert.png']) {
    assertSameAlphaBounds(path.join(tileMapDir, name), expectedBounds, name);
  }
  const samples = sideSampleCenters(expectedBounds);
  const transitionDir = path.join(tileMapDir, 'transition-template');
  for (const key of transitionTemplateKeys) {
    const file = path.join(transitionDir, `tile-transition-plains-desert-${key}.png`);
    const image = assertSameAlphaBounds(file, expectedBounds, key);
    const connectedSides = new Set(key.split('-'));
    for (const [side, [x, y]] of Object.entries(samples).filter(([side]) => side !== 'center')) {
      let warmCount = 0;
      for (let sampleY = y - 18; sampleY <= y + 18; sampleY += 1) {
        for (let sampleX = x - 18; sampleX <= x + 18; sampleX += 1) {
          if (sampleX < 0 || sampleY < 0 || sampleX >= image.width || sampleY >= image.height) continue;
          const index = (sampleY * image.width + sampleX) * 4;
          if (image.rgba[index + 3] > 32 && image.rgba[index] > image.rgba[index + 2] + 42) warmCount += 1;
        }
      }
      if (connectedSides.has(side)) {
        assert.ok(warmCount >= 250, `${key} missing warm desert transition on ${side}`);
      }
    }
  }
});

test('coastal river templates combine coast ports and river ports as full specification', () => {
  const tileMapDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map');
  const plains = readPngRgba(fs.readFileSync(path.join(tileMapDir, 'tile-terrain-plains.png')));
  const expectedBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedBounds);
  const samples = sideSampleCenters(expectedBounds);
  const templateDir = path.join(tileMapDir, 'coastal-river-template');
  assert.equal(coastalRiverTemplateKeys.length, 225);
  for (const key of coastalRiverTemplateKeys) {
    const image = assertSameAlphaBounds(path.join(templateDir, `tile-coastal-river-${key}.png`), expectedBounds, key);
    const [, coastKey, riverKey] = key.match(/^coast-(.+)-river-(.+)$/);
    const coastSides = new Set(coastKey.split('-'));
    const riverSides = new Set(riverKey.split('-'));
    for (const side of coastSides) {
      const [x, y] = samples[side];
      const waterCount = countWaterNear(image.rgba, image.width, image.height, x, y, 18);
      const transparentCount = countTransparentTerrainNear(image.rgba, plains.rgba, image.width, image.height, x, y, 18);
      assert.ok(waterCount + transparentCount >= 240, `${key} missing coast or river water opening on ${side}`);
    }
    for (const side of riverSides) {
      const [x, y] = samples[side];
      const transparentCount = countTransparentTerrainNear(image.rgba, plains.rgba, image.width, image.height, x, y, 18);
      assert.ok(transparentCount >= 240, `${key} missing transparent river port on ${side}`);
    }
  }
});

test('ocean rendering delegates coastlines to land coast templates', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /function getOceanTemplateKey\(tile\) \{\s*return tile\.terrain === 'ocean' \? 'full' : '';\s*\}/);
  assert.match(js, /function getOceanTemplateAsset\(tile\) \{\s*if \(tile\.terrain !== 'ocean'\) return null;\s*return OCEAN_TEMPLATE_ASSETS\.full;\s*\}/);
  assert.doesNotMatch(js, /OCEAN_MOUTH_TEMPLATE_ASSETS|getOceanMouthSide|getOceanTemplateVariantKey|findRiverMouthTarget|addRiverMouthConnection|riverMouthLandTiles|riverMouthOceanTiles/);
  assert.match(js, /function getRiverPorts\(tile\)[\s\S]*RIVER_TEMPLATE_DIRECTION_SIDES/);
  assert.match(js, /function getCoastPorts\(tile\)[\s\S]*getOceanNeighborSides\(tile\)/);
  assert.match(js, /function getCoastalRiverTemplateKey\(tile\)[\s\S]*getCoastPorts\(tile\)[\s\S]*getRiverPorts\(tile\)/);
  assert.doesNotMatch(js, /function getCoastalRiverTemplateKey\(tile\)[\s\S]*getLandCoastSides\(\{ \.\.\.tile/);
  assert.match(js, /if \(kind === 'coastal-river'\)[\s\S]*'ocean'[\s\S]*'river'/);
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
