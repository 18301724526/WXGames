const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CONFIG = {
  gameUrl: process.env.PLAYTEST_GAME_URL || 'http://47.116.32.216/wxgame/',
  apiBase: process.env.PLAYTEST_API_BASE || 'http://47.116.32.216:3000/api',
  username: process.env.PLAYTEST_USERNAME || 'test3',
  password: process.env.PLAYTEST_PASSWORD || '123456',
  headless: process.env.PLAYTEST_HEADLESS !== '0',
  viewportWidth: Number(process.env.PLAYTEST_VIEWPORT_WIDTH || 1365),
  viewportHeight: Number(process.env.PLAYTEST_VIEWPORT_HEIGHT || 768),
  outputRoot: process.env.PLAYTEST_OUTPUT_DIR || path.join('tmp', 'verification', 'online-reset-spawn'),
  maxWaitMs: Number(process.env.PLAYTEST_MAX_WAIT_MS || 45000),
};

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(CONFIG.outputRoot, runId);
fs.mkdirSync(outDir, { recursive: true });

const badResponses = [];
const requestFailures = [];
const pageErrors = [];
const browserEvents = [];
const actionEvidence = [];

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

function fileNameSafe(value) {
  return String(value || 'item').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 96);
}

function coordsKey(coord = {}) {
  if (coord?.tileId) return coord.tileId;
  const q = Number(coord?.q ?? coord?.x);
  const r = Number(coord?.r ?? coord?.y);
  return Number.isFinite(q) && Number.isFinite(r) ? `tile_${q}_${r}` : '';
}

function sameCoord(a = {}, b = {}) {
  const aKey = coordsKey(a);
  const bKey = coordsKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
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

function summarizeWorldState(state = {}, options = {}) {
  const currentPlayerId = String(options.currentPlayerId || state.playerId || CONFIG.username || '').trim();
  const territoryState = state.territoryState || {};
  const worldMap = territoryState.worldMap || {};
  const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
  const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
  const capital = territories.find((item) => item?.id === 'capital' || item?.cityId === 'capital')
    || territories.find((item) => item?.type === 'capital')
    || null;
  const capitalCoord = capital
    ? {
      q: Number(capital.q ?? capital.x ?? capital.relativeX),
      r: Number(capital.r ?? capital.y ?? capital.relativeY),
      tileId: coordsKey(capital),
    }
    : null;
  const origin = worldMap.origin || worldMap.worldOrigin || null;
  const visibleTiles = tiles.filter((tile) => tile && tile.renderOnly !== true && tile.visible !== false && tile.discovered !== false);
  const controlledTiles = tiles.filter((tile) => tile?.visibility === 'controlled' || tile?.siteId === 'capital');
  const ownedTerritories = territories
    .filter((item) => isLocalOwnedTerritory(item, currentPlayerId))
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
      return ownerPlayerId && ownerPlayerId !== currentPlayerId && item?.status === 'occupied';
    })
    .map((item) => ({
      id: item.id || item.territoryId || item.cityId || '',
      status: item.status || '',
      owner: item.owner || '',
      ownerPlayerId: getLocalOwnerPlayerId(item),
      tileId: coordsKey(item),
    }));
  return {
    playerId: currentPlayerId,
    origin,
    originTileId: coordsKey(origin),
    capital: capitalCoord,
    worldTileCount: tiles.length,
    visibleTileCount: visibleTiles.length,
    controlledTileCount: controlledTiles.length,
    ownedTerritories,
    ownedTerritoryIds: ownedTerritories.map((item) => item.id).filter(Boolean),
    ownedTerritoryTileIds: ownedTerritories.map((item) => item.tileId).filter(Boolean),
    sharedOccupiedTerritories,
  };
}

