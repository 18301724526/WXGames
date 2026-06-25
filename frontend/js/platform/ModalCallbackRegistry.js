(function (global) {
  'use strict';

  // App-side companion to the ECS modal owner. The ECS owner stays pure and
  // serializable and holds only a modal token; non-serializable continuations
  // (e.g. confirmDialog onConfirm/onCancel) live here, keyed by that token, so
  // they never enter frontend/js/ecs. naming has no stored callback today, so
  // this registry is exercised by confirmDialog (the next 5a step) and later
  // slices; it is built now so the owner-holds-token pattern is in place.
  function createModalCallbackRegistry() {
    const byToken = new Map();
    return {
      register(token, callbacks) {
        if (!token) return false;
        byToken.set(String(token), callbacks && typeof callbacks === 'object' ? callbacks : {});
        return true;
      },
      resolve(token, action, ...args) {
        const entry = byToken.get(String(token));
        const fn = entry && typeof entry[action] === 'function' ? entry[action] : null;
        return fn ? fn(...args) : undefined;
      },
      clear(token) {
        return byToken.delete(String(token));
      },
      has(token) {
        return byToken.has(String(token));
      },
      size() {
        return byToken.size;
      },
    };
  }

  const api = { createModalCallbackRegistry };

  global.ModalCallbackRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
