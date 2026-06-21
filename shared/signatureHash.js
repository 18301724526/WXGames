'use strict';

// Shared FNV-1a 32-bit hash used for deterministic seeds and cache/render
// signatures across backend services and frontend snapshots/renderers.
//
// Three named helpers preserve the exact input coercion of the legacy inline
// copies they replace, so swapping a call site to this module is byte-identical:
//   - hashStep(hash, value): String(value ?? ''), seeded by the caller's hash
//   - hashString(input):     String(input),       seeded by FNV_OFFSET_BASIS
//   - hashText(value):       String(value || ''), seeded by FNV_OFFSET_BASIS
//
// Do not change the algorithm: backend world/content generation derives
// deterministic seeds from these values, and changing the output would alter
// generated terrain, candidates, and persisted signatures.

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

function foldString(hash, text) {
  let next = hash >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, FNV_PRIME);
  }
  return next >>> 0;
}

function hashStep(hash, value) {
  return foldString(hash, String(value ?? ''));
}

function hashString(input) {
  return foldString(FNV_OFFSET_BASIS, String(input));
}

function hashText(value) {
  return foldString(FNV_OFFSET_BASIS, String(value || ''));
}

module.exports = {
  FNV_OFFSET_BASIS,
  FNV_PRIME,
  foldString,
  hashStep,
  hashString,
  hashText,
};
