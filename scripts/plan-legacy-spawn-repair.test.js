const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPlanFromRows,
  classifyPlayer,
  parseArgs,
  readCapitalCoord,
  readWorldOrigin,
} = require('./plan-legacy-spawn-repair');

function worldMapOrigin(q, r) {
  return JSON.stringify({ origin: { q, r }, tiles: [] });
}

function territoriesCapital(q, r) {
  return JSON.stringify([{ id: 'capital', type: 'capital', x: q, y: r }]);
}

test('classifyPlayer marks missing-spawn origin zero accounts as reset-style repair candidates', () => {
  const classified = classifyPlayer({
    playerId: 'legacy-player',
    lastActiveAt: '2026-06-16T00:00:00.000Z',
    worldMap: worldMapOrigin(0, 0),
    territories: territoriesCapital(0, 0),
    spawnKey: null,
  });

  assert.equal(classified.repairMode, 'eligible-reset-style-repair');
  assert.equal(classified.originIsZeroZero, true);
  assert.equal(classified.capitalIsZeroZero, true);
  assert.equal(classified.hasSpawnAllocation, false);
});

test('classifyPlayer skips accounts already backed by a non-legacy spawn allocation', () => {
  const classified = classifyPlayer({
    playerId: 'spawned-player',
    worldMap: worldMapOrigin(23, 18),
    territories: territoriesCapital(23, 18),
    spawnQ: 23,
    spawnR: 18,
    spawnKey: '23,18',
    spawnStatus: 'reserved',
  });

  assert.equal(classified.repairMode, 'skip-already-spawned');
  assert.deepEqual(classified.origin, { q: 23, r: 18 });
  assert.deepEqual(classified.capital, { q: 23, r: 18 });
  assert.equal(classified.spawn.spawnKey, '23,18');
});

test('classifyPlayer sends mixed legacy state to manual review', () => {
  const classified = classifyPlayer({
    playerId: 'mixed-player',
    worldMap: worldMapOrigin(0, 0),
    territories: territoriesCapital(12, -3),
    spawnKey: null,
  });

  assert.equal(classified.repairMode, 'manual-review');
  assert.equal(classified.originIsZeroZero, true);
  assert.equal(classified.capitalIsZeroZero, false);
});

test('buildPlanFromRows summarizes readonly repair plan without writes', () => {
  const plan = buildPlanFromRows([
    {
      playerId: 'legacy-a',
      lastActiveAt: '2026-06-16T00:00:00.000Z',
      worldMap: worldMapOrigin(0, 0),
      territories: territoriesCapital(0, 0),
    },
    {
      playerId: 'spawned-a',
      lastActiveAt: '2026-06-16T00:01:00.000Z',
      worldMap: worldMapOrigin(-6, 28),
      territories: territoriesCapital(-6, 28),
      spawnQ: -6,
      spawnR: 28,
      spawnKey: '-6,28',
      spawnStatus: 'reserved',
    },
    {
      playerId: 'mixed-a',
      lastActiveAt: '2026-06-16T00:02:00.000Z',
      worldMap: worldMapOrigin(0, 0),
      territories: territoriesCapital(5, 5),
    },
  ], {
    players: 3,
    gameStates: 3,
    spawnAllocations: 1,
  });

  assert.equal(plan.readonly, true);
  assert.equal(plan.writesPerformed, false);
  assert.equal(plan.counts.players, 3);
  assert.equal(plan.counts.gameStates, 3);
  assert.equal(plan.counts.spawnAllocations, 1);
  assert.equal(plan.counts.legacyOriginAndCapital00, 1);
  assert.equal(plan.counts.missingSpawnAllocation, 2);
  assert.equal(plan.counts['eligible-reset-style-repair'], 1);
  assert.equal(plan.counts['skip-already-spawned'], 1);
  assert.equal(plan.counts['manual-review'], 1);
  assert.equal(plan.samples.legacyCandidates[0].playerId, 'legacy-a');
});

test('origin and capital readers tolerate malformed JSON', () => {
  assert.equal(readWorldOrigin('{bad'), null);
  assert.equal(readCapitalCoord('{bad'), null);
});

test('parseArgs supports db path, json mode, and sample limit', () => {
  const options = parseArgs(['--db', '/tmp/example.db', '--json', '--sample-limit=7']);

  assert.equal(options.dbPath, '/tmp/example.db');
  assert.equal(options.json, true);
  assert.equal(options.sampleLimit, 7);
});
