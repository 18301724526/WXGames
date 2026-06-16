const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const CONFIG = {
  gameUrl: process.env.PLAYTEST_GAME_URL || 'http://47.116.32.216/wxgame/',
  apiBase: process.env.PLAYTEST_API_BASE || 'http://47.116.32.216:3000/api',
  username: process.env.PLAYTEST_USERNAME || 'codexqa',
  password: process.env.PLAYTEST_PASSWORD || '123456',
  headless: process.env.PLAYTEST_HEADLESS !== '0',
  viewportWidth: Number(process.env.PLAYTEST_VIEWPORT_WIDTH || 1365),
  viewportHeight: Number(process.env.PLAYTEST_VIEWPORT_HEIGHT || 768),
  outputRoot: process.env.PLAYTEST_OUTPUT_DIR || path.join('tmp', 'verification', 'online-manual-march-return'),
  minTargetDistance: Number(process.env.PLAYTEST_MIN_TARGET_DISTANCE || 5),
  sampleIntervalMs: Number(process.env.PLAYTEST_SAMPLE_INTERVAL_MS || 700),
  maxWaitMs: Number(process.env.PLAYTEST_MAX_WAIT_MS || 90000),
};

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(CONFIG.outputRoot, runId);
fs.mkdirSync(outDir, { recursive: true });

const badResponses = [];
const requestFailures = [];
const pageErrors = [];
const browserEvents = [];
const actionEvidence = [];
const samples = [];

function sanitize(value, depth = 0) {
  if (depth > 5) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return typeof value === 'function' ? '[function]' : value;
  if (Array.isArray(value)) return value.slice(0, 120).map((item) => sanitize(item, depth + 1));
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
  if (Number.isFinite(Number(coord?.q)) && Number.isFinite(Number(coord?.r))) {
    return `tile_${Number(coord.q)}_${Number(coord.r)}`;
  }
  return '';
}

function sameCoord(a = {}, b = {}) {
  const aKey = coordsKey(a);
  const bKey = coordsKey(b);
  return Boolean(aKey && bKey && aKey === bKey);
}

function hexDistance(a = {}, b = {}) {
  const aq = Number(a.q);
  const ar = Number(a.r);
  const bq = Number(b.q);
  const br = Number(b.r);
  if (![aq, ar, bq, br].every(Number.isFinite)) return 0;
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs((aq + ar) - (bq + br)));
}

function summarizeMission(mission = null) {
  if (!mission) return null;
  return {
    id: mission.id || '',
    mode: mission.mode || '',
    status: mission.status || '',
    origin: mission.origin || null,
    homeOrigin: mission.homeOrigin || null,
    target: mission.target || null,
    position: mission.position || null,
    route: Array.isArray(mission.route)
      ? mission.route.map((step) => ({ q: step.q, r: step.r, tileId: coordsKey(step), step: step.step }))
      : [],
    routeIds: Array.isArray(mission.route) ? mission.route.map(coordsKey) : [],
    routeCount: Array.isArray(mission.route) ? mission.route.length : 0,
    plannedTileIds: Array.isArray(mission.plannedTiles) ? mission.plannedTiles.map(coordsKey) : [],
    plannedSiteIds: Array.isArray(mission.plannedSites) ? mission.plannedSites.map((site) => site.siteId || site.site?.id || '') : [],
    startedAt: mission.startedAt || null,
    nextStepAt: mission.nextStepAt || null,
    completesAt: mission.completesAt || null,
    completedAt: mission.completedAt || null,
    remainingSeconds: mission.remainingSeconds,
    stepDurationSeconds: mission.stepDurationSeconds,
  };
}

function getMissionFromState(state, missionId) {
  const explorer = state.worldExplorerState || {};
  const all = [
    explorer.activeMission,
    ...(Array.isArray(explorer.missions) ? explorer.missions : []),
    ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
  ].filter(Boolean);
  return all.find((mission) => mission.id === missionId) || null;
}

function getActiveMission(state) {
  const explorer = state.worldExplorerState || {};
  if (explorer.activeMission?.id) return explorer.activeMission;
  return (Array.isArray(explorer.missions) ? explorer.missions : [])
    .find((mission) => mission?.status === 'active') || null;
}

function getRouteIndex(mission = null) {
  if (!mission?.position || !Array.isArray(mission.route)) return -1;
  return mission.route.findIndex((step) => sameCoord(step, mission.position));
}

