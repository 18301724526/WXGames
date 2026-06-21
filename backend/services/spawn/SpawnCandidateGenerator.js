const WorldMapService = require('../WorldMapService');
const {
  DEFAULT_CANDIDATE_LIMIT,
  DEFAULT_SPAWN_RING_RADIUS,
} = require('./SpawnConstants');
const { getCoordinateKey } = require('./SpawnScoring');
const { hashString } = require('../../../shared/signatureHash');

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function createCandidateStream(options = {}) {
  const playerId = String(options.playerId || 'player');
  const ringRadius = Math.max(2, toInteger(options.ringRadius, DEFAULT_SPAWN_RING_RADIUS));
  const limit = Math.max(1, toInteger(options.limit, DEFAULT_CANDIDATE_LIMIT));
  const seed = `${options.seed || WorldMapService.DEFAULT_WORLD_SEED}|${playerId}|spawn`;
  const seen = new Set();
  const candidates = [];

  for (let index = 0; candidates.length < limit && index < limit * 8; index += 1) {
    const angleHash = hashString(`${seed}|angle|${index}`);
    const radiusHash = hashString(`${seed}|radius|${index}`);
    const angle = (angleHash % 3600) / 3600 * Math.PI * 2;
    const radiusBand = Math.floor(radiusHash % ringRadius);
    const radius = Math.max(2, ringRadius - Math.floor(ringRadius / 3) + radiusBand);
    const q = Math.round(Math.cos(angle) * radius);
    const r = Math.round(Math.sin(angle) * radius);
    const key = getCoordinateKey(q, r);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ q, r, source: 'hash-ring', order: candidates.length });
  }

  return candidates;
}

module.exports = {
  createCandidateStream,
  hashString,
};
