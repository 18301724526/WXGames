const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

test('legacy standalone H5 building renderer has been removed from the runtime', () => {
  const rendererPath = path.join(projectRoot, 'frontend', 'js', 'modules', 'BuildingRenderer.js');
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');

  assert.equal(fs.existsSync(rendererPath), false);
  assert.doesNotMatch(html, /BuildingRenderer\.js|window\.BuildingRenderer/);
});
