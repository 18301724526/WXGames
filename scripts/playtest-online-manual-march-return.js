const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function getArgValue(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const CONFIG = {
  mode: getArgValue('mode', process.env.PLAYTEST_MARCH_MODE || 'return'),
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
  finalPhaseScreenshotIntervalMs: Number(process.env.PLAYTEST_FINAL_PHASE_SCREENSHOT_INTERVAL_MS || 1000),
  maxWaitMs: Number(process.env.PLAYTEST_MAX_WAIT_MS || 90000),
  mapHudBottomInsetPx: Number(process.env.PLAYTEST_MAP_HUD_BOTTOM_INSET_PX || 120),
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

const VISUAL_SIGNATURE_KEYS = ['terrain', 'asset', 'water', 'templates', 'river', 'ocean', 'transition', 'site'];

function parseSignatureParts(signature = '') {
  return String(signature || '').split('|').reduce((parts, part) => {
    const splitAt = part.indexOf('=');
    if (splitAt < 0) return parts;
    parts[part.slice(0, splitAt)] = part.slice(splitAt + 1);
    return parts;
  }, {});
}

function getVisualSignature(signature = '') {
  const parts = parseSignatureParts(signature);
  return VISUAL_SIGNATURE_KEYS.map((key) => `${key}=${parts[key] || ''}`).join('|');
}

function getChangedKnownTileSignatures(snapshots = []) {
  const firstById = new Map();
  const changes = [];
  const stateOnlyChanges = [];
  (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
    const entries = Array.isArray(snapshot?.renderTileSignatures) ? snapshot.renderTileSignatures : [];
    entries
      .filter((entry) => entry && !entry.renderOnly && !entry.renderReadyOnly)
      .forEach((entry) => {
        const visualSignature = getVisualSignature(entry.signature);
        const previous = firstById.get(entry.tileId);
        if (!previous) {
          firstById.set(entry.tileId, { ...entry, visualSignature, label: snapshot.label });
          return;
        }
        if (previous.visualSignature !== visualSignature) {
          changes.push({
            tileId: entry.tileId,
            beforeLabel: previous.label,
            afterLabel: snapshot.label,
            beforeHash: previous.signatureHash,
            afterHash: entry.signatureHash,
            before: previous.signature,
            after: entry.signature,
            beforeVisual: previous.visualSignature,
            afterVisual: visualSignature,
          });
        } else if (previous.signatureHash !== entry.signatureHash || previous.signature !== entry.signature) {
          stateOnlyChanges.push({
            tileId: entry.tileId,
            beforeLabel: previous.label,
            afterLabel: snapshot.label,
            beforeHash: previous.signatureHash,
            afterHash: entry.signatureHash,
            before: previous.signature,
            after: entry.signature,
          });
        }
        firstById.set(entry.tileId, { ...entry, visualSignature, label: snapshot.label });
      });
  });
  return { visualChanges: changes, stateOnlyChanges };
}

function summarizeRenderAheadCoverage(state = {}, mission = null) {
  const renderIds = new Set((state.renderTileSignatures || []).map((entry) => entry.tileId).filter(Boolean));
  const route = Array.isArray(mission?.route) ? mission.route : [];
  return route.map((step, index) => {
    const tileId = coordsKey(step);
    const oneRing = [
      { q: Number(step.q) + 1, r: Number(step.r) },
      { q: Number(step.q) + 1, r: Number(step.r) - 1 },
      { q: Number(step.q), r: Number(step.r) - 1 },
      { q: Number(step.q) - 1, r: Number(step.r) },
      { q: Number(step.q) - 1, r: Number(step.r) + 1 },
      { q: Number(step.q), r: Number(step.r) + 1 },
    ].map(coordsKey);
    const missingNeighbors = oneRing.filter((id) => !renderIds.has(id));
    return {
      index,
      tileId,
      rendered: renderIds.has(tileId),
      neighborCount: oneRing.length,
      renderedNeighborCount: oneRing.length - missingNeighbors.length,
      missingNeighbors,
    };
  });
}

function getRoutePreview(origin = {}, target = {}) {
  const startQ = Number(origin.q);
  const startR = Number(origin.r);
  const targetQ = Number(target.q);
  const targetR = Number(target.r);
  if (![startQ, startR, targetQ, targetR].every(Number.isFinite)) return [];
  const deltaQ = targetQ - startQ;
  const deltaR = targetR - startR;
  const distance = Math.max(Math.abs(deltaQ), Math.abs(deltaR));
  const route = [];
  let q = startQ;
  let r = startR;
  let remainingQ = deltaQ;
  let remainingR = deltaR;
  for (let step = 1; step <= distance; step += 1) {
    const stepQ = Math.sign(remainingQ);
    const stepR = Math.sign(remainingR);
    q += stepQ;
    r += stepR;
    remainingQ -= stepQ;
    remainingR -= stepR;
    route.push({ q, r, tileId: coordsKey({ q, r }), step });
  }
  return route;
}

function isRouteKnownPassable(state = {}, origin = {}, target = {}) {
  const terrainById = new Map((state.renderTileSignatures || [])
    .map((entry) => [entry.tileId, entry.terrain || '']));
  const route = getRoutePreview(origin, target);
  if (!route.length) return false;
  return route.every((step) => terrainById.has(step.tileId) && terrainById.get(step.tileId) !== 'ocean');
}

function getKnownSiteTileIds(state = {}) {
  const ids = new Set();
  (state.renderTileSignatures || []).forEach((entry) => {
    if (!entry?.tileId) return;
    if (entry.siteId || entry.terrain === 'capital') ids.add(entry.tileId);
  });
  (state.hitTargets || []).forEach((target) => {
    const action = target?.action || {};
    if (action.type === 'openWorldSite' && action.tileId) ids.add(action.tileId);
  });
  return ids;
}

function chooseSafeReturnRouteIndex(route = [], state = {}) {
  const steps = Array.isArray(route) ? route : [];
  if (steps.length < 3) return null;
  const siteTileIds = getKnownSiteTileIds(state);
  const maxIndex = Math.max(0, steps.length - 2);
  const preferredIndex = Math.min(maxIndex, Math.max(0, Math.floor(steps.length / 2)));
  const candidates = steps
    .map((step, index) => ({ index, tileId: coordsKey(step), hasKnownSite: siteTileIds.has(coordsKey(step)) }))
    .filter((entry) => entry.index <= maxIndex);
  const nonSiteCandidates = candidates.filter((entry) => !entry.hasKnownSite);
  const pool = nonSiteCandidates.length ? nonSiteCandidates : candidates;
  return pool
    .sort((a, b) => Math.abs(a.index - preferredIndex) - Math.abs(b.index - preferredIndex)
      || b.index - a.index)[0] || null;
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
    const contextCandidates = [
      runtime?.getLastTileMapContext?.(),
      runtime?.lastTileMapContext,
      renderer?.lastWorldTileMapContext,
      renderer?.worldMapLayerRenderer?.lastWorldTileMapContext,
      renderer?.worldMapRenderer?.lastWorldTileMapContext,
      shell?.worldMapRenderer?.lastWorldTileMapContext,
      shell?.worldMapRuntime?.getLastTileMapContext?.(),
      shell?.worldMapRuntime?.lastTileMapContext,
    ].filter(Boolean);
    const tileMapContext = contextCandidates.find((context) => Array.isArray(context?.tileMapView?.tiles)) || null;
    const tileMapView = tileMapContext?.tileMapView || {};
    const renderDiagnostics = window.WorldTileMapRenderDiagnostics || null;
    const hashText = renderDiagnostics?.hashText || ((text) => {
      let hash = 2166136261;
      const source = String(text || '');
      for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(36);
    });
    const getSignature = renderDiagnostics?.getTileRenderSignature || ((tile = {}) => [
      `terrain=${tile.terrain || ''}`,
      `asset=${tile.terrainAsset || ''}`,
      `water=${tile.waterAsset || tile.water?.asset || tile.water?.kind || ''}`,
      `templates=${(Array.isArray(tile.templateAssets) ? tile.templateAssets : []).map((asset) => [
        asset.templateType || asset.type || '',
        asset.key || asset.name || asset.path || '',
        asset.path || '',
      ].filter(Boolean).join(':')).sort().join(',')}`,
      `river=${(Array.isArray(tile.riverPorts) ? tile.riverPorts : []).filter(Boolean).map(String).sort().join(',')}`,
      `ocean=${(Array.isArray(tile.oceanTemplates) ? tile.oceanTemplates : []).filter(Boolean).map(String).sort().join(',')}`,
      `transition=${tile.transitionKey || ''}`,
      `visibility=${tile.visibility || ''}`,
      `visible=${tile.visible !== false ? 1 : 0}`,
      `discovered=${tile.discovered !== false ? 1 : 0}`,
      `renderReady=${tile.renderReady ? 1 : 0}`,
      `renderOnly=${tile.renderOnly ? 1 : 0}`,
      `site=${tile.siteId || ''}:${tile.site?.id || ''}:${tile.site?.type || ''}:${tile.site?.status || ''}:${tile.site?.owner || ''}:${tile.site?.art || ''}`,
    ].join('|'));
    const renderTileSignatures = (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [])
      .map((tile) => {
        const tileId = tile.id || tile.tileId || (
          Number.isFinite(Number(tile.q)) && Number.isFinite(Number(tile.r))
            ? `tile_${Number(tile.q)}_${Number(tile.r)}`
            : ''
        );
        const signature = getSignature(tile);
        return {
          tileId,
          q: Number(tile.q),
          r: Number(tile.r),
          terrain: tile.terrain || '',
          transitionKey: tile.transitionKey || '',
          riverPorts: Array.isArray(tile.riverPorts) ? tile.riverPorts.filter(Boolean).map(String).sort() : [],
          oceanTemplates: Array.isArray(tile.oceanTemplates) ? tile.oceanTemplates.filter(Boolean).map(String).sort() : [],
          templateAssets: Array.isArray(tile.templateAssets)
            ? tile.templateAssets.map((asset) => [
              asset.templateType || asset.type || '',
              asset.key || asset.name || asset.path || '',
              asset.path || '',
            ].filter(Boolean).join(':')).filter(Boolean).sort()
            : [],
          renderReady: Boolean(tile.renderReady),
          renderOnly: Boolean(tile.renderOnly),
          visibility: tile.visibility || '',
          siteId: tile.siteId || tile.site?.id || '',
          signature,
          signatureHash: hashText(signature),
        };
      })
      .filter((entry) => entry.tileId)
      .sort((a, b) => a.q - b.q || a.r - b.r || a.tileId.localeCompare(b.tileId));
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
      renderTileContext: {
        present: Boolean(tileMapContext),
        tileCount: renderTileSignatures.length,
        signatureHash: hashText(renderTileSignatures.map((entry) => `${entry.tileId}:${entry.signatureHash}`).join('|')),
        origin: tileMapView.origin || tileMapView.worldOrigin || null,
        pan: tileMapView.pan || null,
      },
      renderTileSignatures,
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
    const result = await predicate(state);
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
    if (action.terrain === 'ocean') return;
    const tileId = action.tileId || `tile_${q}_${r}`;
    if (tileId === coordsKey(origin)) return;
    if (!isRouteKnownPassable(state, origin, { q, r })) return;
    const center = targetCenter(target);
    const canvasWidth = Number(state.canvas?.logicalWidth || CONFIG.viewportWidth);
    const canvasHeight = Number(state.canvas?.logicalHeight || CONFIG.viewportHeight);
    if (center.x < 24
      || center.x > canvasWidth - 24
      || center.y < 64
      || center.y > canvasHeight - CONFIG.mapHudBottomInsetPx) return;
    const routePreview = getRoutePreview(origin, { q, r });
    const item = {
      target,
      tileId,
      q,
      r,
      distance: hexDistance(origin, { q, r }),
      routeStepCount: routePreview.length,
      center,
      startCoord: origin,
      startMissionId: formationMission?.id || '',
    };
    const existing = unique.get(tileId);
    if (!existing || item.center.y < existing.center.y) unique.set(tileId, item);
  });
  const candidates = [...unique.values()]
    .filter((item) => item.routeStepCount >= CONFIG.minTargetDistance)
    .filter((item) => CONFIG.mode !== 'templates'
      || item.routeStepCount < 3
      || chooseSafeReturnRouteIndex(getRoutePreview(origin, { q: item.q, r: item.r }), state))
    .sort((a, b) => (
      CONFIG.mode === 'templates'
        ? a.routeStepCount - b.routeStepCount || a.distance - b.distance || a.center.y - b.center.y
        : b.routeStepCount - a.routeStepCount || b.distance - a.distance || b.center.y - a.center.y
    ));
  if (candidates.length) return candidates[0];
  return [...unique.values()].sort((a, b) => (
    CONFIG.mode === 'templates'
      ? a.routeStepCount - b.routeStepCount || a.distance - b.distance
      : b.routeStepCount - a.routeStepCount || b.distance - a.distance
  ))[0] || null;
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

