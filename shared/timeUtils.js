'use strict';

// Single source of truth for the ISO-timestamp helper that was copy-pasted into
// 6 backend services. Pure + dependency-free so it loads in both Node and the
// browser. The blocking guard scripts/check-duplicate-shared-helpers.js forbids
// re-defining it locally.
//
// NOTE: throws RangeError on an un-parseable `now` (matches the long-standing
// local copies). The invalid-date-guarded variant is a DIFFERENT concept and
// lives separately as SchemaMigrationService.nowIsoSafe.
function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

const api = { nowIso };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.TimeUtils = api;
