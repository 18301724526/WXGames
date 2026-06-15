const SpawnAllocator = require('./SpawnAllocator');
const SpawnAssignment = require('./SpawnAssignment');
const SpawnCandidateGenerator = require('./SpawnCandidateGenerator');
const SpawnConstants = require('./SpawnConstants');
const SpawnScoring = require('./SpawnScoring');

module.exports = {
  ...SpawnAssignment,
  ...SpawnConstants,
  ...SpawnScoring,
  ...SpawnCandidateGenerator,
  ...SpawnAllocator,
};