function getFormationMission(state, formationSlot = 1, cityId = 'capital') {
  const explorer = state.worldExplorerState || {};
  const all = [
    explorer.activeMission,
    ...(Array.isArray(explorer.missions) ? explorer.missions : []),
    ...(Array.isArray(explorer.idleMissions) ? explorer.idleMissions : []),
  ].filter(Boolean);
  return all.find((mission) => (
    Number(mission?.formation?.slot) === Number(formationSlot)
    && String(mission?.formation?.cityId || cityId) === String(cityId)
    && mission?.position
  )) || null;
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
    const summarizeMissionInPage = (mission = null) => {
      if (!mission) return null;
      const toTileId = (coord = {}) => {
        if (coord?.tileId) return coord.tileId;
        const q = Number(coord?.q);
        const r = Number(coord?.r);
        return Number.isFinite(q) && Number.isFinite(r) ? `tile_${q}_${r}` : '';
      };
      return {
        id: mission.id || '',
        kind: mission.kind || '',
        mode: mission.mode || '',
        status: mission.status || '',
        origin: mission.origin || null,
        homeOrigin: mission.homeOrigin || null,
        target: mission.target || null,
        position: mission.position || null,
        route: Array.isArray(mission.route)
          ? mission.route.map((step) => ({ q: step.q, r: step.r, tileId: toTileId(step), step: step.step }))
          : [],
        routeIds: Array.isArray(mission.route) ? mission.route.map(toTileId) : [],
        plannedTileIds: Array.isArray(mission.plannedTiles) ? mission.plannedTiles.map(toTileId) : [],
        plannedSiteIds: Array.isArray(mission.plannedSites)
          ? mission.plannedSites.map((site) => site.siteId || site.site?.id || '')
          : [],
        formation: mission.formation || null,
        revealedTileIds: Array.isArray(mission.revealedTileIds) ? mission.revealedTileIds : [],
        stepDurationSeconds: mission.stepDurationSeconds,
        remainingSeconds: mission.remainingSeconds,
        startedAt: mission.startedAt || null,
        nextStepAt: mission.nextStepAt || null,
        completesAt: mission.completesAt || null,
        completedAt: mission.completedAt || null,
      };
    };
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || null;
    const runtime = shell?.runtime || game?.runtime || null;
    const canvas = runtime?.canvas
      || document.querySelector('[data-canvas-hud-input]')
      || document.getElementById('h5CanvasLayer')
      || document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect?.();
    const hitTargets = Array.isArray(renderer?.hitTargets) ? renderer.hitTargets : [];
    const summarizedTargets = hitTargets.map((target, index) => {
      const rectSource = target.rect || target;
      return {
        index,
        x: Number(target.x ?? rectSource.x) || 0,
        y: Number(target.y ?? rectSource.y) || 0,
        width: Number(target.width ?? rectSource.width) || 0,
        height: Number(target.height ?? rectSource.height) || 0,
        action: target.action || {},
      };
    });
    const counts = {};
    summarizedTargets.forEach((target) => {
      const type = target.action?.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    const explorer = game?.state?.worldExplorerState || {};
    const activeMission = summarizeMissionInPage(explorer.activeMission)
      || (Array.isArray(explorer.missions)
        ? explorer.missions.map(summarizeMissionInPage).find((mission) => mission?.status === 'active')
        : null);
    return {
      url: location.href,
      title: document.title,
      now: new Date().toISOString(),
      tokenPresent: Boolean(localStorage.getItem('cf_token')),
      playerId: game?.playerId || game?.state?.playerId || null,
      currentTab: game?.state?.currentTab || game?.currentTab || shell?.currentTab || '',
      militaryView: game?.state?.militaryView || shell?.militaryView || '',
      mapHomeActive: Boolean(shell?.mapHomeActive || game?.mapHomeActive),
      tutorialStep: Number(game?.state?.tutorial?.currentStep ?? game?.tutorial?.currentStep ?? 0) || 0,
      tutorialCompleted: Boolean(game?.state?.tutorial?.completed || game?.tutorial?.completed),
      canvas: {
        id: canvas?.id || '',
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
      hitTargets: summarizedTargets,
      hitTargetCounts: counts,
      worldExplorerState: {
        activeMission,
        missions: Array.isArray(explorer.missions) ? explorer.missions.map(summarizeMissionInPage) : [],
        idleMissions: Array.isArray(explorer.idleMissions) ? explorer.idleMissions.map(summarizeMissionInPage) : [],
        busyFormations: explorer.busyFormations || [],
        maxActiveMissions: explorer.maxActiveMissions,
        maxManualRouteLength: explorer.maxManualRouteLength,
        stepDurationSeconds: explorer.stepDurationSeconds,
      },
      territoryUiState: game?.state?.territoryUiState || null,
      territoryState: game?.state?.territoryState ? {
        origin: game.state.territoryState.worldMap?.origin || null,
        tileCount: Array.isArray(game.state.territoryState.worldMap?.tiles)
          ? game.state.territoryState.worldMap.tiles.length
          : 0,
        occupiedCount: game.state.territoryState.occupiedCount,
        worldMap: {
          origin: game.state.territoryState.worldMap?.origin || null,
          tiles: Array.isArray(game.state.territoryState.worldMap?.tiles)
            ? game.state.territoryState.worldMap.tiles.map((tile) => ({
              id: tile.id,
              q: tile.q,
              r: tile.r,
              terrain: tile.terrain,
              siteId: tile.siteId || tile.site?.id || '',
              visibility: tile.visibility || '',
              visible: tile.visible,
              discovered: tile.discovered,
            }))
            : [],
        },
      } : null,
      apiCalls: Array.isArray(window.__codexApiCalls) ? window.__codexApiCalls.slice(-120) : [],
    };
  });
}

async function writeSnapshot(page, label, extra = {}) {
  const safe = fileNameSafe(label);
  const state = await getState(page);
  const fullPath = path.join(outDir, `${safe}-full.png`);
  const jsonPath = path.join(outDir, `${safe}.json`);
  await page.screenshot({ path: fullPath, fullPage: true });
  fs.writeFileSync(jsonPath, JSON.stringify({ label, state: sanitize(state), extra: sanitize(extra) }, null, 2));
  return { label, state, fullPath, jsonPath };
}

function targetCenter(target = {}) {
  return {
    x: (Number(target.x) || 0) + (Number(target.width) || 0) / 2,
    y: (Number(target.y) || 0) + (Number(target.height) || 0) / 2,
  };
}

function targetPageCenter(target = {}, state = {}) {
  const center = targetCenter(target);
  const canvas = state.canvas || {};
  const rect = canvas.rect || {};
  const logicalWidth = Number(canvas.logicalWidth || rect.width || 0);
  const logicalHeight = Number(canvas.logicalHeight || rect.height || 0);
  const rectWidth = Number(rect.width || logicalWidth || 0);
  const rectHeight = Number(rect.height || logicalHeight || 0);
  return {
    x: Number(rect.left || 0) + center.x * (rectWidth / Math.max(1, logicalWidth)),
    y: Number(rect.top || 0) + center.y * (rectHeight / Math.max(1, logicalHeight)),
  };
}

function findTopHitTarget(state, predicate) {
  const targets = Array.isArray(state.hitTargets) ? state.hitTargets : [];
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (!target || target.width <= 0 || target.height <= 0) continue;
    if (predicate(target.action || {}, target)) return target;
  }
  return null;
}

