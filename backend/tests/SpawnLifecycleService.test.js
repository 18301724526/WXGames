const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const GameStateService = require('../services/GameStateService');
const GameStateRepository = require('../repositories/GameStateRepository');
const { SpawnLifecycleService } = require('../services/spawn/SpawnLifecycleService');

function createRepositoryStub() {
  const reservations = new Map();
  const calls = [];
  return {
    calls,
    reservations,
    occupiedCoordinates: [],
    getSpawnForPlayer(playerId) {
      calls.push(`get:${playerId}`);
      return reservations.get(playerId) || null;
    },
    getOccupiedSpawnCoordinates() {
      calls.push('occupied');
      return [...this.occupiedCoordinates, ...reservations.values()];
    },
    reserveSpawnForPlayer(playerId, assignment) {
      calls.push(`reserve:${playerId}:${assignment.spawnKey}`);
      const existing = reservations.get(playerId);
      if (existing) return existing;
      const conflict = [...reservations.values()].find((item) => item.spawnKey === assignment.spawnKey);
      if (conflict) {
        const error = new Error('reserved');
        error.code = 'SPAWN_ALREADY_RESERVED';
        error.spawnKey = assignment.spawnKey;
        error.reservedBy = conflict.playerId;
        throw error;
      }
      const saved = { ...assignment, playerId, status: assignment.status || 'reserved' };
      reservations.set(playerId, saved);
      return saved;
    },
    releaseSpawnForPlayer(playerId) {
      calls.push(`release:${playerId}`);
      const existed = reservations.delete(playerId);
      return existed ? 1 : 0;
    },
  };
}

function createLifecycle(repository, candidatesByPlayer = {}) {
  return new SpawnLifecycleService({
    repository,
    gameStateService: GameStateService,
    now: () => new Date('2026-06-16T00:00:00.000Z'),
    allocator(options = {}) {
      const candidates = candidatesByPlayer[options.playerId] || [{ q: 10, r: 0 }, { q: 24, r: 0 }];
      const occupiedKeys = new Set((options.occupiedCoordinates || []).map((coord) => coord.spawnKey || `${coord.q},${coord.r}`));
      const selected = candidates.find((candidate) => !occupiedKeys.has(candidate.spawnKey || `${candidate.q},${candidate.r}`));
      if (!selected) return { success: false, selected: null, scoredCandidates: candidates };
      return {
        success: true,
        selected: {
          ...selected,
          valid: true,
          terrain: 'plains',
          score: 100,
          nearestCapitalDistance: 20,
          tutorialTarget: { q: selected.q + 1, r: selected.r },
        },
        scoredCandidates: candidates,
      };
    },
  });
}

test('SpawnLifecycleService creates spawn-aware initial states and reserves unique coordinates', () => {
  const repository = createRepositoryStub();
  const lifecycle = createLifecycle(repository, {
    'spawn-life-a': [{ q: 10, r: 0 }, { q: 24, r: 0 }],
    'spawn-life-b': [{ q: 10, r: 0 }, { q: 24, r: 0 }],
  });

  const first = lifecycle.createInitialStateForPlayer('spawn-life-a');
  const second = lifecycle.createInitialStateForPlayer('spawn-life-b');

  assert.equal(first.territories[0].x, 10);
  assert.equal(first.worldMap.origin.q, 10);
  assert.equal(second.territories[0].x, 24);
  assert.equal(second.worldMap.origin.q, 24);
  assert.equal(repository.getSpawnForPlayer('spawn-life-a').spawnKey, '10,0');
  assert.equal(repository.getSpawnForPlayer('spawn-life-b').spawnKey, '24,0');
});

