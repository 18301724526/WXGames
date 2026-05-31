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
const transitionTemplateKeys = riverTemplateKeys;
const oceanWaterTemplateFiles = ['tile-ocean-water-full.png'];
const oceanShoreEdgeTemplateFiles = [
  'tile-ocean-shore-edge-nw.png',
  'tile-ocean-shore-edge-ne.png',
  'tile-ocean-shore-edge-se.png',
  'tile-ocean-shore-edge-sw.png',
  'tile-ocean-shore-edges-nw-ne.png',
  'tile-ocean-shore-edges-ne-se.png',
  'tile-ocean-shore-edges-se-sw.png',
  'tile-ocean-shore-edges-nw-sw.png',
];
const oceanShoreCornerTemplateFiles = [
  'tile-ocean-shore-corner-n.png',
  'tile-ocean-shore-corner-e.png',
  'tile-ocean-shore-corner-s.png',
  'tile-ocean-shore-corner-w.png',
];
const oceanRiverMouthTemplateFiles = [
  'tile-ocean-river-mouth-nw.png',
  'tile-ocean-river-mouth-ne.png',
  'tile-ocean-river-mouth-se.png',
  'tile-ocean-river-mouth-sw.png',
];
const oceanRiverMouthRiverTemplateKeys = {
  nw: 'nw-se',
  ne: 'ne-sw',
  se: 'nw-se',
  sw: 'ne-sw',
};
const oceanTemplateFiles = [
  ...oceanWaterTemplateFiles,
  ...oceanShoreEdgeTemplateFiles,
  ...oceanRiverMouthTemplateFiles,
  ...oceanShoreCornerTemplateFiles,
];

