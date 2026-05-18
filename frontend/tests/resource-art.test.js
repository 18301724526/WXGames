const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..', '..');

function iconUrlPattern(assetName) {
  return `assets/art/${assetName}(?:\\?v=[^']+)?`;
}

test('resource strip uses dedicated resource icon assets', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const assets = [
    'icon-food-cutout.webp',
    'icon-happiness-cutout.webp',
    'icon-knowledge-cutout.webp',
    'icon-wood-cutout.webp',
  ];

  for (const asset of assets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', asset)), true);
  }
  assert.match(css, new RegExp(`\\.food-card \\.resource-icon \\{ background-image: url\\('${iconUrlPattern('icon-food-cutout.webp')}'\\); \\}`));
  assert.match(css, new RegExp(`\\.knowledge-card \\.resource-icon \\{ background-image: url\\('${iconUrlPattern('icon-knowledge-cutout.webp')}'\\); \\}`));
  assert.match(css, new RegExp(`\\.wood-card \\.resource-icon \\{ background-image: url\\('${iconUrlPattern('icon-wood-cutout.webp')}'\\); \\}`));
  assert.match(css, new RegExp(`\\.resource-detail-food \\{ background-image: url\\('${iconUrlPattern('icon-food-cutout.webp')}'\\); \\}`));
  assert.match(css, new RegExp(`\\.resource-detail-knowledge \\{ background-image: url\\('${iconUrlPattern('icon-knowledge-cutout.webp')}'\\); \\}`));
  assert.match(css, new RegExp(`\\.resource-detail-wood \\{ background-image: url\\('${iconUrlPattern('icon-wood-cutout.webp')}'\\); \\}`));
  assert.match(css, new RegExp(`\\.cost-food \\.cost-icon \\{\\s*background-image: url\\('${iconUrlPattern('icon-food-cutout.webp')}'\\);\\s*\\}`));
  assert.match(css, new RegExp(`\\.cost-knowledge \\.cost-icon \\{\\s*background-image: url\\('${iconUrlPattern('icon-knowledge-cutout.webp')}'\\);\\s*\\}`));
  assert.match(css, new RegExp(`\\.cost-wood \\.cost-icon \\{\\s*background-image: url\\('${iconUrlPattern('icon-wood-cutout.webp')}'\\);\\s*\\}`));
  assert.match(css, new RegExp(`\\.civ-overview-item:nth-child\\(4\\) \\.civ-overview-icon \\{ background-image: url\\('${iconUrlPattern('icon-happiness-cutout.webp')}'\\); \\}`));
  assert.doesNotMatch(css, /\.wood-card \.resource-icon \{ background-image: url\('assets\/art\/icon-fire-cutout\.webp'\); \}/);
  assert.doesNotMatch(css, /\.resource-detail-wood \{ background-image: url\('assets\/art\/icon-fire-cutout\.webp'\); \}/);
  assert.doesNotMatch(css, /\.civ-overview-item:nth-child\(4\) \.civ-overview-icon \{ background-image: url\('assets\/art\/icon-fire-cutout\.webp'\); \}/);
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

test('world scouting uses dedicated site icons and military scout controls', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'ui', 'TerritoryUIRenderer.js'), 'utf8');
  const assets = [
    'world-site-outpost-cutout.png',
    'world-site-town-cutout.png',
    'world-site-city-cutout.png',
    'world-site-camp-cutout.png',
    'world-site-ruins-cutout.png',
  ];

  for (const asset of assets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', asset)), true);
  }
  assert.doesNotMatch(html, /id="tabTerritory"/);
  assert.doesNotMatch(html, /data-tab="territory"/);
  assert.match(html, /id="militarySubTabs"/);
  assert.match(html, /data-military-view="army"/);
  assert.match(html, /data-military-view="scout"/);
  assert.match(html, /data-military-view="world"/);
  assert.match(html, /id="scoutDirectionGrid"/);
  assert.match(css, /\.scout-compass/);
  assert.match(css, /\.world-radar/);
  assert.match(css, /\.world-radar-pan/);
  assert.match(css, /\.world-reset/);
  assert.match(css, /\.world-site-modal-content/);
  assert.match(css, /@keyframes radarSweep/);
  assert.match(css, /@keyframes radarNeedle/);
  assert.doesNotMatch(css, /--radar-phase/);
  assert.match(css, /\.btn-scout\.status-locked/);
  assert.match(css, /\.world-site-detail\[hidden\] \{\s*display: none !important;/);
  assert.match(renderer, /class="world-radar"/);
  assert.match(renderer, /data-world-pan/);
  assert.match(renderer, /data-world-reset/);
  assert.match(renderer, /data-world-site-modal/);
  assert.match(renderer, /data-site-detail/);
  assert.match(renderer, /selectedSiteId/);
  assert.match(renderer, /visualOffset/);
  assert.match(renderer, /data-world-map-host/);
  assert.match(renderer, /mapSignature/);
  assert.doesNotMatch(renderer, /radarPhase|--radar-phase/);
  assert.match(renderer, /site-card-hero/);
  assert.match(renderer, /site-card-art/);
  assert.match(renderer, /site-card-summary/);
  assert.doesNotMatch(renderer, /territory-site-list/);
  assert.doesNotMatch(renderer, /world-cell-unknown/);
  assert.match(html, /style\.css\?v=territory-radar-v1/);
  assert.match(html, /GameAPI\.js\?v=territory-radar-v1/);
  assert.match(html, /TerritoryController\.js\?v=territory-radar-v1/);
  assert.match(html, /TerritoryUIRenderer\.js\?v=territory-radar-v1/);
  assert.match(html, /app\.js\?v=territory-radar-v1/);
  assert.match(html, /id="advisorBtn"/);
  assert.match(html, /id="advisorModal"/);
  assert.match(html, /id="logButton"/);
  assert.doesNotMatch(html, /id="gameTime"/);
  assert.doesNotMatch(html, /onclick="Game\.toggleSettings\(\)"/);
  assert.match(css, /\.advisor-btn/);
  assert.match(css, /\.advisor-modal-content/);
  assert.match(css, /\.top-actions/);
  assert.match(css, /\.hud-btn/);
  assert.match(css, /\.log-panel \{\s*display: none;/);
  assert.match(css, /\.tab-btn:disabled/);
  assert.match(css, /\.site-card-hero/);
  assert.match(renderer, /scoutReports/);
  assert.doesNotMatch(renderer, /river_plain|north_forest|hill_outpost|old_ruins/);
});
