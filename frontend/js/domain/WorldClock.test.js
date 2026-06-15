const test = require('node:test');
const assert = require('node:assert/strict');

const { WorldClock } = require('./WorldClock');

test('WorldClock advances server epoch with monotonic runtime time', () => {
  let mono = 1000;
  const clock = new WorldClock({
    runtime: {
      performance: {
        now() {
          return mono;
        },
      },
    },
    serverTime: '2026-06-15T00:00:00.000Z',
  });

  mono = 3500;

  assert.equal(
    clock.getEpochNowMs(),
    new Date('2026-06-15T00:00:02.500Z').getTime(),
  );
});

test('WorldClock syncs from command authority payloads', () => {
  let mono = 10;
  const clock = new WorldClock({
    runtime: {
      performance: {
        now() {
          return mono;
        },
      },
    },
  });

  assert.equal(clock.updateFromPayload({
    authority: {
      serverTime: '2026-06-15T00:00:05.000Z',
    },
  }), true);

  mono = 1010;

  assert.equal(
    clock.getEpochNowMs(),
    new Date('2026-06-15T00:00:06.000Z').getTime(),
  );
});

test('WorldClock preserves explicit NaN fallback when unsynced', () => {
  const clock = new WorldClock();

  assert.equal(
    Number.isNaN(WorldClock.getEpochNowMs({ worldClock: clock }, Number.NaN)),
    true,
  );
});

test('WorldClock syncs from wrapped state payload server time', () => {
  const clock = new WorldClock({
    runtime: {
      performance: {
        now() {
          return 0;
        },
      },
    },
  });

  assert.equal(clock.updateFromPayload({
    gameState: {
      serverTime: '2026-06-15T00:00:10.000Z',
    },
  }), true);

  assert.equal(
    clock.getEpochNowMs(),
    new Date('2026-06-15T00:00:10.000Z').getTime(),
  );
});
