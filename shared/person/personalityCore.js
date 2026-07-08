// personalityCore — pure rules for 气性(性格) + 相性(compatibility). Spine B of the PVPVE/三国志
// person system (docs/design/02, decisions in 08). A person carries `personality.axes` (the THREE
// continuous personality axes — boldness/sociability/integrity, -1..1 — which ARE the multi-dim
// compatibility vector the user confirmed) plus a readable `nature` anchor derived from them.
// Personality drives WORLD BEHAVIOR only (meet rate, bonds, betrayal, grudges, loyalty drift, ruler
// aggression) — never combat stats (those stay on the 6 attributes + skills, no dual source).
//
// PURE: the config-table rows (`personality_natures`) and tuning (`personality_tuning`) are passed in
// by the caller (a backend service reads ConfigTables and passes them), so the same rules run on
// server, worker, and tests — exactly like veteranCampCore / worldMarchCore.

const AXES = ['boldness', 'sociability', 'integrity'];

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampAxis(value) {
  return Math.max(-1, Math.min(1, toNumber(value, 0)));
}

function round2(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

// Deterministic seeding (reproducible personalities): FNV-1a hash -> mulberry32 PRNG.
function hashSeed(seed) {
  const str = String(seed == null ? '' : seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makePrng(seed) {
  let a = hashSeed(seed) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeAxes(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    boldness: round2(clampAxis(src.boldness)),
    sociability: round2(clampAxis(src.sociability)),
    integrity: round2(clampAxis(src.integrity)),
  };
}

function anchorAxesOf(natureRow) {
  return {
    boldness: clampAxis(natureRow?.aBoldness),
    sociability: clampAxis(natureRow?.aSociability),
    integrity: clampAxis(natureRow?.aIntegrity),
  };
}

function axisWeights(tuning) {
  const t = tuning && typeof tuning === 'object' ? tuning : {};
  return {
    boldness: Math.max(0, toNumber(t.wBoldness, 1)),
    sociability: Math.max(0, toNumber(t.wSociability, 1)),
    integrity: Math.max(0, toNumber(t.wIntegrity, 1)),
  };
}

// Weighted axis alignment of two axis-vectors: 1 = identical, 0 = fully opposite.
function axisAlignment(axesA, axesB, tuning) {
  const a = normalizeAxes(axesA);
  const b = normalizeAxes(axesB);
  const w = axisWeights(tuning);
  const wsum = w.boldness + w.sociability + w.integrity || 1;
  // each |diff| is in 0..2 (axes are -1..1); normalize the weighted mean distance to 0..1.
  const dist = AXES.reduce((sum, k) => sum + w[k] * Math.abs(a[k] - b[k]), 0) / wsum;
  return 1 - dist / 2;
}

// 投缘度 rapport in -scale..+scale: two people are compatible (positive) when their weighted axis
// alignment is above the neutral midpoint, incompatible (相克, negative) below it.
function compatScore(axesA, axesB, tuning) {
  const scale = Math.max(1, toNumber((tuning || {}).rapportScale, 100));
  const alignment = axisAlignment(axesA, axesB, tuning);
  return Math.round((alignment * 2 - 1) * scale);
}

// The named nature = the anchor nearest (weighted) to a set of axes. Axes are the source of truth;
// nature is their readable quantized name (recomputed on normalize if they disagree).
function nearestNature(axes, natures) {
  const rows = Array.isArray(natures) ? natures.filter((r) => r && r.natureId) : [];
  if (!rows.length) return null;
  let best = null;
  let bestAlign = -Infinity;
  for (const row of rows) {
    const align = axisAlignment(axes, anchorAxesOf(row), null);
    if (align > bestAlign) {
      bestAlign = align;
      best = row.natureId;
    }
  }
  return best;
}

function pickNatureByWeight(prng, natures) {
  const rows = Array.isArray(natures) ? natures.filter((r) => r && r.natureId) : [];
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + Math.max(0, toNumber(r.weight, 1)), 0) || rows.length;
  let roll = prng() * total;
  for (const row of rows) {
    roll -= Math.max(0, toNumber(row.weight, 1));
    if (roll <= 0) return row;
  }
  return rows[rows.length - 1];
}

// Deterministically assign a personality from a seed: pick a nature by weight, jitter its anchor into
// concrete axes (so people of the same nature still differ), then re-derive nature from the jittered
// axes (axes are the single source of truth).
function assignPersonality(seed, natures, tuning) {
  const rows = Array.isArray(natures) ? natures.filter((r) => r && r.natureId) : [];
  if (!rows.length) return { nature: null, axes: normalizeAxes(null) };
  const prng = makePrng(seed);
  const anchor = pickNatureByWeight(prng, rows);
  const jitter = Math.max(0, toNumber((tuning || {}).axisJitter, 0.25));
  const anchorAxes = anchorAxesOf(anchor);
  const axes = normalizeAxes({
    boldness: anchorAxes.boldness + (prng() * 2 - 1) * jitter,
    sociability: anchorAxes.sociability + (prng() * 2 - 1) * jitter,
    integrity: anchorAxes.integrity + (prng() * 2 - 1) * jitter,
  });
  return { nature: nearestNature(axes, rows), axes };
}

// Normalize a stored personality, keeping axes authoritative and recomputing nature if it drifted.
function normalizePersonality(raw, natures) {
  const axes = normalizeAxes(raw && raw.axes);
  const nature = nearestNature(axes, natures) || (raw && raw.nature) || null;
  return { nature, axes };
}

// A behaviour multiplier/bias for a nature (meetRateMult, bondBias, betrayalBias, grudgeBias,
// loyaltyDriftMult, aggression, ...) read from the personality_natures row. Fallback if absent.
function behaviorMult(nature, key, natures, fallback = 1) {
  const rows = Array.isArray(natures) ? natures : [];
  const row = rows.find((r) => r && r.natureId === nature);
  if (!row || row[key] == null) return fallback;
  return toNumber(row[key], fallback);
}

module.exports = {
  AXES,
  hashSeed,
  makePrng,
  normalizeAxes,
  axisAlignment,
  compatScore,
  nearestNature,
  assignPersonality,
  normalizePersonality,
  behaviorMult,
};
