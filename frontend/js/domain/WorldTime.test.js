const test = require('node:test');
const assert = require('node:assert/strict');

const WorldTime = require('./WorldTime');

test('WorldTime normalizes ISO, millisecond, and second epoch timestamps', () => {
  const epochMs = new Date('2026-06-06T00:00:10.000Z').getTime();

  assert.equal(WorldTime.toEpochMs('2026-06-06T00:00:10.000Z'), epochMs);
  assert.equal(WorldTime.toEpochMs(epochMs), epochMs);
  assert.equal(WorldTime.toEpochMs(Math.floor(epochMs / 1000)), epochMs);
  assert.equal(WorldTime.toEpochMs(String(Math.floor(epochMs / 1000))), epochMs);
});

test('WorldTime ignores performance.now values when resolving epoch now', () => {
  const epochMs = new Date('2026-06-06T00:00:04.000Z').getTime();

  assert.equal(WorldTime.getEpochNowMs({
    getNow() {
      return 4321.25;
    },
    epochNowMs: epochMs,
  }), epochMs);
});

test('WorldTime does not treat short performance timestamps as epoch now', () => {
  const fallbackMs = new Date('2026-06-06T00:00:04.000Z').getTime();

  assert.equal(WorldTime.toEpochNowMs(4321.25, fallbackMs), fallbackMs);
});

test('WorldTime treats timestamp-like remainingSeconds as absolute time', () => {
  const nowMs = new Date('2026-06-06T00:00:04.000Z').getTime();
  const nextStepSeconds = Math.floor(new Date('2026-06-06T00:00:10.000Z').getTime() / 1000);

  assert.equal(WorldTime.getRemainingSeconds({
    status: 'active',
    remainingSeconds: nextStepSeconds,
  }, nowMs), 6);
});
