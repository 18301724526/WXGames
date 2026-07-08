// GarrisonPolicy — the single source for "is this neutral city defended, and by how much".
//
// An EMPTY (neutral) city is defended based on its distance band from the capital (config table
// `garrison`): the `safe` spawn band is undefended (frictionless settlement, protects the tutorial
// and home region), farther bands spawn a garrison you must beat before occupying. Both the
// occupation-mode decision (settlement vs conquest) and the defender-garrison generation consult
// THIS module with the same (territory, distance) inputs, so they can never disagree.
//
// Pure: reads the config table + takes a precomputed distance; no world/service coupling.
const ConfigTables = require('../../config/ConfigTables');

function toDistance(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

// Resolve the distance band for a ring distance. Bands are matched by ascending maxDistance;
// the last band (maxDistance 9999) is the catch-all for anything beyond the named bands.
function resolveBand(distance) {
  const dist = toDistance(distance);
  const rows = ConfigTables.getRows('garrison');
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => (Number(a.maxDistance) || 0) - (Number(b.maxDistance) || 0));
  return sorted.find((row) => dist <= (Number(row.maxDistance) || 0)) || sorted[sorted.length - 1];
}

// Only NEUTRAL, non-capital cities are gated by the band. Hostile territories keep their own
// garrison logic; player/capital are never defended-against-you.
function isNeutralCityDefended(territory = {}, distance) {
  const owner = territory.owner || 'neutral';
  if (owner !== 'neutral') return false;
  if (territory.id === 'capital') return false;
  const band = resolveBand(distance);
  return Boolean(band && band.defended);
}

// Garrison soldier count for a band + a site's scale.
function garrisonSoldiers(band, scale) {
  const base = Math.max(0, Math.floor(Number(band?.baseSoldiers) || 0));
  const perScale = Math.max(0, Math.floor(Number(band?.soldiersPerScale) || 0));
  const siteScale = Math.max(1, Math.floor(Number(scale) || 1));
  return base + perScale * siteScale;
}

function clampRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function bandCaptureChance(band) {
  return clampRate(band?.captureChance);
}

function bandRecruitBaseRate(band) {
  return clampRate(band?.recruitBaseRate);
}

module.exports = {
  resolveBand,
  isNeutralCityDefended,
  garrisonSoldiers,
  bandCaptureChance,
  bandRecruitBaseRate,
};
