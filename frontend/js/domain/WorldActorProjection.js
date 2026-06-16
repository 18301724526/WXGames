(function (global) {
  const ProgressSnapshot = (() => {
    if (global.WorldMarchProgressSnapshot) return global.WorldMarchProgressSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMarchProgressSnapshot');
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
        return require('./TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function coordKey(coord = {}) {
    if (!coord || typeof coord !== 'object') return '0:0';
    if (TileCoord?.normalizeCoord) return TileCoord.normalizeCoord(coord).tileId;
    const q = Number.isFinite(Number(coord.x ?? coord.q)) ? Math.floor(Number(coord.x ?? coord.q)) : 0;
    const r = Number.isFinite(Number(coord.y ?? coord.r)) ? Math.floor(Number(coord.y ?? coord.r)) : 0;
    return `tile_${q}_${r}`;
  }

  function isSameCoord(a = {}, b = {}) {
    return coordKey(a) === coordKey(b);
  }

  function getHomeCoord(row = {}) {
    return row.homeOrigin || row.formation?.homeOrigin || row.origin || {};
  }

  function getProjectionKind(row = {}) {
    if (row.status === 'active') return 'worldRoute';
    if (row.status !== 'idle') return '';
    if (row.rawStatus && row.rawStatus !== 'idle' && row.mode !== 'manual') return '';
    const current = row.current || row.position || row.target || {};
    return isSameCoord(current, getHomeCoord(row)) ? 'garrisonedAtHome' : 'parkedAwayFromHome';
  }

  function shouldRenderWorldActor(row = {}) {
    const kind = getProjectionKind(row);
    return kind === 'worldRoute' || kind === 'parkedAwayFromHome';
  }

  function projectActorFromProgress(row = {}) {
    if (!shouldRenderWorldActor(row)) return null;
    const actor = ProgressSnapshot?.buildActorFromProgress
      ? ProgressSnapshot.buildActorFromProgress(row)
      : null;
    if (!actor) return null;
    return {
      ...actor,
      projection: {
        kind: getProjectionKind(row),
        source: 'WorldActorProjection',
      },
    };
  }

  function getRows(input = {}, options = {}) {
    if (Array.isArray(input.rows)) return input.rows;
    if (input.schema === 'world-march-progress-snapshot-v1') return input.missions || [];
    if (!ProgressSnapshot?.createSnapshot) return [];
    return ProgressSnapshot.createSnapshot(input, options).missions || [];
  }

  function projectWorldActors(input = {}, options = {}) {
    return getRows(input, options)
      .map(projectActorFromProgress)
      .filter(Boolean);
  }

  const api = {
    coordKey,
    getProjectionKind,
    isSameCoord,
    projectActorFromProgress,
    projectWorldActors,
    shouldRenderWorldActor,
  };

  global.WorldActorProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
