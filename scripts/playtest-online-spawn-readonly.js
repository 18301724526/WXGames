const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function getArgValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function getNumberArg(name, fallback) {
  const value = Number(getArgValue(name, process.env[`PLAYTEST_${name.replace(/-/g, '_').toUpperCase()}`] || fallback));
  return Number.isFinite(value) ? value : Number(fallback);
}

function parseCsv(value, fallback = []) {
  const source = String(value || '').trim();
  if (!source) return fallback;
  return source.split(',').map((item) => item.trim()).filter(Boolean);
}

const CONFIG = {
  gameUrl: getArgValue('game-url', process.env.PLAYTEST_GAME_URL || 'http://47.116.32.216/wxgame/'),
  apiBase: getArgValue('api-base', process.env.PLAYTEST_API_BASE || 'http://47.116.32.216:3000/api'),
  username: getArgValue('username', process.env.PLAYTEST_USERNAME || 'test2'),
  password: getArgValue('password', process.env.PLAYTEST_PASSWORD || '123456'),
  headless: getArgValue('headless', process.env.PLAYTEST_HEADLESS || '1') !== '0',
  viewportWidth: getNumberArg('viewport-width', 1365),
  viewportHeight: getNumberArg('viewport-height', 768),
  outputRoot: getArgValue(
    'output-dir',
    process.env.PLAYTEST_OUTPUT_DIR || path.join('tmp', 'verification', 'online-spawn-readonly'),
  ),
  expectedVisibleTileCount: getNumberArg('expected-visible-tile-count', 25),
  expectedOriginTileId: getArgValue('expected-origin-tile-id', process.env.PLAYTEST_EXPECTED_ORIGIN_TILE_ID || ''),
  expectedOwnedTerritoryIds: parseCsv(
    getArgValue('expected-owned-territory-ids', process.env.PLAYTEST_EXPECTED_OWNED_TERRITORY_IDS || 'capital'),
    ['capital'],
  ),
  maxWaitMs: getNumberArg('max-wait-ms', 45000),
};

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(CONFIG.outputRoot, runId);
fs.mkdirSync(outDir, { recursive: true });

const badResponses = [];
const requestFailures = [];
const pageErrors = [];
const consoleMessages = [];

function sanitize(value, depth = 0) {
  if (depth > 6) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return typeof value === 'function' ? '[function]' : value;
  if (Array.isArray(value)) return value.slice(0, 160).map((item) => sanitize(item, depth + 1));
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'function') continue;
    result[key] = sanitize(entry, depth + 1);
  }
  return result;
}

function coordsKey(coord = {}) {
  if (coord?.tileId) return coord.tileId;
  const q = Number(coord?.q ?? coord?.x ?? coord?.relativeX);
  const r = Number(coord?.r ?? coord?.y ?? coord?.relativeY);
  return Number.isFinite(q) && Number.isFinite(r) ? `tile_${q}_${r}` : '';
}

function getLocalOwnerPlayerId(item = {}) {
  return String(item.ownerPlayerId || '').trim();
}

function isLocalOwnedTerritory(item = {}, currentPlayerId = '') {
  if (item?.id === 'capital' || item?.cityId === 'capital') return true;
  const ownerPlayerId = getLocalOwnerPlayerId(item);
  if (ownerPlayerId) return ownerPlayerId === currentPlayerId;
  return item?.owner === 'player' && item?.status === 'occupied';
}

