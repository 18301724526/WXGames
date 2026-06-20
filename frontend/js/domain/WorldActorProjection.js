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

  function isActorPickingDiagEnabled() {
    if (global.__actorPickingDiag === true) return true;
    try {
      const params = new URL(global.location?.href || '').searchParams;
      const value = params.get('actorPickingDiag') || params.get('worldActorPickingDiag');
      if (value !== null) return value !== '0' && value !== 'false' && value !== 'off';
    } catch (_) {}
    try {
      const value = global.localStorage?.getItem?.('actorPickingDiag');
      return value === '1' || value === 'true' || value === 'on';
    } catch (_) {}
    return false;
  }

  function summarizeCoord(coord = null) {
    if (!coord || typeof coord !== 'object') return null;
    return {
      x: coord.x ?? null,
      y: coord.y ?? null,
      q: coord.q ?? null,
      r: coord.r ?? null,
      tileId: coord.tileId || coord.id || coordKey(coord),
    };
  }

  function logActorPickingDiag(stage = '', detail = {}) {
    if (!isActorPickingDiagEnabled()) return null;
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...detail,
    };
    try {
      global.console?.log?.('[ActorPickingDiag]', stage, payload);
    } catch (_) {}
    return payload;
  }

  function getProjectionKind(row = {}) {
    if (row.status === 'active') {
      logActorPickingDiag('worldActorProjection:getProjectionKind', {
        actorId: row.id || row.actorId || row.missionId || '',
        missionId: row.missionId || '',
        status: row.status || '',
        rawStatus: row.rawStatus || '',
        mode: row.mode || '',
        current: summarizeCoord(row.current),
        position: summarizeCoord(row.position),
        origin: summarizeCoord(row.origin),
        target: summarizeCoord(row.target),
        homeCoord: summarizeCoord(getHomeCoord(row)),
        result: 'worldRoute',
      });
      return 'worldRoute';
    }
    if (row.status !== 'idle') {
      logActorPickingDiag('worldActorProjection:getProjectionKind', {
        actorId: row.id || row.actorId || row.missionId || '',
        missionId: row.missionId || '',
        status: row.status || '',
        rawStatus: row.rawStatus || '',
        mode: row.mode || '',
        current: summarizeCoord(row.current),
        position: summarizeCoord(row.position),
        origin: summarizeCoord(row.origin),
        target: summarizeCoord(row.target),
        homeCoord: summarizeCoord(getHomeCoord(row)),
        result: '',
      });
      return '';
    }
    if (row.rawStatus && row.rawStatus !== 'idle' && row.mode !== 'manual') {
      logActorPickingDiag('worldActorProjection:getProjectionKind', {
        actorId: row.id || row.actorId || row.missionId || '',
        missionId: row.missionId || '',
        status: row.status || '',
        rawStatus: row.rawStatus || '',
        mode: row.mode || '',
        current: summarizeCoord(row.current),
        position: summarizeCoord(row.position),
        origin: summarizeCoord(row.origin),
        target: summarizeCoord(row.target),
        homeCoord: summarizeCoord(getHomeCoord(row)),
        result: '',
      });
      return '';
    }
    const current = row.current || row.position || row.target || {};
    const homeCoord = getHomeCoord(row);
    const result = isSameCoord(current, homeCoord) ? 'garrisonedAtHome' : 'parkedAwayFromHome';
    logActorPickingDiag('worldActorProjection:getProjectionKind', {
      actorId: row.id || row.actorId || row.missionId || '',
      missionId: row.missionId || '',
      status: row.status || '',
      rawStatus: row.rawStatus || '',
      mode: row.mode || '',
      current: summarizeCoord(row.current),
      position: summarizeCoord(row.position),
      origin: summarizeCoord(row.origin),
      target: summarizeCoord(row.target),
      homeCoord: summarizeCoord(homeCoord),
      selectedCurrentSource: row.current ? 'current' : (row.position ? 'position' : (row.target ? 'target' : 'none')),
      result,
    });
    return result;
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
