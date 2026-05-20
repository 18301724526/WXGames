const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5TextAdapter = require('../js/ui/H5TextAdapter');

const projectRoot = path.join(__dirname, '..', '..');

test('H5 text adapter owns id based text writes', () => {
  const elements = new Map([
    ['eraName', { textContent: '' }],
  ]);
  const adapter = H5TextAdapter.fromDocument({
    getElementById(id) {
      return elements.get(id) || null;
    },
  });

  adapter.setText('eraName', '聚落时代');
  adapter.setText('missing', 'ignored');

  assert.equal(elements.get('eraName').textContent, '聚落时代');
});

test('app keeps H5TextAdapter for pages not yet migrated to Canvas', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  assert.match(html, /js\/ui\/H5TextAdapter\.js\?v=explicit-doc-v1/);
  assert.doesNotMatch(html, /DOMHelper\.js/);
  assert.match(appJs, /Object\.assign\(this, shell\)/);
  assert.match(appJs, /this\.textAdapter\?\.setText\(id, value\)/);
  assert.doesNotMatch(appJs, /renderTech\(\)|techKnowledgeRate/);
  assert.doesNotMatch(appJs, /DOMHelper/);
});
