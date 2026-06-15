const { allocateSpawn } = require('./SpawnAllocator');
const { normalizeSpawnAssignment } = require('./SpawnAssignment');

const DEFAULT_MAX_RESERVATION_ATTEMPTS = 5;

function toPlayerId(playerId) {
  return String(playerId || '').trim();
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getNowIso(nowProvider, overrideNow) {
  const override = overrideNow ? toDate(overrideNow) : null;
  if (override) return override.toISOString();
  const value = typeof nowProvider === 'function' ? nowProvider() : new Date();
  return (toDate(value) || new Date()).toISOString();
}

function normalizeOccupiedCoordinate(coord = {}) {
  const normalized = normalizeSpawnAssignment(coord);
  return {
    ...coord,
    q: normalized.q,
    r: normalized.r,
    x: normalized.q,
    y: normalized.r,
    spawnKey: normalized.spawnKey,
  };
}

function filterPlayerCoordinates(coordinates = [], playerId) {
  const ignoredPlayerId = toPlayerId(playerId);
  return (Array.isArray(coordinates) ? coordinates : [])
    .filter((coord) => toPlayerId(coord?.playerId) !== ignoredPlayerId)
    .map(normalizeOccupiedCoordinate);
}

function normalizeAvoidCoordinates(coordinates = []) {
  return (Array.isArray(coordinates) ? coordinates : [])
    .filter(Boolean)
    .map((coord) => ({
      ...normalizeOccupiedCoordinate(coord),
      source: coord.source || 'spawn-avoidance',
    }));
}

function createReservationAssignment(playerId, selected = {}, options = {}) {
  return normalizeSpawnAssignment({
    ...selected,
    playerId,
    worldId: options.worldId || selected.worldId,
    status: selected.status || 'reserved',
    allocation: {
      score: selected.score,
      terrain: selected.terrain,
      nearestCapitalDistance: selected.nearestCapitalDistance,
      tutorialTarget: selected.tutorialTarget || null,
    },
  });
}

class SpawnLifecycleService {
  constructor(options = {}) {
    this.repository = options.repository;
    this.gameStateService = options.gameStateService;
    this.allocator = options.allocator || allocateSpawn;
    this.now = options.now || (() => new Date());
    this.allocationOptions = options.allocationOptions || {};
    this.maxReservationAttempts = Math.max(
      1,
      Math.floor(Number(options.maxReservationAttempts || DEFAULT_MAX_RESERVATION_ATTEMPTS)),
    );
  }

  createInitialStateForPlayer(playerId, options = {}) {
    const normalizedPlayerId = toPlayerId(playerId);
    const spawn = this.ensureSpawnForPlayer(normalizedPlayerId, options);
    return this.gameStateService.createInitialGameState(normalizedPlayerId, {
      ...options,
      spawn,
    });
  }

  resetInitialStateForPlayer(playerId, options = {}) {
    const normalizedPlayerId = toPlayerId(playerId);
    const previousSpawn = this.repository.getSpawnForPlayer?.(normalizedPlayerId);
    let releasedPreviousSpawn = false;
    const spawn = this.allocateAndReserveSpawn(normalizedPlayerId, {
      ...options,
      includePlayerOccupiedCoordinates: true,
      avoidCoordinates: [
        ...(options.avoidCoordinates || []),
        ...(previousSpawn ? [{ ...previousSpawn, source: 'previous-spawn' }] : []),
      ],
      beforeReserve: () => {
        if (releasedPreviousSpawn) return;
        this.repository.releaseSpawnForPlayer?.(normalizedPlayerId);
        releasedPreviousSpawn = true;
      },
    });
    return this.gameStateService.createInitialGameState(normalizedPlayerId, {
      ...options,
      spawn,
    });
  }

  ensureSpawnForPlayer(playerId, options = {}) {
    const current = this.repository.getSpawnForPlayer?.(playerId);
    if (current && !options.forceNewSpawn) return current;
    return this.allocateAndReserveSpawn(playerId, options);
  }

  getOccupiedCoordinates(playerId, options = {}) {
    const occupied = this.repository.getOccupiedSpawnCoordinates?.(options) || [];
    const occupiedCoordinates = options.includePlayerOccupiedCoordinates
      ? (Array.isArray(occupied) ? occupied : []).map(normalizeOccupiedCoordinate)
      : filterPlayerCoordinates(occupied, playerId);
    return [
      ...occupiedCoordinates,
      ...normalizeAvoidCoordinates(options.avoidCoordinates),
    ];
  }

  allocateAndReserveSpawn(playerId, options = {}) {
    let occupiedCoordinates = this.getOccupiedCoordinates(playerId, options);

    for (let attempt = 1; attempt <= this.maxReservationAttempts; attempt += 1) {
      const result = this.allocator({
        ...this.allocationOptions,
        ...options,
        playerId,
        occupiedCoordinates,
        attempt,
      });
      if (!result?.success || !result.selected) {
        const error = new Error(`Unable to allocate spawn for player ${playerId}`);
        error.code = 'SPAWN_ALLOCATION_FAILED';
        error.playerId = playerId;
        error.scoredCandidates = result?.scoredCandidates || [];
        throw error;
      }

      const selected = createReservationAssignment(playerId, result.selected, options);

      try {
        if (typeof options.beforeReserve === 'function') {
          options.beforeReserve(selected);
        }
        return this.repository.reserveSpawnForPlayer(playerId, selected, {
          nowIso: getNowIso(this.now, options.now),
        });
      } catch (error) {
        if (error?.code !== 'SPAWN_ALREADY_RESERVED') throw error;
        occupiedCoordinates = [
          ...occupiedCoordinates,
          {
            ...selected,
            source: 'spawn-reservation-conflict',
            playerId: error.reservedBy || selected.playerId,
          },
        ];
      }
    }

    const error = new Error(`Spawn reservation retry limit reached for player ${playerId}`);
    error.code = 'SPAWN_RESERVATION_RETRY_LIMIT';
    error.playerId = playerId;
    throw error;
  }
}

module.exports = {
  SpawnLifecycleService,
  filterPlayerCoordinates,
};
