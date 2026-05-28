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
  let opaquePixels = 0;
  rows.forEach((row) => {
    for (let x = 0; x < width; x += 1) {
      if (row[x * bytesPerPixel + 3] > 8) opaquePixels += 1;
    }
  });
  return { width, height, opaquePixels };
}

test('famous portrait v3 lab exposes simple three-layer controls', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(html, /名人立绘三层试验台/);
  assert.match(html, /id="globalScale"[^>]*min="0"[^>]*max="200"/);
  assert.match(html, /id="layerList"/);
  assert.match(html, /id="copyExport"/);
  assert.match(html, /id="exportData"/);
  assert.match(html, /衣服、脸型、发型三层/);
  assert.match(html, /<canvas id="stage" width="1120" height="900"><\/canvas>/);
  assert.match(html, /<script src="\.\.\/js\/config\/FamousPortraitLayout\.js\?v=famous-portrait-v3-simple-20260528"><\/script>/);
  assert.match(html, /<script src="famous-portrait-lab\.js\?v=0\.2\.0-v3-simple"><\/script>/);

  assert.match(script, /sharedLayout = window\.FamousPortraitLayout/);
  assert.match(script, /labels = \{/);
  assert.match(script, /outfit: '衣服'/);
  assert.match(script, /face: '脸型'/);
  assert.match(script, /hair: '发型'/);
  assert.match(script, /sharedLayout\.order \|\| \['outfit', 'face', 'hair'\]/);
  assert.match(script, /data-control="scale" type="range" min="0" max="200"/);
  assert.match(script, /function drawPortrait\(x, y, size, options = \{\}\)/);
  assert.match(script, /游戏头像区域预览/);
  assert.doesNotMatch(script, /fp-layer-v2|fp-layer-v2-manifest|hairBase|bangs|outfitBack|outfitFront|frontCutY|backCutY/);
});

test('famous portrait lab keeps desktop controls scroll isolated from preview', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');

  assert.match(html, /html,\s*body\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
  assert.match(html, /\.shell\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*hidden;/);
  assert.match(html, /\.panel\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(html, /\.stage\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(html, /@media \(max-width:\s*900px\)\s*\{[\s\S]*?html,\s*body\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*auto;/);
});

test('famous portrait v3 resource directory contains only three simple layer pools', () => {
  const files = listFamousLayerFiles(/^fp-layer-v3-.*\.png$/);
  const expected = ['face', 'hair', 'outfit'].flatMap((type) => (
    Array.from({ length: 10 }, (_, index) => `fp-layer-v3-${type}-${String(index + 1).padStart(2, '0')}.png`)
  )).sort();

  assert.deepEqual(files, expected);
  assert.deepEqual(listFamousLayerFiles(/^fp-layer-v2-.*\.png$/), []);
  assert.equal(fs.existsSync(path.join(famousLayerDir, 'fp-layer-v2-manifest.json')), false);
});

test('famous portrait v3 PNG layers are non-empty 512 alpha resources', () => {
  listFamousLayerFiles(/^fp-layer-v3-.*\.png$/).forEach((filename) => {
    const filePath = path.join(famousLayerDir, filename);
    const fileSize = fs.statSync(filePath).size;
    const stats = readPngAlphaStats(path.join(famousLayerDir, filename));
    assert.equal(stats.width, 512, filename);
    assert.equal(stats.height, 512, filename);
    assert.ok(stats.opaquePixels > 0, filename);
    assert.ok(fileSize > (filename.includes('-outfit-') ? 100000 : 50000), filename);
  });
});
