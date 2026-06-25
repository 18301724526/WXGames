'use strict';

// Batch 5 ECS modal owner. Pure, functional, serializable: it is scanned by the
// ECS boundary guard, so no classes, no `new` (except Error), no DOM/Event/
// Promise, and no stored closures. It is the source of truth for covered modal
// subtypes' presence + a frozen serializable payload + a token. Non-serializable
// continuations live in the app-side ModalCallbackRegistry, keyed by the token.
//
// State shape: { entries: { '<subtype>': { visible, token, payload } }, tokenSeq }.
// All returns are frozen; mutations produce a new frozen world (no in-place edits),
// matching the ModeWorld functional style.

function freezePayload(payload) {
  return Object.freeze({ ...(payload && typeof payload === 'object' ? payload : {}) });
}

function createModalWorld() {
  return Object.freeze({ entries: Object.freeze({}), tokenSeq: 0 });
}

function normalizeSubtype(subtype) {
  return String(subtype || '');
}

function withEntry(world, key, entry, tokenSeq) {
  const base = world && typeof world === 'object' ? world : createModalWorld();
  const entries = Object.freeze({ ...(base.entries || {}), [key]: Object.freeze(entry) });
  return Object.freeze({ entries, tokenSeq: tokenSeq != null ? tokenSeq : base.tokenSeq || 0 });
}

function getEntry(world, subtype) {
  return (world && world.entries && world.entries[normalizeSubtype(subtype)]) || null;
}

// Open (or re-open) a modal subtype with a fresh token and a frozen payload.
function openModal(world, subtype, payload = {}) {
  const base = world && typeof world === 'object' ? world : createModalWorld();
  const key = normalizeSubtype(subtype);
  const tokenSeq = (base.tokenSeq || 0) + 1;
  const token = `${key}#${tokenSeq}`;
  return withEntry(base, key, { visible: true, token, payload: freezePayload(payload) }, tokenSeq);
}

// Patch the payload of an already-open modal; no-op if the subtype is not open.
function updateModalPayload(world, subtype, patch = {}) {
  const prev = getEntry(world, subtype);
  if (!prev || !prev.visible)
    return world && typeof world === 'object' ? world : createModalWorld();
  const key = normalizeSubtype(subtype);
  const payload = freezePayload({ ...prev.payload, ...patch });
  return withEntry(world, key, { visible: true, token: prev.token, payload });
}

// Close a modal subtype, clearing its payload but keeping the world's token sequence.
function closeModal(world, subtype) {
  const key = normalizeSubtype(subtype);
  return withEntry(world, key, { visible: false, token: '', payload: Object.freeze({}) });
}

function isModalOpen(world, subtype) {
  return Boolean(getEntry(world, subtype)?.visible);
}

function getModalPayload(world, subtype) {
  const entry = getEntry(world, subtype);
  return entry && entry.visible ? entry.payload : null;
}

function getModalToken(world, subtype) {
  const entry = getEntry(world, subtype);
  return entry && entry.visible ? entry.token : '';
}

const api = Object.freeze({
  closeModal,
  createModalWorld,
  getEntry,
  getModalPayload,
  getModalToken,
  isModalOpen,
  openModal,
  updateModalPayload,
});

if (typeof globalThis !== 'undefined') globalThis.EcsModalWorld = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
