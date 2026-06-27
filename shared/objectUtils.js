'use strict';

// Single source of truth for the tiny object helpers that were copy-pasted into
// ~20 files. Pure + dependency-free so it loads in both Node and the browser. The
// blocking guard scripts/check-duplicate-shared-helpers.js forbids re-defining
// these locally.

// Deep clone via JSON round-trip. NOTE: drops functions / undefined / Dates and
// throws on a bare `undefined` input -- matches the long-standing local copies.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Distinct concept from clone: passes primitives / null / undefined through
// untouched and only deep-clones objects (never throws on undefined). Several
// services hand-rolled this guarded variant; it gets its own honest name.
function cloneIfObject(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
}

// Pure type guard: a non-null, non-array object. Two services hand-rolled this
// (one as `Boolean(v && ...)`, one as `Boolean(v) && ...` -- behaviourally
// identical for every input). Single source here.
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const api = { clone, cloneIfObject, isPlainObject };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.ObjectUtils = api;
