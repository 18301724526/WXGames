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
  assert.match(html, /当前游戏顺序/);
  assert.match(html, /素材诊断/);
  assert.match(html, /显示透明像素边界/);

  assert.match(script, /fp-layer-outfit-guardian-01\.png/);
  assert.match(script, /fp-layer-outfit-vanguard-01\.png/);
  assert.match(script, /fp-layer-outfit-scholar-01\.png/);
  assert.match(html, /value="split"/);
  assert.match(script, /state\.mode === 'current'/);
  assert.match(script, /drawSplitOutfit/);
  assert.match(script, /getAlphaBounds/);
  assert.match(script, /drawBoundsOverlay/);
  assert.match(script, /drawCropComparison/);
  assert.match(script, /裁边后回 x=256/);
});
