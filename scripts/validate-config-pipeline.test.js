const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs } = require('./validate-config-pipeline');

test('validate-config-pipeline parses baseline and output options', () => {
  assert.deepEqual(parseArgs([
    '--baseline',
    'config/baseline.json',
    '--write-baseline=out/snapshot.json',
    '--json',
  ]), {
    baselinePath: 'config/baseline.json',
    writeBaselinePath: 'out/snapshot.json',
    json: true,
  });
});

test('validate-config-pipeline parses equals baseline form', () => {
  assert.deepEqual(parseArgs([
    '--baseline=config/baseline.json',
    '--write-baseline',
    'out/snapshot.json',
  ]), {
    baselinePath: 'config/baseline.json',
    writeBaselinePath: 'out/snapshot.json',
  });
});
