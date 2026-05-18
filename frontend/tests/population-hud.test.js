const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

test('population panel uses custom HUD controls and dedicated cutout icons', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');

  assert.match(html, /class="population-header"/);
  assert.match(html, /class="pop-stat-icon pop-stat-population"/);
  assert.match(html, /class="pop-stat-icon pop-stat-happiness"/);
  assert.match(html, /class="job-card job-farmer"[\s\S]*class="job-icon" aria-hidden="true"/);
  assert.match(html, /class="btn-minus" data-job="farmer" type="button" aria-label="减少农民"><span aria-hidden="true"><\/span><\/button>\s*<div class="job-count" id="farmerCount">3<\/div>\s*<button class="btn-plus" data-job="farmer"/);
  assert.match(html, /class="btn-plus" data-job="craftsman" type="button" aria-label="增加工匠"><span aria-hidden="true"><\/span><\/button>/);
  assert.doesNotMatch(html, /<select[^>]*population/i);

  assert.match(css, /url\('assets\/art\/icon-population-cutout\.webp'\)/);
  assert.match(css, /url\('assets\/art\/icon-happiness-cutout\.webp'\)/);
  assert.match(css, /url\('assets\/art\/icon-farmer-cutout\.webp'\)/);
  assert.match(css, /url\('assets\/art\/icon-scholar-cutout\.webp'\)/);
  assert.match(css, /url\('assets\/art\/icon-craftsman-cutout\.webp'\)/);
  assert.match(css, /\.pop-stats \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.match(css, /\.pop-stat \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
  assert.match(css, /\.job-card \{[\s\S]*?padding: 4px 7px;[\s\S]*?grid-template-columns: 32px minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.job-icon \{[\s\S]*?width: 32px;[\s\S]*?height: 32px;[\s\S]*?border: 0;[\s\S]*?background: center \/ contain no-repeat;[\s\S]*?box-shadow: none;/);
  assert.match(css, /\.job-info \{[\s\S]*?justify-self: center;[\s\S]*?text-align: center;/);
  assert.match(css, /\.job-controls \{[\s\S]*?grid-template-columns: 22px minmax\(30px, auto\) 22px;/);
  assert.match(css, /\.job-controls button \{[\s\S]*?width: 22px;[\s\S]*?height: 22px;/);
  assert.match(css, /\.job-controls button::before/);
  assert.match(css, /\.job-controls \.btn-plus::after/);
  assert.match(css, /\.job-controls \.btn-minus \{[\s\S]*?color: #ff7f92;/);
  assert.match(css, /\.job-controls \.btn-plus \{[\s\S]*?color: #74d3a0;/);
  assert.doesNotMatch(css, /\.job-farmer \.job-icon \{[^}]*linear-gradient/);
  assert.doesNotMatch(css, /\.job-scholar \.job-icon \{[^}]*linear-gradient/);
  assert.doesNotMatch(css, /\.job-craftsman \.job-icon \{[^}]*linear-gradient/);
});

test('population click handler reads the closest custom button', () => {
  const populationJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'population.js'), 'utf8');
  assert.match(populationJs, /e\.target\.closest\('button\[data-job\]'\)/);
  assert.match(populationJs, /button\.classList\.contains\('btn-plus'\)/);
});
