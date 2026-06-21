(function (global) {
  // Browser-facing copy of the shared FNV-1a hash. The backend/Node canonical
  // source is shared/signatureHash.js; this file mirrors it byte-for-byte for
  // the browser, where top-level shared/ is not served. shared/signatureHash.drift.test.js
  // requires both and asserts identical output so the two copies cannot drift.
  //
  // Three named helpers preserve the exact input coercion of the legacy inline
  // copies they replace, so swapping a call site is byte-identical:
  //   - hashStep(hash, value): String(value ?? ''), seeded by the caller's hash
  //   - hashString(input):     String(input),       seeded by FNV_OFFSET_BASIS
  //   - hashText(value):       String(value || ''), seeded by FNV_OFFSET_BASIS

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

  const api = {
    FNV_OFFSET_BASIS,
    FNV_PRIME,
    foldString,
    hashStep,
    hashString,
    hashText,
  };

  global.SignatureHash = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