async function waitForPositionIndex(page, missionId, desiredIndex, routeCount, options = {}) {
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
    const allowFinal = Boolean(options.allowFinal);
    if (routeIndex >= desiredIndex && (allowFinal || routeIndex < routeCount - 1)) return { routeIndex, active };
    return false;
  }, { timeoutMs: maxWait, intervalMs: CONFIG.sampleIntervalMs });
}

async function waitForMissionComplete(page, missionId, routeCount) {
  const stepDurationSeconds = 10;
  const maxWait = Math.max(CONFIG.maxWaitMs, (Math.max(1, routeCount + 1) * stepDurationSeconds + 10) * 1000);
  const positions = [];
  let lastRouteIndex = -1;
  let lastScreenshotAt = 0;
  return waitForState(page, 'wait-for-full-route-complete', async (state) => {
    const active = getActiveMission(state);
    const mission = getMissionFromState(state, missionId) || active;
    const sample = buildPositionSample(state, 'complete-monitor', missionId);
    const routeIndex = getRouteIndex(mission || active);
    samples.push(sample);
    positions.push({
      at: new Date().toISOString(),
      missionStatus: mission?.status || '',
      activeStatus: active?.status || '',
      position: mission?.position || active?.position || null,
      routeIndex,
      actorTargetCount: (sample.actorTargets || [])
        .filter((target) => !target.missionId || target.missionId === missionId)
        .length,
    });
    if (routeIndex !== lastRouteIndex) {
      lastRouteIndex = routeIndex;
      fs.writeFileSync(
        path.join(outDir, `complete-step-${String(routeIndex).padStart(2, '0')}.json`),
        JSON.stringify(sanitize(sample), null, 2),
      );
    }
    const now = Date.now();
    if (routeIndex >= Math.max(0, routeCount - 2)
      && now - lastScreenshotAt >= CONFIG.finalPhaseScreenshotIntervalMs) {
      lastScreenshotAt = now;
      await writeSnapshot(page, `complete-final-phase-step-${String(routeIndex).padStart(2, '0')}-${positions.length}`, {
        missionId,
        routeCount,
        routeIndex,
      });
    }
    if (!mission) return false;
    const atTarget = sameCoord(mission.position, mission.target);
    const inactive = !active || active.id !== missionId || mission.status === 'idle';
    if (atTarget && inactive) {
      return {
        finalMission: mission,
        positions: sanitize(positions),
      };
    }
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

function evaluateCompleteResult({ activeMission, preFinalSnapshot, finalSnapshot, completeResult }) {
  const failures = [];
  const finalMission = completeResult?.result?.finalMission
    || getMissionFromState(finalSnapshot, activeMission?.id)
    || null;
  if (!activeMission) failures.push('missing active mission at start');
  if (!preFinalSnapshot) failures.push('missing pre-final route snapshot');
  if (!finalMission) failures.push('missing final mission result');
  if (finalMission && !sameCoord(finalMission.position, activeMission.target)) {
    failures.push(`final mission did not end at target: position=${coordsKey(finalMission.position)} target=${coordsKey(activeMission.target)}`);
  }
  const positions = Array.isArray(completeResult?.result?.positions)
    ? completeResult.result.positions
    : [];
  const routeIndices = positions
    .map((item) => Number(item.routeIndex))
    .filter(Number.isFinite);
  const activeActorDisappearances = positions.filter((item) => (
    item.missionStatus === 'active'
    && Number(item.routeIndex) >= Math.max(0, (activeMission?.route?.length || 0) - 2)
    && Number(item.actorTargetCount || 0) === 0
  ));
  const sawPenultimate = routeIndices.includes(Math.max(0, (activeMission?.route?.length || 0) - 2));
  const sawFinal = routeIndices.includes(Math.max(0, (activeMission?.route?.length || 0) - 1));
  if ((activeMission?.route?.length || 0) >= 4 && !sawPenultimate) {
    failures.push('monitor did not observe the penultimate route tile before completion');
  }
  if ((activeMission?.route?.length || 0) >= 4 && !sawFinal) {
    failures.push('monitor did not observe the final route tile before completion');
  }
  if (activeActorDisappearances.length) {
    failures.push(`active actor disappeared during final route phase for ${activeActorDisappearances.length} samples`);
  }
  return {
    pass: failures.length === 0,
    failures,
    routeIndices,
    activeActorDisappearances,
    sawPenultimate,
    sawFinal,
    finalPosition: finalMission?.position || null,
    target: activeMission?.target || null,
  };
}

function evaluateTemplateStabilityResult({ snapshots = [], activeMission = null }) {
  const failures = [];
  const signatureChanges = getChangedKnownTileSignatures(snapshots);
  const visualChanges = signatureChanges.visualChanges || [];
  const stateOnlyChanges = signatureChanges.stateOnlyChanges || [];
  if (visualChanges.length) {
    failures.push(`known render tile visual signatures changed for ${visualChanges.length} entries`);
  }
  const missingContexts = snapshots.filter((snapshot) => !snapshot.renderTileContext?.present);
  if (missingContexts.length) {
    failures.push(`missing render tile context for ${missingContexts.length} snapshots`);
  }
  const coverage = summarizeRenderAheadCoverage(snapshots[0] || {}, activeMission);
  return {
    pass: failures.length === 0,
    failures,
    snapshotCount: snapshots.length,
    knownTileChangeCount: visualChanges.length,
    changedKnownTiles: visualChanges.slice(0, 16),
    stateOnlyChangeCount: stateOnlyChanges.length,
    stateOnlyChangedKnownTiles: stateOnlyChanges.slice(0, 16),
    renderContextHashes: snapshots.map((snapshot) => ({
      label: snapshot.label,
      tileCount: snapshot.renderTileContext?.tileCount || 0,
      signatureHash: snapshot.renderTileContext?.signatureHash || '',
    })),
    routeRenderAheadCoverage: coverage,
  };
}

async function main() {
  if (!['return', 'complete', 'templates'].includes(CONFIG.mode)) {
    throw new Error(`unsupported PLAYTEST_MARCH_MODE=${CONFIG.mode}`);
  }
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
  const minimumRouteCount = CONFIG.mode === 'templates' ? 1 : 4;
  if (routeCount < minimumRouteCount) throw new Error(`selected target route too short for ${CONFIG.mode} test: routeCount=${routeCount}`);
  await writeSnapshot(page, '04-active-mission-started', { activeMission });
  const templateSnapshots = [{
    label: '04-active-mission-started',
    renderTileContext: activeReady.state.renderTileContext,
    renderTileSignatures: activeReady.state.renderTileSignatures,
  }];

  if (CONFIG.mode === 'templates' && routeCount < 3) {
    const completed = await waitForMissionComplete(page, activeMission.id, routeCount);
    const finalSnapshot = await writeSnapshot(page, '05-template-short-route-complete', {
      missionId: activeMission.id,
      finalResult: sanitize(completed.result),
    });
    templateSnapshots.push({
      label: '05-template-short-route-complete',
      renderTileContext: finalSnapshot.state.renderTileContext,
      renderTileSignatures: finalSnapshot.state.renderTileSignatures,
    });
    const completeVerdict = evaluateCompleteResult({
      activeMission,
      preFinalSnapshot: activeReady.state,
      finalSnapshot: finalSnapshot.state,
      completeResult: completed,
    });
    const templateVerdict = evaluateTemplateStabilityResult({
      snapshots: templateSnapshots,
      activeMission,
    });
    const verdict = {
      pass: completeVerdict.pass && templateVerdict.pass,
      failures: [...completeVerdict.failures, ...templateVerdict.failures],
      completeVerdict,
      templateVerdict,
    };
    const summary = {
      mode: CONFIG.mode,
      outputDir: outDir,
      gameUrl: CONFIG.gameUrl,
      apiBase: CONFIG.apiBase,
      deployedUrl: url.toString(),
      playerId: CONFIG.username,
      initialTutorialCompleted: Boolean(login.tutorial?.completed || initialState.tutorial?.completed),
      chosenTarget: sanitize(chosen),
      routeCount,
      missionId: activeMission.id,
      activeMission: summarizeMission(activeMission),
      finalMission: summarizeMission(getMissionFromState(finalSnapshot.state, activeMission.id)),
      actionEvidence,
      sampleCount: samples.length,
      samples: sanitize(samples),
      templateSnapshots: sanitize(templateSnapshots),
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
      mode: CONFIG.mode,
      outputDir: outDir,
      missionId: activeMission.id,
      routeCount,
      chosenTarget: { tileId: chosen.tileId, q: chosen.q, r: chosen.r, distance: chosen.distance, routeStepCount: chosen.routeStepCount },
      badResponses: badResponses.length,
      requestFailures: requestFailures.length,
      pageErrors: pageErrors.length,
      verdict,
    }, null, 2));
    if (!verdict.pass || badResponses.length || requestFailures.length || pageErrors.length) process.exit(1);
    return;
  }

  if (CONFIG.mode === 'complete') {
    const preFinalIndex = Math.max(0, routeCount - 2);
    const preFinal = await waitForPositionIndex(page, activeMission.id, preFinalIndex, routeCount);
    const preFinalSnapshot = await writeSnapshot(page, '05-before-final-route-steps', {
      desiredRouteIndex: preFinalIndex,
      reached: preFinal.result,
    });
    const completeStartedAtMs = Date.now();
    const completed = await waitForMissionComplete(page, activeMission.id, routeCount);
    const finalSnapshot = await writeSnapshot(page, '06-final-route-complete', {
      missionId: activeMission.id,
      finalResult: sanitize(completed.result),
    });
    const verdict = evaluateCompleteResult({
      activeMission,
      preFinalSnapshot: preFinalSnapshot.state,
      finalSnapshot: finalSnapshot.state,
      completeResult: completed,
    });
    const summary = {
      mode: CONFIG.mode,
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
      activeMission: summarizeMission(activeMission),
      preFinal: summarizeMission(getActiveMission(preFinalSnapshot.state) || getMissionFromState(preFinalSnapshot.state, activeMission.id)),
      finalMission: summarizeMission(getMissionFromState(finalSnapshot.state, activeMission.id)),
      finalElapsedMs: Date.now() - completeStartedAtMs,
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
      mode: CONFIG.mode,
      outputDir: outDir,
      missionId: activeMission.id,
      routeCount,
      chosenTarget: { tileId: chosen.tileId, q: chosen.q, r: chosen.r, distance: chosen.distance, routeStepCount: chosen.routeStepCount },
      badResponses: badResponses.length,
      requestFailures: requestFailures.length,
      pageErrors: pageErrors.length,
      verdict,
    }, null, 2));
    if (!verdict.pass || badResponses.length || requestFailures.length || pageErrors.length) process.exit(1);
    return;
  }

  const safeReturnStep = CONFIG.mode === 'templates'
    ? chooseSafeReturnRouteIndex(activeMission.route, activeReady.state)
    : null;
  const returnIndex = CONFIG.mode === 'templates'
    ? (safeReturnStep?.index ?? Math.max(1, Math.min(routeCount - 3, Math.floor(routeCount / 2))))
    : Math.max(1, Math.min(routeCount - 2, routeCount - 2));
  const midRoute = await waitForPositionIndex(page, activeMission.id, returnIndex, routeCount);
  const beforeReturnSnapshot = await writeSnapshot(page, '05-before-return-click', {
    desiredRouteIndex: returnIndex,
    safeReturnStep,
    reached: midRoute.result,
  });
  templateSnapshots.push({
    label: '05-before-return-click',
    renderTileContext: beforeReturnSnapshot.state.renderTileContext,
    renderTileSignatures: beforeReturnSnapshot.state.renderTileSignatures,
  });

  const actorTarget = findTopHitTarget(beforeReturnSnapshot.state, (action) => (
    action.type === 'selectWorldActor' && (!action.missionId || action.missionId === activeMission.id)
  ));
  await clickTarget(page, '06-select-active-actor', actorTarget, { missionId: activeMission.id });
  const returnReady = await waitForState(page, 'wait-return-command', (state) => (
    findTopHitTarget(state, (action) => action.type === 'returnWorldMarch' && action.missionId === activeMission.id)
  ), { timeoutMs: 12000 });
  const beforeReturnCommand = await writeSnapshot(page, '07-return-command-visible', { missionId: activeMission.id });
  templateSnapshots.push({
    label: '07-return-command-visible',
    renderTileContext: beforeReturnCommand.state.renderTileContext,
    renderTileSignatures: beforeReturnCommand.state.renderTileSignatures,
  });
  const returnStartedAtMs = Date.now();
  await clickTarget(page, '08-click-return-home', returnReady.result, { missionId: activeMission.id });
  const afterReturn = await writeSnapshot(page, '09-after-return-click', { missionId: activeMission.id });
  templateSnapshots.push({
    label: '09-after-return-click',
    renderTileContext: afterReturn.state.renderTileContext,
    renderTileSignatures: afterReturn.state.renderTileSignatures,
  });
  await page.waitForTimeout(1500);
  const firstReturnFrame = await writeSnapshot(page, '10-first-return-frame', { missionId: activeMission.id });
  templateSnapshots.push({
    label: '10-first-return-frame',
    renderTileContext: firstReturnFrame.state.renderTileContext,
    renderTileSignatures: firstReturnFrame.state.renderTileSignatures,
  });

  const homeOrigin = activeMission.homeOrigin || activeMission.origin;
  const finalReturn = await waitForReturnedHome(page, activeMission.id, homeOrigin, returnStartedAtMs);
  const finalSnapshot = await writeSnapshot(page, '11-final-return-home', {
    missionId: activeMission.id,
    finalResult: sanitize(finalReturn.result),
  });
  templateSnapshots.push({
    label: '11-final-return-home',
    renderTileContext: finalSnapshot.state.renderTileContext,
    renderTileSignatures: finalSnapshot.state.renderTileSignatures,
  });

  const returnVerdict = evaluateReturnResult({
    beforeReturn: beforeReturnSnapshot.state,
    afterReturn: afterReturn.state,
    firstReturnFrame: firstReturnFrame.state,
    finalResult: finalReturn,
  });
  const templateVerdict = evaluateTemplateStabilityResult({
    snapshots: templateSnapshots,
    activeMission,
  });
  const verdict = CONFIG.mode === 'templates'
    ? {
      pass: returnVerdict.pass && templateVerdict.pass,
      failures: [...returnVerdict.failures, ...templateVerdict.failures],
      returnVerdict,
      templateVerdict,
    }
    : returnVerdict;
  const summary = {
    mode: CONFIG.mode,
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
  if (CONFIG.mode === 'templates') {
    summary.templateSnapshots = sanitize(templateSnapshots.map((snapshot) => ({
      label: snapshot.label,
      renderTileContext: snapshot.renderTileContext,
      renderTileSignatures: snapshot.renderTileSignatures,
    })));
  }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, 'browser-events.json'), JSON.stringify(browserEvents, null, 2));

  await browser.close();
  console.log(JSON.stringify({
    outputDir: outDir,
    missionId: activeMission.id,
    routeCount,
    chosenTarget: { tileId: chosen.tileId, q: chosen.q, r: chosen.r, distance: chosen.distance, routeStepCount: chosen.routeStepCount },
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
