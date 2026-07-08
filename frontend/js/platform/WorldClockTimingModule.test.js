const test = require('node:test');
const assert = require('node:assert/strict');

// WorldClockTimingModule is SHAPE-A (stateless, host-passing). Its own logic is the
// clock-slot resolution chain that lets ONE implementation serve both CanvasGameApp
// (host.worldClock) and CanvasGameShell (host.lastGame.worldClock). We stub the shared
// clock so we can observe which slot the module picks, then restore the require cache so
// the real module is unaffected for any sibling test in the same process.

const g = typeof global !== 'undefined' ? global : globalThis;
const modPath = require.resolve('./WorldClockTimingModule');

function withStubbedClock(stub, fn) {
  const prevGlobal = g.WorldClock;
  const prevCached = require.cache[modPath];
  const prevShared = g.__WorldClockShared;
  delete require.cache[modPath];
  g.WorldClock = stub;
  try {
    return fn(require(modPath));
  } finally {
    g.WorldClock = prevGlobal;
    g.__WorldClockShared = prevShared;
    delete require.cache[modPath];
    if (prevCached) require.cache[modPath] = prevCached;
    else delete require.cache[modPath];
  }
}

test('ensureWorldClock returns the already-cached host clock without recreating it', () => {
  withStubbedClock(
    {
      getShared() {
        throw new Error('should not create when host.worldClock exists');
      },
    },
    (Mod) => {
      const existing = { id: 'existing' };
      const host = { worldClock: existing };
      assert.equal(Mod.ensureWorldClock(host), existing);
    },
  );
});

test('ensureWorldClock creates via getShared and mirrors onto runtime.worldClock', () => {
  withStubbedClock({ getShared: ({ runtime }) => ({ id: 'new', runtime }) }, (Mod) => {
    const runtime = {};
    const host = { runtime };
    const clock = Mod.ensureWorldClock(host);
    assert.equal(clock.id, 'new');
    assert.equal(host.worldClock, clock, 'clock cached on host');
    assert.equal(runtime.worldClock, clock, 'clock mirrored onto runtime');
  });
});

test('syncWorldClock rejects bad payloads and otherwise delegates to updateFromPayload', () => {
  withStubbedClock(
    {
      getShared: () => ({ id: 'c' }),
      updateFromPayload: (_clock, payload) => payload.ok === true,
    },
    (Mod) => {
      const host = {};
      assert.equal(Mod.syncWorldClock(host, null), false);
      assert.equal(Mod.syncWorldClock(host, { ok: true }), true);
      assert.equal(Mod.syncWorldClock(host, { ok: false }), false);
    },
  );
});

test('getWorldEpochNowMs resolves the clock chain: own -> runtime -> lastGame -> global shared', () => {
  withStubbedClock(
    { getEpochNowMs: ({ worldClock }, fallback) => (worldClock ? worldClock.tag : fallback) },
    (Mod) => {
      // App-like host: its own worldClock wins over runtime's.
      assert.equal(
        Mod.getWorldEpochNowMs({ worldClock: { tag: 100 }, runtime: { worldClock: { tag: 999 } } }),
        100,
      );
      // Falls through to runtime.worldClock.
      assert.equal(Mod.getWorldEpochNowMs({ runtime: { worldClock: { tag: 200 } } }), 200);
      // Shell-like host: no own/runtime clock -> mounted game's clock (this.lastGame.worldClock).
      assert.equal(Mod.getWorldEpochNowMs({ lastGame: { worldClock: { tag: 300 } } }), 300);
      // Nothing on the host -> the process-wide shared clock.
      g.__WorldClockShared = { tag: 400 };
      assert.equal(Mod.getWorldEpochNowMs({}), 400);
    },
  );
});