function summarizeWorldState(state = {}, currentPlayerId = '') {
  const playerId = String(currentPlayerId || state.playerId || CONFIG.username || '').trim();
  const territoryState = state.territoryState || {};
  const worldMap = territoryState.worldMap || {};
  const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
  const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
  const capital = territories.find((item) => item?.id === 'capital' || item?.cityId === 'capital')
    || territories.find((item) => item?.type === 'capital')
    || null;
  const visibleTiles = tiles.filter((tile) => (
    tile
    && tile.renderOnly !== true
    && tile.visible !== false
    && tile.discovered !== false
  ));
  const ownedTerritories = territories
    .filter((item) => isLocalOwnedTerritory(item, playerId))
    .map((item) => ({
      id: item.id || item.territoryId || item.cityId || '',
      type: item.type || '',
      status: item.status || '',
      owner: item.owner || '',
      ownerPlayerId: getLocalOwnerPlayerId(item),
      q: Number(item.q ?? item.x ?? item.relativeX),
      r: Number(item.r ?? item.y ?? item.relativeY),
      tileId: coordsKey(item),
    }));
  const sharedOccupiedTerritories = territories
    .filter((item) => {
      const ownerPlayerId = getLocalOwnerPlayerId(item);
      return ownerPlayerId && ownerPlayerId !== playerId && item?.status === 'occupied';
    })
    .map((item) => ({
      id: item.id || item.territoryId || item.cityId || '',
      status: item.status || '',
      owner: item.owner || '',
      ownerPlayerId: getLocalOwnerPlayerId(item),
      tileId: coordsKey(item),
    }));
  return {
    playerId,
    origin: worldMap.origin || worldMap.worldOrigin || null,
    originTileId: coordsKey(worldMap.origin || worldMap.worldOrigin || {}),
    capital: capital ? {
      id: capital.id || capital.cityId || '',
      q: Number(capital.q ?? capital.x ?? capital.relativeX),
      r: Number(capital.r ?? capital.y ?? capital.relativeY),
      tileId: coordsKey(capital),
    } : null,
    worldTileCount: tiles.length,
    visibleTileCount: visibleTiles.length,
    ownedTerritories,
    ownedTerritoryIds: ownedTerritories.map((item) => item.id).filter(Boolean),
    ownedTerritoryTileIds: ownedTerritories.map((item) => item.tileId).filter(Boolean),
    sharedOccupiedTerritories,
  };
}

async function postJson(url, body, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await resp.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { text };
  }
  if (!resp.ok) throw new Error(`POST ${url} failed ${resp.status}: ${text}`);
  return payload;
}

async function getFrontendState(page) {
  return page.evaluate(() => {
    const toTileId = (coord = {}) => {
      if (coord?.tileId) return coord.tileId;
      const q = Number(coord?.q ?? coord?.x ?? coord?.relativeX);
      const r = Number(coord?.r ?? coord?.y ?? coord?.relativeY);
      return Number.isFinite(q) && Number.isFinite(r) ? `tile_${q}_${r}` : '';
    };
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || null;
    const runtime = shell?.runtime || game?.runtime || null;
    const coordinator = shell?.worldMapRuntimeCoordinator || game?.worldMapRuntimeCoordinator || null;
    const mapRuntime = coordinator?.getMapRuntime?.()
      || coordinator?.ensureRuntime?.()
      || shell?.worldMapRuntime
      || game?.worldMapRuntime
      || null;
    const contextCandidates = [
      mapRuntime?.getLastTileMapContext?.(),
      mapRuntime?.lastTileMapContext,
      runtime?.getLastTileMapContext?.(),
      runtime?.lastTileMapContext,
      renderer?.lastWorldTileMapContext,
      renderer?.worldMapLayerRenderer?.lastWorldTileMapContext,
      shell?.worldMapRenderer?.lastWorldTileMapContext,
    ].filter(Boolean);
    const tileMapContext = contextCandidates.find((context) => Array.isArray(context?.tileMapView?.tiles)) || null;
    const tileMapView = tileMapContext?.tileMapView || {};
    const state = game?.state || {};
    const territoryState = state.territoryState || {};
    const worldMap = territoryState.worldMap || {};
    const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
    const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
    const playerId = String(game?.playerId || state.playerId || '').trim();
    const capital = territories.find((item) => item?.id === 'capital' || item?.cityId === 'capital')
      || territories.find((item) => item?.type === 'capital')
      || null;
    const visibleTiles = tiles.filter((tile) => (
      tile
      && tile.renderOnly !== true
      && tile.visible !== false
      && tile.discovered !== false
    ));
    const localOwned = territories.filter((item) => {
      if (item?.id === 'capital' || item?.cityId === 'capital') return true;
      const ownerPlayerId = String(item?.ownerPlayerId || '').trim();
      if (ownerPlayerId) return ownerPlayerId === playerId;
      return item?.owner === 'player' && item?.status === 'occupied';
    });
    const sharedOccupied = territories.filter((item) => {
      const ownerPlayerId = String(item?.ownerPlayerId || '').trim();
      return ownerPlayerId && ownerPlayerId !== playerId && item?.status === 'occupied';
    });
    const renderTiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const capitalTileId = toTileId(capital || {});
    const hitTargets = Array.isArray(renderer?.hitTargets) ? renderer.hitTargets : [];
    const capitalHitTarget = hitTargets.find((target) => {
      const action = target?.action || {};
      return action.type === 'openWorldSite'
        && (action.siteId === 'capital' || action.cityId === 'capital' || action.tileId === capitalTileId);
    }) || null;
    const canvas = runtime?.canvas || document.querySelector('canvas') || document.getElementById('h5CanvasLayer');
    const rect = canvas?.getBoundingClientRect?.();
    return {
      url: location.href,
      title: document.title,
      playerId,
      gameReady: Boolean(game && shell),
      currentTab: state.currentTab || game?.currentTab || shell?.currentTab || '',
      militaryView: state.militaryView || shell?.militaryView || '',
      mapHomeActive: Boolean(shell?.mapHomeActive || game?.mapHomeActive),
      loading: shell?.loading || null,
      origin: worldMap.origin || worldMap.worldOrigin || null,
      originTileId: toTileId(worldMap.origin || worldMap.worldOrigin || {}),
      capital: capital ? {
        id: capital.id || capital.cityId || '',
        q: Number(capital.q ?? capital.x ?? capital.relativeX),
        r: Number(capital.r ?? capital.y ?? capital.relativeY),
        tileId: capitalTileId,
      } : null,
      worldTileCount: tiles.length,
      visibleTileCount: visibleTiles.length,
      localOwnedTerritoryIds: localOwned
        .map((item) => item.id || item.cityId || item.territoryId || '')
        .filter(Boolean),
      sharedOccupiedTerritories: sharedOccupied.map((item) => ({
        id: item.id || item.cityId || item.territoryId || '',
        ownerPlayerId: String(item.ownerPlayerId || '').trim(),
        tileId: toTileId(item),
      })),
      renderContext: {
        present: Boolean(tileMapContext),
        origin: tileMapView.origin || tileMapView.worldOrigin || null,
        pan: tileMapView.pan || null,
        tileCount: renderTiles.length,
        containsCapital: renderTiles.some((tile) => toTileId(tile) === capitalTileId || tile.siteId === 'capital'),
      },
      capitalHitTargetVisible: Boolean(capitalHitTarget),
      capitalHitTarget,
      hitTargetCount: hitTargets.length,
      canvas: rect ? {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      } : null,
      apiCalls: Array.isArray(window.__codexApiCalls) ? window.__codexApiCalls : [],
    };
  });
}

