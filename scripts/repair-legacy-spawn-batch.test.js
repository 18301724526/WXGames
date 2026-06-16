const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('../backend/node_modules/better-sqlite3');

const GameStateRepository = require('../backend/repositories/GameStateRepository');
const GameStateNormalizer = require('../backend/services/GameStateNormalizer');

const {
  chooseCandidates,
  expectedBatchConfirmation,
  parseArgs,
  repairLegacySpawnBatch,
} = require('./repair-legacy-spawn-batch');

function createRepository() {
  const db = new Database(':memory:');
  const repository = new GameStateRepository(db);
  repository.init();
  return { db, repository };
}

function createLegacyState(playerId) {
  const state = GameStateNormalizer.createInitialGameState(playerId, {
    now: new Date('2026-06-16T00:00:00.000Z'),
  });
  state.territories = [
    ...state.territories,
    {
      id: `site_${playerId}`,
      type: 'town',
      x: 3,
      y: 0,
      owner: 'player',
      ownerPlayerId: playerId,
      status: 'occupied',
    },
  ];
  return state;
}

function seedLegacyAccounts(repository, playerIds) {
  playerIds.forEach((playerId) => repository.save(createLegacyState(playerId)));
}

test('repairLegacySpawnBatch dry-run selects limited eligible accounts without writes', () => {
  const { db, repository } = createRepository();
  try {
    seedLegacyAccounts(repository, ['legacy-a', 'legacy-b']);

    const report = repairLegacySpawnBatch(db, { limit: 1 });

    assert.equal(report.dryRun, true);
    assert.equal(report.writesPerformed, false);
    assert.equal(report.selectedPlayers.length, 1);
    assert.equal(report.totals.selected, 1);
    assert.equal(report.reports[0].dryRun, true);
    assert.equal(repository.getSpawnForPlayer(report.selectedPlayers[0]), null);
  } finally {
    db.close();
  }
});

test('repairLegacySpawnBatch write mode requires batch confirmation', () => {
  const { db, repository } = createRepository();
  try {
    seedLegacyAccounts(repository, ['legacy-confirm']);

    assert.throws(
      () => repairLegacySpawnBatch(db, {
        limit: 1,
        write: true,
        confirm: 'wrong',
      }),
      /Write requires --confirm repair-legacy-spawn-batch:1/,
    );
    assert.equal(repository.getSpawnForPlayer('legacy-confirm'), null);
  } finally {
    db.close();
  }
});

test('repairLegacySpawnBatch repairs only the requested limit through reset-style account repair', () => {
  const { db, repository } = createRepository();
  try {
    seedLegacyAccounts(repository, ['legacy-one', 'legacy-two']);

    const report = repairLegacySpawnBatch(db, {
      limit: 1,
      write: true,
      confirm: expectedBatchConfirmation(1),
    });

    assert.equal(report.writesPerformed, true);
    assert.equal(report.totals.selected, 1);
    assert.equal(report.totals.repaired, 1);
    assert.equal(report.reports.length, 1);
    assert.equal(report.reports[0].after.visibleTileCount, 25);
    assert.ok(repository.getSpawnForPlayer(report.selectedPlayers[0]));
    const untouched = ['legacy-one', 'legacy-two'].find((playerId) => playerId !== report.selectedPlayers[0]);
    assert.equal(repository.getSpawnForPlayer(untouched), null);
    assert.deepEqual(repository.findByPlayerId(untouched).worldMap.origin, { q: 0, r: 0 });
  } finally {
    db.close();
  }
});

test('repairLegacySpawnBatch can restrict candidates to explicit players', () => {
  const { db, repository } = createRepository();
  try {
    seedLegacyAccounts(repository, ['legacy-a', 'legacy-b', 'legacy-c']);

    const report = repairLegacySpawnBatch(db, {
      limit: 2,
      includePlayers: ['legacy-b'],
    });

    assert.deepEqual(report.selectedPlayers, ['legacy-b']);
    assert.equal(report.totals.selected, 1);
  } finally {
    db.close();
  }
});

test('chooseCandidates honors includePlayers and limit', () => {
  const plan = {
    samples: {
      legacyCandidates: [
        { playerId: 'a' },
        { playerId: 'b' },
        { playerId: 'c' },
      ],
    },
  };

  assert.deepEqual(
    chooseCandidates(plan, { includePlayers: ['c', 'a'], limit: 1 }).map((candidate) => candidate.playerId),
    ['a'],
  );
  assert.deepEqual(
    chooseCandidates(plan, { limit: 2 }).map((candidate) => candidate.playerId),
    ['a', 'b'],
  );
});

test('parseArgs reads db, limit, player, write, json, and confirmation options', () => {
  const options = parseArgs([
    '--db=/tmp/example.db',
    '--limit',
    '3',
    '--player',
    'test1',
    '--player=test2',
    '--write',
    '--confirm',
    'repair-legacy-spawn-batch:3',
    '--json',
  ]);

  assert.equal(options.dbPath, '/tmp/example.db');
  assert.equal(options.limit, 3);
  assert.deepEqual(options.includePlayers, ['test1', 'test2']);
  assert.equal(options.write, true);
  assert.equal(options.confirm, 'repair-legacy-spawn-batch:3');
  assert.equal(options.json, true);
});
