(function (global) {
  // Real BitECS module: per-frame march reveal strength is a pure function of
  // (mission facts, nowMs) and lives in a `FogRevealSource` component while it is being
  // projected. runRevealSystem recomputes the component arrays for the requested instant
  // (time is a PARAMETER here, never a stored field); getRevealSnapshot is the read-only
  // projection consumers use. This is the WorldClock/WorldMapVisibilityModel pattern
  // applied to reveal facts — bitecs is reached only via EcsCoreBoundary.
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
    throw new Error('FogRevealModel requires EcsCoreBoundary and bitecs primitives');
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
    throw new Error('FogRevealModel requires the approved BitECS primitive surface');
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

  if (!SignatureHash || !TileCoord) {
    throw new Error('FogRevealModel requires SignatureHash and TileCoord');
  }

  const SCHEMA = 'world-fog-reveal-v1';
  const SOURCE_KINDS = Object.freeze(['backendReveal', 'routeHistory', 'routeFrontier']);
  const KIND_INDEX = Object.freeze(
    SOURCE_KINDS.reduce((map, kind, index) => ({ ...map, [kind]: index }), {}),
  );

  // Authoritative per-frame reveal fact. One entity per (mission, reveal source).
  const FogRevealSource = defineComponent({
    q: Types.f32,
    r: Types.f32,
    strength: Types.f32,
    kind: Types.ui8,
    missionIndex: Types.ui16,
  });

  const revealQuery = defineQuery([FogRevealSource]);

  // Resolved at call time (not module load) to stay immune to script load order.
  function resolveWorldMarchCore() {
    if (global.WorldMarchCore?.getRouteRenderRevealSources) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../shared/WorldMarchCoreAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  function requireFiniteNowMs(nowMs, caller = 'FogRevealModel') {
    const value = Number(nowMs);
    if (!Number.isFinite(value)) {
      throw new Error(
        `${caller} requires a finite nowMs (pass epochNowMs from WorldClock); ` +
          'reveal strength is a function of time and must never be read from stale data',
      );
    }
    return value;
  }

  function createRevealWorld() {
    return {
      world: createWorld(),
      order: [],
      missionIds: [],
    };
  }

  let sharedRevealWorld = null;

  function getSharedRevealWorld() {
    if (!sharedRevealWorld) sharedRevealWorld = createRevealWorld();
    return sharedRevealWorld;
  }

  function resetRevealWorld(revealWorld) {
    const matches = revealQuery(revealWorld.world);
    const eids = Array.from(matches);
    for (let i = 0; i < eids.length; i += 1) removeEntity(revealWorld.world, eids[i]);
    revealWorld.order = [];
    revealWorld.missionIds = [];
    return revealWorld;
  }

  function normalizeMissionList(missions = []) {
    if (Array.isArray(missions)) return missions.filter((m) => m && typeof m === 'object');
    if (missions && typeof missions === 'object') return [missions];
    return [];
  }

  // Named system: rebuild the FogRevealSource components for the requested instant.
  function runRevealSystem(revealWorld, missions = [], nowMs = Number.NaN) {
    const instant = requireFiniteNowMs(nowMs, 'FogRevealModel.runRevealSystem');
    const core = resolveWorldMarchCore();
    if (!core) {
      throw new Error(
        'FogRevealModel requires WorldMarchCore (load WorldMarchCoreAdapter.js first)',
      );
    }
    resetRevealWorld(revealWorld);
    normalizeMissionList(missions).forEach((mission) => {
      const missionId = String(mission.id || mission.missionId || '');
      const missionIndex = revealWorld.missionIds.length;
      revealWorld.missionIds.push(missionId);
      const sources = core.getRouteRenderRevealSources(mission, instant);
      (Array.isArray(sources) ? sources : []).forEach((source) => {
        const eid = addEntity(revealWorld.world);
        addComponent(revealWorld.world, FogRevealSource, eid);
        FogRevealSource.q[eid] = Number(source.q) || 0;
        FogRevealSource.r[eid] = Number(source.r) || 0;
        FogRevealSource.strength[eid] = Math.max(0, Math.min(1, Number(source.strength) || 0));
        FogRevealSource.kind[eid] = KIND_INDEX[source.source] ?? KIND_INDEX.routeHistory;
        FogRevealSource.missionIndex[eid] = missionIndex;
        revealWorld.order.push(eid);
      });
    });
    return revealWorld;
  }

  // Read-only projection: copy the component arrays into the serializable snapshot.
  function getRevealSnapshot(revealWorld, nowMs = Number.NaN) {
    const instant = requireFiniteNowMs(nowMs, 'FogRevealModel.getRevealSnapshot');
    const q = [];
    const r = [];
    const tileIds = [];
    const strength = [];
    const kinds = [];
    const missionIndex = [];
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    for (let i = 0; i < revealWorld.order.length; i += 1) {
      const eid = revealWorld.order[i];
      const sq = FogRevealSource.q[eid];
      const sr = FogRevealSource.r[eid];
      const sStrength = FogRevealSource.strength[eid];
      const kind = SOURCE_KINDS[FogRevealSource.kind[eid]] || 'routeHistory';
      const index = FogRevealSource.missionIndex[eid];
      q.push(sq);
      r.push(sr);
      tileIds.push(TileCoord.tileId(Math.round(sq), Math.round(sr)));
      strength.push(sStrength);
      kinds.push(kind);
      missionIndex.push(index);
      hash = SignatureHash.hashStep(
        hash,
        [revealWorld.missionIds[index] || '', tileIds[i], Math.round(sStrength * 1000), kind].join(
          ':',
        ),
      );
    }
    return Object.freeze({
      schema: SCHEMA,
      nowMs: instant,
      missionIds: [...revealWorld.missionIds],
      q,
      r,
      tileIds,
      strength,
      kinds,
      missionIndex,
      signature: `${q.length}:${(hash >>> 0).toString(36)}`,
    });
  }

  function getMissionRevealSources(snapshot = {}, missionId = '') {
    const id = String(missionId || '');
    const index = Array.isArray(snapshot.missionIds) ? snapshot.missionIds.indexOf(id) : -1;
    if (index < 0) return [];
    const sources = [];
    for (let i = 0; i < (snapshot.missionIndex?.length || 0); i += 1) {
      if (snapshot.missionIndex[i] !== index) continue;
      sources.push({
        q: snapshot.q[i],
        r: snapshot.r[i],
        tileId: snapshot.tileIds[i],
        strength: snapshot.strength[i],
        source: snapshot.kinds[i],
      });
    }
    return sources;
  }

  function createSnapshot(missions = [], nowMs = Number.NaN) {
    const instant = requireFiniteNowMs(nowMs, 'FogRevealModel.createSnapshot');
    const revealWorld = getSharedRevealWorld();
    runRevealSystem(revealWorld, missions, instant);
    const snapshot = getRevealSnapshot(revealWorld, instant);
    global.WorldMarchTrace?.logDedup?.('fog:reveal', {
      missions: snapshot.missionIds.length,
      sources: snapshot.q.length,
      signature: snapshot.signature,
    });
    return snapshot;
  }

  const api = {
    SCHEMA,
    SOURCE_KINDS,
    FogRevealSource,
    revealQuery,
    createRevealWorld,
    runRevealSystem,
    getRevealSnapshot,
    getMissionRevealSources,
    createSnapshot,
  };

  global.FogRevealModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
