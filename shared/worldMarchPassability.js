// C-LAYER (rules) for world-march passability. This is the SINGLE place the
// rule "can a unit march onto / across this tile" lives. Pure function: it takes
// a terrain oracle (D) by injection and returns a structured verdict; it does no
// I/O, no rendering, and reads no globals beyond loading the geometry core.
//
// Backend injects a seed-based oracle (knows every tile). Frontend injects a
// known-tile oracle (fog tiles report 'unknown'). Same rule, two data sources —
// see docs/architecture/module-pipeline-and-observability-standard.md.
(function (global) {
  const WorldMarchCore = (() => {
    if (global.WorldMarchCore) return global.WorldMarchCore;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./worldMarchCore');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TERRAIN_UNKNOWN = 'unknown';
  // The one rule, in one place: which terrains block a land march. Adding boats /
  // tech later means consulting `unit` here — and ONLY here.
  const LAND_IMPASSABLE_TERRAIN = Object.freeze(['ocean', 'river']);

  function requireWorldMarchCore() {
    if (WorldMarchCore?.tileId && WorldMarchCore?.normalizeCoord) return WorldMarchCore;
    throw new Error('WorldMarchPassability requires WorldMarchCore: load shared/worldMarchCore.js first');
  }

  const MarchCore = requireWorldMarchCore();

  function normalizeCoord(coord = {}, fallback = {}) {
    return MarchCore.normalizeCoord(coord, fallback);
  }

  // The terrain rule. `null` means "cannot decide from this data" (fog); the
  // caller treats that as optimistically passable and flags hasUnknownOnRoute so
  // the authoritative backend can settle it.
  function isTerrainTraversable(terrain, _unit) {
    if (terrain === TERRAIN_UNKNOWN || terrain === undefined || terrain === null) return null;
    return !LAND_IMPASSABLE_TERRAIN.includes(String(terrain));
  }

  function emit(trace, stage, payload) {
    if (typeof trace === 'function') {
      trace(stage, payload);
    } else if (trace && typeof trace.log === 'function') {
      trace.log(stage, payload);
    }
  }

  // The single decision. Returns a verdict consumed by every B/A layer.
  function evaluateMarch(params = {}) {
    const origin = normalizeCoord(params.origin || {});
    const target = normalizeCoord(params.target || {}, origin);
    const getTileTerrain =
      typeof params.getTileTerrain === 'function' ? params.getTileTerrain : () => TERRAIN_UNKNOWN;
    const unit = params.unit || null;
    const trace = params.trace || null;
    const corr = params.corr || '';

    const buildRoute = params.axisAligned && WorldMarchCore?.buildAxisAlignedRoute
      ? WorldMarchCore.buildAxisAlignedRoute
      : WorldMarchCore?.buildLinearMarchRoute;
    const plan = buildRoute
      ? buildRoute(origin, target, {
          maxLength: params.maxLength,
          maxManualRouteLength: params.maxManualRouteLength,
          width: params.worldWidth ?? params.width,
          height: params.worldHeight ?? params.height,
          wrapping: params.wrapping,
        })
      : { success: true, route: [], distance: 0, target };

    const baseVerdict = {
      origin,
      target,
      route: Array.isArray(plan.route) ? plan.route : [],
      distance: Number.isFinite(plan.distance) ? plan.distance : 0,
      canMarch: false,
      blocked: null,
      hasUnknownOnRoute: false,
      reason: '',
    };

    // Geometry-level rejections (same origin / out of range) — known without terrain.
    if (!plan.success) {
      const verdict = {
        ...baseVerdict,
        route: [],
        reason: plan.error || 'EXPLORE_ROUTE_INVALID',
        blocked: { reason: plan.error || 'EXPLORE_ROUTE_INVALID', terrain: '', atTile: null },
      };
      emit(trace, 'passability:verdict', { corr, canMarch: false, reason: verdict.reason });
      return verdict;
    }

    // Walk the route applying the terrain rule; stop at the first KNOWN blocker.
    let hasUnknownOnRoute = false;
    for (const step of baseVerdict.route) {
      const terrain = getTileTerrain(step.q, step.r);
      const traversable = isTerrainTraversable(terrain, unit);
      if (traversable === null) {
        hasUnknownOnRoute = true;
        continue;
      }
      if (traversable === false) {
        const verdict = {
          ...baseVerdict,
          canMarch: false,
          hasUnknownOnRoute,
          reason: 'EXPLORE_ROUTE_BLOCKED',
          blocked: {
            reason: 'EXPLORE_ROUTE_BLOCKED',
            terrain: String(terrain),
            atTile: {
              q: step.q,
              r: step.r,
              step: step.step,
              tileId: step.tileId || MarchCore.tileId(step.q, step.r),
              ...(step.dir ? { dir: step.dir } : {}),
            },
          },
        };
        emit(trace, 'passability:verdict', {
          corr,
          canMarch: false,
          reason: 'EXPLORE_ROUTE_BLOCKED',
          terrain: String(terrain),
          atTile: verdict.blocked.atTile.tileId,
          hasUnknownOnRoute,
        });
        return verdict;
      }
    }

    // No known blocker on the whole route → marchable (optimistic if any fog).
    const verdict = {
      ...baseVerdict,
      canMarch: true,
      hasUnknownOnRoute,
      reason: '',
      blocked: null,
    };
    emit(trace, 'passability:verdict', {
      corr,
      canMarch: true,
      hasUnknownOnRoute,
      distance: verdict.distance,
    });
    return verdict;
  }

  // Helper for the common "is this single tile a place I could stand/end on"
  // question, reused by hit-target/button code so the rule is not re-derived.
  function isTileMarchable(terrain, unit) {
    const traversable = isTerrainTraversable(terrain, unit);
    return traversable !== false; // unknown (null) is optimistically marchable
  }

  const api = {
    TERRAIN_UNKNOWN,
    LAND_IMPASSABLE_TERRAIN,
    isTerrainTraversable,
    isTileMarchable,
    evaluateMarch,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.WorldMarchPassability = api;
  }
})(globalThis);
