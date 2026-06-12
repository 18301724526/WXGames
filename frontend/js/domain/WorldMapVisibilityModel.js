(function (global) {
  const LEVEL_UNKNOWN = 0;
  const LEVEL_EXPLORED = 1;
  const LEVEL_VISIBLE = 2;
  const LEVEL_CONTROLLED = 3;

  const LEVEL_NAMES = Object.freeze(['unknown', 'explored', 'visible', 'controlled']);
  const LEVEL_BY_VISIBILITY = Object.freeze({
    unknown: LEVEL_UNKNOWN,
    hidden: LEVEL_UNKNOWN,
    undiscovered: LEVEL_UNKNOWN,
    scouted: LEVEL_EXPLORED,
    explored: LEVEL_EXPLORED,
    discovered: LEVEL_EXPLORED,
    visible: LEVEL_VISIBLE,
    controlled: LEVEL_CONTROLLED,
  });

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function tileId(q, r) {
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function normalizeCoord(source = {}, fallback = {}) {
    const q = toInteger(source.q ?? source.x, fallback.q ?? 0);
    const r = toInteger(source.r ?? source.y, fallback.r ?? 0);
    return {
      q,
      r,
      tileId: source.tileId || source.id || tileId(q, r),
    };
  }

  function clampLevel(value, fallback = LEVEL_UNKNOWN) {
    const level = toInteger(value, fallback);
    if (level <= LEVEL_UNKNOWN) return LEVEL_UNKNOWN;
    if (level >= LEVEL_CONTROLLED) return LEVEL_CONTROLLED;
    return level;
  }

  function levelName(level) {
    return LEVEL_NAMES[clampLevel(level)] || 'unknown';
  }

  function hashStep(hash, value) {
    const text = String(value ?? '');
    let next = hash >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      next ^= text.charCodeAt(i);
      next = Math.imul(next, 16777619);
    }
    return next >>> 0;
  }

  function normalizeLevel(value, options = {}) {
    if (options.controlled) return LEVEL_CONTROLLED;
    if (Number.isFinite(Number(value))) return clampLevel(value);
    const key = String(value || '').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEVEL_BY_VISIBILITY, key)) return LEVEL_BY_VISIBILITY[key];
    if (options.discovered === false || options.visible === false) return LEVEL_UNKNOWN;
    return options.defaultLevel ?? LEVEL_EXPLORED;
  }

  function getIntelLevel(rawIntel = null, fallback = 0) {
    if (!rawIntel || typeof rawIntel !== 'object') return clampLevel(fallback);
    return clampLevel(rawIntel.level, fallback);
  }

  function readTileVisibility(tile = {}, options = {}) {
    const coord = normalizeCoord(tile);
    const controlled = Boolean(
      tile.controlled
      || tile.visibility === 'controlled'
      || tile.siteId === 'capital'
      || tile.id === 'tile_0_0'
    );
    const discovered = tile.discovered !== false;
    const level = normalizeLevel(tile.visibility, {
      controlled,
      discovered,
      visible: tile.visible,
      defaultLevel: options.defaultDiscoveredLevel ?? LEVEL_EXPLORED,
    });
    return {
      tileId: coord.tileId,
      q: coord.q,
      r: coord.r,
      level,
      visibility: levelName(level),
      intelLevel: Math.max(getIntelLevel(tile.intel, level), level),
    };
  }

  function createAccumulator(version = 0) {
    return {
      schema: 'world-map-visibility-v1',
      version,
      tileIds: [],
      q: [],
      r: [],
      levels: [],
      intelLevels: [],
      indexById: Object.create(null),
      counts: {
        unknown: 0,
        explored: 0,
        visible: 0,
        controlled: 0,
      },
      signature: '',
      _hash: 2166136261,
    };
  }

  function countLevel(counts, level, delta) {
    counts[levelName(level)] += delta;
  }

  function upsert(accumulator, entry = {}) {
    const id = String(entry.tileId || tileId(entry.q, entry.r));
    const level = clampLevel(entry.level);
    const intelLevel = clampLevel(entry.intelLevel, level);
    const index = accumulator.indexById[id];
    if (index !== undefined) {
      if (level > accumulator.levels[index]) {
        countLevel(accumulator.counts, accumulator.levels[index], -1);
        accumulator.levels[index] = level;
        countLevel(accumulator.counts, level, 1);
      }
      if (intelLevel > accumulator.intelLevels[index]) accumulator.intelLevels[index] = intelLevel;
      return index;
    }
    const nextIndex = accumulator.tileIds.length;
    accumulator.indexById[id] = nextIndex;
    accumulator.tileIds.push(id);
    accumulator.q.push(toInteger(entry.q));
    accumulator.r.push(toInteger(entry.r));
    accumulator.levels.push(level);
    accumulator.intelLevels.push(intelLevel);
    countLevel(accumulator.counts, level, 1);
    return nextIndex;
  }

  function getMissionList(worldExplorerState = {}, extraMissions = []) {
    const result = [];
    const append = (mission) => {
      if (mission && typeof mission === 'object') result.push(mission);
    };
    (Array.isArray(extraMissions) ? extraMissions : []).forEach(append);
    (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(append);
    append(worldExplorerState.activeMission);
    (Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []).forEach(append);
    return result;
  }

  function applyMissionVisibility(accumulator, mission = {}) {
    if (!mission || typeof mission !== 'object') return accumulator;
    const revealedIds = new Set((Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : []).map(String));
    const applyCoord = (coord, level = LEVEL_EXPLORED) => {
      if (!coord || typeof coord !== 'object') return;
      const normalized = normalizeCoord(coord);
      upsert(accumulator, {
        tileId: normalized.tileId,
        q: normalized.q,
        r: normalized.r,
        level,
        intelLevel: level,
      });
    };
    (Array.isArray(mission.route) ? mission.route : []).forEach((step) => {
      const normalized = normalizeCoord(step);
      if (step.revealed || revealedIds.has(normalized.tileId)) {
        applyCoord(normalized, LEVEL_EXPLORED);
      }
    });
    (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => {
      const normalized = normalizeCoord(tile);
      if (tile.revealed || revealedIds.has(normalized.tileId)) {
        applyCoord({ ...tile, ...normalized }, LEVEL_EXPLORED);
      }
    });
    if (mission.position) applyCoord(mission.position, mission.status === 'active' ? LEVEL_VISIBLE : LEVEL_EXPLORED);
    return accumulator;
  }

  function finalizeSnapshot(accumulator) {
    let hash = accumulator._hash;
    for (let i = 0; i < accumulator.tileIds.length; i += 1) {
      hash = hashStep(hash, accumulator.tileIds[i]);
      hash = hashStep(hash, accumulator.levels[i]);
      hash = hashStep(hash, accumulator.intelLevels[i]);
    }
    accumulator.signature = `${accumulator.version}:${accumulator.tileIds.length}:${hash.toString(16)}`;
    delete accumulator._hash;
    return accumulator;
  }

  function createSnapshot(input = {}, options = {}) {
    const territoryState = input.territoryState || {};
    const worldMap = input.worldMap || territoryState.worldMap || {};
    const tiles = Array.isArray(input.tiles) ? input.tiles : (Array.isArray(worldMap.tiles) ? worldMap.tiles : []);
    const accumulator = createAccumulator(worldMap.version || input.version || 0);
    for (let i = 0; i < tiles.length; i += 1) {
      upsert(accumulator, readTileVisibility(tiles[i], options));
    }
    const worldExplorerState = input.worldExplorerState || {};
    getMissionList(worldExplorerState, input.missions).forEach((mission) => applyMissionVisibility(accumulator, mission));
    return finalizeSnapshot(accumulator);
  }

  function getLevel(snapshot = {}, id = '') {
    const index = snapshot.indexById?.[String(id)];
    return index === undefined ? LEVEL_UNKNOWN : clampLevel(snapshot.levels?.[index]);
  }

  function isExplored(snapshot = {}, id = '') {
    return getLevel(snapshot, id) >= LEVEL_EXPLORED;
  }

  function isVisible(snapshot = {}, id = '') {
    return getLevel(snapshot, id) >= LEVEL_VISIBLE;
  }

  function toSerializable(snapshot = {}) {
    return {
      schema: snapshot.schema || 'world-map-visibility-v1',
      version: snapshot.version || 0,
      tileIds: Array.isArray(snapshot.tileIds) ? [...snapshot.tileIds] : [],
      q: Array.isArray(snapshot.q) ? [...snapshot.q] : [],
      r: Array.isArray(snapshot.r) ? [...snapshot.r] : [],
      levels: Array.isArray(snapshot.levels) ? [...snapshot.levels] : [],
      intelLevels: Array.isArray(snapshot.intelLevels) ? [...snapshot.intelLevels] : [],
      indexById: { ...(snapshot.indexById || {}) },
      counts: { ...(snapshot.counts || {}) },
      signature: snapshot.signature || '',
    };
  }

  const api = {
    LEVEL_UNKNOWN,
    LEVEL_EXPLORED,
    LEVEL_VISIBLE,
    LEVEL_CONTROLLED,
    LEVEL_NAMES,
    createSnapshot,
    getLevel,
    isExplored,
    isVisible,
    levelName,
    normalizeCoord,
    normalizeLevel,
    readTileVisibility,
    tileId,
    toSerializable,
  };

  global.WorldMapVisibilityModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
