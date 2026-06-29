(function (global) {
  const PREFIX = '[CodexDiag][WorldMap]';
  const MAX_SIGNATURES = 160;
  const lastSignatures = new Map();
  let environmentProvider = null;

  function setEnvironmentProvider(provider = null) {
    environmentProvider = provider && typeof provider === 'object' ? provider : null;
    return environmentProvider;
  }

  function isVerboseEnabled() {
    if (global.__codexWorldMapDiagVerbose === true) return true;
    const value = environmentProvider?.readStoredFlag?.('codexWorldMapDiagVerbose', { fallback: false });
    if (typeof value === 'boolean') return value;
    return environmentProvider?.readStoredValue?.('codexWorldMapDiagVerbose') === '1';
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function stableStringify(value) {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${key}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function readWorldMap(source = {}) {
    return source?.territoryState?.worldMap
      || source?.gameState?.territoryState?.worldMap
      || source?.state?.territoryState?.worldMap
      || source?.worldMap
      || source?.gameState?.worldMap
      || source?.state?.worldMap
      || null;
  }

  function summarizeWorldMap(source = {}) {
    const rawWorldMap = readWorldMap(source);
    const worldMap = rawWorldMap || {};
    const tiles = toArray(worldMap.tiles);
    const firstTile = tiles[0] || null;
    const capitalTile = tiles.find((tile) => tile?.siteId === 'capital') || null;
    return {
      hasWorldMap: Boolean(rawWorldMap && typeof rawWorldMap === 'object'),
      tileCount: tiles.length,
      version: Number(worldMap.version) || 0,
      seed: worldMap.seed || '',
      origin: worldMap.origin || null,
      firstTile: firstTile ? {
        id: firstTile.id || firstTile.tileId || firstTile.canonicalId || '',
        q: firstTile.q ?? firstTile.x ?? null,
        r: firstTile.r ?? firstTile.y ?? null,
        visibility: firstTile.visibility || '',
        siteId: firstTile.siteId || '',
      } : null,
      capitalTile: capitalTile ? {
        id: capitalTile.id || capitalTile.tileId || capitalTile.canonicalId || '',
        q: capitalTile.q ?? capitalTile.x ?? null,
        r: capitalTile.r ?? capitalTile.y ?? null,
        visibility: capitalTile.visibility || '',
      } : null,
    };
  }

  function summarizeState(state = {}) {
    const territoryState = state?.territoryState || {};
    return {
      currentTab: state?.currentTab || '',
      militaryView: state?.militaryView || '',
      territoryKeys: Object.keys(territoryState).slice(0, 20),
      territoryCount: toArray(territoryState.territories).length,
      worldMap: summarizeWorldMap(state),
      worldExplorer: {
        missions: toArray(state?.worldExplorerState?.missions).length,
        hasActiveMission: Boolean(state?.worldExplorerState?.activeMission),
      },
      tutorial: {
        currentStep: state?.tutorial?.currentStep ?? null,
        completed: Boolean(state?.tutorial?.completed),
      },
    };
  }

  function log(stage = '', detail = {}) {
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...detail,
    };
    try {
      if (isVerboseEnabled()) {
        global?.console?.info?.(PREFIX, stage, payload);
      }
    } catch (_) {}
    try {
      global.ClientOperationLog?.record?.('codex:worldMapDiag', payload, { flush: true });
    } catch (_) {}
    return payload;
  }

  function logChanged(stage = '', signature = '', detail = {}) {
    const key = String(stage || '');
    const nextSignature = typeof signature === 'string' ? signature : stableStringify(signature);
    if (lastSignatures.get(key) === nextSignature) return null;
    if (lastSignatures.size > MAX_SIGNATURES) lastSignatures.clear();
    lastSignatures.set(key, nextSignature);
    return log(stage, {
      signature: nextSignature,
      ...detail,
    });
  }

  function summarizeRenderResult(result = null) {
    if (!result || typeof result !== 'object') return null;
    return {
      rendered: Boolean(result.rendered),
      drewFrame: Boolean(result.drewFrame),
      preserved: Boolean(result.preserved),
      reason: result.reason || '',
    };
  }

  const api = {
    log,
    logChanged,
    setEnvironmentProvider,
    summarizeRenderResult,
    summarizeState,
    summarizeWorldMap,
  };

  global.CodexWorldMapDiag = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