function sameStringList(a = [], b = []) {
  const left = [...a].map(String).sort();
  const right = [...b].map(String).sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function buildVerdict(apiSummary, frontendState) {
  const expectedOriginTileId = CONFIG.expectedOriginTileId || apiSummary.originTileId;
  const resetCalls = (frontendState.apiCalls || []).filter((call) => String(call.url || '').includes('/api/player/reset'));
  const consoleErrors = consoleMessages.filter((entry) => entry.type === 'error');
  const checks = {
    publicUrl: frontendState.url.startsWith(CONFIG.gameUrl),
    playerId: frontendState.playerId === CONFIG.username,
    apiOriginKnown: Boolean(apiSummary.originTileId),
    apiCapitalKnown: Boolean(apiSummary.capital?.tileId),
    apiOriginMatchesExpected: apiSummary.originTileId === expectedOriginTileId,
    apiCapitalMatchesExpected: apiSummary.capital?.tileId === expectedOriginTileId,
    apiVisibleTileCount: apiSummary.visibleTileCount === CONFIG.expectedVisibleTileCount,
    frontendOriginMatchesApi: frontendState.originTileId === apiSummary.originTileId,
    frontendCapitalMatchesApi: frontendState.capital?.tileId === apiSummary.capital?.tileId,
    frontendVisibleTileCount: frontendState.visibleTileCount === CONFIG.expectedVisibleTileCount,
    localOwnedTerritories: sameStringList(frontendState.localOwnedTerritoryIds, CONFIG.expectedOwnedTerritoryIds),
    renderContextPresent: frontendState.renderContext?.present === true,
    renderContainsCapital: frontendState.renderContext?.containsCapital === true,
    capitalHitTargetVisible: frontendState.capitalHitTargetVisible === true,
    noResetCalls: resetCalls.length === 0,
    noBadResponses: badResponses.length === 0,
    noRequestFailures: requestFailures.length === 0,
    noPageErrors: pageErrors.length === 0,
    noConsoleErrors: consoleErrors.length === 0,
  };
  const failures = Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([name]) => name);
  return {
    pass: failures.length === 0,
    checks,
    failures,
    resetCalls,
    consoleErrors,
  };
}

