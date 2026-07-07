const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMapService = require('../services/WorldMapService');
const SpawnAllocator = require('../services/spawn/SpawnAllocator');
const SpawnScoring = require('../services/spawn/SpawnScoring');

test('spawn scorer rejects blocked capital terrain', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  WorldMapService.chooseTerrain = (_seed, q, r) => (q === 8 && r === 8 ? 'ocean' : 'plains');

  const result = SpawnScoring.scoreSpawnCandidate({ q: 8, r: 8 }, {
    seed: 'spawn-blocked-terrain-test',
    occupiedCoordinates: [],
  });

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('BLOCKED_TERRAIN'));
});

test('spawn scorer rejects candidates too close to existing capitals', () => {
  const result = SpawnScoring.scoreSpawnCandidate({ q: 6, r: 0 }, {
    seed: 'spawn-distance-test',
    occupiedCoordinates: [{ q: 0, r: 0 }],
    minCapitalDistance: 10,
  });

  assert.equal(result.valid, false);
  assert.ok(result.reasons.includes('TOO_CLOSE_TO_CAPITAL'));
});

test('spawn scorer default capital spacing requires more than twenty tiles', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  WorldMapService.chooseTerrain = () => 'plains';

  const tooClose = SpawnScoring.scoreSpawnCandidate({ q: 20, r: 0 }, {
    seed: 'spawn-default-spacing-test',
    occupiedCoordinates: [{ q: 0, r: 0 }],
  });
  const accepted = SpawnScoring.scoreSpawnCandidate({ q: 21, r: 0 }, {
    seed: 'spawn-default-spacing-test',
    occupiedCoordinates: [{ q: 0, r: 0 }],
  });

  assert.equal(tooClose.valid, false);
  assert.ok(tooClose.reasons.includes('TOO_CLOSE_TO_CAPITAL'));
  assert.equal(accepted.valid, true);
});

test('spawn scorer treats world cities as exact tile blockers without capital spacing', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  WorldMapService.chooseTerrain = () => 'plains';

  const exact = SpawnScoring.scoreSpawnCandidate({ q: 4, r: 0 }, {
    seed: 'spawn-world-city-block-test',
    occupiedCoordinates: [{ q: 4, r: 0, source: 'world-city', blocksDistance: false }],
    minCapitalDistance: 10,
  });
  assert.equal(exact.valid, false);
  assert.ok(exact.reasons.includes('OCCUPIED_TILE'));
  assert.equal(exact.reasons.includes('TOO_CLOSE_TO_CAPITAL'), false);

  const nearby = SpawnScoring.scoreSpawnCandidate({ q: 4, r: 0 }, {
    seed: 'spawn-world-city-nearby-test',
    occupiedCoordinates: [{ q: 5, r: 0, source: 'world-city', blocksDistance: false }],
    minCapitalDistance: 10,
  });
  assert.equal(nearby.valid, true);
  assert.equal(nearby.nearestCapitalDistance, Infinity);
  assert.notDeepEqual(
    { q: nearby.tutorialTarget.q, r: nearby.tutorialTarget.r },
    { q: 5, r: 0 },
  );
});

test('spawn allocator selects a valid uncrowded candidate with tutorial target', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  WorldMapService.chooseTerrain = () => 'plains';

  const result = SpawnAllocator.allocateSpawn({
    playerId: 'spawn-step-one-player',
    seed: 'spawn-selection-test',
    candidates: [
      { q: 4, r: 0 },
      { q: 18, r: 0 },
      { q: 12, r: 12 },
    ],
    occupiedCoordinates: [
      { q: 0, r: 0 },
      { q: 5, r: 0 },
    ],
    minCapitalDistance: 10,
  });

  assert.equal(result.success, true);
  assert.equal(result.selected.q, 18);
  assert.equal(result.selected.r, 0);
  assert.equal(result.selected.valid, true);
  assert.ok(result.selected.tutorialTarget);
});

test('spawn allocator reports failure when every candidate is invalid', (t) => {
  const originalChooseTerrain = WorldMapService.chooseTerrain;
  t.after(() => {
    WorldMapService.chooseTerrain = originalChooseTerrain;
  });
  WorldMapService.chooseTerrain = () => 'ocean';

  const result = SpawnAllocator.allocateSpawn({
    playerId: 'spawn-no-valid-player',
    seed: 'spawn-no-valid-test',
    candidates: [{ q: 30, r: 0 }, { q: 40, r: 0 }],
    occupiedCoordinates: [],
  });

  assert.equal(result.success, false);
  assert.equal(result.selected, null);
  assert.ok(result.scoredCandidates.every((candidate) => candidate.reasons.includes('BLOCKED_TERRAIN')));
});
