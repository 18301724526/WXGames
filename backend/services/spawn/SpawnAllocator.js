const WorldMapService = require('../WorldMapService');
const { createCandidateStream } = require('./SpawnCandidateGenerator');
const { scoreSpawnCandidate } = require('./SpawnScoring');

function compareScoredCandidates(a, b) {
  return (
    Number(b.valid) - Number(a.valid)
    || b.score - a.score
    || b.nearestCapitalDistance - a.nearestCapitalDistance
    || a.q - b.q
    || a.r - b.r
  );
}

function allocateSpawn(options = {}) {
  const seed = options.seed || WorldMapService.DEFAULT_WORLD_SEED;
  const candidates = Array.isArray(options.candidates) && options.candidates.length
    ? options.candidates
    : createCandidateStream({ ...options, seed });
  const scoredCandidates = candidates
    .map((candidate) => scoreSpawnCandidate(candidate, { ...options, seed }))
    .sort(compareScoredCandidates);
  const selected = scoredCandidates.find((candidate) => candidate.valid) || null;

  return {
    success: Boolean(selected),
    selected,
    scoredCandidates,
    seed,
    playerId: String(options.playerId || ''),
  };
}

module.exports = {
  allocateSpawn,
  compareScoredCandidates,
};