test('tile map lab is an art-resource stitching page', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  const artAssets = [
    'tile-map/tile-terrain-plains.png',
    'tile-map/tile-terrain-desert.png',
    'tile-map/tile-terrain-forest.png',
    'tile-map/tile-terrain-hills.png',
    'tile-map/tile-terrain-river.png',
    'tile-map/tile-terrain-waste.png',
    'tile-map/tile-terrain-mountain.png',
    'tile-map/tile-feature-tree-cluster.png',
    'tile-map/tile-feature-mountain-ridge.png',
    'tile-map/tile-water-river-loop.png',
    ...riverTemplateKeys.map((key) => `tile-map/river-template/tile-river-bank-uv-${key}.png`),
    ...oceanTemplateFiles.map((file) => `tile-map/ocean-template/${file}`),
    ...transitionTemplateKeys.map((key) => `tile-map/transition-template/tile-transition-plains-desert-${key}.png`),
    'tile-map/tile-water-ocean-loop.png',
    'world-site-camp-cutout.png',
    'world-site-city-cutout.png',
    'world-site-outpost-cutout.png',
    'world-site-ruins-cutout.png',
    'world-site-town-cutout.png',
  ];

  assert.match(html, /<canvas id="tileCanvas"/);
  assert.match(html, /tile-map-lab\.js\?v=local-overlay-calibration-v21/);
  assert.match(html, /overlay-calibration/);
  assert.match(html, /id="overlayOffsetTarget"/);
  assert.match(html, /id="overlayOffsetX"/);
  assert.match(html, /id="overlayOffsetY"/);
  assert.match(html, /ocean-missing-11/);
  assert.match(js, /ASSET_ROOT = '\.\.\/assets\/art\/'/);
  assert.match(js, /tile-map\/tile-terrain-plains\.png/);
  assert.match(js, /tile-map\/tile-terrain-desert\.png/);
  assert.match(js, /imageMetrics = new Map/);
  assert.match(js, /analyzeAlphaBounds/);
  assert.match(js, /getTileDrawSize/);
  assert.match(js, /syncGridToEffectiveTile/);
  assert.match(js, /effectiveTile/);
  assert.match(js, /FEATURE_ASSETS/);
  assert.match(js, /WATER_TEXTURE_ASSETS/);
  assert.match(js, /tile-map\/tile-water-river-loop\.png/);
  assert.match(js, /tile-map\/tile-water-ocean-loop\.png/);
  assert.match(js, /createTransparentRiverWaterMask/);
  assert.match(js, /drawWaterToLayer/);
  assert.match(js, /fillLoopWaterTexture/);
  assert.match(js, /RIVER_TEMPLATE_ASSETS/);
  assert.match(js, /tile-map\/river-template\/tile-river-bank-uv-/);
  assert.match(js, /OCEAN_TEMPLATE_ASSETS/);
  assert.match(js, /OCEAN_WATER_TEMPLATE_ASSETS/);
  assert.match(js, /OCEAN_SHORE_EDGE_ASSETS/);
  assert.match(js, /OCEAN_SHORE_CORNER_ASSETS/);
  assert.match(js, /OCEAN_RIVER_MOUTH_ASSETS/);
  assert.match(js, /OCEAN_TEMPLATE_SAMPLE_IDS/);
  assert.match(js, /drawOceanTemplateLegend/);
  assert.match(js, /tile-map\/ocean-template\/tile-ocean-water-full\.png/);
  assert.match(js, /tile-map\/ocean-template\/tile-ocean-shore-edge-/);
  assert.match(js, /tile-map\/ocean-template\/tile-ocean-shore-edges-/);
  assert.match(js, /tile-map\/ocean-template\/tile-ocean-shore-corner-/);
  assert.match(js, /tile-map\/ocean-template\/tile-ocean-river-mouth-/);
  assert.doesNotMatch(js, /tile-map\/ocean-template\/tile-ocean-bank-uv-/);
  assert.match(js, /OCEAN_LAB_CORE_TILE_IDS/);
  assert.match(js, /OCEAN_REFERENCE_FULL_NUMBERS/);
  assert.match(js, /OCEAN_SHORE_EDGE_BY_CORE_OFFSET/);
  assert.match(js, /chooseOceanTemplates/);
  assert.match(js, /OCEAN_COMBO_CORE_TILE_IDS/);
  assert.match(js, /getRiverTemplateKey/);
  assert.match(js, /getRiverTemplateAsset/);
  assert.match(js, /RIVER_DIRECTIONS/);
  assert.match(js, /RIVER_TEMPLATE_DIRECTION_SIDES/);
  assert.match(js, /RIVER_TEMPLATE_DIRECTION_INDICES/);
  assert.match(js, /MICRO_RIVER_PATHS/);
  assert.match(js, /createMicroRiverConnections/);
  assert.match(js, /getRiverPorts/);
  assert.match(js, /getTerrainTransitionTemplateKey/);
  assert.match(js, /getTileTemplateAsset/);
  assert.match(js, /hasRiverNearby/);
  assert.match(js, /isRiverBlockedCoord/);
  assert.match(js, /createRiverConnections/);
  assert.match(js, /buildRiverPath/);
  assert.match(js, /addRiverConnection/);
  assert.match(js, /riverConnections = createRiverConnections/);
  assert.match(js, /getRiverConnections/);
  assert.doesNotMatch(js, /pond|choosePond|drawPond|tile-feature-pond|feature:pond|pondTiles/);
  assert.match(js, /drawRiverTemplatePorts/);
  assert.match(js, /effectiveTerrainTransitions/);
  assert.match(js, /desertTiles/);
  assert.match(js, /terrainTransitionTiles/);
  assert.match(js, /effectiveFeatures/);
  assert.match(js, /OVERLAY_OFFSET_TARGETS/);
  assert.match(js, /OVERLAY_CALIBRATION_TILES/);
  assert.match(js, /function buildOverlayCalibrationTiles\(\)/);
  assert.match(js, /function isOverlayCalibrationPreset\(\)/);
  assert.match(js, /drawOverlayCalibrationSelection/);
  assert.match(js, /selectedOverlayOffsetTarget/);
  assert.match(js, /overlayOffsets/);
  assert.match(js, /function getOverlayAnchor\(tile, targetKey\)/);
  assert.match(js, /projected\.x \+ offset\.x \* state\.zoom/);
  assert.match(js, /projected\.y \+ offset\.y \* state\.zoom/);
  assert.match(js, /getOverlayAnchor\(tile, `site:\$\{tile\.site\.type\}`\)/);
  assert.match(js, /getOverlayAnchor\(tile, 'feature:treeCluster'\)/);
  assert.match(js, /getOverlayAnchor\(tile, 'feature:mountainRidge'\)/);
  assert.match(js, /getOverlayAnchor\(tile, `terrain:\$\{tile\.terrain\}`\)/);
  assert.match(js, /const isCalibration = isOverlayCalibrationPreset\(\);/);
  assert.match(js, /const count = isCalibration \? 1 :/);
  assert.match(js, /const jitterX = isCalibration \? 0 :/);
  assert.match(js, /effectiveWaterTextures/);
  assert.match(js, /waterMaskTemplates/);
  assert.match(js, /valueNoise/);
  assert.match(js, /drawTerrainFeature/);
  assert.match(js, /TERRAIN_FEATURES/);
  assert.match(js, /drawRegionTint/);
  assert.match(js, /pointerdown/);
  assert.match(js, /wheel/);
  assert.match(js, /if \(hasRiverNearby\(q, r, 1\)\) return null;/);
  assert.match(js, /if \(!isCalibration && hasRiverNearby\(tile\.q, tile\.r, 1\)\) return;/);
  assert.match(js, /getRiverTemplateAsset\(tile\)[\s\S]*getTerrainTransitionTemplateAsset\(tile\)/);
  assert.match(js, /templateAsset \? getTemplateDrawMetrics\(templateAsset\) : tileSize\.metrics/);
  assert.match(js, /\.filter\(\(item\) => !isRiverBlockedCoord\(item\.q, item\.r\)\)/);
  assert.doesNotMatch(js, /coastal|tile-terrain-beach/);
  assert.doesNotMatch(js, /drawRiverSegments|drawRiverSegmentBetween|drawTiledRiverStrip|drawRiverWaterCaps|shouldDrawRiverJunction|drawRiverNode/);
  assert.doesNotMatch(js, /riverNodeCap|getRiverPiece|tile-river-node-cap|tile-river-straight-water|tile-river-junction-water/);
  assert.doesNotMatch(js, /createRiverGeometryWaterMask|RIVER_TEMPLATE_FILE_KEYS|getTemplateSidePoints/);
  assert.doesNotMatch(js, /tile-river-template-ai-/);

  for (const asset of artAssets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', ...asset.split('/'))), true, asset);
    assert.match(js, new RegExp(asset.replace('.', '\\.')));
  }

  const removedAssetDirs = [
    'coast-template',
    'coast-shape-template',
    'coastal-river-template',
    'coastal-river-shape-template',
    'river-mouth-template',
  ];
  for (const dir of removedAssetDirs) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', dir)), false, dir);
  }
  assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-beach.png')), false);
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

