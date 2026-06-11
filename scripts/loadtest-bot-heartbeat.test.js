const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs, summarize } = require('./loadtest-bot-heartbeat');

test('bot heartbeat load-test args keep an explicit 80 percent utilization target', () => {
  const args = parseArgs([
    'node',
    'scripts/loadtest-bot-heartbeat.js',
    '--base-url',
    'http://example.test/',
    '--bot-count',
    '5000',
    '--concurrency',
    '200',
    '--target-utilization',
    '0.8',
    '--password',
    'secret',
  ]);

  assert.equal(args.baseUrl, 'http://example.test');
  assert.equal(args.botCount, 5000);
  assert.equal(args.concurrency, 200);
  assert.equal(args.targetUtilization, 0.8);
  assert.equal(args.password, 'secret');
});

test('bot heartbeat load-test summary reports error rate and latency percentiles', () => {
  const summary = summarize('heartbeat', [
    { ok: true, durationMs: 10 },
    { ok: true, durationMs: 20 },
    { ok: false, durationMs: 1000 },
  ]);

  assert.equal(summary.label, 'heartbeat');
  assert.equal(summary.count, 3);
  assert.equal(summary.success, 2);
  assert.equal(summary.failures, 1);
  assert.equal(summary.errorRate, 0.3333);
  assert.equal(summary.p50Ms, 20);
  assert.equal(summary.p95Ms, 1000);
});
