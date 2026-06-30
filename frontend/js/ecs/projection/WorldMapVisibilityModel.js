(function (global) {
  // Real BitECS module: per-tile fog visibility is the authoritative fact and lives in a
  // `FogVisibility` component (TypedArray columns indexed by entity id). A named system
  // (runVisibilitySystem) computes the level from world tiles + mission reveals and writes the
  // component arrays; getVisibilitySnapshot is the read-only projection consumers use. This is
  // the WorldClock pattern applied to fog visibility — bitecs is reached only via EcsCoreBoundary.
  const EcsCoreBoundary = (() => {
    if (global.EcsCoreBoundary) return global.EcsCoreBoundary;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../core/EcsCoreBoundary');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  if (!EcsCoreBoundary) {
    throw new Error('WorldMapVisibilityModel requires EcsCoreBoundary and bitecs primitives');
  }

  const {
    Types,
    addComponent,
    addEntity,
    createWorld,
    defineComponent,
    defineQuery,
    removeEntity,
  } = EcsCoreBoundary;

  if (
    !Types ||
    !defineComponent ||
    !defineQuery ||
    !createWorld ||
    !addEntity ||
    !addComponent ||
    !removeEntity
  ) {
    throw new Error('WorldMapVisibilityModel requires the approved BitECS primitive surface');
  }

  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../foundation/TileCoord');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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

  // Authoritative per-tile fog fact. One entity per (canonical) tile; values live here.
  const FogVisibility = defineComponent({
    q: Types.i32,
    r: Types.i32,
    level: Types.ui8,
    intelLevel: Types.ui8,
  });

  const fogVisibilityQuery = defineQuery([FogVisibility]);

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function tileId(q, r) {
    return TileCoord.tileId(q, r);
  }

  function normalizeCoord(source = {}, fallback = {}) {
    const normalized = TileCoord.normalizeCoord(source, fallback);
    return {
      q: normalized.x,
      r: normalized.y,
      tileId: normalized.tileId,
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
    return SignatureHash.hashStep(hash, value);
  }

  function normalizeLevel(value, options = {}) {
    if (options.controlled) return LEVEL_CONTROLLED;
    if (Number.isFinite(Number(value))) return clampLevel(value);
    const key = String(value || '')
      .trim()
      .toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEVEL_BY_VISIBILITY, key))
      return LEVEL_BY_VISIBILITY[key];
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
      tile.controlled ||
      tile.visibility === 'controlled' ||
      tile.siteId === 'capital' ||
      tile.id === 'tile_0_0',
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

  function createVisibilityWorld() {
    return {
      world: createWorld(),
      byId: new Map(),
      order: [],
    };
  }

  let sharedVisibilityWorld = null;

  function getSharedVisibilityWorld() {
    if (!sharedVisibilityWorld) sharedVisibilityWorld = createVisibilityWorld();
    return sharedVisibilityWorld;
  }

  function resetVisibilityWorld(visWorld) {
    const matches = fogVisibilityQuery(visWorld.world);
    const eids = Array.from(matches);
    for (let i = 0; i < eids.length; i += 1) removeEntity(visWorld.world, eids[i]);
    visWorld.byId = new Map();
    visWorld.order = [];
    return visWorld;
  }

  // Component write: upsert one tile's visibility fact, never downgrading an existing entity.
  function upsertTile(visWorld, entry = {}) {
    const id = String(entry.tileId || tileId(entry.q, entry.r));
    const level = clampLevel(entry.level);
    const intelLevel = clampLevel(entry.intelLevel, level);
    const existing = visWorld.byId.get(id);
    if (existing !== undefined) {
      if (level > FogVisibility.level[existing]) FogVisibility.level[existing] = level;
      if (intelLevel > FogVisibility.intelLevel[existing])
        FogVisibility.intelLevel[existing] = intelLevel;
      return existing;
    }
    const eid = addEntity(visWorld.world);
    addComponent(visWorld.world, FogVisibility, eid);
    FogVisibility.q[eid] = toInteger(entry.q);
    FogVisibility.r[eid] = toInteger(entry.r);
    FogVisibility.level[eid] = level;
    FogVisibility.intelLevel[eid] = intelLevel;
    visWorld.byId.set(id, eid);
    visWorld.order.push(eid);
    return eid;
  }

  function getMissionList(worldExplorerState = {}, extraMissions = []) {
    const result = [];
    const append = (mission) => {
      if (mission && typeof mission === 'object') result.push(mission);
    };
    (Array.isArray(extraMissions) ? extraMissions : []).forEach(append);
    (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(append);
    append(worldExplorerState.activeMission);
    (Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []).forEach(
      append,
    );
    return result;
  }

  function hasCoordPair(source = {}) {
    if (!source || typeof source !== 'object') return false;
    const hasQ = source.x !== undefined || source.q !== undefined;
    const hasR = source.y !== undefined || source.r !== undefined;
    return hasQ && hasR;
  }

  function addTileAlias(aliases, value, canonicalId) {
    if (!value || !canonicalId) return;
    const alias = String(value);
    const ids = aliases.get(alias) || new Set();
    ids.add(String(canonicalId));
    aliases.set(alias, ids);
  }

  function addCoordAliases(aliases, source = {}) {
    if (!hasCoordPair(source)) return;
    const normalized = normalizeCoord(source);
    addTileAlias(aliases, normalized.tileId, normalized.tileId);
    addTileAlias(aliases, source.tileId, normalized.tileId);
    addTileAlias(aliases, source.id, normalized.tileId);
  }

  function createMissionTileAliasMap(mission = {}) {
    const aliases = new Map();
    (Array.isArray(mission.route) ? mission.route : []).forEach((step) =>
      addCoordAliases(aliases, step),
    );
    (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) =>
      addCoordAliases(aliases, tile),
    );
    return aliases;
  }

  function createRevealedTileSet(mission = {}) {
    const aliases = createMissionTileAliasMap(mission);
    const revealed = new Set();
    (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
      .filter(Boolean)
      .forEach((id) => {
        const canonicalIds = aliases.get(String(id));
        if (canonicalIds) {
          canonicalIds.forEach((canonicalId) => revealed.add(canonicalId));
          return;
        }
        revealed.add(String(id));
      });
    return revealed;
  }

  function applyMissionVisibility(visWorld, mission = {}) {
    if (!mission || typeof mission !== 'object') return visWorld;
    const revealedIds = createRevealedTileSet(mission);
    const applyCoord = (coord, level = LEVEL_EXPLORED) => {
      if (!coord || typeof coord !== 'object') return;
      const normalized = normalizeCoord(coord);
      upsertTile(visWorld, {
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
    if (mission.position)
      applyCoord(mission.position, mission.status === 'active' ? LEVEL_VISIBLE : LEVEL_EXPLORED);
    return visWorld;
  }

  // Named system: rebuild the FogVisibility components for this frame from world tiles + missions.
  function runVisibilitySystem(visWorld, input = {}, options = {}) {
    resetVisibilityWorld(visWorld);
    const territoryState = input.territoryState || {};
    const worldMap = input.worldMap || territoryState.worldMap || {};
    const tiles = Array.isArray(input.tiles)
      ? input.tiles
      : Array.isArray(worldMap.tiles)
        ? worldMap.tiles
        : [];
    for (let i = 0; i < tiles.length; i += 1) {
      upsertTile(visWorld, readTileVisibility(tiles[i], options));
    }
    const worldExplorerState = input.worldExplorerState || {};
    getMissionList(worldExplorerState, input.missions).forEach((mission) =>
      applyMissionVisibility(visWorld, mission),
    );
    return visWorld;
  }

  // Read-only projection: copy the component arrays into the serializable snapshot consumers use.
  function getVisibilitySnapshot(visWorld, version = 0) {
    const tileIds = [];
    const q = [];
    const r = [];
    const levels = [];
    const intelLevels = [];
    const indexById = Object.create(null);
    const counts = { unknown: 0, explored: 0, visible: 0, controlled: 0 };
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    for (let i = 0; i < visWorld.order.length; i += 1) {
      const eid = visWorld.order[i];
      const tq = FogVisibility.q[eid];
      const tr = FogVisibility.r[eid];
      const id = tileId(tq, tr);
      const level = clampLevel(FogVisibility.level[eid]);
      const intelLevel = clampLevel(FogVisibility.intelLevel[eid], level);
      indexById[id] = i;
      tileIds.push(id);
      q.push(tq);
      r.push(tr);
      levels.push(level);
      intelLevels.push(intelLevel);
      counts[levelName(level)] += 1;
      hash = hashStep(hash, id);
      hash = hashStep(hash, level);
      hash = hashStep(hash, intelLevel);
    }
    return {
      schema: 'world-map-visibility-v1',
      version,
      tileIds,
      q,
      r,
      levels,
      intelLevels,
      indexById,
      counts,
      signature: `${version}:${tileIds.length}:${hash.toString(16)}`,
    };
  }

  function createSnapshot(input = {}, options = {}) {
    const territoryState = input.territoryState || {};
    const worldMap = input.worldMap || territoryState.worldMap || {};
    const version = worldMap.version || input.version || 0;
    const visWorld = getSharedVisibilityWorld();
    runVisibilitySystem(visWorld, input, options);
    return getVisibilitySnapshot(visWorld, version);
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
    FogVisibility,
    fogVisibilityQuery,
    createVisibilityWorld,
    runVisibilitySystem,
    getVisibilitySnapshot,
    createSnapshot,
    getLevel,
    isExplored,
    isVisible,
    levelName,
    normalizeCoord,
    normalizeLevel,
    readTileVisibility,
    createMissionTileAliasMap,
    createRevealedTileSet,
    tileId,
    toSerializable,
  };

  global.WorldMapVisibilityModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
