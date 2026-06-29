(function (global) {
  const URL_KEYS = ['worldMarchTrace', 'codexMarchTrace', 'codexTrace'];
  const STORAGE_KEY = 'worldMarchTrace';
  const MAX_DEDUP_ENTRIES = 300;
  const deduped = new Map();
  let environmentProvider = null;

  function getEnvironment() {
    return environmentProvider || global.CanvasDebugEnvironment || null;
  }

  function setEnvironmentProvider(provider = null) {
    environmentProvider = provider && typeof provider === 'object' ? provider : null;
    return environmentProvider;
  }

  function parseFlagValue(value, fallback = false) {
    if (value === null || value === undefined) return fallback;
    return !['0', 'false', 'off', 'no', ''].includes(String(value).toLowerCase());
  }

  function readUrlFlag() {
    const value = getEnvironment()?.readQueryFlag?.(URL_KEYS);
    return typeof value === 'boolean' ? value : null;
  }

  function readStorageFlag() {
    const environment = getEnvironment();
    const value = environment?.readStoredFlag?.(STORAGE_KEY, { fallback: false });
    if (typeof value === 'boolean') return value;
    return parseFlagValue(environment?.readStoredValue?.(STORAGE_KEY), false);
  }

  function writeStorageFlag(value) {
    try {
      if (value) getEnvironment()?.writeStoredValue?.(STORAGE_KEY, '1');
      else getEnvironment()?.removeStoredValue?.(STORAGE_KEY);
    } catch (_) {}
  }

  function enabled() {
    const urlFlag = readUrlFlag();
    if (urlFlag !== null) {
      writeStorageFlag(urlFlag);
      return urlFlag;
    }
    return readStorageFlag();
  }

  function getBootState() {
    const environment = getEnvironment();
    const page = environment?.getPageInfo?.() || {};
    const storageValue = environment?.readStoredValue?.(STORAGE_KEY) ?? null;
    return {
      enabled: enabled(),
      search: page.search || '',
      storageKey: STORAGE_KEY,
      storageValue,
    };
  }

  function setEnabled(value) {
    writeStorageFlag(value);
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

  function hasCoordinate(source = {}) {
    return source && typeof source === 'object'
      && (source.q !== undefined || source.x !== undefined || source.r !== undefined || source.y !== undefined);
  }

  function getTraceTileId(source = {}) {
    const q = Number(source?.q ?? source?.x ?? 0);
    const r = Number(source?.r ?? source?.y ?? 0);
    if (hasCoordinate(source)) return `tile_${q}_${r}`;
    return source?.tileId || source?.id || '';
  }

  function addTileAlias(aliases, value, canonicalId) {
    if (!value || !canonicalId) return;
    const ids = aliases.get(String(value)) || new Set();
    ids.add(String(canonicalId));
    aliases.set(String(value), ids);
  }

  function addCoordAliases(aliases, source = {}, fallback = {}) {
    if (!source || typeof source !== 'object') return;
    const coordSource = hasCoordinate(source) ? source : fallback;
    if (!hasCoordinate(coordSource)) return;
    const canonicalId = getTraceTileId(coordSource);
    addTileAlias(aliases, canonicalId, canonicalId);
    addTileAlias(aliases, source.tileId, canonicalId);
    addTileAlias(aliases, source.id, canonicalId);
  }

  function createMissionTileAliasMap(mission = {}) {
    const aliases = new Map();
    (Array.isArray(mission.route) ? mission.route : []).forEach((step) => addCoordAliases(aliases, step));
    (Array.isArray(mission.revealArea) ? mission.revealArea : []).forEach((step) => addCoordAliases(aliases, step));
    (Array.isArray(mission.plannedTiles) ? mission.plannedTiles : []).forEach((tile) => addCoordAliases(aliases, tile));
    (Array.isArray(mission.plannedSites) ? mission.plannedSites : []).forEach((site) => {
      const rawSite = site?.site && typeof site.site === 'object' ? site.site : {};
      addCoordAliases(aliases, site, rawSite);
    });
    return aliases;
  }

  function summarizeRevealedTileIds(mission = {}) {
    const aliases = createMissionTileAliasMap(mission);
    const ids = [];
    const seen = new Set();
    const addId = (id) => {
      if (!id) return;
      const value = String(id);
      if (seen.has(value)) return;
      seen.add(value);
      ids.push(value);
    };
    (Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [])
      .slice(0, 8)
      .forEach((id) => {
        const canonicalIds = aliases.get(String(id));
        if (canonicalIds) {
          canonicalIds.forEach(addId);
          return;
        }
        addId(id);
      });
    if (Array.isArray(mission.revealedTileIds) && mission.revealedTileIds.length > 8) {
      addId(`...+${mission.revealedTileIds.length - 8}`);
    }
    return ids;
  }

  function summarizeCoord(coord = null) {
    if (!coord || typeof coord !== 'object') return null;
    const q = Number(coord.q ?? coord.x ?? 0);
    const r = Number(coord.r ?? coord.y ?? 0);
    return {
      q,
      r,
      tileId: getTraceTileId(coord),
    };
  }

  function summarizeRoute(route = []) {
    const steps = Array.isArray(route) ? route : [];
    const revealed = steps.filter((step) => step?.revealed);
    return {
      count: steps.length,
      revealed: revealed.length,
      ids: compactArray(steps, (step) => getTraceTileId(step)),
      revealedIds: compactArray(revealed, (step) => getTraceTileId(step)),
      first: summarizeCoord(steps[0]),
      last: summarizeCoord(steps.at(-1)),
    };
  }

  function summarizePlannedTiles(plannedTiles = []) {
    const tiles = Array.isArray(plannedTiles) ? plannedTiles : [];
    return {
      count: tiles.length,
      ids: compactArray(tiles, (tile) => getTraceTileId(tile)),
      terrain: compactArray(tiles, (tile) => `${getTraceTileId(tile)}:${tile?.terrain || ''}`),
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
      revealedTileIds: summarizeRevealedTileIds(mission),
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
    const idleMissions = Array.isArray(state.idleMissions) ? state.idleMissions : [];
    return {
      missionCount: missions.length,
      activeMission: summarizeMission(state.activeMission),
      missionIds: compactArray(missions, (mission) => `${mission?.id}:${mission?.status}`),
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

  function summarizeAuthority(authority = null) {
    if (!authority || typeof authority !== 'object') return null;
    return {
      schema: authority.schema || '',
      status: authority.status || '',
      commandId: authority.commandId || '',
      serverTime: authority.serverTime || '',
      command: authority.command ? {
        type: authority.command.type || '',
        actorId: authority.command.actorId || '',
        playerId: authority.command.playerId || '',
      } : null,
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
      authority: summarizeAuthority(data.authority),
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
    setEnvironmentProvider,
    getBootState,
    log,
    logDedup,
    warn,
    error,
    summarizeActionBody,
    summarizeApiPayload,
    summarizeAuthority,
    summarizeCoord,
    summarizeMission,
    summarizeWorldExplorerState,
    summarizeGameState,
    summarizeRoute,
    summarizePlannedTiles,
    summarizePlannedSites,
  };

  global.WorldMarchTrace = api;
  try {
    const bootState = getBootState();
    if (bootState.enabled) global?.console?.warn?.('[WorldMarchTrace]', 'boot', bootState);
  } catch (_) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