test('SpawnLifecycleService creates the spawn companion city in the shared world and initial map', () => {
  const db = new Database(':memory:');
  try {
    const repository = new GameStateRepository(db);
    repository.init();
    const lifecycle = new SpawnLifecycleService({
      repository,
      gameStateService: GameStateService,
      now: () => new Date('2026-07-07T00:00:00.000Z'),
      allocator() {
        return {
          success: true,
          selected: {
            q: 10,
            r: 0,
            valid: true,
            terrain: 'plains',
            score: 100,
            nearestCapitalDistance: 30,
            tutorialTarget: { q: 11, r: 0, terrain: 'plains' },
          },
          scoredCandidates: [],
        };
      },
    });

    const state = lifecycle.createInitialStateForPlayer('spawn-companion-city-test');
    const companion = repository.worldCityRepo.getCity('site_11_0');

    assert.ok(companion, 'companion city must be persisted in world_cities');
    assert.equal(companion.owner, 'neutral');
    assert.equal(state.territories.some((territory) => territory.id === companion.id), true);
    assert.equal(state.worldMap.tiles.some((tile) => tile.siteId === companion.id), true);
    assert.equal(
      state.worldMap.visionHistory.sources.some((source) => (
        source.kind === 'city' && source.q === companion.x && source.r === companion.y
      )),
      false,
    );
  } finally {
    db.close();
  }
});

test('SpawnLifecycleService reset releases old spawn and avoids the previous coordinate', () => {
  const repository = createRepositoryStub();
  repository.reservations.set('spawn-reset-a', {
    playerId: 'spawn-reset-a',
    q: 10,
    r: 0,
    x: 10,
    y: 0,
    spawnKey: '10,0',
    status: 'reserved',
  });
  repository.occupiedCoordinates = [
    { playerId: 'other-player', q: 24, r: 0, spawnKey: '24,0', source: 'game-state-capital' },
    { playerId: 'spawn-reset-a', q: 10, r: 0, spawnKey: '10,0', source: 'game-state-capital' },
  ];
  const lifecycle = createLifecycle(repository, {
    'spawn-reset-a': [{ q: 10, r: 0 }, { q: 24, r: 0 }, { q: 36, r: 0 }],
  });

  const resetState = lifecycle.resetInitialStateForPlayer('spawn-reset-a');

  assert.deepEqual(repository.calls.slice(0, 3), ['get:spawn-reset-a', 'occupied', 'release:spawn-reset-a']);
  assert.equal(resetState.territories[0].x, 36);
  assert.equal(resetState.worldMap.origin.q, 36);
  assert.equal(repository.getSpawnForPlayer('spawn-reset-a').spawnKey, '36,0');
});

test('SpawnLifecycleService reset avoids current player occupied city coordinates before releasing them', () => {
  const repository = createRepositoryStub();
  repository.reservations.set('spawn-reset-owned-city', {
    playerId: 'spawn-reset-owned-city',
    q: 10,
    r: 0,
    x: 10,
    y: 0,
    spawnKey: '10,0',
    status: 'reserved',
  });
  repository.occupiedCoordinates = [
    { playerId: 'spawn-reset-owned-city', q: 10, r: 0, spawnKey: '10,0', source: 'game-state-capital' },
    { playerId: 'spawn-reset-owned-city', q: 18, r: -4, spawnKey: '18,-4', source: 'shared-world-territory', territoryId: '123' },
  ];
  const lifecycle = createLifecycle(repository, {
    'spawn-reset-owned-city': [{ q: 18, r: -4 }, { q: 42, r: -4 }],
  });

  const resetState = lifecycle.resetInitialStateForPlayer('spawn-reset-owned-city');

  assert.equal(resetState.territories[0].x, 42);
  assert.equal(resetState.territories[0].y, -4);
  assert.equal(repository.getSpawnForPlayer('spawn-reset-owned-city').spawnKey, '42,-4');
});

test('SpawnLifecycleService retries when a reservation races with another player', () => {
  const repository = createRepositoryStub();
  let firstReserve = true;
  const originalReserve = repository.reserveSpawnForPlayer.bind(repository);
  repository.reserveSpawnForPlayer = (playerId, assignment, options) => {
    if (firstReserve) {
      firstReserve = false;
      const error = new Error('reserved');
      error.code = 'SPAWN_ALREADY_RESERVED';
      error.spawnKey = assignment.spawnKey;
      error.reservedBy = 'race-winner';
      return (() => { throw error; })();
    }
    return originalReserve(playerId, assignment, options);
  };
  const lifecycle = createLifecycle(repository, {
    'spawn-race-a': [{ q: 10, r: 0 }, { q: 24, r: 0 }],
  });

  const state = lifecycle.createInitialStateForPlayer('spawn-race-a');

  assert.equal(state.territories[0].x, 24);
  assert.equal(repository.getSpawnForPlayer('spawn-race-a').spawnKey, '24,0');
});
