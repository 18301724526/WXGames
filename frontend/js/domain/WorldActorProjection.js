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

  function coordKey(coord = {}) {
    if (!coord || typeof coord !== 'object') return '0:0';
    if (coord.tileId) return String(coord.tileId);
    const q = Number.isFinite(Number(coord.q ?? coord.x)) ? Math.floor(Number(coord.q ?? coord.x)) : 0;
    const r = Number.isFinite(Number(coord.r ?? coord.y)) ? Math.floor(Number(coord.r ?? coord.y)) : 0;
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
