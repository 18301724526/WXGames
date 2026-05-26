const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');
const famousLayerDir = path.join(projectRoot, 'frontend', 'assets', 'art', 'famous-person', 'layers');

test('famous portrait lab exposes isolated layer order experiments', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(html, /名人立绘实验台/);
  assert.match(html, /famous-portrait-lab\.js/);
  assert.match(html, /\.\.\/js\/config\/FamousPortraitLayout\.js[\s\S]*famous-portrait-lab\.js/);
  assert.match(html, /模拟衣服前后层/);
  assert.match(html, /旧错误示例/);
  assert.match(html, /素材诊断/);
  assert.match(html, /显示透明像素边界/);

  assert.match(script, /fp-layer-outfit-guardian-01\.png/);
  assert.match(script, /fp-layer-outfit-vanguard-01\.png/);
  assert.match(script, /fp-layer-outfit-scholar-01\.png/);
  assert.match(script, /fp-layer-outfit-guardian-front-candidate-01\.png/);
  assert.match(script, /fp-layer-outfit-vanguard-front-candidate-02\.png/);
  assert.match(script, /fp-layer-outfit-scholar-front-candidate-03\.png/);
  assert.match(html, /守将候选-正面甲/);
  assert.match(html, /突骑候选-正面甲/);
  assert.match(html, /学者候选-正面袍/);
  assert.match(html, /value="split"/);
  assert.match(script, /state\.mode === 'current'/);
  assert.match(script, /drawSplitOutfit/);
  assert.match(script, /getAlphaBounds/);
  assert.match(script, /drawBoundsOverlay/);
  assert.match(script, /drawCropComparison/);
  assert.match(script, /isCandidateOutfit/);
  assert.match(script, /候选素材整层预览/);
  assert.match(script, /裁边后回 x=256/);
  assert.match(script, /不要采用/);
});