async function clickTarget(page, label, target, extra = {}) {
  if (!target) throw new Error(`${label}: target not found`);
  const before = await writeSnapshot(page, `${label}-before`, { target, ...extra });
  const center = targetCenter(target);
  const pageCenter = targetPageCenter(target, before.state);
  await page.mouse.click(pageCenter.x, pageCenter.y);
  await page.waitForTimeout(700);
  const after = await writeSnapshot(page, `${label}-after`, { target, center, pageCenter, ...extra });
  const record = {
    label,
    center,
    pageCenter,
    action: sanitize(target.action || {}),
    beforeFullPath: before.fullPath,
    afterFullPath: after.fullPath,
    afterState: {
      activeMission: summarizeMission(getActiveMission(after.state)),
      counts: after.state.hitTargetCounts,
    },
  };
  actionEvidence.push(record);
  return after.state;
}

async function waitForState(page, label, predicate, options = {}) {
  const timeoutMs = options.timeoutMs || CONFIG.maxWaitMs;
  const intervalMs = options.intervalMs || CONFIG.sampleIntervalMs;
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt <= timeoutMs) {
    const state = await getState(page);
    lastState = state;
    const result = predicate(state);
    if (result) return { state, result, elapsedMs: Date.now() - startedAt };
    await page.waitForTimeout(intervalMs);
  }
  await writeSnapshot(page, `${label}-timeout`, { timeoutMs, lastState });
  throw new Error(`${label}: timeout after ${timeoutMs}ms`);
}

