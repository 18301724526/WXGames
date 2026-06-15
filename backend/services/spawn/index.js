const SpawnAllocator = require('./SpawnAllocator');
const SpawnCandidateGenerator = require('./SpawnCandidateGenerator');
const SpawnConstants = require('./SpawnConstants');
const SpawnScoring = require('./SpawnScoring');

module.exports = {
  ...SpawnConstants,
  ...SpawnScoring,
  ...SpawnCandidateGenerator,
  ...SpawnAllocator,
};
