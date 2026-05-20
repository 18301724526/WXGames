const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('city switcher is owned by Canvas HUD without H5 DOM controls', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');

  assert.doesNotMatch(indexHtml, /id="citySwitcher"/);
  assert.doesNotMatch(indexHtml, /id="citySwitcherTrigger"/);
  assert.doesNotMatch(indexHtml, /id="citySwitcherMenu"/);
  assert.doesNotMatch(indexHtml, /CitySwitcherAdapter/);
  assert.doesNotMatch(css, /city-switcher/);
  assert.doesNotMatch(appJs, /citySwitcher\?\.bind|renderCitySwitcher\(\)/);
  assert.match(renderer, /renderCitySwitcherMenu/);
  assert.match(renderer, /type: 'selectCity'/);
  assert.match(renderer, /type: 'closeCitySwitcher'/);
});
