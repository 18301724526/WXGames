const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const projectRoot = path.join(__dirname, '..', '..');
const famousLayerDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'famous-person', 'layers');

function listFamousLayerFiles(pattern) {
  return fs.readdirSync(famousLayerDir).filter((filename) => pattern.test(filename)).sort();
}

function readPngAlphaStats(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  let offset = 8;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === 'IDAT') chunks.push(buffer.subarray(dataStart, dataStart + length));
    if (type === 'IEND') break;
    offset = dataStart + length + 4;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rows = [];
  let cursor = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const scanline = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bytesPerPixel ? scanline[i - bytesPerPixel] : 0;
      const up = previous[i];
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      if (filter === 1) scanline[i] = (scanline[i] + left) & 255;
      else if (filter === 2) scanline[i] = (scanline[i] + up) & 255;
      else if (filter === 3) scanline[i] = (scanline[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        scanline[i] = (scanline[i] + predictor) & 255;
      }
    }
    rows.push(scanline);
    previous = scanline;
  }
  const edgeAlpha = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  let opaquePixels = 0;
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      if (row[x * bytesPerPixel + 3] <= 8) continue;
      opaquePixels += 1;
      if (y === 0) edgeAlpha.top += 1;
      if (x === width - 1) edgeAlpha.right += 1;
      if (y === height - 1) edgeAlpha.bottom += 1;
      if (x === 0) edgeAlpha.left += 1;
    }
  });
  return { width, height, opaquePixels, edgeAlpha };
}

test('famous portrait v2 lab exposes user-cut layer controls', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(html, /名人立绘分层试验台/);
  assert.match(html, /id="globalScale"[^>]*min="0"[^>]*max="200"/);
  assert.match(html, /id="globalX"/);
  assert.match(html, /id="globalY"/);
  assert.match(html, /id="layerList"/);
  assert.match(html, /id="copyExport"/);
  assert.match(html, /id="exportData"/);
  assert.match(html, /直接使用你切好的 PNG 原图/);
  assert.match(html, /<canvas id="stage" width="1120" height="900"><\/canvas>/);
  assert.match(html, /<script src="famous-portrait-lab\.js\?v=0\.1\.139-hair-anchor"><\/script>/);

  assert.match(script, /fp-layer-v2-manifest\.json/);
  assert.match(script, /order: \['outfitBack', 'head', 'hair', 'outfitFront'\]/);
  assert.match(script, /fp-layer-v2-art01-head-base-01\.png/);
  assert.match(script, /fp-layer-v2-art01-hair-bound-topknot-01\.png/);
  assert.match(script, /fp-layer-v2-art01-outfitBack-guardian-01\.png/);
  assert.match(script, /fp-layer-v2-art01-outfitFront-guardian-01\.png/);
  assert.match(script, /data-control="scale" type="range" min="0" max="200"/);
  assert.match(script, /function drawPortrait\(x, y, size, options = \{\}\)/);
  assert.match(script, /游戏头像区域预览/);
  assert.doesNotMatch(script, /frontCutY|backCutY|drawSplitOutfit|fp-layer-outfit-guardian-front-candidate/);
});

test('famous portrait lab keeps desktop controls scroll isolated from preview', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');

  assert.match(html, /html,\s*body\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
  assert.match(html, /\.shell\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*hidden;/);
  assert.match(html, /\.panel\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(html, /\.stage\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(html, /@media \(max-width:\s*900px\)\s*\{[\s\S]*?html,\s*body\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*auto;/);
});

test('famous portrait v2 manifest includes the user-cut resource set', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(famousLayerDir, 'fp-layer-v2-manifest.json'), 'utf8'));
  const files = listFamousLayerFiles(/^fp-layer-v2-.*\.png$/);

  assert.equal(manifest.version, 2);
  assert.equal(manifest.coordinateSize, 512);
  assert.deepEqual(files, [
    'fp-layer-v2-art01-backHair-short-01.png',
    'fp-layer-v2-art01-bangs-short-01.png',
    'fp-layer-v2-art01-body-base-01.png',
    'fp-layer-v2-art01-frontHair-short-01.png',
    'fp-layer-v2-art01-hair-bound-topknot-01.png',
    'fp-layer-v2-art01-head-base-01.png',
    'fp-layer-v2-art01-innerwear-guardian-01.png',
    'fp-layer-v2-art01-outfit-guardian-01.png',
    'fp-layer-v2-art01-outfitBack-guardian-01.png',
    'fp-layer-v2-art01-outfitFront-guardian-01.png',
    'fp-layer-v2-art01-sideHair-short-01.png',
  ]);

  files.forEach((filename) => {
    const entry = manifest.layers[filename];
    assert.ok(entry, filename);
    ['x', 'y', 'width', 'height', 'sourcePixelWidth', 'sourcePixelHeight'].forEach((key) => {
      assert.equal(Number.isFinite(Number(entry[key])), true, `${filename}.${key}`);
      assert.ok(Number(entry[key]) > 0 || key === 'x' || key === 'y', `${filename}.${key}`);
    });
  });
});

test('famous portrait v2 PNG layers are non-empty alpha resources', () => {
  listFamousLayerFiles(/^fp-layer-v2-.*\.png$/).forEach((filename) => {
    const stats = readPngAlphaStats(path.join(famousLayerDir, filename));
    assert.ok(stats.width > 0, filename);
    assert.ok(stats.height > 0, filename);
    assert.ok(stats.opaquePixels > 0, filename);
  });
});

test('active famous portrait lab layers preserve source aspect ratio', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(famousLayerDir, 'fp-layer-v2-manifest.json'), 'utf8'));
  [
    'fp-layer-v2-art01-backHair-short-01.png',
    'fp-layer-v2-art01-sideHair-short-01.png',
    'fp-layer-v2-art01-frontHair-short-01.png',
    'fp-layer-v2-art01-bangs-short-01.png',
    'fp-layer-v2-art01-head-base-01.png',
    'fp-layer-v2-art01-hair-bound-topknot-01.png',
    'fp-layer-v2-art01-outfitBack-guardian-01.png',
    'fp-layer-v2-art01-outfitFront-guardian-01.png',
  ].forEach((filename) => {
    const entry = manifest.layers[filename];
    const sourceRatio = entry.sourcePixelWidth / entry.sourcePixelHeight;
    const drawRatio = entry.width / entry.height;
    assert.ok(Math.abs(sourceRatio - drawRatio) < 0.002, `${filename} aspect ratio`);
  });
});
