const test = require('node:test');
const assert = require('node:assert/strict');

const {
  Clock,
  createClockWorld,
  createWorldClock,
  getEpochNowMs,
  getShared,
  getClockSnapshot,
  isClockWorld,
  runClockAdvanceSystem,
  runClockSyncSystem,
  sync,
  updateFromPayload,
} = require('./WorldClock');

test('WorldClock exposes a real BitECS clock component and entity world', () => {
  const clockWorld = createClockWorld({
    runtime: {
      performance: {
        now() {
          return 100;
        },
      },
    },
    serverTime: '2026-06-15T00:00:00.000Z',
  });

  assert.equal(typeof clockWorld.world, 'object');
  assert.equal(Number.isInteger(clockWorld.clockEntity), true);
  assert.equal(Clock.synced[clockWorld.clockEntity], 1);
  assert.equal(
    Clock.serverEpochAtSyncMs[clockWorld.clockEntity],
    new Date('2026-06-15T00:00:00.000Z').getTime(),
  );
  assert.equal(Clock.clientMonoAtSyncMs[clockWorld.clockEntity], 100);
});

test('WorldClock BitECS systems sync and advance the clock entity', () => {
  let mono = 1000;
  const clockWorld = createClockWorld({
    runtime: {
      performance: {
        now() {
          return mono;
        },
      },
    },
  });

  assert.equal(
    runClockSyncSystem(clockWorld, {
      serverTime: '2026-06-15T00:00:05.000Z',
    }),
    true,
  );

  mono = 3250;
  assert.equal(runClockAdvanceSystem(clockWorld), true);

  const snapshot = getClockSnapshot(clockWorld);
  assert.equal(snapshot.synced, true);
  assert.equal(snapshot.epochNowMs, new Date('2026-06-15T00:00:07.250Z').getTime());
  assert.equal(Clock.elapsedMs[clockWorld.clockEntity], 2250);
});

test('createWorldClock returns a BitECS clock world handle, not a wrapper object', () => {
  const clockWorld = createWorldClock();

  assert.equal(isClockWorld(clockWorld), true);
  assert.equal(typeof clockWorld.world, 'object');
  assert.equal(typeof clockWorld.getEpochNowMs, 'undefined');
  assert.equal(typeof clockWorld.updateFromPayload, 'undefined');
});

test('WorldClock advances server epoch with monotonic runtime time', () => {
  let mono = 1000;
  const clockWorld = createClockWorld({
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
    getEpochNowMs({ worldClock: clockWorld }),
    new Date('2026-06-15T00:00:02.500Z').getTime(),
  );
});

test('createWorldClock stores derived time only in BitECS component arrays', () => {
  let mono = 20;
  const clockWorld = createWorldClock({
    runtime: {
      performance: {
        now() {
          return mono;
        },
      },
    },
    serverTime: '2026-06-15T00:00:00.000Z',
  });

  mono = 1020;

  assert.equal(
    getEpochNowMs({ worldClock: clockWorld }),
    new Date('2026-06-15T00:00:01.000Z').getTime(),
  );
  assert.equal(
    Clock.epochNowMs[clockWorld.clockEntity],
    new Date('2026-06-15T00:00:01.000Z').getTime(),
  );
});

test('WorldClock syncs from command authority payloads', () => {
  let mono = 10;
  const clockWorld = createClockWorld({
    runtime: {
      performance: {
        now() {
          return mono;
        },
      },
    },
  });

  assert.equal(
    updateFromPayload(clockWorld, {
      authority: {
        serverTime: '2026-06-15T00:00:05.000Z',
      },
    }),
    true,
  );

  mono = 1010;

  assert.equal(
    getEpochNowMs({ worldClock: clockWorld }),
    new Date('2026-06-15T00:00:06.000Z').getTime(),
  );
});

test('WorldClock never lets a stale server sync pull the epoch clock backward (rubber-band guard)', () => {
  let mono = 1000;
  const clockWorld = createClockWorld({
    runtime: { performance: { now() { return mono; } } },
    serverTime: '2026-06-15T00:00:05.000Z',
  });
  const t0 = new Date('2026-06-15T00:00:05.000Z').getTime();

  // 1000ms of real (monotonic) time elapses: the clock reads T0 + 1000ms.
  mono = 2000;
  const beforeResync = getEpochNowMs({ worldClock: clockWorld });
  assert.equal(beforeResync, t0 + 1000);

  // A sync arrives whose serverTime was STAMPED 200ms ago (slow response build). Naively
  // re-anchoring the epoch to that stale value while anchoring mono at receipt would snap the
  // clock back to T0+800 — the per-sync backstep that rubber-bands marching units. The
  // forward-only clamp must hold the clock at its current reading instead.
  runClockSyncSystem(clockWorld, { serverTime: new Date(t0 + 800).toISOString() });
  const afterStale = getEpochNowMs({ worldClock: clockWorld });
  assert.equal(afterStale >= beforeResync, true, 'a stale sync must never rewind the clock');
  assert.equal(afterStale, t0 + 1000);

  // A genuinely forward server time (a real correction ahead) is still adopted.
  runClockSyncSystem(clockWorld, { serverTime: new Date(t0 + 1500).toISOString() });
  assert.equal(getEpochNowMs({ worldClock: clockWorld }), t0 + 1500);
});

test('WorldClock preserves explicit NaN fallback when unsynced', () => {
  const clockWorld = createClockWorld();

  assert.equal(Number.isNaN(getEpochNowMs({ worldClock: clockWorld }, Number.NaN)), true);
});

test('WorldClock syncs from wrapped state payload server time', () => {
  const clockWorld = createClockWorld({
    runtime: {
      performance: {
        now() {
          return 0;
        },
      },
    },
  });

  assert.equal(
    updateFromPayload(clockWorld, {
      gameState: {
        serverTime: '2026-06-15T00:00:10.000Z',
      },
    }),
    true,
  );

  assert.equal(
    getEpochNowMs({ worldClock: clockWorld }),
    new Date('2026-06-15T00:00:10.000Z').getTime(),
  );
});

test('WorldClock shared API stores the shared handle as a BitECS world', () => {
  const previous = globalThis.__WorldClockShared;
  try {
    delete globalThis.__WorldClockShared;
    const clockWorld = getShared({
      runtime: {
        performance: {
          now() {
            return 0;
          },
        },
      },
      serverTime: '2026-06-15T00:00:20.000Z',
    });

    assert.equal(isClockWorld(clockWorld), true);
    assert.equal(globalThis.__WorldClockShared, clockWorld);
    assert.equal(getEpochNowMs({}, Number.NaN), new Date('2026-06-15T00:00:20.000Z').getTime());
  } finally {
    globalThis.__WorldClockShared = previous;
  }
});

test('WorldClock sync assigns the real BitECS handle to legacy source fields', () => {
  const previous = globalThis.__WorldClockShared;
  try {
    delete globalThis.__WorldClockShared;
    const source = {
      runtime: {
        performance: {
          now() {
            return 0;
          },
        },
      },
    };

    assert.equal(
      sync(source, {
        serverTime: '2026-06-15T00:00:30.000Z',
      }),
      true,
    );
    assert.equal(isClockWorld(source.worldClock), true);
    assert.equal(
      Clock.serverEpochAtSyncMs[source.worldClock.clockEntity],
      new Date('2026-06-15T00:00:30.000Z').getTime(),
    );
  } finally {
    globalThis.__WorldClockShared = previous;
  }
});
