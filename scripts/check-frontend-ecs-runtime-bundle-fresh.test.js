const test = require('node:test');
const assert = require('node:assert/strict');

const { checkBundleFresh, normalize, renderText } = require('./check-frontend-ecs-runtime-bundle-fresh');

test('normalize collapses CRLF and trailing whitespace to a single LF', () => {
  assert.equal(normalize('a\r\nb\r\n'), 'a\nb\n');
  assert.equal(normalize('a\nb   \n\n\n'), 'a\nb\n');
});

test('renderText reports pass vs stale', () => {
  assert.match(renderText({ drifted: false, outfile: 'x' }), /passed/);
  assert.match(renderText({ drifted: true, outfile: 'x' }), /STALE/);
});

test('the committed ecs runtime bundle matches a fresh build (not drifted)', async () => {
  const result = await checkBundleFresh();
  assert.equal(result.drifted, false);
});