function chooseLongMarchTarget(state) {
  const formationMission = getFormationMission(state, 1, 'capital');
  const origin = formationMission?.position
    || state.territoryState?.origin
    || state.territoryState?.worldMap?.origin
    || {};
  const unique = new Map();
  (state.hitTargets || []).forEach((target) => {
    const action = target.action || {};
    if (action.type !== 'selectWorldMarchTarget') return;
    const q = Number(action.targetQ);
    const r = Number(action.targetR);
    if (!Number.isFinite(q) || !Number.isFinite(r)) return;
    const tileId = action.tileId || `tile_${q}_${r}`;
    if (tileId === coordsKey(origin)) return;
    const center = targetCenter(target);
    const canvasWidth = Number(state.canvas?.logicalWidth || CONFIG.viewportWidth);
    const canvasHeight = Number(state.canvas?.logicalHeight || CONFIG.viewportHeight);
    if (center.x < 24 || center.x > canvasWidth - 24 || center.y < 64 || center.y > canvasHeight - 24) return;
    const item = {
      target,
      tileId,
      q,
      r,
      distance: hexDistance(origin, { q, r }),
      center,
      startCoord: origin,
      startMissionId: formationMission?.id || '',
    };
    const existing = unique.get(tileId);
    if (!existing || item.center.y < existing.center.y) unique.set(tileId, item);
  });
  const candidates = [...unique.values()]
    .filter((item) => item.distance >= CONFIG.minTargetDistance)
    .sort((a, b) => b.distance - a.distance || b.center.y - a.center.y);
  if (candidates.length) return candidates[0];
  return [...unique.values()].sort((a, b) => b.distance - a.distance)[0] || null;
}

function buildPositionSample(state, tag, missionId = '') {
  const active = getActiveMission(state);
  const mission = missionId ? getMissionFromState(state, missionId) : active;
  const actorTargets = (state.hitTargets || []).filter((target) => target.action?.type === 'selectWorldActor');
  return {
    at: new Date().toISOString(),
    tag,
    activeMission: summarizeMission(active),
    mission: summarizeMission(mission),
    routeIndex: getRouteIndex(active || mission),
    actorTargets: actorTargets.map((target) => ({
      missionId: target.action?.missionId || '',
      center: targetCenter(target),
      rect: { x: target.x, y: target.y, width: target.width, height: target.height },
    })),
    hitTargetCounts: state.hitTargetCounts,
  };
}

async function waitForPositionIndex(page, missionId, desiredIndex, routeCount) {
  const stepDurationSeconds = 10;
  const maxWait = Math.max(CONFIG.maxWaitMs, (Math.max(1, desiredIndex + 2) * stepDurationSeconds + 8) * 1000);
  let lastIndex = -1;
  return waitForState(page, 'wait-for-mid-route-position', (state) => {
    const active = getActiveMission(state);
    const sample = buildPositionSample(state, 'outbound-monitor', missionId);
    samples.push(sample);
    if (active?.id !== missionId) return false;
    const routeIndex = getRouteIndex(active);
    if (routeIndex !== lastIndex) {
      lastIndex = routeIndex;
      fs.writeFileSync(
        path.join(outDir, `outbound-step-${String(routeIndex).padStart(2, '0')}.json`),
        JSON.stringify(sanitize(sample), null, 2),
      );
    }
    if (routeIndex >= desiredIndex && routeIndex < routeCount - 1) return { routeIndex, active };
    return false;
  }, { timeoutMs: maxWait, intervalMs: CONFIG.sampleIntervalMs });
}

