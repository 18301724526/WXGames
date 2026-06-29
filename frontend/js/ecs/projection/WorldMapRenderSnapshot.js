(function (global) {
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

  const MarchSnapshot = (() => {
    if (global.WorldMarchProgressSnapshot) return global.WorldMarchProgressSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../system/WorldMarchProgressSnapshot');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const ActorProjection = (() => {
    if (global.WorldActorProjection) return global.WorldActorProjection;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldActorProjection');
      } catch (error) {
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
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeCoord(coord = {}, fallback = {}) {
    return TileCoord.normalizeCoord(coord, fallback);
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function normalizeFrame(input = {}) {
    const x = toNumber(input.x, 0);
    const y = toNumber(input.y, 0);
    const width = Math.max(0, toNumber(input.width, 0));
    const height = Math.max(0, toNumber(input.height, 0));
    const inset = Math.max(0, toNumber(input.inset, 1));
    return {
      x: x + inset,
      y: y + inset,
      width: Math.max(0, width - inset * 2),
      height: Math.max(0, height - inset * 2),
    };
  }

  function normalizeViewport(tileMapView = {}, frameInput = {}, options = {}) {
    const x = toNumber(frameInput.x, 0);
    const y = toNumber(frameInput.y, 0);
    const width = Math.max(1, toNumber(frameInput.width, 1));
    const height = Math.max(1, toNumber(frameInput.height, 1));
    const scaleBasisWidth = toNumber(options.scaleBasisWidth, width);
    const scaleBasisHeight = toNumber(options.scaleBasisHeight, height);
    const originX =
      options.originX !== undefined ? toNumber(options.originX, x + width * 0.5) : x + width * 0.5;
    const originY =
      options.originY !== undefined
        ? toNumber(options.originY, y + height * 0.42)
        : y + height * 0.42;
    const scale = Math.max(
      0.38,
      Math.min(0.78, Math.min(scaleBasisWidth / 520, scaleBasisHeight / 420)),
    );
    const geometry = options.geometry || tileMapView.geometry || {};
    const worldOrigin = normalizeCoord(
      options.worldOrigin || tileMapView.origin || tileMapView.worldOrigin || {},
    );
    return {
      originX: Number.isFinite(originX) ? originX : x + width * 0.5,
      originY: Number.isFinite(originY) ? originY : y + height * 0.42,
      panX: toNumber(tileMapView.pan?.x, 0),
      panY: toNumber(tileMapView.pan?.y, 0),
      scale,
      seed: tileMapView.seed || 'scout-tile-v1',
      geometry,
      worldOrigin,
    };
  }

  function normalizeMarchTarget(target = null) {
    if (!target || typeof target !== 'object') return null;
    const coord = TileCoord.normalizeCoord(target);
    const q = coord.x;
    const r = coord.y;
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    const result = {
      q,
      r,
      tileId: coord.tileId,
      known: target.known === undefined ? undefined : Boolean(target.known),
      terrain: target.terrain || '',
      terrainLabel: target.terrainLabel || '',
    };
    if (target.combatEncounterId || target.encounterId || target.combatTarget?.encounterId) {
      result.combatEncounterId =
        target.combatEncounterId || target.encounterId || target.combatTarget?.encounterId;
    }
    if (target.combatTarget && typeof target.combatTarget === 'object') {
      result.combatTarget = JSON.parse(JSON.stringify(target.combatTarget));
    }
    return result;
  }

  function normalizeUiState(uiState = {}) {
    return {
      selectedSiteId: uiState.selectedSiteId || '',
      worldMarchTarget: normalizeMarchTarget(uiState.worldMarchTarget),
      tileMapWaterAnimated: Boolean(uiState.tileMapWaterAnimated),
    };
  }

  function normalizeFlags(options = {}) {
    return {
      hitTargetsOnly: Boolean(options.hitTargetsOnly),
      snapshotOnly: Boolean(options.snapshotOnly),
      frameless: Boolean(options.frameless),
      fastDrag: Boolean(options.fastDrag),
      collectHitTargets: Boolean(options.collectHitTargets),
      reuseCachedWorldTileView: Boolean(options.reuseCachedWorldTileView),
    };
  }

  function buildMarchSnapshot(tileMapView = {}, options = {}) {
    if (options.marchSnapshot && typeof options.marchSnapshot === 'object')
      return options.marchSnapshot;
    const missions = Array.isArray(tileMapView.activeScouts) ? tileMapView.activeScouts : [];
    const nowMs = options.nowMs ?? options.epochNowMs ?? options.serverNowMs;
    if (!MarchSnapshot?.createSnapshot) {
      return {
        schema: 'world-march-progress-snapshot-v1',
        nowMs: toNumber(nowMs, Date.now()),
        missions: [],
        actors: [],
        arrivals: [],
        indexById: {
          missions: Object.create(null),
          actors: Object.create(null),
          arrivals: Object.create(null),
        },
        counts: { missions: missions.length, actors: 0, arrivals: 0, active: 0, idle: 0 },
        signature: `fallback:${missions.length}`,
      };
    }
    return MarchSnapshot.createSnapshot(
      { missions },
      {
        nowMs,
        signatureTimeBucketMs: options.signatureTimeBucketMs,
      },
    );
  }

  function createSnapshot(input = {}, options = {}) {
    const tileMapView = input.tileMapView || {};
    const uiState = input.uiState || {};
    const frameInput = {
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      inset: options.frameInset ?? input.frameInset ?? 1,
    };
    const geometry = options.geometry || tileMapView.geometry || {};
    const viewport =
      options.viewport || normalizeViewport(tileMapView, frameInput, { ...options, geometry });
    const frame = options.frame || normalizeFrame(frameInput);
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const sites = Array.isArray(tileMapView.sites) ? tileMapView.sites : [];
    const activeScouts = Array.isArray(tileMapView.activeScouts) ? tileMapView.activeScouts : [];
    const scoutAreas = Array.isArray(tileMapView.scoutAreas) ? tileMapView.scoutAreas : [];
    const march = buildMarchSnapshot(tileMapView, options);
    const actors = ActorProjection?.projectWorldActors
      ? ActorProjection.projectWorldActors(march, options)
      : Array.isArray(march.actors)
        ? march.actors
        : [];
    const flags = normalizeFlags(options);
    const ui = normalizeUiState(uiState);
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    hash = hashStep(hash, tileMapView.signature || '');
    hash = hashStep(hash, tileMapView.version || 0);
    hash = hashStep(hash, tileMapView.seed || '');
    hash = hashStep(hash, tiles.length);
    hash = hashStep(hash, sites.length);
    hash = hashStep(hash, activeScouts.length);
    hash = hashStep(hash, scoutAreas.length);
    hash = hashStep(hash, ui.selectedSiteId);
    hash = hashStep(hash, ui.worldMarchTarget?.tileId || '');
    hash = hashStep(hash, Math.round(viewport.panX));
    hash = hashStep(hash, Math.round(viewport.panY));
    hash = hashStep(hash, Math.round(viewport.scale * 1000));
    hash = hashStep(hash, Math.round(frame.x));
    hash = hashStep(hash, Math.round(frame.y));
    hash = hashStep(hash, Math.round(frame.width));
    hash = hashStep(hash, Math.round(frame.height));
    hash = hashStep(hash, march.signature || '');
    return {
      schema: 'world-map-render-snapshot-v1',
      tileMapView,
      geometry,
      viewport,
      frame,
      ui,
      flags,
      march,
      actors,
      arrivals: Array.isArray(march.arrivals) ? march.arrivals : [],
      counts: {
        tiles: tiles.length,
        sites: sites.length,
        activeScouts: activeScouts.length,
        scoutAreas: scoutAreas.length,
        actors: actors.length,
        arrivals: Array.isArray(march.arrivals) ? march.arrivals.length : 0,
      },
      signature: `${tileMapView.version || 0}:${tiles.length}:${sites.length}:${activeScouts.length}:${(hash >>> 0).toString(16)}`,
    };
  }

  function getTileMapView(snapshot = {}) {
    return snapshot.tileMapView || {};
  }

  function getViewport(snapshot = {}) {
    return snapshot.viewport || {};
  }

  function getFrame(snapshot = {}) {
    return snapshot.frame || {};
  }

  function getActors(snapshot = {}) {
    return Array.isArray(snapshot.actors) ? snapshot.actors : [];
  }

  function getArrivals(snapshot = {}) {
    return Array.isArray(snapshot.arrivals) ? snapshot.arrivals : [];
  }

  function toSerializable(snapshot = {}) {
    return {
      schema: snapshot.schema || 'world-map-render-snapshot-v1',
      viewport: snapshot.viewport || {},
      frame: snapshot.frame || {},
      ui: snapshot.ui || {},
      flags: snapshot.flags || {},
      counts: snapshot.counts || {},
      march: MarchSnapshot?.toSerializable
        ? MarchSnapshot.toSerializable(snapshot.march || {})
        : snapshot.march || null,
      signature: snapshot.signature || '',
    };
  }

  const api = {
    createSnapshot,
    getActors,
    getArrivals,
    getFrame,
    getTileMapView,
    getViewport,
    normalizeFlags,
    normalizeFrame,
    normalizeCoord,
    normalizeMarchTarget,
    normalizeUiState,
    normalizeViewport,
    toSerializable,
  };

  global.WorldMapRenderSnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
