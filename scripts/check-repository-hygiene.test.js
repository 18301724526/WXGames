const test = require('node:test');
const assert = require('node:assert/strict');

const { isForbidden } = require('./check-repository-hygiene');

test('repository hygiene blocks runtime artifacts and local secret text files', () => {
  [
    'backend/server.js.bak',
    'backend/data/civilization.db',
    'backend/.env.production',
    'deploy-key.pem',
    'password.txt',
    'server-credentials.txt',
    'ops_secret.txt',
    'docs/服务器连接密码.txt',
  ].forEach((file) => assert.equal(isForbidden(file), true, file));
});

test('repository hygiene allows normal source and docs', () => {
  [
    'backend/server.js',
    'scripts/check-repository-hygiene.js',
    'docs/production_engineering_roadmap_2026-06-09.md',
  ].forEach((file) => assert.equal(isForbidden(file), false, file));
});