async function waitForReturnedHome(page, missionId, homeOrigin, returnStartedAtMs) {
  const positions = [];
  return waitForState(page, 'wait-for-return-home', (state) => {
    const active = getActiveMission(state);
    const mission = getMissionFromState(state, missionId) || active;
    const sample = buildPositionSample(state, 'return-monitor', missionId);
    samples.push(sample);
    positions.push({
      atMs: Date.now(),
      missionStatus: mission?.status || '',
      activeStatus: active?.status || '',
      position: mission?.position || active?.position || null,
      routeIndex: getRouteIndex(mission || active),
    });
    if (!mission) return false;
    const atHome = sameCoord(mission.position, homeOrigin);
    const inactive = !active || active.id !== missionId || mission.status === 'idle';
    if (atHome && inactive) {
      return {
        elapsedMs: Date.now() - returnStartedAtMs,
        finalMission: mission,
        positions: sanitize(positions),
      };
    }
    return false;
  }, { timeoutMs: CONFIG.maxWaitMs * 2, intervalMs: CONFIG.sampleIntervalMs });
}

function evaluateReturnResult({ beforeReturn, afterReturn, firstReturnFrame, finalResult }) {
  const failures = [];
  const beforeMission = getActiveMission(beforeReturn);
  const afterMission = getActiveMission(afterReturn) || getMissionFromState(afterReturn, beforeMission?.id);
  const firstMission = getActiveMission(firstReturnFrame) || getMissionFromState(firstReturnFrame, beforeMission?.id);
  const finalMission = finalResult?.result?.finalMission || null;
  if (!beforeMission) failures.push('missing active mission before return click');
  if (!afterMission) failures.push('missing mission immediately after return click');
  if (beforeMission && afterMission && !sameCoord(beforeMission.position, afterMission.position)) {
    failures.push(`return click changed position immediately from ${coordsKey(beforeMission.position)} to ${coordsKey(afterMission.position)}`);
  }
  if (beforeMission && firstMission && !sameCoord(beforeMission.position, firstMission.position)) {
    failures.push(`first return frame changed position from ${coordsKey(beforeMission.position)} to ${coordsKey(firstMission.position)}`);
  }
  if (finalMission && !sameCoord(finalMission.position, finalMission.homeOrigin)) {
    failures.push(`final mission did not end at home: position=${coordsKey(finalMission.position)} home=${coordsKey(finalMission.homeOrigin)}`);
  }
  if (!finalMission) failures.push('missing final mission result');
  return {
    pass: failures.length === 0,
    failures,
    beforePosition: beforeMission?.position || null,
    afterPosition: afterMission?.position || null,
    firstFramePosition: firstMission?.position || null,
    finalPosition: finalMission?.position || null,
    homeOrigin: finalMission?.homeOrigin || beforeMission?.homeOrigin || null,
  };
}

