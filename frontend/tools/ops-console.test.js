const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const htmlPath = path.join(__dirname, 'ops-console.html');

test('ops console exposes protected admin operations workflow', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /\u6587\u660e\u706b\u79cd\u8fd0\u7ef4\u63a7\u5236\u53f0/);
  assert.match(html, /\u8fd0\u7ef4\u7ba1\u7406\u5458\u767b\u5f55/);
  assert.match(html, /\/admin\/ops\/login/);
  assert.match(html, /\/admin\/ops\/dashboard/);
  assert.match(html, /\/admin\/ops\/maintenance/);
  assert.match(html, /\/admin\/ops\/restart/);
  assert.match(html, /cf_ops_token/);
  assert.match(html, /TOKEN_STORAGE_KEY/);
  assert.match(html, /headers\.Authorization = `Bearer \$\{token\}`/);
});

test('ops console documents soft maintenance and hard-stop boundary', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /\u8f6f\u505c\u670d/);
  assert.match(html, /\u62e6\u622a\u73a9\u5bb6\u767b\u5f55\/\u6e38\u620f API/);
  assert.match(html, /ops-agent/);
  assert.match(html, /PM2 server/);
  assert.doesNotMatch(html, /\/api\/player\/login/);
  assert.doesNotMatch(html, /cf_token/);
  assert.doesNotMatch(html, /localStorage\.setItem\(['"]cf_token/);
  assert.doesNotMatch(html, /\u767b\u5f55\u6e38\u620f/);
});

test('ops console exposes independent ops-agent hard stop and start controls', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /id="opsAgent"/);
  assert.match(html, /cf_ops_agent_token/);
  assert.match(html, /AGENT_TOKEN_STORAGE_KEY/);
  assert.match(html, /agentBaseParam/);
  assert.match(html, /\/ops-agent/);
  assert.match(html, /requestAgent\('\/login'/);
  assert.match(html, /requestAgent\('\/status'/);
  assert.match(html, /requestAgent\(`\/pm2\/\$\{action\}`/);
  assert.match(html, /controlAgent\('start'\)/);
  assert.match(html, /controlAgent\('stop'\)/);
  assert.match(html, /controlAgent\('restart'\)/);
});