test('famous portrait lab can tune split hair and individual layer transforms', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(script, /const backHairFiles = \{/);
  assert.match(script, /const sideHairFiles = \{/);
  assert.match(script, /const frontHairFiles = \{/);
  assert.match(script, /fp-layer-backHair-short-02\.png/);
  assert.match(script, /fp-layer-sideHair-short-01\.png/);
  assert.match(script, /fp-layer-frontHair-short-02\.png/);
  assert.doesNotMatch(script, /hairLayerEnabled/);

  ['backHair', 'sideHair', 'body', 'outfit', 'frontHair', 'accessory'].forEach((key) => {
    assert.match(html, new RegExp(`id="${key}Scale"`));
    assert.match(html, new RegExp(`id="${key}X"`));
    assert.match(html, new RegExp(`id="${key}Y"`));
  });
  assert.match(html, /id="copyExport"/);
  assert.match(html, /id="exportData"/);

  assert.match(html, /id="scale"[^>]*min="0"[^>]*max="200"[^>]*value="130"/);
  assert.match(html, /id="bodyScale"[^>]*value="70"/);
  assert.match(html, /id="bodyY"[^>]*value="-17"/);
  assert.match(html, /id="outfitScale"[^>]*value="121"/);
  assert.match(html, /id="backHairScale"[^>]*min="0"[^>]*max="200"[^>]*value="70"/);
  assert.match(html, /id="backHairY"[^>]*value="-70"/);
  assert.match(html, /id="sideHairScale"[^>]*min="0"[^>]*max="200"[^>]*value="70"/);
  assert.match(html, /id="sideHairY"[^>]*value="-75"/);
  assert.match(html, /id="frontHairScale"[^>]*min="0"[^>]*max="200"[^>]*value="70"/);
  assert.match(html, /id="frontHairY"[^>]*value="-65"/);
  assert.match(html, /id="accessoryScale"[^>]*min="0"[^>]*max="200"[^>]*value="100"/);
  assert.match(script, /const fallbackLayerTransforms = \{/);
  assert.match(script, /window\.FamousPortraitLayout/);
  assert.match(script, /function applyDefaultLayerTransforms\(\)/);
  assert.match(script, /body: \{ scale: 0\.7, x: 0, y: -17 \}/);
  assert.match(html, /id="outfitY"[^>]*value="53"/);
  assert.match(script, /outfit: \{ scale: 1\.21, x: 0, y: 53 \}/);
  assert.match(script, /backHair: \{ scale: 0\.7, x: 0, y: -70 \}/);
  assert.match(script, /sideHair: \{ scale: 0\.7, x: 0, y: -75 \}/);
  assert.match(script, /frontHair: \{ scale: 0\.7, x: 0, y: -65 \}/);
  assert.match(script, /function getLayerTransforms\(\)/);
  assert.match(script, /function getLayerDrawFrame\(key, x, y, size, state, options = \{\}\)/);
  assert.match(script, /const transform = state\.layerTransforms\?\.\[key\]/);
  assert.match(script, /drawLayer\(images\.backHair, backHairFrame\.x, backHairFrame\.y, backHairFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.body, bodyFrame\.x, bodyFrame\.y, bodyFrame\.size\);[\s\S]*drawLayer\(images\.sideHair, sideHairFrame\.x, sideHairFrame\.y, sideHairFrame\.size\);[\s\S]*drawLayer\(images\.outfit, outfitFrame\.x, outfitFrame\.y, outfitFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.body, bodyFrame\.x, bodyFrame\.y, bodyFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.outfit, outfitFrame\.x, outfitFrame\.y, outfitFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.frontHair, frontHairFrame\.x, frontHairFrame\.y, frontHairFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.accessory, accessoryFrame\.x, accessoryFrame\.y, accessoryFrame\.size\);/);
  assert.match(script, /scaleOffsets: true,\s*\}\);\s*ctx\.fillStyle = '#ffe6b5';/);
  assert.match(script, /function buildExportPayload\(state\)/);
  assert.match(script, /exportData\.value = JSON\.stringify\(buildExportPayload\(state\), null, 2\);/);
  assert.doesNotMatch(script, /drawLayer\(images\.body, drawX, drawY, drawSize\);/);
  assert.doesNotMatch(script, /drawLayer\(images\.hair, drawX, drawY, drawSize\);/);
});

test('famous portrait lab shows an in-game candidate card preview', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(html, /<canvas id="stage" width="1180" height="1220"><\/canvas>/);
  assert.match(script, /const gamePortraitPreview = \{/);
  assert.match(script, /portraitWidth: 74/);
  assert.match(script, /portraitHeight: 98/);
  assert.match(script, /portraitScale: 1\.74/);
  assert.match(script, /portraitOffsetY: 0\.14/);
  assert.match(script, /function drawGameFamousPortrait\(images, x, y, state, options = \{\}\)/);
  assert.match(script, /function drawGameFamousPersonItem\(images, x, y, state\)/);
  assert.match(script, /const gameState = \{/);
  assert.match(script, /mode: 'current'/);
  assert.match(script, /scale: 1/);
  assert.match(script, /offsetY: 0/);
  assert.match(script, /drawPortrait\(images, drawX, drawY, drawSize, gameState, \{/);
  assert.match(script, /scaleOffsets: true/);
  assert.match(script, /const offsetScale = options\.scaleOffsets \? frame\.size \/ 512 : 1;/);
  assert.match(script, /ctx\.fillText\('游戏实显', 592, 414\)/);
  assert.match(script, /drawGameFamousPersonItem\(images, 592, 466, state\)/);
  assert.match(script, /if \(!image \|\| size <= 0\) return;/);
});

test('famous portrait lab keeps desktop controls scroll isolated from preview', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');

  assert.match(html, /html,\s*body\s*\{[\s\S]*?height:\s*100%;[\s\S]*?overflow:\s*hidden;/);
  assert.match(html, /\.shell\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*hidden;/);
  assert.match(html, /\.panel\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(html, /\.stage\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?overflow:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/);
  assert.match(html, /@media \(max-width:\s*900px\)\s*\{[\s\S]*?html,\s*body\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*auto;/);
});

test('famous portrait split hair assets exist and stay aligned', () => {
  [
    'fp-layer-backHair-short-02.png',
    'fp-layer-backHair-tied-02.png',
    'fp-layer-frontHair-short-02.png',
    'fp-layer-frontHair-tied-02.png',
  ].forEach((filename) => {
    const bounds = readPngAlphaBounds(path.join(famousLayerDir, filename));
    assert.ok(Math.abs(((bounds.minX + bounds.maxX) / 2) - 256) <= 4, filename);
    assert.equal(bounds.minY < 100, true, filename);
    assert.equal(bounds.maxY < 320, true, filename);
  });
});

test('famous portrait side hair assets are side locks instead of full hair caps', () => {
  [
    'fp-layer-sideHair-short-01.png',
    'fp-layer-sideHair-tied-01.png',
  ].forEach((filename) => {
    const alpha = readPngAlphaStats(path.join(famousLayerDir, filename));
    const left = alpha.points.filter((point) => point.x < 226).length;
    const center = alpha.points.filter((point) => point.x >= 226 && point.x <= 286).length;
    const right = alpha.points.filter((point) => point.x > 286).length;
    assert.ok(Math.abs(((alpha.bounds.minX + alpha.bounds.maxX) / 2) - 256) <= 4, filename);
    assert.ok(left > 0 && right > 0, filename);
    assert.ok(left / right > 0.9 && left / right < 1.1, filename);
    assert.equal(center, 0, filename);
    assert.equal(alpha.bounds.minY >= 95, true, filename);
    assert.equal(alpha.bounds.maxY < 320, true, filename);
  });
});

test('famous portrait front hair assets cover full bangs without reaching lower face', () => {
  [
    'fp-layer-frontHair-short-02.png',
    'fp-layer-frontHair-tied-02.png',
  ].forEach((filename) => {
    const bounds = readPngAlphaBounds(path.join(famousLayerDir, filename));
    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    assert.ok(width >= 260 && width <= 285, filename);
    assert.ok(height >= 190 && height <= 205, filename);
    assert.ok(bounds.minY <= 30, filename);
    assert.ok(bounds.maxY <= 220, filename);
  });
});

function readPngAlphaBounds(filePath) {
  return readPngAlphaStats(filePath).bounds;
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
  const zlib = require('node:zlib');
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
  const bounds = { minX: width, minY: height, maxX: -1, maxY: -1 };
  const points = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) {
      if (row[x * bytesPerPixel + 3] <= 8) continue;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
      points.push({ x, y });
    }
  });
  return { bounds, points };
}

test('famous portrait candidate outfits share guardian armor alpha bounds', () => {
  const expected = { minX: 41, minY: 242, maxX: 470, maxY: 511 };
  [
    'fp-layer-outfit-guardian-front-candidate-01.png',
    'fp-layer-outfit-vanguard-front-candidate-02.png',
    'fp-layer-outfit-scholar-front-candidate-03.png',
  ].forEach((filename) => {
    assert.deepEqual(readPngAlphaBounds(path.join(famousLayerDir, filename)), expected, filename);
  });
});
