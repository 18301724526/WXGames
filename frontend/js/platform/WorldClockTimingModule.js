// WorldClockTimingModule -- SHAPE-A (stateless, host-passing) world-clock timing for
// the canvas game host. Extracted from CanvasGameApp (god-file re-decomposition slice 1).
//
// The three functions read/write the host's own `worldClock`/`runtime` slots, so one
// implementation serves BOTH CanvasGameApp (host === the live game) and CanvasGameShell
// (host.lastGame carries the mounted game). getWorldEpochNowMs uses the superset clock
// chain (host.worldClock -> runtime.worldClock -> lastGame.worldClock -> global shared)
// which is behaviour-preserving for the app (no lastGame) and covers the shell -- this is
// what let CanvasGameShell drop its divergent getWorldEpochNowMs/now overrides.
(function (global) {
  var SharedWorldClock = global.WorldClock;
  if (typeof module !== 'undefined' && module.exports && !SharedWorldClock) {
    try {
      SharedWorldClock = require('../ecs/foundation/WorldClock');
    } catch (_error) {
      SharedWorldClock = null;
    }
  }

  function ensureWorldClock(host) {
    if (!host) return null;
    if (host.worldClock) return host.worldClock;
    host.worldClock = SharedWorldClock?.getShared?.({ runtime: host.runtime }) || null;
    if (host.runtime && typeof host.runtime === 'object' && host.worldClock) {
      host.runtime.worldClock = host.worldClock;
    }
    return host.worldClock;
  }

  function syncWorldClock(host, payload = {}) {
    const clock = ensureWorldClock(host);
    if (!clock || !payload || typeof payload !== 'object') return false;
    return SharedWorldClock?.updateFromPayload?.(clock, payload) || false;
  }

  function getWorldEpochNowMs(host) {
    const clock =
      host?.worldClock ||
      host?.runtime?.worldClock ||
      host?.lastGame?.worldClock ||
      global.__WorldClockShared;
    return SharedWorldClock?.getEpochNowMs?.({ worldClock: clock }, Date.now()) ?? Date.now();
  }

  const api = Object.freeze({ ensureWorldClock, syncWorldClock, getWorldEpochNowMs });
  global.WorldClockTimingModule = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