function assertStandardIsoBounds(bounds, label) {
  assert.equal(bounds.maxX - bounds.minX + 1, 424, `${label} standard iso width`);
  assert.equal(bounds.maxY - bounds.minY + 1, 212, `${label} standard iso height`);
  assert.equal(bounds.maxY - bounds.minY + 1, (bounds.maxX - bounds.minX + 1) / 2, `${label} must be 2:1 iso`);
}

test('river bank UV templates keep transparent water ports on standard template shapes', () => {
  const plainsFile = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-plains.png');
  const plains = readPngRgba(fs.readFileSync(plainsFile));
  const expectedAlphaBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assertStandardIsoBounds(expectedAlphaBounds, 'plains');
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

test('desert and plains-desert transition templates use real terrain alpha bounds', () => {
  const tileMapDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map');
  const plains = readPngRgba(fs.readFileSync(path.join(tileMapDir, 'tile-terrain-plains.png')));
  const expectedBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedBounds);
  assertStandardIsoBounds(expectedBounds, 'plains');
  for (const name of ['tile-terrain-desert.png']) {
    assertSameAlphaBounds(path.join(tileMapDir, name), expectedBounds, name);
  }
  const samples = sideSampleCenters(expectedBounds);
  const transitionDir = path.join(tileMapDir, 'transition-template');
  for (const key of transitionTemplateKeys) {
    const file = path.join(transitionDir, `tile-transition-plains-desert-${key}.png`);
    const image = assertSameAlphaBounds(file, expectedBounds, key);
    const alphaBounds = getPixelBounds(image.rgba, image.width, image.height, (red, green, blue, alpha) => alpha > 32);
    assertStandardIsoBounds(alphaBounds, key);
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

test('water loop textures are seamless on opposite edges', () => {
  const files = ['tile-water-river-loop.png'];
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

test('ocean lab templates keep standard tile alpha bounds and transparent water cuts', () => {
  const plainsFile = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'tile-terrain-plains.png');
  const plains = readPngRgba(fs.readFileSync(plainsFile));
  const expectedAlphaBounds = getPixelBounds(plains.rgba, plains.width, plains.height, (red, green, blue, alpha) => alpha > 32);
  assert.ok(expectedAlphaBounds);
  assertStandardIsoBounds(expectedAlphaBounds, 'plains');
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'ocean-template');
  for (const templateFile of oceanTemplateFiles) {
    const file = path.join(templateDir, templateFile);
    const { width, height, rgba } = readPngRgba(fs.readFileSync(file));
    const alphaBounds = getPixelBounds(rgba, width, height, (red, green, blue, alpha) => alpha > 32);
    const waterBounds = getPixelBounds(rgba, width, height, isWaterPixel);
    assert.equal(waterBounds, null, `${templateFile} should not contain baked blue ocean`);
    if (templateFile === 'tile-ocean-water-full.png') {
      assert.equal(alphaBounds, null, 'full ocean tile should be fully transparent so UV water owns the tile');
      continue;
    }
    assert.ok(alphaBounds, templateFile);
    assertStandardIsoBounds(alphaBounds, templateFile);
    assert.equal(width, plains.width, templateFile);
    assert.equal(height, plains.height, templateFile);
    assert.ok(alphaBounds.minX >= expectedAlphaBounds.minX, templateFile);
    assert.ok(alphaBounds.minY >= expectedAlphaBounds.minY, templateFile);
    assert.ok(alphaBounds.maxX <= expectedAlphaBounds.maxX, templateFile);
    assert.ok(alphaBounds.maxY <= expectedAlphaBounds.maxY, templateFile);
  }
});

test('ocean river mouth templates are shore edges with straight river cutouts', () => {
  const tileMapDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map');
  const oceanDir = path.join(tileMapDir, 'ocean-template');
  const riverDir = path.join(tileMapDir, 'river-template');
  const plains = readPngRgba(fs.readFileSync(path.join(tileMapDir, 'tile-terrain-plains.png')));
  const transparentTerrainMask = (image) => image.rgba.map((value, index) => {
    if (index % 4 !== 3) return 0;
    return plains.rgba[index] > 32 && value <= 8 ? 1 : 0;
  });
  const countOverlap = (a, b) => a.reduce((sum, value, index) => sum + (value && b[index] ? 1 : 0), 0);
  const countMask = (mask) => mask.reduce((sum, value) => sum + value, 0);
  for (const [side, riverKey] of Object.entries(oceanRiverMouthRiverTemplateKeys)) {
    const mouth = readPngRgba(fs.readFileSync(path.join(oceanDir, `tile-ocean-river-mouth-${side}.png`)));
    const shore = readPngRgba(fs.readFileSync(path.join(oceanDir, `tile-ocean-shore-edge-${side}.png`)));
    const river = readPngRgba(fs.readFileSync(path.join(riverDir, `tile-river-bank-uv-${riverKey}.png`)));
    const mouthMask = transparentTerrainMask(mouth);
    const shoreMask = transparentTerrainMask(shore);
    const riverMask = transparentTerrainMask(river);
    const shoreCount = countMask(shoreMask);
    const riverCount = countMask(riverMask);
    assert.ok(shoreCount > 2000, `${side} shore edge should expose ocean cutout`);
    assert.ok(riverCount > 2000, `${riverKey} river template should expose a straight river cutout`);
    assert.ok(countOverlap(mouthMask, shoreMask) >= shoreCount * 0.96, `${side} mouth missing shore-edge ocean cutout`);
    assert.ok(countOverlap(mouthMask, riverMask) >= riverCount * 0.96, `${side} mouth missing ${riverKey} river cutout`);
    assert.ok(countMask(mouthMask) > Math.max(shoreCount, riverCount) * 1.12, `${side} mouth should be more than only shore or only river`);
  }
});

test('ocean shoreline files use water, edge, river mouth, and corner roles only', () => {
  const templateDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'tile-map', 'ocean-template');
  const actualFiles = fs.readdirSync(templateDir).sort();
  assert.deepEqual(actualFiles, oceanTemplateFiles.slice().sort());
  assert.equal(oceanTemplateFiles.length, 17);
  assert.equal(oceanWaterTemplateFiles.length, 1);
  assert.equal(oceanShoreEdgeTemplateFiles.length, 8);
  assert.equal(oceanRiverMouthTemplateFiles.length, 4);
  assert.equal(oceanShoreCornerTemplateFiles.length, 4);
  for (const file of oceanTemplateFiles) {
    assert.doesNotMatch(file, /bank-uv/);
    assert.doesNotMatch(file, /nw-se|ne-sw|nw-ne-se|nw-ne-sw|nw-se-sw|ne-se-sw|nw-ne-se-sw/);
  }
});

test('ocean template selection keeps diagonal corners separate from side masks', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /const OCEAN_CORNER_BY_CORE_OFFSET = \{/);
  assert.match(js, /'1,1': 'corner-n'/);
  assert.match(js, /'-1,1': 'corner-e'/);
  assert.match(js, /'-1,-1': 'corner-s'/);
  assert.match(js, /'1,-1': 'corner-w'/);
  assert.match(js, /const OCEAN_SHORE_EDGE_ASSETS = \{/);
  assert.match(js, /const OCEAN_SHORE_CORNER_ASSETS = \{/);
  assert.match(js, /const OCEAN_RIVER_MOUTH_ASSETS = \{/);
  assert.match(js, /'-1,0': 'nw'/);
  assert.match(js, /'0,-1': 'ne'/);
  assert.match(js, /'1,0': 'se'/);
  assert.match(js, /'0,1': 'sw'/);
  assert.doesNotMatch(js, /'-1,0': \['nw'\]/);
  assert.doesNotMatch(js, /'0,-1': \['ne'\]/);
  assert.doesNotMatch(js, /'1,0': \['se'\]/);
  assert.doesNotMatch(js, /'0,1': \['sw'\]/);
  assert.match(js, /templates\.push\(\.\.\.getOceanShoreEdgeOrRiverMouthTemplateKeys\(q, r, adjacentOceanSides\)\);/);
  assert.match(js, /for \(const corner of getAdjacentOceanCorners\(q, r\)\)/);
  assert.match(js, /return templates;/);
  assert.doesNotMatch(js, /'-1,-1': \['nw-ne'\]/);
  assert.doesNotMatch(js, /'1,-1': \['ne-se'\]/);
  assert.doesNotMatch(js, /'1,1': \['se-sw'\]/);
  assert.doesNotMatch(js, /'-1,1': \['nw-sw'\]/);
  assert.doesNotMatch(js, /tile-ocean-bank-uv/);
  assert.doesNotMatch(js, /tile-ocean-shore-edges-nw-se/);
  assert.doesNotMatch(js, /tile-ocean-shore-edges-ne-sw/);
});

test('river mouths only attach to single-side ocean shore edges', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /const OCEAN_RIVER_MOUTH_KEYS = \['river-mouth-nw', 'river-mouth-ne', 'river-mouth-se', 'river-mouth-sw'\]/);
  assert.match(js, /const RIVER_MOUTH_INLAND_SIDE_BY_SHORE_SIDE = \{/);
  assert.match(js, /nw: 'se'/);
  assert.match(js, /ne: 'sw'/);
  assert.match(js, /se: 'nw'/);
  assert.match(js, /sw: 'ne'/);
  assert.match(js, /const RIVER_MOUTH_RIVER_TEMPLATE_KEY_BY_SHORE_SIDE = \{/);
  assert.match(js, /nw: 'nw-se'/);
  assert.match(js, /ne: 'ne-sw'/);
  assert.match(js, /se: 'nw-se'/);
  assert.match(js, /sw: 'ne-sw'/);
  assert.match(js, /function getRiverMouthTemplateKey\(q, r, shoreSide\)/);
  assert.match(js, /riverSides\.length === 2 && riverSides\.includes\(shoreSide\) && riverSides\.includes\(inlandSide\)/);
  assert.match(js, /const blocksRiverMouth = isOceanShoreCornerCoord\(q, r\);/);
  assert.match(js, /const mouthKey = !blocksRiverMouth && sides\.length === 1 \? getRiverMouthTemplateKey\(q, r, key\) : '';/);
  assert.match(js, /!blocksRiverMouth && sides\.length === 1/);
  assert.match(js, /return mouthKey && OCEAN_RIVER_MOUTH_ASSETS\[mouthKey\] \? \[mouthKey\] : \[key\];/);
  assert.match(js, /\(state\.mapPreset === 'micro' && isOceanCoreCoord\(neighbor\.q, neighbor\.r\)\)/);
  assert.match(js, /getRiverMouthShoreEdgeAsset\(templateAsset\)/);
  assert.match(js, /getRiverMouthRiverTemplateAsset\(templateAsset\)/);
  assert.match(js, /drawWaterToLayerWithKind\(tile, shoreEdgeAsset, metrics, drawRect\.x, drawRect\.y, drawRect\.width, drawRect\.height, 'ocean'\)/);
  assert.match(js, /drawWaterToLayerWithKind\(tile, riverAsset, metrics, drawRect\.x, drawRect\.y, drawRect\.width, drawRect\.height, 'river'\)/);
  assert.doesNotMatch(js, /river-mouth-nw-ne/);
  assert.doesNotMatch(js, /river-mouth-ne-se/);
  assert.doesNotMatch(js, /river-mouth-se-sw/);
  assert.doesNotMatch(js, /river-mouth-nw-sw/);
});

test('river connections only open at the map boundary', () => {
  const js = fs.readFileSync(jsPath, 'utf8');
  assert.match(js, /function normalizeRiverConnections\(connections, radius\)/);
  assert.match(js, /function isOceanShoreCornerCoord\(q, r\)/);
  assert.match(js, /if \(isOceanShoreCornerCoord\(coord\.q, coord\.r\)\) continue;/);
  assert.match(js, /if \(isOceanShoreCornerCoord\(neighbor\.q, neighbor\.r\)\) continue;/);
  assert.match(js, /const neighborInsideMap = isCoordInRadius\(neighbor\.q, neighbor\.r, radius\)/);
  assert.match(js, /if \(!neighborInsideMap\) \{\s*nextDirs\.add\(directionIndex\);/);
  assert.match(js, /connections\.get\(neighborId\)\?\.has\(oppositeDirection\)/);
  assert.match(js, /return normalizeRiverConnections\(connections, radius\)/);

  const pathBlockMatch = js.match(/const MICRO_RIVER_PATHS = \[([\s\S]*?)\];/);
  assert.ok(pathBlockMatch, 'MICRO_RIVER_PATHS block missing');
  const pathBlock = pathBlockMatch[1];
  const rawConnections = new Map();
  const dirs = [
    { dq: 1, dr: 0 },
    { dq: 1, dr: -1 },
    { dq: 0, dr: -1 },
    { dq: -1, dr: 0 },
    { dq: -1, dr: 1 },
    { dq: 0, dr: 1 },
  ];
  const supportedDirections = new Set([0, 2, 3, 5]);
  const directionBySide = { se: 0, ne: 2, nw: 3, sw: 5 };
  const getId = (q, r) => `tile_${q}_${r}`;
  const addRawConnection = (q, r, directionIndex) => {
    const id = getId(q, r);
    if (!rawConnections.has(id)) rawConnections.set(id, new Set());
    rawConnections.get(id).add(directionIndex);
  };
  const pathMatches = Array.from(pathBlock.matchAll(/path:\s*\[([\s\S]*?)\],\s*outletSide:\s*'([^']*)'/g));
  for (const pathMatch of pathMatches) {
    const tileMatches = Array.from(pathMatch[1].matchAll(/\{\s*q:\s*(-?\d+),\s*r:\s*(-?\d+)\s*\}/g));
    for (let index = 1; index < tileMatches.length; index += 1) {
      const from = { q: Number(tileMatches[index - 1][1]), r: Number(tileMatches[index - 1][2]) };
      const to = { q: Number(tileMatches[index][1]), r: Number(tileMatches[index][2]) };
      const forward = dirs.findIndex((dir) => from.q + dir.dq === to.q && from.r + dir.dr === to.r);
      const backward = dirs.findIndex((dir) => to.q + dir.dq === from.q && to.r + dir.dr === from.r);
      if (forward < 0 || backward < 0) continue;
      addRawConnection(from.q, from.r, forward);
      addRawConnection(to.q, to.r, backward);
    }
    const last = tileMatches[tileMatches.length - 1];
    const outletDirection = directionBySide[pathMatch[2]];
    if (last && outletDirection !== undefined) {
      addRawConnection(Number(last[1]), Number(last[2]), outletDirection);
    }
  }

  const radius = 5;
  const inRadius = (q, r) => {
    const s = -q - r;
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= radius;
  };
  const microOceanCoreBlockMatch = js.match(/const MICRO_OCEAN_CORE_TILE_IDS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(microOceanCoreBlockMatch, 'MICRO_OCEAN_CORE_TILE_IDS block missing');
  const microOceanCores = new Set(
    Array.from(microOceanCoreBlockMatch[1].matchAll(/'tile_(-?\d+)_(-?\d+)'/g))
      .map((match) => getId(Number(match[1]), Number(match[2])))
  );
  const microOceanCornerTiles = new Set();
  for (const coreId of microOceanCores) {
    const [, qText, rText] = /^tile_(-?\d+)_(-?\d+)$/.exec(coreId);
    const q = Number(qText);
    const r = Number(rText);
    for (const [dq, dr] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const cornerQ = q - dq;
      const cornerR = r - dr;
      if (inRadius(cornerQ, cornerR) && !microOceanCores.has(getId(cornerQ, cornerR))) {
        microOceanCornerTiles.add(getId(cornerQ, cornerR));
      }
    }
  }
  const fakeCornerId = Array.from(microOceanCornerTiles).find((id) => {
    const [, qText, rText] = /^tile_(-?\d+)_(-?\d+)$/.exec(id);
    const q = Number(qText);
    const r = Number(rText);
    return dirs.some((dir, directionIndex) => {
      if (!supportedDirections.has(directionIndex)) return false;
      const nq = q + dir.dq;
      const nr = r + dir.dr;
      return inRadius(nq, nr) && !microOceanCores.has(getId(nq, nr));
    });
  });
  assert.ok(fakeCornerId, 'expected at least one testable ocean shore corner tile');
  const [, fakeQText, fakeRText] = /^tile_(-?\d+)_(-?\d+)$/.exec(fakeCornerId);
  const fakeQ = Number(fakeQText);
  const fakeR = Number(fakeRText);
  const fakeDirection = dirs.findIndex((dir, directionIndex) => {
    if (!supportedDirections.has(directionIndex)) return false;
    const nq = fakeQ + dir.dq;
    const nr = fakeR + dir.dr;
    return inRadius(nq, nr) && !microOceanCores.has(getId(nq, nr));
  });
  const fakeNeighbor = { q: fakeQ + dirs[fakeDirection].dq, r: fakeR + dirs[fakeDirection].dr };
  addRawConnection(fakeQ, fakeR, fakeDirection);
  addRawConnection(fakeNeighbor.q, fakeNeighbor.r, (fakeDirection + 3) % 6);
  const normalized = new Map();
  for (const [id, connectionSet] of rawConnections.entries()) {
    const [, qText, rText] = /^tile_(-?\d+)_(-?\d+)$/.exec(id);
    const q = Number(qText);
    const r = Number(rText);
    if (microOceanCornerTiles.has(id)) continue;
    const nextDirs = [];
    for (const directionIndex of connectionSet) {
      if (!supportedDirections.has(directionIndex)) continue;
      const dir = dirs[directionIndex];
      const nq = q + dir.dq;
      const nr = r + dir.dr;
      if (microOceanCornerTiles.has(getId(nq, nr))) continue;
      if (!inRadius(nq, nr)
        || rawConnections.get(getId(nq, nr))?.has((directionIndex + 3) % 6)
        || microOceanCores.has(getId(nq, nr))) {
        nextDirs.push(directionIndex);
      }
    }
    if (nextDirs.length) normalized.set(id, nextDirs.sort((a, b) => a - b));
  }

  for (const [id, connectionList] of normalized.entries()) {
    const [, qText, rText] = /^tile_(-?\d+)_(-?\d+)$/.exec(id);
    const q = Number(qText);
    const r = Number(rText);
    for (const directionIndex of connectionList) {
      const dir = dirs[directionIndex];
      const nq = q + dir.dq;
      const nr = r + dir.dr;
      if (!inRadius(nq, nr) || microOceanCores.has(getId(nq, nr))) continue;
      assert.equal(
        normalized.get(getId(nq, nr))?.includes((directionIndex + 3) % 6),
        true,
        `${id} opens toward interior tile ${getId(nq, nr)} without a matching river port`
      );
      assert.equal(microOceanCornerTiles.has(getId(nq, nr)), false, `${id} opens toward ocean shore corner ${getId(nq, nr)}`);
    }
  }
  for (const cornerId of microOceanCornerTiles) {
    assert.equal(normalized.has(cornerId), false, `${cornerId} must not carry river connections`);
  }
  assert.equal(normalized.has('tile_-6_6'), false, 'western map edge is not a valid two-port river mouth');
  assert.deepEqual(normalized.get('tile_4_2'), [2], 'inland river source should flow into the river mouth');
  assert.deepEqual(normalized.get('tile_4_1'), [2, 5], 'eastern river mouth should keep both inland and ocean ports');
});
