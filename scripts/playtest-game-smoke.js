'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const CONFIG = Object.freeze({
  gameUrl: process.env.PLAYTEST_GAME_URL || 'http://127.0.0.1:8671/',
  apiBase: process.env.PLAYTEST_API_BASE || 'http://127.0.0.1:3671/api',
  username: process.env.PLAYTEST_USERNAME || 'codexqa',
  password: process.env.PLAYTEST_PASSWORD || '123456',
  headless: process.env.PLAYTEST_HEADLESS !== '0',
  viewportWidth: Number(process.env.PLAYTEST_VIEWPORT_WIDTH || 1365),
  viewportHeight: Number(process.env.PLAYTEST_VIEWPORT_HEIGHT || 768),
  maxWaitMs: Number(process.env.PLAYTEST_MAX_WAIT_MS || 45000),
  outputRoot: process.env.PLAYTEST_OUTPUT_DIR || path.join('.local-logs', 'game-smoke'),
});

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.resolve(CONFIG.outputRoot, runId);
fs.mkdirSync(outputDir, { recursive: true });

const browserEvidence = {
  badResponses: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
};
const actions = [];

function apiUrl(route) {
  return `${CONFIG.apiBase.replace(/\/$/, '')}/${String(route || '').replace(/^\//, '')}`;
}

function sanitize(value, depth = 0) {
  if (depth > 6) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return typeof value === 'function' ? '[function]' : value;
  if (Array.isArray(value)) return value.slice(0, 160).map((item) => sanitize(item, depth + 1));
  return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => typeof entry !== 'function')
    .map(([key, entry]) => [key, sanitize(entry, depth + 1)]));
}

function safeName(value) {
  return String(value || 'snapshot').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 100);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { text };
  }
  if (!response.ok) throw new Error(`POST ${url} failed ${response.status}: ${text}`);
  return payload;
}

async function readGameState(page) {
  return page.evaluate(() => {
    const game = globalThis.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || null;
    const runtime = shell?.runtime || game?.runtime || null;
    shell?.renderActive?.();
    const canvas = runtime?.canvas
      || document.querySelector('[data-canvas-hud-input]')
      || document.getElementById('h5CanvasLayer')
      || document.querySelector('canvas');
    const canvasRect = canvas?.getBoundingClientRect?.() || null;
    const hitTargets = (Array.isArray(renderer?.hitTargets) ? renderer.hitTargets : []).map((target, index) => {
      const rect = target?.rect || target || {};
      return {
        index,
        x: Number(target?.x ?? rect.x) || 0,
        y: Number(target?.y ?? rect.y) || 0,
        width: Number(target?.width ?? rect.width) || 0,
        height: Number(target?.height ?? rect.height) || 0,
        action: target?.action || {},
      };
    });
    const actionCounts = {};
    hitTargets.forEach((target) => {
      const type = target.action?.type || 'unknown';
      actionCounts[type] = (actionCounts[type] || 0) + 1;
    });
    const state = game?.state || {};
    const territoryUiState = globalThis.TerritoryUiStateStore?.read?.(shell)
      || shell?.territoryUiState
      || game?.territoryUiState
      || {};
    const resources = Object.fromEntries(Object.entries(state.resources || {})
      .filter(([, value]) => typeof value === 'number' && Number.isFinite(value)));
    const buildings = Object.fromEntries(Object.entries(state.buildings || {}).map(([id, value]) => [
      id,
      value && typeof value === 'object' ? {
        level: Number(value.level) || 0,
        status: value.status || '',
        count: Number(value.count) || 0,
      } : value,
    ]));
    return {
      url: location.href,
      title: document.title,
      playerId: game?.playerId || state.playerId || '',
      currentTab: state.currentTab || game?.activeTab || shell?.getActiveTab?.() || '',
      militaryView: state.militaryView || game?.militaryView || shell?.militaryView || '',
      mapHomeActive: Boolean(game?.mapHomeActive || shell?.mapHomeActive),
      loadingVisible: Boolean(shell?.loading?.visible || game?.loading?.visible),
      resourceDetailsOpen: Boolean(shell?.isBlockingPanelSnapshotOpen?.('showResourceDetails')),
      cityManagementOpen: Boolean(shell?.isBlockingPanelSnapshotOpen?.('showCityManagement')),
      selectedSiteId: territoryUiState.selectedSiteId || '',
      activeCityManagementTab: game?.activeCityManagementTab || shell?.activeCityManagementTab || '',
      resources,
      buildings,
      buildingSignature: JSON.stringify(buildings),
      hitTargets,
      actionCounts,
      apiCalls: Array.isArray(globalThis.__gameSmokeApiCalls) ? globalThis.__gameSmokeApiCalls : [],
      canvas: {
        logicalWidth: Number(runtime?.width || renderer?.width || canvas?.width || canvasRect?.width || 0),
        logicalHeight: Number(runtime?.height || renderer?.height || canvas?.height || canvasRect?.height || 0),
        rect: canvasRect ? {
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
          height: canvasRect.height,
        } : null,
      },
    };
  });
}

