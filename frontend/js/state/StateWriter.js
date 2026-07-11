(function (global) {
  'use strict';

  // state/StateWriter.js -- the single write point for the live game state owner.
  //
  // North star: there is exactly ONE place that assigns the host/owner `.state`.
  // To answer "who wrote the state?" you read this one module. StateWriter keeps NO
  // copy of state of its own -- it is pure host-resolution + routing. It does not
  // mirror, cache, or normalize; it just selects the canonical owner and assigns.
  //
  // Owner-selection precedence (load-bearing, pinned by
  // CanvasGameAppTripleHostMirror.test.js and shared with state/optimistic/index.js):
  // the live owner is `host.lastGame` when it is a distinct object, otherwise `host`.
  // The shell (CanvasGameShell) mounts the real game as `lastGame`, so a write made
  // from the shell lands on the mounted game -- the same slot getState() reads. On a
  // bare game app `lastGame` is absent, so the owner resolves to the app itself.

  function getStateHost(host) {
    return host && host.lastGame && host.lastGame !== host && typeof host.lastGame === 'object'
      ? host.lastGame
      : host;
  }

  function getUiRuntimeStateStore() {
    if (global.UiRuntimeStateStore) return global.UiRuntimeStateStore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./UiRuntimeStateStore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  function getChangeEventBus() {
    if (global.ChangeEventBus) return global.ChangeEventBus;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ChangeEventBus');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  // commit(host, patcher[, meta])
  //   - object patcher  => wholesale replace: owner.state = patcher
  //   - function patcher => derive-from-prev: owner.state = patcher(owner.state || {})
  // Returns the new state object (or undefined when there is no owner to write).
  // `meta` ({ source, action }) is accepted for future debug routing; StateWriter
  // does not store it -- it stays a pure write conduit.
  function commit(host, patcher, meta) {
    const owner = getStateHost(host);
    if (!owner || typeof owner !== 'object') return undefined;
    const previous = owner.state;
    const next = typeof patcher === 'function' ? patcher(previous || {}) : patcher;
    owner.state = next;
    getUiRuntimeStateStore()?.syncFromState?.(owner, next);
    getChangeEventBus()?.emit?.('state.changed', {
      source: 'StateWriter',
      operation: 'commit',
      owner,
      previous,
      next,
      meta: meta && typeof meta === 'object' ? { ...meta } : {},
    });
    return next;
  }

  // wholesaleReplace(host, nextState[, meta]) -- thin alias of commit with an object
  // patcher, kept as a named entry point for call sites that replace the whole state.
  function wholesaleReplace(host, nextState, meta) {
    return commit(host, nextState, meta);
  }

  const api = Object.freeze({
    getStateHost,
    commit,
    wholesaleReplace,
  });

  global.StateWriter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
