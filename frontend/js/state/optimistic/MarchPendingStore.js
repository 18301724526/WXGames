(function (global) {
  // MarchPendingStore -- the single owner of optimistic world-march bookkeeping:
  // { sequence, pending, aliases }. Plain store, private state shape created per host,
  // mutated only through these named commands. No host, no network, no DOM.
  //
  //   sequence  -- monotonic counter used to mint unique optimistic pending ids
  //   pending   -- pendingId -> pending descriptor (the in-flight optimistic command)
  //   aliases   -- missionId/authorityId -> pendingId (so a reconcile or rollback can
  //                resolve a pending from a server-assigned mission id)
  //
  // applyPatch carries the two reconcile-time mutations the reconciler computes but
  // must not perform itself: alias writes (authorityId -> pendingId) and authorityId
  // stamps onto the live pending descriptors. Without applying these, rollback and
  // complete cannot resolve a pending by its server-assigned id.

  function createStore() {
    return {
      sequence: 0,
      pending: Object.create(null),
      aliases: Object.create(null),
    };
  }

  function ensureShape(store) {
    if (!store || typeof store !== 'object') return createStore();
    if (!store.pending || typeof store.pending !== 'object') store.pending = Object.create(null);
    if (!store.aliases || typeof store.aliases !== 'object') store.aliases = Object.create(null);
    if (!Number.isFinite(Number(store.sequence))) store.sequence = 0;
    return store;
  }

  function nextSequence(store) {
    const target = ensureShape(store);
    target.sequence = Number(target.sequence) + 1;
    return target.sequence;
  }

  function register(store, pending = {}) {
    const target = ensureShape(store);
    target.pending[pending.pendingId] = pending;
    if (pending.missionId && pending.missionId !== pending.pendingId) {
      target.aliases[pending.missionId] = pending.pendingId;
    }
    return pending;
  }

  function resolve(store, ref) {
    const target = ensureShape(store);
    const pendingId = typeof ref === 'string' ? target.aliases[ref] || ref : ref?.pendingId;
    return target.pending[pendingId] || target.pending[target.aliases[ref]] || null;
  }

  function remove(store, pendingId = '') {
    const target = ensureShape(store);
    const pending = target.pending[pendingId] || target.pending[target.aliases[pendingId]] || null;
    if (!pending) return false;
    delete target.pending[pending.pendingId];
    Object.entries(target.aliases).forEach(([alias, id]) => {
      if (id === pending.pendingId || alias === pending.pendingId) delete target.aliases[alias];
    });
    return true;
  }

  function list(store) {
    const target = ensureShape(store);
    return Object.values(target.pending);
  }

  // applyPatch -- apply the reconciler's deferred mutations.
  //   patch.aliases      -- { [authorityId]: pendingId } alias writes
  //   patch.authorityIds -- { [pendingId]: authorityId } authorityId stamps on pendings
  function applyPatch(store, patch = {}) {
    const target = ensureShape(store);
    const aliases = patch.aliases || {};
    Object.keys(aliases).forEach((authorityId) => {
      target.aliases[authorityId] = aliases[authorityId];
    });
    const authorityIds = patch.authorityIds || {};
    Object.keys(authorityIds).forEach((pendingId) => {
      const pending = target.pending[pendingId];
      if (pending) pending.authorityId = authorityIds[pendingId];
    });
    return target;
  }

  const api = Object.freeze({
    applyPatch,
    createStore,
    ensureShape,
    list,
    nextSequence,
    register,
    remove,
    resolve,
  });

  global.MarchPendingStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
