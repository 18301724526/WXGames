const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const htmlPath = path.join(__dirname, 'ops-console.html');

test('ops console exposes protected admin operations workflow', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /\u6587\u660e\u706b\u79cd\u8fd0\u7ef4\u63a7\u5236\u53f0/);
  assert.match(html, /\/admin\/ops\/dashboard/);
  assert.match(html, /\/admin\/ops\/maintenance/);
  assert.match(html, /\/admin\/ops\/restart/);
  assert.match(html, /cf_token/);
  assert.match(html, /Authorization: token \? `Bearer \$\{token\}` : ''/);
});

test('ops console documents soft maintenance and hard-stop boundary', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /\u8f6f\u505c\u670d/);
  assert.match(html, /\u62e6\u622a\u73a9\u5bb6\u767b\u5f55\/\u6e38\u620f API/);
  assert.match(html, /ops-agent/);
  assert.match(html, /PM2 server/);
  assert.doesNotMatch(html, /\/api\/player\/login/);
  assert.doesNotMatch(html, /localStorage\.setItem\(['"]cf_token/);
});
