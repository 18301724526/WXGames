const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('client command block reason guard rejects no domain signals in current source', () => {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, 'check-client-command-block-reasons.js')], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /guard passed/);
});