async function main() {
  const login = await postJson(`${CONFIG.apiBase}/player/login`, {
    username: CONFIG.username,
    password: CONFIG.password,
  });
  const apiSummary = summarizeWorldState(login.gameState || {}, login.playerId || CONFIG.username);
  const browser = await chromium.launch({ headless: CONFIG.headless });
  let page;
  try {
    page = await browser.newPage({
      viewport: {
        width: CONFIG.viewportWidth,
        height: CONFIG.viewportHeight,
      },
    });
    page.on('response', (response) => {
      if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
    });
    page.on('requestfailed', (request) => {
      requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || '' });
    });
    page.on('pageerror', (error) => {
      pageErrors.push({ message: error.message, stack: error.stack || '' });
    });
    page.on('console', (message) => {
      const type = message.type();
      if (['warning', 'warn', 'error'].includes(type)) {
        consoleMessages.push({ type, text: message.text().slice(0, 500) });
      }
    });
    await page.addInitScript(() => {
      window.__codexApiCalls = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const startedAt = Date.now();
        const request = args[0];
        const init = args[1] || {};
        const url = typeof request === 'string' ? request : request?.url;
        const method = init.method || request?.method || 'GET';
        const entry = {
          index: window.__codexApiCalls.length,
          url,
          method,
          startedAt,
          completed: false,
        };
        window.__codexApiCalls.push(entry);
        try {
          const response = await originalFetch(...args);
          entry.completed = true;
          entry.ok = response.ok;
          entry.status = response.status;
          entry.durationMs = Date.now() - startedAt;
          return response;
        } catch (error) {
          entry.completed = true;
          entry.ok = false;
          entry.error = error?.message || String(error);
          entry.durationMs = Date.now() - startedAt;
          throw error;
        }
      };
    });

    const url = new URL(CONFIG.gameUrl);
    url.searchParams.set('codexIabToken', login.token);
    url.searchParams.set('codexIabUser', CONFIG.username);
    url.searchParams.set('codexSpawnReadonly', runId);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: CONFIG.maxWaitMs });
    await page.waitForFunction(() => Boolean(window.Game && window.Game.canvasShell), null, { timeout: CONFIG.maxWaitMs });
    await page.waitForFunction(() => Boolean(window.Game?.playerId || window.Game?.state?.playerId), null, {
      timeout: CONFIG.maxWaitMs,
    });
    await page.waitForFunction(
      (expectedVisibleTileCount) => {
        const tiles = window.Game?.state?.territoryState?.worldMap?.tiles;
        return Array.isArray(tiles) && tiles.length >= expectedVisibleTileCount;
      },
      CONFIG.expectedVisibleTileCount,
      { timeout: CONFIG.maxWaitMs },
    );
    await page.waitForTimeout(1200);

    const frontendState = await getFrontendState(page);
    const screenshotPath = path.join(outDir, 'public-h5-spawn-readonly.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const verdict = buildVerdict(apiSummary, frontendState);
    const summary = {
      schema: 'wxgame-online-spawn-readonly-v1',
      outDir,
      screenshot: screenshotPath,
      capturedAt: new Date().toISOString(),
      gameUrl: CONFIG.gameUrl,
      apiBase: CONFIG.apiBase,
      username: CONFIG.username,
      runId,
      viewport: {
        width: CONFIG.viewportWidth,
        height: CONFIG.viewportHeight,
      },
      headless: CONFIG.headless,
      expectations: {
        expectedOriginTileId: CONFIG.expectedOriginTileId || apiSummary.originTileId,
        expectedVisibleTileCount: CONFIG.expectedVisibleTileCount,
        expectedOwnedTerritoryIds: CONFIG.expectedOwnedTerritoryIds,
      },
      apiSummary,
      frontendState: sanitize(frontendState),
      badResponses,
      requestFailures,
      pageErrors,
      consoleMessages,
      verdict,
    };
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({
      outDir,
      screenshot: screenshotPath,
      playerId: frontendState.playerId,
      apiOrigin: apiSummary.originTileId,
      frontendOrigin: frontendState.originTileId,
      apiCapital: apiSummary.capital?.tileId || '',
      frontendCapital: frontendState.capital?.tileId || '',
      visibleTileCount: frontendState.visibleTileCount,
      localOwnedTerritoryIds: frontendState.localOwnedTerritoryIds,
      sharedOccupiedTerritories: frontendState.sharedOccupiedTerritories,
      badResponses: badResponses.length,
      requestFailures: requestFailures.length,
      pageErrors: pageErrors.length,
      consoleErrors: verdict.consoleErrors.length,
      pass: verdict.pass,
      failures: verdict.failures,
    }, null, 2));
    if (!verdict.pass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fatal-error.txt'), error.stack || error.message);
  console.error(error.stack || error.message);
  process.exit(1);
});
