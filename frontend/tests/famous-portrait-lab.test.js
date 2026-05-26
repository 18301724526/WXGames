const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

test('famous portrait lab exposes isolated layer order experiments', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(html, /名人立绘实验台/);
  assert.match(html, /famous-portrait-lab\.js/);
  assert.match(html, /模拟衣服前后层/);
  assert.match(html, /旧错误示例/);
  assert.match(html, /素材诊断/);
  assert.match(html, /显示透明像素边界/);

  assert.match(script, /fp-layer-outfit-guardian-01\.png/);
  assert.match(script, /fp-layer-outfit-vanguard-01\.png/);
  assert.match(script, /fp-layer-outfit-scholar-01\.png/);
  assert.match(script, /fp-layer-outfit-guardian-front-candidate-01\.png/);
  assert.match(script, /fp-layer-outfit-vanguard-front-candidate-01\.png/);
  assert.match(script, /fp-layer-outfit-scholar-front-candidate-01\.png/);
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

test('famous portrait lab can hide hair and tune individual layer transforms', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.html'), 'utf8');
  const script = fs.readFileSync(path.join(projectRoot, 'frontend', 'tools', 'famous-portrait-lab.js'), 'utf8');

  assert.match(script, /const hairLayerEnabled = false;/);
  assert.match(script, /if \(!hairLayerEnabled && controls\.hair\)/);
  assert.match(script, /document\.querySelector\('\[data-layer-panel="hair"\]'\)/);
  assert.match(script, /if \(hairLayerEnabled\) layerRequests\.push\(\{ key: 'hair', filename: hairFiles\[state\.hair\] \}\);/);
  assert.match(script, /if \(hairLayerEnabled && images\.hair\) drawLayer\(images\.hair,/);

  ['body', 'outfit', 'hair', 'accessory'].forEach((key) => {
    assert.match(html, new RegExp(`id="${key}Scale"`));
    assert.match(html, new RegExp(`id="${key}X"`));
    assert.match(html, new RegExp(`id="${key}Y"`));
  });
  assert.match(html, /id="copyExport"/);
  assert.match(html, /id="exportData"/);

  assert.match(script, /body: \{ scale: 0\.88, x: 0, y: 0 \}/);
  assert.match(script, /function getLayerTransforms\(\)/);
  assert.match(script, /function getLayerDrawFrame\(key, x, y, size, state\)/);
  assert.match(script, /const transform = state\.layerTransforms\?\.\[key\]/);
  assert.match(script, /drawLayer\(images\.body, bodyFrame\.x, bodyFrame\.y, bodyFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.outfit, outfitFrame\.x, outfitFrame\.y, outfitFrame\.size\);/);
  assert.match(script, /drawLayer\(images\.accessory, accessoryFrame\.x, accessoryFrame\.y, accessoryFrame\.size\);/);
  assert.match(script, /function buildExportPayload\(state\)/);
  assert.match(script, /exportData\.value = JSON\.stringify\(buildExportPayload\(state\), null, 2\);/);
  assert.doesNotMatch(script, /drawLayer\(images\.body, drawX, drawY, drawSize\);/);
  assert.doesNotMatch(script, /drawLayer\(images\.hair, drawX, drawY, drawSize\);/);
});