async function postJson(url, body, token = null) {
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

async function getState(page) {
  return page.evaluate(() => {
    const toTileId = (coord = {}) => {
      if (coord?.tileId) return coord.tileId;
      const q = Number(coord?.q ?? coord?.x);
      const r = Number(coord?.r ?? coord?.y);
      return Number.isFinite(q) && Number.isFinite(r) ? `tile_${q}_${r}` : '';
    };
    const summarizeTargets = (targets = []) => (Array.isArray(targets) ? targets : []).map((target, index) => {
      const rect = target.rect || target;
      return {
        index,
        x: Number(target.x ?? rect.x) || 0,
        y: Number(target.y ?? rect.y) || 0,
        width: Number(target.width ?? rect.width) || 0,
        height: Number(target.height ?? rect.height) || 0,
        action: target.action || {},
      };
    });
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || null;
    const runtime = shell?.runtime || game?.runtime || null;
    const canvas = runtime?.canvas
      || document.querySelector('[data-canvas-hud-input]')
      || document.getElementById('h5CanvasLayer')
      || document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect?.();
    const coordinator = shell?.worldMapRuntimeCoordinator || game?.worldMapRuntimeCoordinator || null;
    const worldMapRuntime = coordinator?.getMapRuntime?.()
      || coordinator?.ensureRuntime?.()
      || shell?.worldMapRuntime
      || game?.worldMapRuntime
      || null;
    const contextCandidates = [
      worldMapRuntime?.getLastTileMapContext?.(),
      worldMapRuntime?.lastTileMapContext,
      runtime?.getLastTileMapContext?.(),
      runtime?.lastTileMapContext,
      renderer?.lastWorldTileMapContext,
      renderer?.worldMapLayerRenderer?.lastWorldTileMapContext,
      shell?.worldMapRenderer?.lastWorldTileMapContext,
    ].filter(Boolean);
    const tileMapContext = contextCandidates.find((context) => Array.isArray(context?.tileMapView?.tiles)) || null;
    const tileMapView = tileMapContext?.tileMapView || {};
    const hitTargets = summarizeTargets(renderer?.hitTargets);
    const counts = {};
    hitTargets.forEach((target) => {
      const type = target.action?.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    const territoryState = game?.state?.territoryState || {};
    const worldMap = territoryState.worldMap || {};
    const tiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
    const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
    const capital = territories.find((item) => item?.id === 'capital' || item?.cityId === 'capital')
      || territories.find((item) => item?.type === 'capital')
      || null;
    const capitalCoord = capital
      ? {
        q: Number(capital.q ?? capital.x ?? capital.relativeX),
        r: Number(capital.r ?? capital.y ?? capital.relativeY),
        tileId: toTileId(capital),
      }
      : null;
    const origin = worldMap.origin || worldMap.worldOrigin || null;
    const renderTiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const capitalHitTarget = hitTargets.find((target) => {
      const action = target.action || {};
      return action.type === 'openWorldSite' && (action.siteId === 'capital' || action.cityId === 'capital' || action.tileId === toTileId(capitalCoord));
    }) || null;
    return {
      title: document.title,
      url: location.href,
      playerId: game?.playerId || game?.state?.playerId || '',
      currentTab: game?.state?.currentTab || game?.currentTab || shell?.currentTab || '',
      militaryView: game?.state?.militaryView || shell?.militaryView || '',
      mapHomeActive: Boolean(shell?.mapHomeActive || game?.mapHomeActive),
      tutorialStep: (() => {
        const raw = game?.tutorial?.currentStep ?? game?.state?.tutorial?.currentStep ?? 0;
        const index = globalThis.TutorialFlowShared?.stepIndex?.(raw);
        return Number.isFinite(index) && index >= 0 ? index : Number(raw) || 0;
      })(),
      tutorialCompleted: Boolean(game?.tutorial?.completed || game?.state?.tutorial?.completed),
      loading: shell?.loading || null,
      confirmDialog: shell?.confirmDialog || null,
      canvas: {
        logicalWidth: Number(runtime?.width || renderer?.width || canvas?.width || rect?.width || 0),
        logicalHeight: Number(runtime?.height || renderer?.height || canvas?.height || rect?.height || 0),
        rect: rect ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        } : null,
      },
      hitTargets,
      hitTargetCounts: counts,
      capitalHitTarget,
      territoryState: {
        worldMap: {
          origin,
          tileCount: tiles.length,
          tiles: tiles.map((tile) => ({
            id: tile.id || tile.tileId || toTileId(tile),
            q: Number(tile.q),
            r: Number(tile.r),
            tileId: toTileId(tile),
            terrain: tile.terrain || '',
            visibility: tile.visibility || '',
            siteId: tile.siteId || '',
            renderOnly: Boolean(tile.renderOnly),
            visible: tile.visible,
            discovered: tile.discovered,
          })),
        },
        territories: territories.map((item) => ({
          id: item.id || '',
          type: item.type || '',
          status: item.status || '',
          owner: item.owner || '',
          ownerPlayerId: item.ownerPlayerId || '',
          q: Number(item.q ?? item.x ?? item.relativeX),
          r: Number(item.r ?? item.y ?? item.relativeY),
          tileId: toTileId(item),
        })),
        capital: capitalCoord,
      },
      renderContext: {
        present: Boolean(tileMapContext),
        origin: tileMapView.origin || tileMapView.worldOrigin || null,
        pan: tileMapView.pan || null,
        tileCount: renderTiles.length,
        containsCapital: renderTiles.some((tile) => toTileId(tile) === toTileId(capitalCoord)),
        capitalTile: renderTiles.find((tile) => toTileId(tile) === toTileId(capitalCoord)) || null,
      },
      runtimeCamera: worldMapRuntime ? {
        cameraX: Number(worldMapRuntime.cameraX ?? worldMapRuntime.x ?? worldMapRuntime.panX),
        cameraY: Number(worldMapRuntime.cameraY ?? worldMapRuntime.y ?? worldMapRuntime.panY),
        waterTimeMs: worldMapRuntime.waterTimeMs ?? null,
      } : null,
      apiCalls: Array.isArray(window.__codexApiCalls) ? window.__codexApiCalls : [],
    };
  });
}

async function writeSnapshot(page, label, extra = {}) {
  const state = await getState(page);
  const fullPath = path.join(outDir, `${fileNameSafe(label)}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const payload = { label, capturedAt: new Date().toISOString(), state: sanitize(state), extra: sanitize(extra) };
  const jsonPath = path.join(outDir, `${fileNameSafe(label)}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  return { state, fullPath, jsonPath };
}

function pagePointForTarget(state, target) {
  const canvas = state.canvas || {};
  const rect = canvas.rect || { left: 0, top: 0, width: CONFIG.viewportWidth, height: CONFIG.viewportHeight };
  const logicalWidth = Number(canvas.logicalWidth) || Number(rect.width) || CONFIG.viewportWidth;
  const logicalHeight = Number(canvas.logicalHeight) || Number(rect.height) || CONFIG.viewportHeight;
  const scaleX = Number(rect.width) / Math.max(1, logicalWidth);
  const scaleY = Number(rect.height) / Math.max(1, logicalHeight);
  return {
    x: Number(rect.left) + (Number(target.x) + Number(target.width) / 2) * scaleX,
    y: Number(rect.top) + (Number(target.y) + Number(target.height) / 2) * scaleY,
  };
}

function findTopTarget(state, predicate) {
  const targets = Array.isArray(state.hitTargets) ? state.hitTargets : [];
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (!target || Number(target.width) <= 0 || Number(target.height) <= 0) continue;
    if (predicate(target.action || {}, target)) return target;
  }
  return null;
}

async function waitForState(page, label, predicate, options = {}) {
  const timeoutMs = Number(options.timeoutMs || CONFIG.maxWaitMs);
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await getState(page);
    const result = predicate(lastState);
    if (result) return { state: lastState, result };
    await page.waitForTimeout(Number(options.intervalMs || 350));
  }
  await writeSnapshot(page, `${label}-timeout`, { lastState });
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function clickTarget(page, label, target, extra = {}) {
  const before = await writeSnapshot(page, `${label}-before`, { target, ...extra });
  const point = pagePointForTarget(before.state, target);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(600);
  const after = await writeSnapshot(page, `${label}-after`, { target, pagePoint: point, ...extra });
  actionEvidence.push({
    label,
    action: sanitize(target.action || {}),
    target: sanitize(target),
    pagePoint: point,
    beforeFullPath: before.fullPath,
    afterFullPath: after.fullPath,
  });
  return after;
}

async function clickByPredicate(page, label, predicate, timeoutMs = 12000) {
  const ready = await waitForState(page, `wait-${label}`, (state) => findTopTarget(state, predicate), { timeoutMs });
  return clickTarget(page, label, ready.result);
}

function evaluateReset({ beforeSummary, afterSummary, afterState, resetCall }) {
  const failures = [];
  if (!resetCall?.ok || resetCall.status !== 200) failures.push('reset API call did not complete successfully');
  if (!afterSummary.originTileId) failures.push('after reset world origin is missing');
  if (!afterSummary.capital?.tileId) failures.push('after reset capital coordinate is missing');
  if (afterSummary.originTileId && afterSummary.capital?.tileId && afterSummary.originTileId !== afterSummary.capital.tileId) {
    failures.push(`after reset origin ${afterSummary.originTileId} does not match capital ${afterSummary.capital.tileId}`);
  }
  if (beforeSummary.originTileId && afterSummary.originTileId === beforeSummary.originTileId) {
    failures.push(`reset kept the previous spawn ${afterSummary.originTileId}`);
  }
  const previousOwned = new Set((beforeSummary.ownedTerritories || [])
    .filter((item) => item.id && item.id !== 'capital')
    .map((item) => item.id));
  const afterOwned = new Set((afterSummary.ownedTerritories || [])
    .filter((item) => item.id && item.id !== 'capital')
    .map((item) => item.id));
  const retainedOldOwned = [...previousOwned].filter((id) => afterOwned.has(id));
  if (retainedOldOwned.length) failures.push(`old owned territories still present after reset: ${retainedOldOwned.join(',')}`);
  const previousOwnedTiles = new Set((beforeSummary.ownedTerritoryTileIds || []).filter(Boolean));
  if (afterSummary.capital?.tileId && previousOwnedTiles.has(afterSummary.capital.tileId)) {
    failures.push(`new capital spawned on a previous owned tile ${afterSummary.capital.tileId}`);
  }
  if (afterSummary.visibleTileCount !== 25) {
    failures.push(`after reset visible starting tile count is ${afterSummary.visibleTileCount}, expected 25`);
  }
  if (!afterState.renderContext?.containsCapital) failures.push('render context does not contain the new capital tile');
  if (!afterState.capitalHitTarget) failures.push('new capital is not visible/clickable in canvas hit targets');
  if (!afterState.mapHomeActive || afterState.currentTab !== 'military') {
    failures.push(`after reset view is not map-home military: tab=${afterState.currentTab} mapHome=${afterState.mapHomeActive}`);
  }
  return {
    pass: failures.length === 0,
    failures,
    previousOwnedTerritoryCount: previousOwned.size,
    retainedOldOwned,
  };
}

async function main() {
  const login = await postJson(`${CONFIG.apiBase}/player/login`, {
    username: CONFIG.username,
    password: CONFIG.password,
  });
  if (!login.token) throw new Error('login returned no token');
  const beforeApiSummary = summarizeWorldState(login.gameState || {}, { currentPlayerId: CONFIG.username });

  const browser = await chromium.launch({ headless: CONFIG.headless });
  const page = await browser.newPage({
    viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight },
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => browserEvents.push({ type: msg.type(), text: msg.text().slice(0, 1000) }));
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack }));
  page.on('requestfailed', (req) => requestFailures.push({
    url: req.url(),
    method: req.method(),
    failure: req.failure()?.errorText || '',
  }));
  page.on('response', (resp) => {
    if (resp.status() >= 400) badResponses.push({ url: resp.url(), status: resp.status() });
  });
  await page.addInitScript(({ token, username }) => {
    const originalFetch = window.fetch.bind(window);
    window.__codexApiCalls = [];
    window.fetch = async (...args) => {
      const startedAt = Date.now();
      const request = args[0];
      const init = args[1] || {};
      const url = typeof request === 'string' ? request : String(request?.url || '');
      const method = String(init.method || request?.method || 'GET').toUpperCase();
      let body = null;
      try {
        const rawBody = init.body ?? request?.body ?? null;
        body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      } catch {
        body = typeof init.body === 'string' ? init.body.slice(0, 300) : null;
      }
      const entry = { index: window.__codexApiCalls.length, url, method, body, startedAt, completed: false };
      window.__codexApiCalls.push(entry);
      try {
        const response = await originalFetch(...args);
        let payload = {};
        try { payload = await response.clone().json(); } catch (_) {}
        entry.completed = true;
        entry.ok = response.ok;
        entry.status = response.status;
        entry.response = payload;
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
    localStorage.setItem('cf_token', token);
    localStorage.setItem('cf_username', username);
  }, { token: login.token, username: CONFIG.username });

  const url = new URL(CONFIG.gameUrl);
  url.searchParams.set('codexResetSpawn', runId);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.Game && window.Game.canvasShell), null, { timeout: 45000 });
  await page.waitForTimeout(6000);

  const beforeLoaded = await writeSnapshot(page, '00-loaded-before-reset', { beforeApiSummary });
  const beforeBrowserSummary = summarizeWorldState({
    territoryState: {
      worldMap: beforeLoaded.state.territoryState.worldMap,
      territories: beforeLoaded.state.territoryState.territories,
    },
  }, { currentPlayerId: CONFIG.username });

  await clickByPredicate(page, '01-open-settings', (action) => action.type === 'openSettings' && !action.disabled);
  await clickByPredicate(page, '02-request-reset', (action) => action.type === 'requestResetGame' && !action.disabled);
  await waitForState(page, 'wait-reset-confirm-visible', (state) => state.confirmDialog?.visible && state.confirmDialog?.kind === 'resetGame', { timeoutMs: 10000 });
  await clickByPredicate(page, '03-confirm-reset', (action) => action.type === 'confirmResetGame' && !action.disabled, 10000);
  const resetDone = await waitForState(page, 'wait-reset-complete', (state) => {
    const resetCall = (state.apiCalls || []).find((call) => String(call.url || '').includes('/player/reset') && call.completed);
    if (!resetCall?.ok) return false;
    if (state.confirmDialog?.visible) return false;
    if (state.loading?.visible) return false;
    return resetCall;
  }, { timeoutMs: CONFIG.maxWaitMs });
  await page.waitForTimeout(2000);
  const afterSnapshot = await writeSnapshot(page, '04-after-reset-complete', { resetCall: resetDone.result });

  const afterBrowserSummary = summarizeWorldState({
    territoryState: {
      worldMap: afterSnapshot.state.territoryState.worldMap,
      territories: afterSnapshot.state.territoryState.territories,
    },
  }, { currentPlayerId: CONFIG.username });
  const resetResponseState = resetDone.result?.response?.gameState || null;
  const resetResponseSummary = summarizeWorldState(resetResponseState || {}, { currentPlayerId: CONFIG.username });
  const verdict = evaluateReset({
    beforeSummary: beforeBrowserSummary,
    afterSummary: afterBrowserSummary,
    afterState: afterSnapshot.state,
    resetCall: resetDone.result,
  });
  const summary = {
    outputDir: outDir,
    gameUrl: CONFIG.gameUrl,
    apiBase: CONFIG.apiBase,
    deployedUrl: url.toString(),
    playerId: CONFIG.username,
    beforeApiSummary,
    beforeBrowserSummary,
    resetResponseSummary,
    afterBrowserSummary,
    resetCall: sanitize(resetDone.result),
    actionEvidence,
    badResponses,
    requestFailures,
    pageErrors,
    browserEventCount: browserEvents.length,
    verdict,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, 'browser-events.json'), JSON.stringify(browserEvents, null, 2));
  await browser.close();

  console.log(JSON.stringify({
    outputDir: outDir,
    playerId: CONFIG.username,
    beforeOrigin: beforeBrowserSummary.originTileId,
    afterOrigin: afterBrowserSummary.originTileId,
    afterCapital: afterBrowserSummary.capital,
    afterVisibleTileCount: afterBrowserSummary.visibleTileCount,
    renderContainsCapital: afterSnapshot.state.renderContext?.containsCapital,
    capitalHitTargetVisible: Boolean(afterSnapshot.state.capitalHitTarget),
    badResponses: badResponses.length,
    requestFailures: requestFailures.length,
    pageErrors: pageErrors.length,
    verdict,
  }, null, 2));
  if (!verdict.pass || badResponses.length || requestFailures.length || pageErrors.length) process.exit(1);
}

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fatal-error.txt'), error.stack || error.message);
  console.error(error.stack || error.message);
  process.exit(1);
});
