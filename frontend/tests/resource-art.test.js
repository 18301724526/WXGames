const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..', '..');

test('wood resource uses its own transparent icon asset', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const assetPath = path.join(projectRoot, 'frontend', 'assets', 'art', 'icon-wood-cutout.webp');

  assert.equal(fs.existsSync(assetPath), true);
  assert.match(css, /\.wood-card \.resource-icon \{ background-image: url\('assets\/art\/icon-wood-cutout\.webp'\); \}/);
  assert.match(css, /\.resource-detail-wood \{ background-image: url\('assets\/art\/icon-wood-cutout\.webp'\); \}/);
  assert.doesNotMatch(css, /\.wood-card \.resource-icon \{ background-image: url\('assets\/art\/icon-fire-cutout\.webp'\); \}/);
  assert.doesNotMatch(css, /\.resource-detail-wood \{ background-image: url\('assets\/art\/icon-fire-cutout\.webp'\); \}/);
});

test('military has its own tab and page outside the civilization page', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const civStart = html.indexOf('<section class="page page-civilization"');
  const militaryStart = html.indexOf('<section class="page page-military"');

  assert.ok(civStart >= 0);
  assert.ok(militaryStart > civStart);
  assert.match(html, /id="tabMilitary" data-tab="military"/);
  assert.match(html, /class="page page-military" data-page="military"/);
  assert.equal(html.slice(civStart, militaryStart).includes('id="militaryPanel"'), false);
});
