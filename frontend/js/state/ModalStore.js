(function (global) {
  'use strict';

  // state/ModalStore.js -- the single source of truth for modal presence.
  //
  // One fact lives here and nowhere else: which modal subtypes are open, with the
  // frozen payload + minted token + (optional) non-serializable continuations for
  // each. Presence is COMPUTED from `state.entries[subtype]` existence -- there is
  // NO `open` boolean mirror to drift. Tokens embed their subtype as
  // `<subtype>#<seq>` so resolve(token) can recover the entry without a second map.
  //
  // Reads never clone the live payload (getPayload returns the stored frozen object).
  // The renderer-facing read is buildModalSnapshot(), which reconstructs the
  // { entries: { subtype: { open, token, payload } } } shape the snapshot boundary
  // and the per-panel facts consume.

  const state = {
    entries: {
      /* '<subtype>' -> { token, payload, callbacks } */
    },
    tokenSeq: 0,
  };

  function normalizeSubtype(subtype) {
    return String(subtype || '');
  }

  function freezePayload(payload) {
    return Object.freeze({ ...(payload && typeof payload === 'object' ? payload : {}) });
  }

  function subtypeFromToken(token) {
    const text = String(token || '');
    const index = text.lastIndexOf('#');
    return index >= 0 ? text.slice(0, index) : text;
  }

  // --- commands (the only write entry points) ---

  // Open (or re-open) a modal subtype with a fresh token + frozen payload, plus
  // optional callbacks (continuations kept off the serializable payload). Returns
  // the minted token.
  function openModal(subtype, payload = {}, callbacks = null) {
    const key = normalizeSubtype(subtype);
    state.tokenSeq += 1;
    const token = `${key}#${state.tokenSeq}`;
    state.entries[key] = {
      token,
      payload: freezePayload(payload),
      callbacks: callbacks && typeof callbacks === 'object' ? callbacks : null,
    };
    return token;
  }

  // Patch the payload of an already-open modal; no-op if the subtype is not open.
  function updateModalPayload(subtype, patch = {}) {
    const key = normalizeSubtype(subtype);
    const entry = state.entries[key];
    if (!entry) return null;
    entry.payload = freezePayload({ ...entry.payload, ...(patch || {}) });
    return entry.payload;
  }

  function closeModal(subtype) {
    const key = normalizeSubtype(subtype);
    delete state.entries[key];
    return null;
  }

  // Close every open modal subtype at once (e.g. a full UI reset). tokenSeq is NOT
  // reset, so any token minted before a closeAll stays globally unique.
  function closeAll() {
    state.entries = {};
    return null;
  }

  // --- queries (read-only, never clone) ---

  function isOpen(subtype) {
    return Boolean(state.entries[normalizeSubtype(subtype)]);
  }

  function getPayload(subtype) {
    const entry = state.entries[normalizeSubtype(subtype)];
    return entry ? entry.payload : null;
  }

  function getToken(subtype) {
    const entry = state.entries[normalizeSubtype(subtype)];
    return entry ? entry.token : '';
  }

  // Invoke a stored continuation by token. The token carries its subtype, so the
  // owning entry is recovered without a second map; a stale token (closed/reopened)
  // matches no live entry and is inert.
  function resolve(token, action, ...args) {
    const entry = state.entries[subtypeFromToken(token)];
    if (!entry || entry.token !== String(token) || !entry.callbacks) return undefined;
    const fn = typeof entry.callbacks[action] === 'function' ? entry.callbacks[action] : null;
    return fn ? fn(...args) : undefined;
  }

  // Renderer-facing read: the { entries: { subtype: { open, token, payload } } }
  // shape the RendererSnapshotBoundary + per-panel facts reconstruct from. `open`
  // is recomputed here (presence), not stored.
  function buildModalSnapshot() {
    const entries = {};
    Object.keys(state.entries).forEach((subtype) => {
      const entry = state.entries[subtype];
      entries[subtype] = { open: true, token: entry.token, payload: entry.payload };
    });
    return { entries };
  }

  function debugView() {
    return JSON.parse(JSON.stringify(buildModalSnapshot()));
  }

  const api = Object.freeze({
    openModal,
    updateModalPayload,
    closeModal,
    closeAll,
    isOpen,
    getPayload,
    getToken,
    resolve,
    buildModalSnapshot,
    debugView,
  });

  global.ModalStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