async function main() {
  const login = await postJson(`${CONFIG.apiBase}/player/login`, {
    username: CONFIG.username,
    password: CONFIG.password,
  });
  const initialState = login.gameState || {};
  if (!login.token) throw new Error('login returned no token');
  if (!initialState.tutorial?.completed && login.tutorial?.completed !== true) {
    throw new Error('QA account must have completed tutorial before manual march test');
  }

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
  url.searchParams.set('codexManualMarchReturn', runId);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.Game && window.Game.canvasShell), null, { timeout: 45000 });
  await page.waitForTimeout(5000);

  const loaded = await writeSnapshot(page, '00-loaded');
  if (!loaded.state.tutorialCompleted || loaded.state.tutorialStep < 36) {
    throw new Error(`manual march requires completed tutorial; current step=${loaded.state.tutorialStep}`);
  }
  if (!loaded.state.mapHomeActive || loaded.state.currentTab !== 'military') {
    throw new Error(`expected map-home military view, got tab=${loaded.state.currentTab} mapHome=${loaded.state.mapHomeActive}`);
  }

  const chosen = chooseLongMarchTarget(loaded.state);
  if (!chosen) throw new Error('no visible long march target found');
  fs.writeFileSync(path.join(outDir, 'chosen-target.json'), JSON.stringify(sanitize(chosen), null, 2));

  await clickTarget(page, `01-select-target-${chosen.tileId}`, chosen.target, { chosen });
  const pickerReady = await waitForState(page, 'wait-open-picker', (state) => (
    findTopHitTarget(state, (action) => action.type === 'openWorldMarchFormationPicker')
  ), { timeoutMs: 12000 });
  await clickTarget(page, '02-open-formation-picker', pickerReady.result);

  const startReady = await waitForState(page, 'wait-start-march', (state) => (
    findTopHitTarget(state, (action) => action.type === 'startWorldMarch' && Number(action.formationSlot) === 1 && !action.disabled)
  ), { timeoutMs: 12000 });
  const beforeStart = await getState(page);
  await clickTarget(page, '03-start-march-slot-1', startReady.result);

  const activeReady = await waitForState(page, 'wait-active-mission', (state) => {
    const active = getActiveMission(state);
    if (active?.status === 'active') return active;
    return false;
  }, { timeoutMs: 15000 });
  const activeMission = activeReady.result;
  const routeCount = Array.isArray(activeMission.route) ? activeMission.route.length : 0;
  if (routeCount < 4) throw new Error(`selected target route too short for long-route return test: routeCount=${routeCount}`);
  await writeSnapshot(page, '04-active-mission-started', { activeMission });

  const returnIndex = Math.max(1, Math.min(routeCount - 2, routeCount - 2));
  const midRoute = await waitForPositionIndex(page, activeMission.id, returnIndex, routeCount);
  const beforeReturnSnapshot = await writeSnapshot(page, '05-before-return-click', {
    desiredRouteIndex: returnIndex,
    reached: midRoute.result,
  });

  const actorTarget = findTopHitTarget(beforeReturnSnapshot.state, (action) => (
    action.type === 'selectWorldActor' && (!action.missionId || action.missionId === activeMission.id)
  ));
  await clickTarget(page, '06-select-active-actor', actorTarget, { missionId: activeMission.id });
  const returnReady = await waitForState(page, 'wait-return-command', (state) => (
    findTopHitTarget(state, (action) => action.type === 'returnWorldMarch' && action.missionId === activeMission.id)
  ), { timeoutMs: 12000 });
  const beforeReturnCommand = await writeSnapshot(page, '07-return-command-visible', { missionId: activeMission.id });
  const returnStartedAtMs = Date.now();
  await clickTarget(page, '08-click-return-home', returnReady.result, { missionId: activeMission.id });
  const afterReturn = await writeSnapshot(page, '09-after-return-click', { missionId: activeMission.id });
  await page.waitForTimeout(1500);
  const firstReturnFrame = await writeSnapshot(page, '10-first-return-frame', { missionId: activeMission.id });

  const homeOrigin = activeMission.homeOrigin || activeMission.origin;
  const finalReturn = await waitForReturnedHome(page, activeMission.id, homeOrigin, returnStartedAtMs);
  const finalSnapshot = await writeSnapshot(page, '11-final-return-home', {
    missionId: activeMission.id,
    finalResult: sanitize(finalReturn.result),
  });

  const verdict = evaluateReturnResult({
    beforeReturn: beforeReturnSnapshot.state,
    afterReturn: afterReturn.state,
    firstReturnFrame: firstReturnFrame.state,
    finalResult: finalReturn,
  });
  const summary = {
    outputDir: outDir,
    gameUrl: CONFIG.gameUrl,
    apiBase: CONFIG.apiBase,
    deployedUrl: url.toString(),
    playerId: CONFIG.username,
    initialTutorialCompleted: Boolean(login.tutorial?.completed || initialState.tutorial?.completed),
    chosenTarget: sanitize(chosen),
    routeCount,
    missionId: activeMission.id,
    beforeStart: {
      activeMission: summarizeMission(getActiveMission(beforeStart)),
      hitTargetCounts: beforeStart.hitTargetCounts,
    },
    beforeReturn: summarizeMission(getActiveMission(beforeReturnSnapshot.state)),
    afterReturn: summarizeMission(getActiveMission(afterReturn.state) || getMissionFromState(afterReturn.state, activeMission.id)),
    firstReturnFrame: summarizeMission(getActiveMission(firstReturnFrame.state) || getMissionFromState(firstReturnFrame.state, activeMission.id)),
    finalMission: summarizeMission(getMissionFromState(finalSnapshot.state, activeMission.id)),
    finalReturnElapsedMs: finalReturn.elapsedMs,
    actionEvidence,
    sampleCount: samples.length,
    samples: sanitize(samples),
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
    missionId: activeMission.id,
    routeCount,
    chosenTarget: { tileId: chosen.tileId, q: chosen.q, r: chosen.r, distance: chosen.distance },
    finalReturnElapsedMs: finalReturn.elapsedMs,
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
