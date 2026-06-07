(function (global) {
  const URL_KEYS = ['worldMarchTrace', 'codexMarchTrace'];
  const STORAGE_KEY = 'worldMarchTrace';
  const MAX_DEDUP_ENTRIES = 300;
  const deduped = new Map();

  function readUrlFlag() {
    try {
      const search = global?.location?.search || '';
      if (!search) return null;
      const params = new URLSearchParams(search);
      for (const key of URL_KEYS) {
        if (!params.has(key)) continue;
        const value = String(params.get(key) || '1').toLowerCase();
        return !['0', 'false', 'off', 'no'].includes(value);
      }
    } catch (_) {}
    return null;
  }

  function readStorageFlag() {
    try {
      const value = global?.localStorage?.getItem?.(STORAGE_KEY);
      if (value === null || value === undefined) return false;
      return !['0', 'false', 'off', 'no', ''].includes(String(value).toLowerCase());
    } catch (_) {
      return false;
    }
  }

  function enabled() {
    const urlFlag = readUrlFlag();
    if (urlFlag !== null) {
      try {
        if (urlFlag) global?.localStorage?.setItem?.(STORAGE_KEY, '1');
        else global?.localStorage?.removeItem?.(STORAGE_KEY);
      } catch (_) {}
      return urlFlag;
    }
    return readStorageFlag();
  }

  function setEnabled(value) {
    try {
      if (value) global?.localStorage?.setItem?.(STORAGE_KEY, '1');
      else global?.localStorage?.removeItem?.(STORAGE_KEY);
    } catch (_) {}
    return enabled();
  }

  function toId(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function compactArray(list = [], mapper = (item) => item, limit = 8) {
    const array = Array.isArray(list) ? list : [];
    const values = array.slice(0, limit).map(mapper);
    if (array.length > limit) values.push(`...+${array.length - limit}`);
    return values;
  }

  function summarizeCoord(coord = null) {
    if (!coord || typeof coord !== 'object') return null;
    return {
      q: Number(coord.q ?? coord.x ?? 0),
      r: Number(coord.r ?? coord.y ?? 0),
      tileId: coord.tileId || (coord.q !== undefined || coord.x !== undefined
        ? `tile_${Number(coord.q ?? coord.x ?? 0)}_${Number(coord.r ?? coord.y ?? 0)}`
        : ''),
    };
  }

  function summarizeRoute(route = []) {
    const steps = Array.isArray(route) ? route : [];
    const revealed = steps.filter((step) => step?.revealed);
    return {
      count: steps.length,
      revealed: revealed.length,
      ids: compactArray(steps, (step) => step?.tileId || `tile_${step?.q}_${step?.r}`),
      revealedIds: compactArray(revealed, (step) => step?.tileId || `tile_${step?.q}_${step?.r}`),
      first: summarizeCoord(steps[0]),
      last: summarizeCoord(steps.at(-1)),
    };
  }

  function summarizePlannedTiles(plannedTiles = []) {
    const tiles = Array.isArray(plannedTiles) ? plannedTiles : [];
    return {
      count: tiles.length,
      ids: compactArray(tiles, (tile) => tile?.id || `tile_${tile?.q}_${tile?.r}`),
      terrain: compactArray(tiles, (tile) => `${tile?.id || `tile_${tile?.q}_${tile?.r}`}:${tile?.terrain || ''}`),
    };
  }

  function summarizePlannedSites(plannedSites = []) {
    const sites = Array.isArray(plannedSites) ? plannedSites : [];
    return {
      count: sites.length,
      ids: compactArray(sites, (site) => site?.siteId || site?.site?.id || site?.tileId || `site_${site?.q}_${site?.r}`),
      materialized: sites.filter((site) => site?.materialized).length,
    };
  }

  function summarizeFormation(formation = null) {
    if (!formation || typeof formation !== 'object') return null;
    return {
      cityId: formation.cityId || 'capital',
      slot: Number(formation.slot || 1),
      memberCount: Array.isArray(formation.memberIds) ? formation.memberIds.length : 0,
    };
  }

  function summarizeMission(mission = null) {
    if (!mission || typeof mission !== 'object') return null;
    return {
      id: mission.id || '',
      mode: mission.mode || '',
      status: mission.status || '',
      origin: summarizeCoord(mission.origin),
      target: summarizeCoord(mission.target),
      position: summarizeCoord(mission.position),
      route: summarizeRoute(mission.route),
      plannedTiles: summarizePlannedTiles(mission.plannedTiles),
      plannedSites: summarizePlannedSites(mission.plannedSites),
      revealedTileIds: compactArray(mission.revealedTileIds, toId),
      revealedTileCount: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds.length : 0,
      formation: summarizeFormation(mission.formation),
      stepDurationSeconds: Number(mission.stepDurationSeconds || 0),
      remainingSeconds: Number(mission.remainingSeconds || 0),
      startedAt: mission.startedAt || '',
      nextStepAt: mission.nextStepAt || '',
      completesAt: mission.completesAt || '',
      completedAt: mission.completedAt || '',
    };
  }

  function summarizeWorldExplorerState(worldExplorerState = null) {
    const state = worldExplorerState && typeof worldExplorerState === 'object' ? worldExplorerState : {};
    const missions = Array.isArray(state.missions) ? state.missions : [];
    const readyMissions = Array.isArray(state.readyMissions) ? state.readyMissions : [];
    const idleMissions = Array.isArray(state.idleMissions) ? state.idleMissions : [];
    return {
      missionCount: missions.length,
      activeMission: summarizeMission(state.activeMission),
      missionIds: compactArray(missions, (mission) => `${mission?.id}:${mission?.status}`),
      readyIds: compactArray(readyMissions, (mission) => mission?.id || ''),
      idleIds: compactArray(idleMissions, (mission) => mission?.id || ''),
      busyFormations: compactArray(state.busyFormations, (item) => `${item?.cityId || 'capital'}:${item?.slot}:${item?.status}`),
      stepDurationSeconds: Number(state.stepDurationSeconds || 0),
      maxActiveMissions: Number(state.maxActiveMissions || 0),
    };
  }

  function summarizeGameState(gameState = null) {
    const state = gameState && typeof gameState === 'object' ? gameState : {};
    const worldMap = state.territoryState?.worldMap || {};
    return {
      currentTab: state.currentTab || '',
      militaryView: state.militaryView || '',
      worldMap: {
        version: worldMap.version || 0,
        tileCount: Array.isArray(worldMap.tiles) ? worldMap.tiles.length : 0,
      },
      territoryCount: Array.isArray(state.territoryState?.territories) ? state.territoryState.territories.length : 0,
      worldExplorerState: summarizeWorldExplorerState(state.worldExplorerState),
      tutorialStep: Number(state.tutorial?.currentStep || 0),
    };
  }

  function summarizeApiPayload(payload = null) {
    const data = payload && typeof payload === 'object' ? payload : {};
    return {
      success: data.success,
      error: data.error || '',
      message: data.message || '',
      mission: summarizeMission(data.mission),
      gameState: summarizeGameState(data.gameState),
      tutorialStep: Number(data.tutorial?.currentStep || data.gameState?.tutorial?.currentStep || 0),
      syncTime: data.syncTime || '',
    };
  }

  function parseBody(body) {
    if (!body) return {};
    if (typeof body === 'object') return body;
    try {
      return JSON.parse(body);
    } catch (_) {
      return {};
    }
  }

  function summarizeActionBody(body = {}) {
    const data = parseBody(body);
    return {
      action: data.action || '',
      mode: data.mode || '',
      targetQ: data.targetQ ?? data.q ?? data.x ?? null,
      targetR: data.targetR ?? data.r ?? data.y ?? null,
      stopQ: data.stopQ ?? null,
      stopR: data.stopR ?? null,
      formationSlot: data.formationSlot ?? data.slot ?? null,
      missionId: data.missionId || '',
      debugTrace: Boolean(data.debugTrace || data.worldMarchTrace),
    };
  }

  function log(stage, payload = {}) {
    if (!enabled()) return false;
    try {
      const output = {
        at: new Date().toISOString(),
        ...payload,
      };
      if (global?.console?.log) global.console.log('[WorldMarchTrace]', stage, output);
      return true;
    } catch (_) {
      return false;
    }
  }

  function logDedup(stage, key, payload = {}) {
    if (!enabled()) return false;
    const dedupKey = `${stage}:${String(key)}`;
    if (deduped.has(dedupKey)) return false;
    if (deduped.size > MAX_DEDUP_ENTRIES) deduped.clear();
    deduped.set(dedupKey, Date.now());
    return log(stage, payload);
  }

  function warn(stage, payload = {}) {
    if (!enabled()) return false;
    try {
      if (global?.console?.warn) global.console.warn('[WorldMarchTrace]', stage, {
        at: new Date().toISOString(),
        ...payload,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function error(stage, payload = {}) {
    if (!enabled()) return false;
    try {
      if (global?.console?.error) global.console.error('[WorldMarchTrace]', stage, {
        at: new Date().toISOString(),
        ...payload,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  const api = {
    enabled,
    setEnabled,
    log,
    logDedup,
    warn,
    error,
    summarizeActionBody,
    summarizeApiPayload,
    summarizeCoord,
    summarizeMission,
    summarizeWorldExplorerState,
    summarizeGameState,
    summarizeRoute,
    summarizePlannedTiles,
    summarizePlannedSites,
  };

  global.WorldMarchTrace = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
