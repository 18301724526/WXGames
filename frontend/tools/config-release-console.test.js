const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const htmlPath = path.join(__dirname, 'config-release-console.html');

test('config release console exposes audit-only admin release workflow controls', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /配置发布控制台/);
  assert.match(html, /\/admin\/config-releases\/active\?includeSnapshot=true&includeReport=true/);
  assert.match(html, /\/admin\/config-releases\?limit=20&includeReport=true/);
  assert.match(html, /\/admin\/config-releases\/runtime-status/);
  assert.match(html, /\/admin\/config-releases\/preview/);
  assert.match(html, /\/admin\/config-releases\/publish/);
  assert.match(html, /\/admin\/config-releases\/rollback/);
  assert.match(html, /cf_token/);
  assert.match(html, /admin-console-current/);
  assert.match(html, /Runtime Status/);
  assert.match(html, /Runtime Loader/);
  assert.match(html, /loaderStatus/);
  assert.match(html, /payloadIncluded/);
});

test('config release console does not claim runtime hot loading', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.doesNotMatch(html, /hot[- ]?load/i);
  assert.doesNotMatch(html, /热加载/);
  assert.doesNotMatch(html, /立即生效/);
});
