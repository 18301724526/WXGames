'use strict';

// Single source of truth for the small numeric coercion helpers that were
// previously copy-pasted into ~30 files. Pure + dependency-free so it loads in
// both Node (CommonJS require) and the browser (global). The blocking guard
// scripts/check-duplicate-number-helpers.js forbids re-defining these locally.

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

// Distinct concept from toInteger: floors AND clamps to non-negative. Several
// services independently reinvented this (a `toInteger` that secretly did
// Math.max(0, ...)); it gets its own honest name + single source so it is never
// confused with the plain toInteger again.
function toNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const api = { toNumber, toInteger, toNonNegativeInteger, clamp };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.NumberUtils = api;
