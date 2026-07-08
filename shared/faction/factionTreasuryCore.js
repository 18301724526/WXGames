// factionTreasuryCore — PURE arithmetic for a faction-level treasury (docs/design/01 §4 decision 01-4:
// players AND AI factions both hold a faction treasury). This is the ONE place treasury math happens —
// deposit city surplus, check affordability, and spend on build/research/train — so the economy refactor
// (per-city resources → faction pool) has a single, tested seam instead of ad-hoc +/- scattered across
// services. No IO, no mutation of inputs (every op returns a new treasury), deterministic.
//
// Single source: a treasury is a plain { [resource]: amount } map with amounts > 0 (a 0/absent key means
// "none", matching factionCore.normalizeTreasury which drops ≤0). Callers never hand-roll treasury +/-.

function toNonNeg(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Canonicalize a treasury: numeric, drop non-positive keys (0 === absent). Returns a new object.
function normalize(treasury) {
  const src = treasury && typeof treasury === 'object' ? treasury : {};
  const out = {};
  for (const key of Object.keys(src)) {
    const amt = toNonNeg(src[key]);
    if (amt > 0) out[key] = amt;
  }
  return out;
}

// Add city surplus (or any positive income) into the treasury. Negative/zero amounts are ignored —
// deposits are income, never a way to drain (use spend for that). Returns a new treasury.
function deposit(treasury, amounts) {
  const out = normalize(treasury);
  const inc = amounts && typeof amounts === 'object' ? amounts : {};
  for (const key of Object.keys(inc)) {
    const add = toNonNeg(inc[key]);
    if (add > 0) out[key] = (out[key] || 0) + add;
  }
  return out;
}

// Per-resource shortfall of `treasury` against `cost` (only keys where you're short; empty === affordable).
function shortfall(treasury, cost) {
  const have = normalize(treasury);
  const need = cost && typeof cost === 'object' ? cost : {};
  const gap = {};
  for (const key of Object.keys(need)) {
    const required = toNonNeg(need[key]);
    const missing = required - (have[key] || 0);
    if (missing > 0) gap[key] = missing;
  }
  return gap;
}

function canAfford(treasury, cost) {
  return Object.keys(shortfall(treasury, cost)).length === 0;
}

// Spend `cost` if affordable. Returns { ok, treasury, shortfall }. On failure the treasury is returned
// unchanged (normalized) and `shortfall` lists what's missing; on success `shortfall` is {}.
function spend(treasury, cost) {
  const gap = shortfall(treasury, cost);
  const normalized = normalize(treasury);
  if (Object.keys(gap).length > 0) return { ok: false, treasury: normalized, shortfall: gap };
  const need = cost && typeof cost === 'object' ? cost : {};
  const out = { ...normalized };
  for (const key of Object.keys(need)) {
    const required = toNonNeg(need[key]);
    if (required <= 0) continue;
    const left = (out[key] || 0) - required;
    if (left > 0) out[key] = left;
    else delete out[key]; // spent to zero → drop the key (0 === absent)
  }
  return { ok: true, treasury: out, shortfall: {} };
}

// Total across all resources (a coarse "wealth" scalar, e.g. for AI budgeting priorities).
function total(treasury) {
  const t = normalize(treasury);
  return Object.keys(t).reduce((sum, k) => sum + t[k], 0);
}

module.exports = { normalize, deposit, shortfall, canAfford, spend, total };