function findTarget(state, predicate) {
  const targets = Array.isArray(state?.hitTargets) ? state.hitTargets : [];
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (!target || target.width <= 0 || target.height <= 0) continue;
    if (predicate(target.action || {}, target)) return target;
  }
  return null;
}

function pagePoint(state, target) {
  const rect = state.canvas?.rect || {
    left: 0,
    top: 0,
    width: CONFIG.viewportWidth,
    height: CONFIG.viewportHeight,
  };
  const logicalWidth = Number(state.canvas?.logicalWidth) || Number(rect.width) || CONFIG.viewportWidth;
  const logicalHeight = Number(state.canvas?.logicalHeight) || Number(rect.height) || CONFIG.viewportHeight;
  return {
    x: Number(rect.left) + (target.x + target.width / 2) * (Number(rect.width) / Math.max(1, logicalWidth)),
    y: Number(rect.top) + (target.y + target.height / 2) * (Number(rect.height) / Math.max(1, logicalHeight)),
  };
}

async function capture(page, label, extra = {}) {
  const state = await readGameState(page);
  const base = path.join(outputDir, safeName(label));
  const screenshotPath = `${base}.png`;
  const jsonPath = `${base}.json`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify({
    label,
    capturedAt: new Date().toISOString(),
    state: sanitize(state),
    extra: sanitize(extra),
  }, null, 2)}\n`);
  return { state, screenshotPath, jsonPath };
}

async function waitForState(page, label, predicate, timeoutMs = CONFIG.maxWaitMs) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await readGameState(page);
    const result = predicate(lastState);
    if (result) return { state: lastState, result };
    await page.waitForTimeout(250);
  }
  await capture(page, `${label}-timeout`, { lastState });
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function clickTarget(page, label, target, extra = {}) {
  const before = await capture(page, `${label}-before`, { target, ...extra });
  const point = pagePoint(before.state, target);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(350);
  actions.push({
    label,
    action: sanitize(target.action),
    target: sanitize(target),
    point,
    beforeScreenshot: before.screenshotPath,
  });
  return { before, point };
}

async function findAndClick(page, label, predicate, timeoutMs = 15000) {
  const ready = await waitForState(page, `wait-${label}`, (state) => findTarget(state, predicate), timeoutMs);
  const clicked = await clickTarget(page, label, ready.result);
  return { target: ready.result, ...clicked };
}

function resourceChanges(before = {}, after = {}) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .map((key) => ({ key, before: Number(before[key]) || 0, after: Number(after[key]) || 0 }))
    .filter((entry) => entry.before !== entry.after);
}

function attachBrowserEvidence(page) {
  page.on('console', (message) => {
    if (message.type() === 'error') browserEvidence.consoleErrors.push(message.text().slice(0, 1200));
  });
  page.on('pageerror', (error) => browserEvidence.pageErrors.push(error.message || String(error)));
  page.on('requestfailed', (request) => browserEvidence.requestFailures.push({
    method: request.method(),
    url: request.url(),
    error: request.failure()?.errorText || '',
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) browserEvidence.badResponses.push({
      status: response.status(),
      url: response.url(),
    });
  });
}

async function main() {
  const login = await postJson(apiUrl('/player/login'), {
    username: CONFIG.username,
    password: CONFIG.password,
  });
  if (!login.token) throw new Error('login returned no token');

  const browser = await chromium.launch({ headless: CONFIG.headless });
  try {
    const page = await browser.newPage({
      viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight },
      deviceScaleFactor: 1,
    });
    attachBrowserEvidence(page);
    await page.addInitScript(({ token, username }) => {
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.__gameSmokeApiCalls = [];
      globalThis.fetch = async (...args) => {
        const request = args[0];
        const init = args[1] || {};
        const entry = {
          url: typeof request === 'string' ? request : String(request?.url || ''),
          method: String(init.method || request?.method || 'GET').toUpperCase(),
          completed: false,
        };
        globalThis.__gameSmokeApiCalls.push(entry);
        try {
          const response = await originalFetch(...args);
          entry.completed = true;
          entry.ok = response.ok;
          entry.status = response.status;
          return response;
        } catch (error) {
          entry.completed = true;
          entry.ok = false;
          entry.error = error?.message || String(error);
          throw error;
        }
      };
      localStorage.setItem('cf_token', token);
      localStorage.setItem('cf_username', username);
    }, { token: login.token, username: CONFIG.username });

    const gameUrl = new URL(CONFIG.gameUrl);
    gameUrl.searchParams.set('gameSmokeRun', runId);
    await page.goto(gameUrl.toString(), { waitUntil: 'domcontentloaded', timeout: CONFIG.maxWaitMs });
    await page.waitForFunction(() => Boolean(globalThis.Game?.canvasShell), null, { timeout: CONFIG.maxWaitMs });
    await waitForState(page, 'game-ready', (state) => !state.loadingVisible && state.hitTargets.length > 0);
    const loaded = await capture(page, '00-loaded');

    const resourceClick = await findAndClick(page, '01-open-resource-details', (action) => (
      action.type === 'openResourceDetails'
    ));
    await waitForState(page, 'resource-details-open', (state) => (
      state.resourceDetailsOpen
      && Boolean(findTarget(state, (action) => action.type === 'closeResourceDetails'))
    ));
    const resourceEvidence = await capture(page, '01-resource-details-open', {
      action: resourceClick.target.action,
    });
    await findAndClick(page, '01-close-resource-details', (action) => action.type === 'closeResourceDetails');
    await waitForState(page, 'resource-details-closed', (state) => !state.resourceDetailsOpen);

    const cityEntryClick = await findAndClick(page, '02-open-capital-site', (action) => (
      action.type === 'openWorldSite'
      && action.siteId === 'capital'
      && !action.tileId
    ));
    const managementEntry = await waitForState(page, 'city-management-entry-ready', (state) => (
      state.cityManagementOpen
      || findTarget(state, (action) => ['enterCity', 'openCityManagement'].includes(action.type))
    ));
    let panelClick = cityEntryClick;
    if (!managementEntry.state.cityManagementOpen) {
      panelClick = await clickTarget(
        page,
        '02-open-buildings-panel',
        managementEntry.result,
        { entryAction: cityEntryClick.target.action },
      );
    }
    const panelReady = await waitForState(page, 'buildings-panel-open', (state) => (
      state.cityManagementOpen
      && state.activeCityManagementTab === 'buildings'
      && Boolean(findTarget(state, (action) => ['buildBuilding', 'upgradeBuilding'].includes(action.type)))
    ));
    const panelEvidence = await capture(page, '02-buildings-panel-open', {
      action: panelClick.target?.action || managementEntry.result?.action || {},
    });

    const buildReady = await waitForState(page, 'build-action-ready', (state) => (
      findTarget(state, (action) => action.type === 'buildBuilding' && !action.visualDisabled)
      || findTarget(state, (action) => action.type === 'upgradeBuilding' && !action.visualDisabled)
    ));
    const buildTarget = buildReady.result;
    const beforeBuildState = buildReady.state;
    await clickTarget(page, '04-build-or-upgrade', buildTarget, { buildingId: buildTarget.action.buildingId });
    const buildDone = await waitForState(page, 'building-state-changed', (state) => (
      state.buildingSignature !== beforeBuildState.buildingSignature
    ));
    const buildEvidence = await capture(page, '04-building-state-changed', {
      action: buildTarget.action,
      beforeBuildings: beforeBuildState.buildings,
      resourceChanges: resourceChanges(beforeBuildState.resources, buildDone.state.resources),
    });

    await findAndClick(page, '05-return-to-world-map', (action) => action.type === 'closeCityManagement');
    const worldReady = await waitForState(page, 'world-map-ready', (state) => (
      !state.cityManagementOpen
      && state.mapHomeActive
      && Boolean(findTarget(state, (action) => action.type === 'openWorldSite' && action.tileId))
    ));
    const worldTarget = findTarget(worldReady.state, (action) => action.type === 'openWorldSite' && action.tileId);
    await clickTarget(page, '06-select-world-tile', worldTarget, { tileId: worldTarget.action.tileId });
    const worldSelected = await waitForState(page, 'world-tile-selected', (state) => (
      state.selectedSiteId === worldTarget.action.siteId
      || Boolean(findTarget(state, (action) => action.type === 'closeWorldSite'))
    ));
    const worldEvidence = await capture(page, '06-world-tile-selected', {
      action: worldTarget.action,
      selectedSiteId: worldSelected.state.selectedSiteId,
    });

    const assertions = {
      panelOpened: panelReady.state.cityManagementOpen
        && panelReady.state.activeCityManagementTab === 'buildings',
      buildingChanged: buildDone.state.buildingSignature !== beforeBuildState.buildingSignature,
      resourcePanelOpened: resourceEvidence.state.resourceDetailsOpen
        && Object.keys(resourceEvidence.state.resources).length > 0,
      worldTileSelected: Boolean(worldTarget.action.tileId)
        && (worldSelected.state.selectedSiteId === worldTarget.action.siteId
          || Boolean(findTarget(worldSelected.state, (action) => action.type === 'closeWorldSite'))),
      noPageErrors: browserEvidence.pageErrors.length === 0,
      noServerErrors: browserEvidence.badResponses.every((entry) => entry.status < 500),
    };
    const failures = Object.entries(assertions).filter(([, passed]) => !passed).map(([name]) => name);
    const summary = {
      schema: 'game-core-smoke-v1',
      runId,
      outputDir,
      gameUrl: gameUrl.toString(),
      apiBase: CONFIG.apiBase,
      playerId: CONFIG.username,
      assertions,
      pass: failures.length === 0,
      failures,
      actions,
      evidence: {
        loaded: loaded.screenshotPath,
        panel: panelEvidence.screenshotPath,
        resources: resourceEvidence.screenshotPath,
        building: buildEvidence.screenshotPath,
        worldTile: worldEvidence.screenshotPath,
      },
      build: {
        action: buildTarget.action,
        resourceChanges: resourceChanges(beforeBuildState.resources, buildDone.state.resources),
      },
      worldTile: {
        action: worldTarget.action,
        selectedSiteId: worldSelected.state.selectedSiteId,
      },
      browserEvidence,
    };
    fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
    if (!summary.pass) throw new Error(`game smoke failed: ${failures.join(', ')}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  fs.writeFileSync(path.join(outputDir, 'failure.json'), `${JSON.stringify({
    message: error.message,
    stack: error.stack,
    browserEvidence,
    actions,
  }, null, 2)}\n`);
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
