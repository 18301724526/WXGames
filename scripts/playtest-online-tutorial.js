const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const CONFIG = {
  gameUrl: process.env.PLAYTEST_GAME_URL || 'http://47.116.32.216/wxgame/',
  apiBase: process.env.PLAYTEST_API_BASE || 'http://47.116.32.216:3000/api',
  username: process.env.PLAYTEST_USERNAME || 'codexqa',
  password: process.env.PLAYTEST_PASSWORD || '123456',
  resetAccount: process.env.PLAYTEST_RESET_ACCOUNT !== '0',
  headless: process.env.PLAYTEST_HEADLESS !== '0',
  maxActions: Number(process.env.PLAYTEST_MAX_ACTIONS || 72),
  continueOnFailure: process.env.PLAYTEST_CONTINUE_ON_FAILURE === '1',
  viewportWidth: Number(process.env.PLAYTEST_VIEWPORT_WIDTH || 1365),
  viewportHeight: Number(process.env.PLAYTEST_VIEWPORT_HEIGHT || 768),
  outputRoot: process.env.PLAYTEST_OUTPUT_DIR || path.join('.local-logs', 'online-tutorial'),
  strictVisual: process.env.PLAYTEST_STRICT_VISUAL !== '0',
  minVisibleTargetRatio: Number(process.env.PLAYTEST_MIN_VISIBLE_TARGET_RATIO || 0.72),
  minTargetLumaStdDev: Number(process.env.PLAYTEST_MIN_TARGET_LUMA_STDDEV || 5),
  minTargetUniqueColors: Number(process.env.PLAYTEST_MIN_TARGET_UNIQUE_COLORS || 18),
  minHighlightGoldPixels: Number(process.env.PLAYTEST_MIN_HIGHLIGHT_GOLD_PIXELS || 24),
};

// Single source: shared/tutorialFlowConfig.js (index -> step name).
const TutorialFlowShared = require('../shared/tutorialFlowConfig');
const STEP_NAMES = TutorialFlowShared.STEP_ORDER;
const STEPS = TutorialFlowShared.TUTORIAL_STEPS;
// Scripted fallbacks compare the runtime numeric index against named steps so
// STEP_ORDER insertions never silently retarget a branch.
const stepIndexOf = (name) => TutorialFlowShared.stepIndex(name);
const COMPLETED_STEP_INDEX = TutorialFlowShared.stepIndex(
  TutorialFlowShared.TUTORIAL_STEPS.completed,
);

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(CONFIG.outputRoot, runId);
fs.mkdirSync(outDir, { recursive: true });

const events = [];
const badResponses = [];
const requestFailures = [];
const pageErrors = [];
const actionEvidence = [];
const visualFindings = [];
const verificationReports = [];
const verificationFailures = [];

function fileNameSafe(value) {
  return String(value || 'item').replace(/[^a-z0-9._-]+/gi, '-').slice(0, 96);
}

function sanitize(value, depth = 0) {
  if (depth > 4) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return typeof value === 'function' ? '[function]' : value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitize(item, depth + 1));
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'function') continue;
    result[key] = sanitize(entry, depth + 1);
  }
  return result;
}

function normalizeUrl(url) {
  const parsed = new URL(url);
  parsed.searchParams.set('codexTutorialPlaytest', runId);
  return parsed.toString();
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

function analyzePng(buffer) {
  const png = PNG.sync.read(buffer);
  const pixels = png.data;
  const sampleStep = Math.max(1, Math.floor(Math.sqrt((png.width * png.height) / 20000)));
  const colors = new Set();
  let count = 0;
  let lumaSum = 0;
  let lumaSqSum = 0;
  let saturationSum = 0;
  let darkCount = 0;
  let brightCount = 0;
  let transparentCount = 0;
  for (let y = 0; y < png.height; y += sampleStep) {
    for (let x = 0; x < png.width; x += sampleStep) {
      const idx = (png.width * y + x) << 2;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      colors.add(`${r >> 3},${g >> 3},${b >> 3},${a >> 5}`);
      lumaSum += luma;
      lumaSqSum += luma * luma;
      saturationSum += saturation;
      if (luma < 24) darkCount += 1;
      if (luma > 185) brightCount += 1;
      if (a < 8) transparentCount += 1;
      count += 1;
    }
  }
  const mean = count ? lumaSum / count : 0;
  const variance = count ? Math.max(0, lumaSqSum / count - mean * mean) : 0;
  const stdev = Math.sqrt(variance);
  const uniqueColors = colors.size;
  return {
    width: png.width,
    height: png.height,
    samples: count,
    uniqueColors,
    lumaMean: Number(mean.toFixed(2)),
    lumaStdDev: Number(stdev.toFixed(2)),
    saturationMean: Number((count ? saturationSum / count : 0).toFixed(3)),
    darkRatio: Number((count ? darkCount / count : 0).toFixed(3)),
    brightRatio: Number((count ? brightCount / count : 0).toFixed(3)),
    transparentRatio: Number((count ? transparentCount / count : 0).toFixed(3)),
    suspiciousBlank: uniqueColors < 12 || stdev < 4 || (darkCount / Math.max(1, count) > 0.94 && stdev < 10),
  };
}

function analyzeHighlightPng(buffer) {
  const png = PNG.sync.read(buffer);
  const pixels = png.data;
  let goldPixels = 0;
  let warmEdgePixels = 0;
  let brightPixels = 0;
  let count = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const idx = (png.width * y + x) << 2;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      if (a < 8) continue;
      if (r > 215 && g > 165 && b < 105 && r >= g && g > b + 45) goldPixels += 1;
      if (r > 175 && g > 130 && b < 125 && r > b + 55 && g > b + 20) warmEdgePixels += 1;
      if (r + g + b > 650) brightPixels += 1;
      count += 1;
    }
  }
  return {
    width: png.width,
    height: png.height,
    samples: count,
    goldPixels,
    warmEdgePixels,
    brightPixels,
    goldRatio: Number((count ? goldPixels / count : 0).toFixed(4)),
    warmEdgeRatio: Number((count ? warmEdgePixels / count : 0).toFixed(4)),
  };
}

function getTargetCenter(target = {}) {
  return {
    x: (Number(target.x) || 0) + (Number(target.width) || 0) / 2,
    y: (Number(target.y) || 0) + (Number(target.height) || 0) / 2,
  };
}

function getRectIntersectionRatio(rect = {}, bounds = {}) {
  const left = Math.max(Number(rect.x) || 0, Number(bounds.x) || 0);
  const top = Math.max(Number(rect.y) || 0, Number(bounds.y) || 0);
  const right = Math.min((Number(rect.x) || 0) + (Number(rect.width) || 0), (Number(bounds.x) || 0) + (Number(bounds.width) || 0));
  const bottom = Math.min((Number(rect.y) || 0) + (Number(rect.height) || 0), (Number(bounds.y) || 0) + (Number(bounds.height) || 0));
  const area = Math.max(0, right - left) * Math.max(0, bottom - top);
  const targetArea = Math.max(1, (Number(rect.width) || 0) * (Number(rect.height) || 0));
  return area / targetArea;
}

function getActionTargetId(action = {}) {
  return action.siteId
    || action.territoryId
    || action.cityId
    || action.targetId
    || action.personId
    || action.taskId
    || action.eventId
    || action.missionId
    || '';
}

function actionCompatible(expected = {}, actual = {}) {
  if (!expected?.type || !actual?.type || actual.disabled) return false;
  // Mirror the product tutorial gate (matchesTutorialAllowedAction): a guided
  // openWorldSite tile the scout actor still overlaps resolves to the multi-candidate
  // world target picker; that click is valid (the guide then highlights choosing the
  // site candidate), so treat the picker as compatible when it carries the site.
  if (expected.type === 'openWorldSite' && actual.type === 'openWorldTargetPicker') {
    const wanted = getActionTargetId(expected);
    const candidates = Array.isArray(actual.candidates) ? actual.candidates : [];
    return candidates.some((candidate) => {
      const candidateAction = candidate?.action || candidate || {};
      const candidateId = String(
        candidateAction.siteId || candidateAction.cityId || candidateAction.territoryId || '',
      );
      return (candidateAction.type === 'openWorldSite' || candidate?.kind === 'site')
        && (!wanted || candidateId === wanted);
    });
  }
  // openWorldSite and enterCity are interchangeable entrances to the same city (which one
  // owns the tile's clickable center depends on hit-target stacking).
  const cityEntranceTypes = ['openWorldSite', 'enterCity'];
  if (
    cityEntranceTypes.includes(expected.type)
    && cityEntranceTypes.includes(actual.type)
    && expected.type !== actual.type
  ) {
    const wantedCity = getActionTargetId(expected);
    const actualCity = getActionTargetId(actual);
    return Boolean(wantedCity && actualCity && wantedCity === actualCity);
  }
  if (expected.type !== actual.type) return false;
  const expectedId = getActionTargetId(expected);
  const actualId = getActionTargetId(actual);
  return Object.entries(expected).every(([key, value]) => {
    if (key === 'type' || key === 'background' || value === undefined || value === null || value === '') return true;
    // Object-valued action fields (e.g. deploymentEligibility) never satisfy strict
    // equality across two evaluate() serializations; primitives carry the identity.
    if (typeof value === 'object') return true;
    if (actual[key] === value) return true;
    if (['siteId', 'territoryId', 'cityId', 'targetId', 'personId', 'taskId', 'eventId', 'missionId'].includes(key)) {
      return Boolean(expectedId && actualId && expectedId === actualId);
    }
    return false;
  });
}

function createVerificationFailure(label, message, details = {}) {
  const failure = {
    label,
    message,
    details: sanitize(details),
    screenshot: details.fullPath || details.beforeFullPath || details.afterFullPath || '',
    targetScreenshot: details.cropPath || details.beforeTargetPath || '',
    highlightScreenshot: details.highlightPath || details.beforeHighlightPath || '',
  };
  verificationFailures.push(failure);
  return new Error(`${label}: ${message} ${JSON.stringify(failure.details)}`);
}

function isApiAction(actionType = '') {
  return new Set([
    'buildBuilding',
    'advanceEra',
    'claimTaskReward',
    'claimEvent',
    'saveArmyFormation',
    'startWorldMarch',
    'conquer',
    'claimConquest',
    'submitNaming',
    'assignJob',
    'seekFamousPerson',
  ]).has(actionType);
}

function expectedApiBodyAction(action = {}) {
  if (action.type === 'buildBuilding') return 'build';
  if (action.type === 'advanceEra') return 'advanceEra';
  if (action.type === 'claimEvent') return 'claimEvent';
  if (action.type === 'saveArmyFormation') return 'setArmyFormation';
  if (action.type === 'startWorldMarch') return 'startWorldMarch';
  if (action.type === 'conquer') return 'startConquest';
  if (action.type === 'claimConquest') return 'claimConquest';
  if (action.type === 'submitNaming') return action.promptType === 'polity' ? 'renamePolity' : 'renameCity';
  if (action.type === 'assignJob') return 'assign';
  if (action.type === 'seekFamousPerson') return 'seekFamousPerson';
  return '';
}

function actionRequiresAuthority(action = {}) {
  return new Set(['startWorldMarch', 'conquer', 'claimConquest']).has(action.type);
}

function createManualReviewIndex() {
  const byStep = new Map();
  for (const report of verificationReports) {
    const step = Number(report.beforeStep);
    if (!byStep.has(step)) {
      byStep.set(step, {
        step,
        stepName: STEP_NAMES[step] || '',
        labels: [],
        beforeFullPath: report.beforeFullPath || '',
        beforeTargetPath: report.beforeTargetPath || '',
        beforeHighlightPath: report.beforeHighlightPath || '',
        afterFullPath: report.afterFullPath || '',
        outcome: report.outcome?.reason || '',
      });
    }
    byStep.get(step).labels.push(report.label);
    if (report.beforeTargetPath) byStep.get(step).beforeTargetPath = report.beforeTargetPath;
    if (report.beforeHighlightPath) byStep.get(step).beforeHighlightPath = report.beforeHighlightPath;
    if (report.afterFullPath) byStep.get(step).afterFullPath = report.afterFullPath;
  }
  return [...byStep.values()].sort((a, b) => a.step - b.step);
}

function actionMatches(allowed = {}, action = {}) {
  if (!allowed?.type || action?.type !== allowed.type || action.disabled) return false;
  const targetIdKeys = ['siteId', 'territoryId', 'cityId', 'targetId', 'personId', 'taskId', 'eventId', 'optionId', 'panel', 'buildingId', 'tab'];
  return Object.entries(allowed).every(([key, value]) => {
    if (key === 'type' || value === undefined || value === null || value === '') return true;
    if (action[key] === value) return true;
    if (targetIdKeys.includes(key)) {
      const actionTarget = action.siteId || action.territoryId || action.cityId || action.targetId || action.personId || action.taskId || action.eventId || '';
      const allowedTarget = allowed.siteId || allowed.territoryId || allowed.cityId || allowed.targetId || allowed.personId || allowed.taskId || allowed.eventId || '';
      return Boolean(actionTarget && allowedTarget && actionTarget === allowedTarget);
    }
    return false;
  });
}

function findTarget(state, predicate) {
  const targets = state.hitTargets || [];
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (!target || target.width <= 0 || target.height <= 0) continue;
    if (predicate(target.action || {}, target)) return target;
  }
  return null;
}

function getFirstCitySiteId(state = {}) {
  const grantSiteId = state.tutorial?.grants?.firstExploreEmptyCity?.siteId;
  if (grantSiteId) return grantSiteId;
  const explorer = state.stateSummary?.worldExplorerState || {};
  for (const bucket of ['idleMissions', 'missions']) {
    const missions = Array.isArray(explorer[bucket]) ? explorer[bucket] : [];
    for (const mission of missions) {
      const sites = Array.isArray(mission?.plannedSites) ? mission.plannedSites : [];
      for (const site of sites) {
        const siteId = site?.siteId || site?.site?.id;
        if (siteId) return siteId;
      }
    }
  }
  const territories = Array.isArray(state.territoryState?.territories) ? state.territoryState.territories : [];
  const firstNonCapital = territories.find((site) => site?.id && site.id !== 'capital');
  if (firstNonCapital?.id) return firstNonCapital.id;
  const tiles = Array.isArray(state.territoryState?.tiles) ? state.territoryState.tiles : [];
  const firstSiteTile = tiles.find((tile) => tile?.siteId && tile.siteId !== 'capital');
  return firstSiteTile?.siteId || '';
}

function toViewportRect(state, target, padding = 0) {
  const canvas = state.canvas || {};
  const frameWidth = Number(canvas.logicalWidth) || Number(canvas.rect?.width) || CONFIG.viewportWidth;
  const frameHeight = Number(canvas.logicalHeight) || Number(canvas.rect?.height) || CONFIG.viewportHeight;
  const rect = canvas.rect || { left: 0, top: 0, width: frameWidth, height: frameHeight };
  const scaleX = Number(rect.width) / Math.max(1, frameWidth);
  const scaleY = Number(rect.height) / Math.max(1, frameHeight);
  const x = Number(rect.left) + Number(target.x) * scaleX;
  const y = Number(rect.top) + Number(target.y) * scaleY;
  const width = Number(target.width) * scaleX;
  const height = Number(target.height) * scaleY;
  return {
    x: Math.max(0, Math.floor(x - padding)),
    y: Math.max(0, Math.floor(y - padding)),
    width: Math.max(1, Math.ceil(width + padding * 2)),
    height: Math.max(1, Math.ceil(height + padding * 2)),
  };
}

function clampClip(clip, viewport) {
  const x = Math.max(0, Math.min(viewport.width - 1, clip.x));
  const y = Math.max(0, Math.min(viewport.height - 1, clip.y));
  const right = Math.max(x + 1, Math.min(viewport.width, clip.x + clip.width));
  const bottom = Math.max(y + 1, Math.min(viewport.height, clip.y + clip.height));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

async function getState(page) {
  return page.evaluate(() => {
    const summarizeHitTargets = (targets = []) => {
      const list = Array.isArray(targets) ? targets : [];
      const counts = {};
      const siteTargets = [];
      const tileTargets = [];
      list.forEach((target) => {
        const action = target?.action || {};
        const type = action.type || 'unknown';
        counts[type] = (counts[type] || 0) + 1;
        if (type === 'openWorldSite') {
          siteTargets.push({
            siteId: action.siteId || '',
            tileId: action.tileId || '',
            x: Number(target.x ?? target.rect?.x) || 0,
            y: Number(target.y ?? target.rect?.y) || 0,
            width: Number(target.width ?? target.rect?.width) || 0,
            height: Number(target.height ?? target.rect?.height) || 0,
          });
        }
        if (type === 'selectWorldMarchTarget') {
          tileTargets.push({
            tileId: action.tileId || '',
            targetQ: action.targetQ,
            targetR: action.targetR,
          });
        }
      });
      return {
        total: list.length,
        counts,
        siteTargets,
        tileTargets: tileTargets.slice(-16),
      };
    };
    const summarizeTileMapView = (view = null) => {
      if (!view) return null;
      const tiles = Array.isArray(view.tiles) ? view.tiles : [];
      return {
        signature: view.signature || '',
        version: view.version || 0,
        seed: view.seed || '',
        tileCount: tiles.length,
        sites: tiles
          .filter((tile) => tile?.siteId || tile?.site)
          .map((tile) => ({
            id: tile.id,
            q: tile.q,
            r: tile.r,
            siteId: tile.siteId || '',
            site: tile.site ? {
              id: tile.site.id || '',
              type: tile.site.type || '',
              owner: tile.site.owner || '',
              status: tile.site.status || '',
              art: tile.site.art || '',
              scale: tile.site.scale || '',
            } : null,
          })),
      };
    };
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || null;
    const worldMapRenderer = shell?.worldMapRenderer || renderer?.worldMapRenderer || null;
    const coordinator = shell?.worldMapRuntimeCoordinator || game?.worldMapRuntimeCoordinator || null;
    const worldMapRuntime = coordinator?.getMapRuntime?.() || shell?.worldMapRuntime || game?.worldMapRuntime || null;
    const runtime = shell?.runtime || game?.runtime || null;
    const canvas = runtime?.canvas
      || document.querySelector('[data-canvas-hud-input]')
      || document.getElementById('h5CanvasLayer')
      || document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect?.();
    const hitTargets = Array.isArray(renderer?.hitTargets) ? renderer.hitTargets : [];
    const territoryState = game?.state?.territoryState || {};
    const worldMap = territoryState.worldMap || {};
    const worldTiles = Array.isArray(worldMap.tiles) ? worldMap.tiles : [];
    const territories = Array.isArray(territoryState.territories) ? territoryState.territories : [];
    return {
      title: document.title,
      url: location.href,
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
      tokenPresent: Boolean(localStorage.getItem('cf_token')),
      playerId: game?.playerId || game?.state?.playerId || null,
      hasServerState: Boolean(game?.hasServerState),
      currentTab: game?.state?.currentTab || game?.currentTab || shell?.currentTab || '',
      militaryView: game?.state?.militaryView || shell?.militaryView || '',
      tutorialStep: (() => {
        const raw = game?.tutorial?.currentStep ?? game?.state?.tutorial?.currentStep ?? 0;
        const index = globalThis.TutorialFlowShared?.stepIndex?.(raw);
        return Number.isFinite(index) && index >= 0 ? index : Number(raw) || 0;
      })(),
      tutorialCompleted: Boolean(game?.tutorial?.completed || game?.state?.tutorial?.completed),
      tutorial: game?.tutorial || game?.state?.tutorial || null,
      tutorialIntro: game?.tutorialIntro || shell?.tutorialIntro || null,
      tutorialHighlight: shell?.tutorialHighlight || null,
      tutorialAdvisorDialogue: shell?.tutorialAdvisorDialogue || game?.tutorialAdvisorDialogue || null,
      rewardReveal: shell?.getRewardRevealSnapshot?.() || game?.getRewardRevealSnapshot?.() || shell?.rewardReveal || game?.rewardReveal || null,
      // Blocking panels live in the modal snapshot (Batch 8F retired the direct
      // showX properties); probe the snapshot API, keep legacy reads as fallback
      // for older deployments.
      taskCenterOpen: Boolean(
        shell?.isBlockingPanelSnapshotOpen?.('showTaskCenter')
        || game?.isBlockingPanelSnapshotOpen?.('showTaskCenter')
        || shell?.showTaskCenter || game?.showTaskCenter,
      ),
      activeTaskCenterTab: game?.activeTaskCenterTab || shell?.activeTaskCenterTab || '',
      cityManagementOpen: Boolean(
        shell?.isBlockingPanelSnapshotOpen?.('showCityManagement')
        || game?.isBlockingPanelSnapshotOpen?.('showCityManagement')
        || shell?.showCityManagement || game?.showCityManagement,
      ),
      activeCityManagementTab: game?.activeCityManagementTab || shell?.activeCityManagementTab || '',
      activeCommandPanel: shell?.getCommandPanelValue?.() || game?.getCommandPanelValue?.()
        || shell?.activeCommandPanel || game?.activeCommandPanel || '',
      activeEventId: shell?.getEventSnapshot?.()?.eventId || game?.getEventSnapshot?.()?.eventId
        || shell?.activeEventId || game?.activeEventId || game?.eventController?.activeEventId || '',
      showFamousPersons: Boolean(
        shell?.isBlockingPanelSnapshotOpen?.('showFamousPersons')
        || game?.isBlockingPanelSnapshotOpen?.('showFamousPersons')
        || shell?.showFamousPersons || game?.showFamousPersons,
      ),
      selectedFamousPersonId: game?.selectedFamousPersonId || shell?.selectedFamousPersonId || '',
      cityPeopleOpen: Boolean(
        (shell?.isBlockingPanelSnapshotOpen?.('showCityManagement')
          || game?.isBlockingPanelSnapshotOpen?.('showCityManagement')
          || shell?.showCityManagement || game?.showCityManagement)
        && (game?.activeCityManagementTab || shell?.activeCityManagementTab) === 'people',
      ),
      targetPickerKind: (game?.getTargetPickerSnapshot?.() || shell?.getTargetPickerSnapshot?.())?.pickerKind || '',
      // The rendered hit targets are the most reliable "world target picker is open"
      // signal: the picker always registers its candidate buttons there, while the modal
      // snapshot can lag behind on click-opened pickers.
      worldTargetPickerCandidates: hitTargets
        .filter((target) => target?.action?.type === 'chooseWorldTarget')
        .map((target) => String(target.action.targetId || target.action.siteId || '')),
      naming: shell?.getNamingSnapshot?.() || game?.getNamingSnapshot?.() || shell?.naming || game?.naming || null,
      armyFormationEditor: shell?.armyFormationEditor || game?.armyFormationEditor || null,
      territoryUiState: shell?.territoryUiState || game?.territoryUiState || game?.territoryController?.uiState || null,
      territoryState: {
        worldMapVersion: worldMap.version || 0,
        worldMapSeed: worldMap.seed || '',
        territories: territories.slice(0, 80).map((site) => ({
          id: site.id,
          x: site.x ?? site.q,
          y: site.y ?? site.r,
          status: site.status,
          owner: site.owner,
          type: site.type,
          cityName: site.cityName,
          naturalName: site.naturalName,
        })),
        tiles: worldTiles
          .filter((tile) => tile?.siteId || tile?.id === 'tile_2_2' || tile?.id === 'capital-tile' || tile?.id === 'tile_0_0')
          .slice(0, 120)
          .map((tile) => ({
            id: tile.id,
            q: tile.q,
            r: tile.r,
            siteId: tile.siteId || '',
            terrain: tile.terrain,
            visibility: tile.visibility,
            discovered: tile.discovered,
            visible: tile.visible,
          })),
      },
      hitTargets: hitTargets.map((target) => ({
        x: Number(target.x) || 0,
        y: Number(target.y) || 0,
        width: Number(target.width) || 0,
        height: Number(target.height) || 0,
        action: target.action || null,
      })),
      worldMapDebug: {
        mainRendererHitTargets: summarizeHitTargets(renderer?.hitTargets),
        worldMapRendererHitTargets: summarizeHitTargets(worldMapRenderer?.hitTargets),
        runtimeHitTargets: summarizeHitTargets(worldMapRuntime?.hitTargets),
        runtimeBaseHitTargets: summarizeHitTargets(worldMapRuntime?.baseHitTargets),
        rendererWorldTileViewCache: summarizeTileMapView(renderer?.worldTileViewCache?.view),
        worldMapRendererWorldTileViewCache: summarizeTileMapView(worldMapRenderer?.worldTileViewCache?.view),
        lastWorldTileMapContext: summarizeTileMapView(
          worldMapRuntime?.lastTileMapContext?.tileMapView
          || worldMapRuntime?.getLastTileMapContext?.()?.tileMapView
          || worldMapRenderer?.lastWorldTileMapContext?.tileMapView
          || renderer?.lastWorldTileMapContext?.tileMapView,
        ),
      },
      stateSummary: game?.state ? {
        gameDay: game.state.gameDay,
        totalBuildings: game.state.totalBuildings,
        currentEra: game.state.currentEra,
        currentEraName: game.state.currentEraName,
        activeCityId: game.state.activeCityId,
        buildings: game.state.buildings,
        resources: game.state.resources,
        military: game.state.military ? {
          soldiers: Number(game.state.military.soldiers) || 0,
          soldierCap: Number(game.state.military.soldierCap) || 0,
        } : null,
        eventQueue: Array.isArray(game.state.eventQueue) ? game.state.eventQueue.map((event) => ({
          id: event.id,
          status: event.status,
          title: event.title,
        })) : [],
        taskCenter: game.state.taskCenter,
        worldExplorerState: game.state.worldExplorerState,
        famousPersons: game.state.famousPersons ? {
          people: Array.isArray(game.state.famousPersons.people) ? game.state.famousPersons.people.map((person) => ({
            id: person.id,
            name: person.name,
            archetype: person.archetype,
            source: person.source,
          })) : [],
          seek: game.state.famousPersons.seek,
        } : null,
        cityState: game.state.cityState ? {
          capitalCityId: game.state.cityState.capitalCityId,
          cities: Array.isArray(game.state.cityState.cities) ? game.state.cityState.cities.map((city) => ({
            id: city.id,
            name: city.name,
          })) : [],
        } : null,
      } : null,
      requestLogs: Array.isArray(game?.requestLogs) ? game.requestLogs.slice(-12) : [],
      apiCalls: Array.isArray(window.__codexApiCalls) ? window.__codexApiCalls.slice(-100) : [],
    };
  });
}

async function waitForRender(page, ms = 700) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.Game?.canvasShell?.renderActive?.());
  await page.waitForTimeout(150);
}

async function refreshAuthorityStateAndWorldMap(page, label = 'refresh-authority-state') {
  const result = await page.evaluate(async () => {
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || game?.renderer || null;
    const coordinator = shell?.worldMapRuntimeCoordinator || game?.worldMapRuntimeCoordinator || null;
    const runtime = coordinator?.getMapRuntime?.() || shell?.worldMapRuntime || game?.worldMapRuntime || null;
    const api = game?.gameAPI || game?.api || game?.syncService?.api || null;
    const toStepIndex = (raw) => {
      const index = globalThis.TutorialFlowShared?.stepIndex?.(raw);
      return Number.isFinite(index) && index >= 0 ? index : Number(raw) || 0;
    };
    const summary = {
      fetchedAuthorityState: false,
      appliedAuthorityState: false,
      tutorialStep: toStepIndex(game?.tutorial?.currentStep ?? game?.state?.tutorial?.currentStep ?? 0),
      invalidated: [],
    };

    try {
      if (typeof api?.getState === 'function') {
        const data = await api.getState();
        summary.fetchedAuthorityState = true;
        summary.responseTutorialStep = toStepIndex(data?.tutorial?.currentStep ?? data?.gameState?.tutorial?.currentStep ?? 0);
        if (typeof game?.applyApiState === 'function') {
          game.applyApiState(data);
          summary.appliedAuthorityState = true;
        } else if (typeof game?.applyState === 'function') {
          game.applyState(data);
          summary.appliedAuthorityState = true;
        }
      } else if (typeof game?.syncService?.fetchNow === 'function') {
        await game.syncService.fetchNow();
        summary.fetchedAuthorityState = true;
      }
    } catch (error) {
      summary.error = error?.message || String(error);
    }

    try {
      renderer?.invalidateWorldTileCaches?.();
      summary.invalidated.push('renderer.invalidateWorldTileCaches');
    } catch (_) {}
    try {
      renderer?.invalidateWorldTileViewCache?.();
      summary.invalidated.push('renderer.invalidateWorldTileViewCache');
    } catch (_) {}
    try {
      runtime?.invalidateBake?.();
      summary.invalidated.push('worldMapRuntime.invalidateBake');
    } catch (_) {}
    try {
      shell?.renderActive?.({ invalidateWorldTileView: true });
      summary.invalidated.push('shell.renderActive');
    } catch (_) {}
    try {
      game?.renderCanvasSurface?.(game?.state?.currentTab || game?.activeTab);
      summary.invalidated.push('game.renderCanvasSurface');
    } catch (_) {}
    return summary;
  });
  events.push({ type: 'script', text: `${label}: ${JSON.stringify(sanitize(result))}` });
  await waitForRender(page, 400);
  return result;
}

async function writeSnapshot(page, label, state = null, extra = {}) {
  const safeLabel = fileNameSafe(label);
  const currentState = state || await getState(page);
  const fullPath = path.join(outDir, `${safeLabel}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const jsonPath = path.join(outDir, `${safeLabel}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({
    state: currentState,
    extra,
    events,
    badResponses,
    requestFailures,
    pageErrors,
  }, null, 2));
  return { fullPath, jsonPath, state: currentState };
}

async function captureTargetEvidence(page, label, state, target, options = {}) {
  const viewport = page.viewportSize() || { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight };
  const safeLabel = fileNameSafe(label);
  const padded = clampClip(toViewportRect(state, target, options.padding ?? 18), viewport);
  const exact = clampClip(toViewportRect(state, target, 0), viewport);
  const highlightRect = state.tutorialHighlight?.rect
    ? clampClip(toViewportRect(state, {
      x: Number(state.tutorialHighlight.rect.left ?? state.tutorialHighlight.rect.x) || 0,
      y: Number(state.tutorialHighlight.rect.top ?? state.tutorialHighlight.rect.y) || 0,
      width: Number(state.tutorialHighlight.rect.width) || 0,
      height: Number(state.tutorialHighlight.rect.height) || 0,
    }, options.highlightPadding ?? 10), viewport)
    : null;
  const fullPath = path.join(outDir, `${safeLabel}-full.png`);
  const cropPath = path.join(outDir, `${safeLabel}-target.png`);
  const exactPath = path.join(outDir, `${safeLabel}-target-exact.png`);
  const highlightPath = highlightRect ? path.join(outDir, `${safeLabel}-highlight.png`) : '';
  await page.screenshot({ path: fullPath, fullPage: true });
  const cropBuffer = await page.screenshot({ clip: padded });
  const exactBuffer = await page.screenshot({ clip: exact });
  fs.writeFileSync(cropPath, cropBuffer);
  fs.writeFileSync(exactPath, exactBuffer);
  let highlightMetrics = null;
  if (highlightRect) {
    const highlightBuffer = await page.screenshot({ clip: highlightRect });
    fs.writeFileSync(highlightPath, highlightBuffer);
    highlightMetrics = analyzeHighlightPng(highlightBuffer);
  }
  const cropMetrics = analyzePng(cropBuffer);
  const exactMetrics = analyzePng(exactBuffer);
  const targetViewportRect = toViewportRect(state, target, 0);
  const targetVisibleRatio = getRectIntersectionRatio(targetViewportRect, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  const evidence = {
    label,
    step: state.tutorialStep,
    stepName: STEP_NAMES[state.tutorialStep] || '',
    introStep: state.tutorialIntro?.step || '',
    action: sanitize(target.action),
    target: sanitize(target),
    viewportRect: padded,
    exactViewportRect: exact,
    fullPath,
    cropPath,
    exactPath,
    highlightPath,
    cropMetrics,
    exactMetrics,
    highlightMetrics,
    targetVisibleRatio: Number(targetVisibleRatio.toFixed(3)),
    highlight: sanitize(state.tutorialHighlight),
  };
  actionEvidence.push(evidence);
  const findings = [];
  const highlightVisible = Boolean(highlightMetrics && highlightMetrics.goldPixels >= CONFIG.minHighlightGoldPixels);
  if (targetVisibleRatio < CONFIG.minVisibleTargetRatio) {
    findings.push(`target visible ratio ${targetVisibleRatio.toFixed(3)} is below ${CONFIG.minVisibleTargetRatio}`);
  }
  if (cropMetrics.suspiciousBlank
    || (!highlightVisible && (
      exactMetrics.suspiciousBlank
      || exactMetrics.lumaStdDev < CONFIG.minTargetLumaStdDev
      || exactMetrics.uniqueColors < CONFIG.minTargetUniqueColors
    ))) {
    findings.push('target crop is visually too flat to prove the button/highlight is visible');
  }
  if (state.tutorialHighlight?.allowedAction
    && actionMatches(state.tutorialHighlight.allowedAction, target.action)
    && (!highlightMetrics || highlightMetrics.goldPixels < CONFIG.minHighlightGoldPixels)) {
    findings.push(`guided highlight gold border pixels ${highlightMetrics?.goldPixels || 0} is below ${CONFIG.minHighlightGoldPixels}`);
  }
  if (findings.length) {
    const finding = {
      severity: CONFIG.strictVisual ? 'error' : 'warning',
      label,
      step: state.tutorialStep,
      stepName: STEP_NAMES[state.tutorialStep] || '',
      action: sanitize(target.action),
      reason: findings.join('; '),
      fullPath,
      cropPath,
      exactPath,
      highlightPath,
      cropMetrics,
      exactMetrics,
      highlightMetrics,
      targetVisibleRatio: evidence.targetVisibleRatio,
    };
    visualFindings.push(finding);
    if (CONFIG.strictVisual) {
      throw createVerificationFailure(label, 'visual target verification failed', finding);
    }
  }
  return evidence;
}

async function inspectCenterHit(page, state, target) {
  const center = getTargetCenter(target);
  return page.evaluate((point) => {
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || game?.renderer || null;
    const hitAction = renderer?.getHitTarget?.(point) || null;
    return {
      point,
      hitAction,
      tutorialInputActive: Boolean(shell?.isTutorialInputActive?.()),
      tutorialActionAllowed: Boolean(shell?.isTutorialActionAllowed?.(hitAction)),
      blockedByTutorialShield: Boolean(shell?.isPointBlockedByTutorialShield?.(point)),
    };
  }, center);
}

async function assertTargetClickable(page, label, state, target) {
  if (!target?.action?.type) {
    throw createVerificationFailure(label, 'target has no action', { target });
  }
  if (target.action.disabled) {
    throw createVerificationFailure(label, 'target action is disabled', { action: target.action });
  }
  const hit = await inspectCenterHit(page, state, target);
  if (!actionCompatible(target.action, hit.hitAction)) {
    throw createVerificationFailure(label, 'target center does not hit the expected action', {
      expected: target.action,
      hit,
    });
  }
  if (hit.tutorialInputActive && !hit.tutorialActionAllowed) {
    throw createVerificationFailure(label, 'tutorial shield blocks the expected action', {
      expected: target.action,
      hit,
      highlight: state.tutorialHighlight,
      intro: state.tutorialIntro,
    });
  }
  return hit;
}

function getApiCallsAfter(beforeState = {}, afterState = {}) {
  const beforeCalls = Array.isArray(beforeState.apiCalls) ? beforeState.apiCalls : [];
  const afterCalls = Array.isArray(afterState.apiCalls) ? afterState.apiCalls : [];
  const beforeMaxIndex = beforeCalls.reduce((max, call) => Math.max(max, Number(call?.index) || 0), -1);
  return afterCalls.filter((call) => (Number(call?.index) || 0) > beforeMaxIndex);
}

function apiCallMatchesAction(call = {}, action = {}) {
  if (!call || !action?.type) return false;
  const body = call.body || {};
  if (action.type === 'claimTaskReward') {
    return call.path === '/game/tasks/claim' && (!action.taskId || body.taskId === action.taskId);
  }
  const expectedAction = expectedApiBodyAction(action);
  if (!expectedAction) return false;
  if (call.path !== '/game/action') return false;
  if (action.type === 'submitNaming') {
    return body.action === 'renameCity' || body.action === 'renamePolity';
  }
  if (body.action !== expectedAction) return false;
  if (action.type === 'startWorldMarch' && action.formationSlot !== undefined) {
    return Number(body.formationSlot ?? body.slot) === Number(action.formationSlot);
  }
  if (['claimConquest', 'conquer'].includes(action.type)) {
    const expectedId = getActionTargetId(action);
    const bodyId = body.missionId || body.territoryId || body.cityId || '';
    return !expectedId || !bodyId || expectedId === bodyId;
  }
  return true;
}

function getSuccessfulApiCall(afterState = {}, action = {}, beforeState = {}) {
  const calls = getApiCallsAfter(beforeState, afterState);
  return calls.find((call) => (
    apiCallMatchesAction(call, action)
    && call.ok !== false
    && call.error === undefined
    && call.completed
    && call.response?.success !== false
  )) || null;
}

function hasChanged(beforeValue, afterValue) {
  return JSON.stringify(sanitize(beforeValue)) !== JSON.stringify(sanitize(afterValue));
}

function countBuildings(state = {}) {
  const buildings = state.stateSummary?.buildings;
  if (Array.isArray(buildings)) return buildings.length;
  if (buildings && typeof buildings === 'object') {
    return Object.values(buildings).reduce((sum, value) => sum + (Number(value) || (value ? 1 : 0)), 0);
  }
  return 0;
}

function missionCounts(state = {}) {
  const explorer = state.stateSummary?.worldExplorerState || {};
  return {
    active: Array.isArray(explorer.activeMissions) ? explorer.activeMissions.length : (explorer.activeMission ? 1 : 0),
    idle: Array.isArray(explorer.idleMissions) ? explorer.idleMissions.length : 0,
    missions: Array.isArray(explorer.missions) ? explorer.missions.length : 0,
  };
}

function evaluateActionOutcome(before = {}, after = {}, action = {}) {
  const actionType = action?.type || '';
  const apiCall = getSuccessfulApiCall(after, action, before);
  const stepAdvanced = Number(after.tutorialStep) > Number(before.tutorialStep);
  const completed = Boolean(after.tutorialCompleted || after.tutorialStep >= COMPLETED_STEP_INDEX);
  const apiRequired = isApiAction(actionType);
  const apiOk = !apiRequired || Boolean(apiCall);
  const authorityOk = !actionRequiresAuthority(action) || (
    apiCall?.response?.authority?.schema === 'command-authority-contract-v1'
    && apiCall?.response?.authority?.status === 'accepted'
    && apiCall?.response?.authority?.authority?.owner === 'server'
  );
  const base = {
    pass: false,
    reason: '',
    apiCall: sanitize(apiCall),
    apiOk,
    authorityOk,
  };
  const pass = (reason, extra = {}) => ({ ...base, pass: apiOk && authorityOk, reason, ...extra });
  const fail = (reason, extra = {}) => ({ ...base, pass: false, reason, ...extra });

  if (completed) return pass('tutorial completed');

  switch (actionType) {
    case 'wait':
    case 'waitExplore':
      if (actionType === 'wait' && action.introStep && before.tutorialIntro?.active && before.tutorialIntro?.step === action.introStep) {
        return pass(`intro ${action.introStep} wait state remains visible and valid`);
      }
      if (after.tutorialStep !== before.tutorialStep
        || hasChanged(before.stateSummary?.worldExplorerState, after.stateSummary?.worldExplorerState)) {
        return pass('wait observed state progress');
      }
      if (actionType === 'waitExplore') {
        const counts = missionCounts(after);
        if (counts.active > 0 || counts.idle > 0) {
          return pass('explore wait state remains visible and valid', { missionCounts: counts });
        }
      }
      return fail('wait did not observe state progress');
    case 'closeAdvisor':
      return !after.tutorialAdvisorDialogue ? pass('advisor dialogue closed') : fail('advisor dialogue is still visible');
    case 'closeRewardReveal':
      return !after.rewardReveal ? pass('reward reveal closed') : fail('reward reveal is still visible');
    case 'requestNamingInput':
      return after.naming?.visible && String(after.naming?.inputValue || '').trim()
        ? pass('naming input is filled')
        : fail('naming input is not visibly filled');
    case 'submitNaming':
      if (!apiOk) return fail('naming submit API did not succeed');
      if (stepAdvanced) {
        const nextPromptType = after.naming?.visible ? (after.naming?.prompt?.type || after.naming?.view?.prompt?.type || '') : '';
        if (!after.naming?.visible || nextPromptType === 'polity') {
          return pass(after.naming?.visible ? 'naming submitted and next naming prompt opened' : 'naming modal submitted and closed');
        }
      }
      if (!after.naming?.visible && after.tutorialStep >= before.tutorialStep) {
        return pass('naming modal submitted and closed');
      }
      return fail('naming submit did not advance or close');
    case 'openWorldSite': {
      const siteId = action.siteId || action.cityId || action.territoryId || '';
      const selected = after.territoryUiState?.selectedSiteId || '';
      // When a march actor overlaps the tile, the click opens the world target
      // picker instead; that is a valid intermediate step (the next iteration clicks
      // the site candidate). Only a FRESHLY opened picker counts as progress — an
      // already-open picker would otherwise turn every click into a false pass.
      const pickerOpened = (after.targetPickerKind === 'worldTargetPicker'
        || (after.worldTargetPickerCandidates || []).length > 0)
        && !(before.worldTargetPickerCandidates || []).length
        && before.targetPickerKind !== 'worldTargetPicker';
      return (siteId && selected === siteId) || after.cityManagementOpen || pickerOpened || stepAdvanced || before.tutorialIntro?.step !== after.tutorialIntro?.step
        ? pass('world site opened, picker opened, or intro advanced')
        : fail('world site did not open');
    }
    case 'enterCity':
      return after.cityManagementOpen || stepAdvanced || before.currentTab !== after.currentTab
        ? pass('city entered')
        : fail('city did not open after enter action');
    case 'buildBuilding':
      return stepAdvanced || countBuildings(after) > countBuildings(before) || apiOk
        ? pass('building action changed state')
        : fail('building action did not change state');
    case 'openCommandPanel':
      return after.activeCommandPanel === action.panel || after.currentTab === action.panel || stepAdvanced
        ? pass(`command panel ${action.panel || ''} opened`)
        : fail('command panel did not open');
    case 'advanceEra':
      return Number(after.stateSummary?.currentEra || 0) > Number(before.stateSummary?.currentEra || 0) || stepAdvanced
        ? pass('era advanced')
        : fail('era did not advance');
    case 'openTaskCenter':
      return after.taskCenterOpen ? pass('task center opened') : fail('task center did not open');
    case 'claimTaskReward':
      return stepAdvanced || apiOk || hasChanged(before.stateSummary?.resources, after.stateSummary?.resources)
        ? pass('task reward changed state')
        : fail('task reward did not change state');
    case 'openEvent':
      return after.activeEventId ? pass('event modal opened') : fail('event modal did not open');
    case 'claimEvent':
      return stepAdvanced || apiOk ? pass('event claimed') : fail('event claim did not change state');
    case 'openFamousPersons':
      return after.showFamousPersons ? pass('famous panel opened') : fail('famous panel did not open');
    case 'openFamousPersonDetail':
      return after.selectedFamousPersonId || stepAdvanced ? pass('famous detail opened') : fail('famous detail did not open');
    case 'closeFamousPersonDetail':
      return !after.selectedFamousPersonId ? pass('famous detail closed') : fail('famous detail is still open');
    case 'closeFamousPersons':
      return !after.showFamousPersons ? pass('famous panel closed') : fail('famous panel is still open');
    case 'switchCityManagementTab':
      return after.activeCityManagementTab === action.tab ? pass('city management tab switched') : fail('city management tab did not switch');
    case 'openCityManagement':
      return after.cityManagementOpen && after.activeCityManagementTab === (action.tab || 'buildings')
        ? pass(`city management ${action.tab || 'buildings'} tab opened`)
        : fail('city management tab did not open');
    case 'openArmyFormation':
      return after.armyFormationEditor?.open ? pass('army formation editor opened') : fail('army formation editor did not open');
    case 'toggleArmyFormationMember':
      return hasChanged(before.armyFormationEditor, after.armyFormationEditor)
        ? pass('formation member selection changed')
        : fail('formation member selection did not change');
    case 'saveArmyFormation':
      return !after.armyFormationEditor?.open || stepAdvanced || apiOk
        ? pass('formation saved')
        : fail('formation editor did not save/close');
    case 'selectWorldMarchTarget':
      return after.territoryUiState?.worldMarchTarget || stepAdvanced
        ? pass('world march target selected')
        : fail('world march target was not selected');
    case 'openWorldMarchFormationPicker':
      return after.targetPickerKind === 'worldMarchFormation'
        || after.territoryUiState?.worldMarchTarget?.pickerOpen
        ? pass('world march formation picker opened')
        : fail('world march picker did not open');
    case 'startWorldMarch': {
      const beforeCounts = missionCounts(before);
      const afterCounts = missionCounts(after);
      return stepAdvanced || afterCounts.active > beforeCounts.active || afterCounts.idle > beforeCounts.idle || apiOk
        ? pass('world march started')
        : fail('world march did not start');
    }
    case 'chooseWorldTarget': {
      // Choosing the site candidate dispatches its openWorldSite; the action
      // carries targetId (not siteId), so progress = picker closed and a world
      // site is now selected (or city management opened).
      const selected = after.territoryUiState?.selectedSiteId || '';
      const pickerClosed = after.targetPickerKind !== 'worldTargetPicker';
      return (pickerClosed && (Boolean(selected) || after.cityManagementOpen)) || stepAdvanced
        ? pass('world target candidate chosen')
        : fail('world target picker choice did not resolve');
    }
    case 'conquer':
      return stepAdvanced || apiOk ? pass('conquest started') : fail('conquest did not start');
    case 'claimConquest':
      return stepAdvanced || apiOk ? pass('conquest claimed') : fail('conquest claim did not change state');
    case 'renameCity':
      return after.naming?.visible ? pass('city naming modal opened') : fail('city naming modal did not open');
    case 'assignJob':
      return stepAdvanced || apiOk || hasChanged(before.stateSummary?.resources, after.stateSummary?.resources)
        ? pass('manual talent assignment changed state')
        : fail('manual talent assignment did not change state');
    case 'seekFamousPerson':
      return stepAdvanced || apiOk ? pass('famous seek completed') : fail('famous seek did not complete');
    default:
      return stepAdvanced || hasChanged(before, after)
        ? pass('state changed after click')
        : fail(`no expected outcome rule passed for ${actionType || 'unknown action'}`);
  }
}

async function waitForActionOutcome(page, before, action, timeoutMs = 12000) {
  const start = Date.now();
  let lastAfter = before;
  let lastOutcome = evaluateActionOutcome(before, before, action);
  while (Date.now() - start < timeoutMs) {
    await waitForRender(page, 250);
    const after = await getState(page);
    lastAfter = after;
    lastOutcome = evaluateActionOutcome(before, after, action);
    if (lastOutcome.pass) return { after, outcome: lastOutcome };
  }
  return { after: lastAfter, outcome: lastOutcome };
}

async function clickTarget(page, label, state, target) {
  const beforeEvidence = await captureTargetEvidence(page, `${label}-before`, state, target);
  let hit = null;
  try {
    hit = await assertTargetClickable(page, label, state, target);
  } catch (error) {
    throw createVerificationFailure(label, 'target screenshot captured, but center clickability failed', {
      action: target.action,
      beforeFullPath: beforeEvidence.fullPath,
      beforeTargetPath: beforeEvidence.cropPath,
      beforeHighlightPath: beforeEvidence.highlightPath,
      originalError: error.message,
    });
  }
  const rect = toViewportRect(state, target, 0);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const { after, outcome } = await waitForActionOutcome(page, state, target.action);
  const afterSnapshot = await writeSnapshot(page, `${label}-after-step-${after.tutorialStep}`, after, {
    beforeStep: state.tutorialStep,
    action: sanitize(target.action),
    outcome,
  });
  const report = {
    label,
    beforeStep: state.tutorialStep,
    beforeStepName: STEP_NAMES[state.tutorialStep] || '',
    afterStep: after.tutorialStep,
    afterStepName: STEP_NAMES[after.tutorialStep] || '',
    action: sanitize(target.action),
    centerHit: sanitize(hit),
    beforeFullPath: beforeEvidence.fullPath,
    beforeTargetPath: beforeEvidence.cropPath,
    beforeExactTargetPath: beforeEvidence.exactPath,
    beforeHighlightPath: beforeEvidence.highlightPath,
    afterFullPath: afterSnapshot.fullPath,
    afterJsonPath: afterSnapshot.jsonPath,
    outcome,
  };
  verificationReports.push(report);
  if (!outcome.pass) {
    // Opt-in (PLAYTEST_CONTINUE_ON_FAILURE=1): keep driving past a verification miss so a single
    // run can capture the full tutorial trajectory (e.g. the later formation/battle/conquest steps)
    // for manual review, instead of stopping at the first unexpected click outcome. Default stays
    // strict (throws) so CI behaviour is unchanged.
    if (!CONFIG.continueOnFailure) {
      throw createVerificationFailure(label, 'click did not produce the expected result', report);
    }
  }
  return {
    label,
    action: sanitize(target.action),
    step: state.tutorialStep,
    stepName: STEP_NAMES[state.tutorialStep] || '',
    afterStep: after.tutorialStep,
    afterStepName: STEP_NAMES[after.tutorialStep] || '',
    outcome,
  };
}

async function recordWaitAction(page, label, state, action = {}, waitMs = 900, timeoutMs = 12000) {
  const beforeSnapshot = await writeSnapshot(page, `${label}-before`, state, { action });
  await page.waitForTimeout(waitMs);
  await waitForRender(page, 300);
  const { after, outcome } = await waitForActionOutcome(page, state, action, timeoutMs);
  const afterSnapshot = await writeSnapshot(page, `${label}-after-step-${after.tutorialStep}`, after, {
    beforeStep: state.tutorialStep,
    action: sanitize(action),
    outcome,
  });
  const report = {
    label,
    beforeStep: state.tutorialStep,
    beforeStepName: STEP_NAMES[state.tutorialStep] || '',
    afterStep: after.tutorialStep,
    afterStepName: STEP_NAMES[after.tutorialStep] || '',
    action: sanitize(action),
    beforeFullPath: beforeSnapshot.fullPath,
    afterFullPath: afterSnapshot.fullPath,
    afterJsonPath: afterSnapshot.jsonPath,
    outcome,
  };
  verificationReports.push(report);
  if (!outcome.pass && action.type !== 'wait') {
    throw createVerificationFailure(label, 'wait did not produce expected state progress', report);
  }
  return {
    label,
    action: sanitize(action),
    step: state.tutorialStep,
    stepName: STEP_NAMES[state.tutorialStep] || '',
    afterStep: after.tutorialStep,
    afterStepName: STEP_NAMES[after.tutorialStep] || '',
    outcome,
  };
}

async function clickByPredicate(page, label, predicate, timeoutMs = 12000, options = {}) {
  const start = Date.now();
  let lastState = null;
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt += 1;
    const state = await getState(page);
    lastState = state;
    const target = findTarget(state, predicate);
    if (target) return clickTarget(page, label, state, target);
    if (typeof options.onMiss === 'function') {
      await options.onMiss({ page, state, label, attempt, elapsedMs: Date.now() - start });
    }
    await waitForRender(page, 300);
  }
  const summary = {
    step: lastState?.tutorialStep,
    stepName: STEP_NAMES[lastState?.tutorialStep] || '',
    introStep: lastState?.tutorialIntro?.step,
    highlight: lastState?.tutorialHighlight?.allowedAction || null,
    targets: (lastState?.hitTargets || []).map((target) => target.action).slice(-50),
  };
  throw new Error(`No visible target for ${label}: ${JSON.stringify(summary)}`);
}

async function closeRewardIfOpen(page) {
  const state = await getState(page);
  if (!state.rewardReveal) return null;
  const target = findTarget(state, (action) => action.type === 'closeRewardReveal' && !action.disabled);
  if (target) return clickTarget(page, 'close-reward', state, target);
  await writeSnapshot(page, `missing-close-reward-step-${state.tutorialStep}`, state);
  throw createVerificationFailure('close-reward', 'reward reveal is open but no visible close target exists', {
    step: state.tutorialStep,
    rewardReveal: state.rewardReveal,
    targets: state.hitTargets.map((item) => item.action).slice(-80),
  });
}

async function closeAdvisorDialogueIfOpen(page) {
  const state = await getState(page);
  const target = findTarget(state, (action) => action.type === 'closeAdvisor' && !action.disabled);
  if (!state.tutorialAdvisorDialogue && !target) return null;
  if (target) return clickTarget(page, `close-advisor-step-${state.tutorialStep}`, state, target);
  await writeSnapshot(page, `missing-close-advisor-step-${state.tutorialStep}`, state);
  throw createVerificationFailure('close-advisor', 'advisor dialogue is open but no visible close target exists', {
    step: state.tutorialStep,
    dialogue: state.tutorialAdvisorDialogue,
    targets: state.hitTargets.map((item) => item.action).slice(-80),
  });
}

async function fillNamingIfOpen(page) {
  const state = await getState(page);
  if (!state.naming?.visible) return null;
  if (!String(state.naming.inputValue || '').trim()) {
    await writeSnapshot(page, `naming-before-fill-step-${state.tutorialStep}`, state);
    const promptType = state.naming?.prompt?.type
      || state.naming?.view?.prompt?.type
      || state.naming?.view?.type
      || '';
    const value = promptType === 'polity' ? 'Fireseed' : 'Riverbend';
    await page.evaluate((nextValue) => {
      window.__codexNamingAutoValue = nextValue;
    }, value);
    await clickByPredicate(page, `request-naming-input-step-${state.tutorialStep}`, (action) => (
      action.type === 'requestNamingInput' && !action.disabled
    ), 6000);
    await page.waitForFunction(() => {
      const game = window.Game;
      const shell = game?.canvasShell;
      // Batch 8F retired the direct shell.naming property; the input value lives in
      // the naming snapshot now.
      const snapshot = shell?.getNamingSnapshot?.() || game?.getNamingSnapshot?.() || null;
      const inputValue = snapshot?.inputValue ?? shell?.naming?.inputValue ?? game?.naming?.inputValue ?? '';
      return Boolean(String(inputValue || '').trim());
    }, null, { timeout: 6000 });
    await waitForRender(page, 300);
  }
  return clickByPredicate(page, `submit-naming-step-${state.tutorialStep}`, (action) => (
    action.type === 'submitNaming' && !action.disabled
  ), 6000);
}

async function chooseNextAction(page, iteration) {
  const closedAdvisor = await closeAdvisorDialogueIfOpen(page);
  if (closedAdvisor) return closedAdvisor;
  const closedReward = await closeRewardIfOpen(page);
  if (closedReward) return closedReward;
  const naming = await fillNamingIfOpen(page);
  if (naming) return naming;

  const state = await getState(page);
  const introStep = state.tutorialIntro?.active ? state.tutorialIntro.step : '';
  if (introStep === 'march' || introStep === 'entering') {
    return recordWaitAction(page, `wait-intro-${introStep}-${iteration}`, state, { type: 'wait', introStep }, 700, 1600);
  }
  if (introStep === 'city') {
    return clickByPredicate(page, `intro-open-capital-${iteration}`, (action) => (
      action.type === 'openWorldSite' && (!action.siteId || action.siteId === 'capital')
    ));
  }
  if (introStep === 'enter') {
    return clickByPredicate(page, `intro-enter-city-${iteration}`, (action) => (
      action.type === 'enterCity' && (!action.cityId || action.cityId === 'capital')
    ));
  }

  // The world target picker blocks every click behind it. Whenever it is open (its
  // candidate buttons are registered as hit targets), resolve it first — a real player
  // taps the site candidate — otherwise the guide-highlight fallback below keeps
  // clicking through it without ever advancing.
  if ((state.worldTargetPickerCandidates || []).length) {
    const candidates = state.worldTargetPickerCandidates;
    const wanted = candidates.find((id) => id === 'capital' || String(id).startsWith('site_')) || '';
    return clickByPredicate(page, `resolve-world-target-picker-${iteration}`, (action) => (
      action.type === 'chooseWorldTarget'
      && (!wanted || String(action.targetId || action.siteId || '') === wanted)
      && !action.disabled
    ));
  }

  const allowed = state.tutorialHighlight?.allowedAction || null;
  // A guided openWorldSite towards a site the active march has not reached yet cannot
  // advance the step machine (the guide points at the discovered empty city while the
  // exploration march is still travelling). Wait the march out instead of click-spamming.
  if (allowed?.type === 'openWorldSite' && missionCounts(state).active > 0) {
    return recordWaitAction(page, `wait-march-before-${allowed.type}-${iteration}`, state, {
      type: 'wait',
      reason: 'active march has not arrived yet',
    }, 1500, 3000);
  }
  if (allowed?.type) {
    const target = findTarget(state, (action) => actionMatches(allowed, action))
      || findTarget(state, (action) => action.type === allowed.type && !action.disabled);
    if (target) return clickTarget(page, `highlight-${allowed.type}-${iteration}`, state, target);
  }

  const step = state.tutorialStep;
  const stepIs = (name) => step === stepIndexOf(name);
  if (stepIs(STEPS.cityEntered) && !state.taskCenterOpen) {
    return clickByPredicate(page, `open-task-center-homestead-${iteration}`, (action) => (
      action.type === 'openTaskCenter' && !action.disabled
    ));
  }
  if (stepIs(STEPS.cityEntered) && state.taskCenterOpen) {
    return clickByPredicate(page, `claim-homestead-task-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_homestead_supplies' && !action.disabled
    ));
  }
  if (stepIs(STEPS.houseGuideReady) || stepIs(STEPS.farmPrepReserved) || stepIs(STEPS.buildingsTabOpenedForLumbermill)) {
    const buildingId = stepIs(STEPS.houseGuideReady) ? 'house' : (stepIs(STEPS.farmPrepReserved) ? 'farm' : 'lumbermill');
    return clickByPredicate(page, `build-${buildingId}-${iteration}`, (action) => (
      action.type === 'buildBuilding' && action.buildingId === buildingId && !action.disabled
    ));
  }
  if (stepIs(STEPS.houseBuilt) || stepIs(STEPS.era2AdvanceReady) || stepIs(STEPS.era3AdvanceReady)) {
    if (stepIs(STEPS.era3AdvanceReady) && state.taskCenterOpen) {
      return clickByPredicate(page, `claim-lumber-task-${iteration}`, (action) => (
        action.type === 'claimTaskReward' && action.taskId === 'main_lumbermill_supplies' && !action.disabled
      ));
    }
    return clickByPredicate(page, `open-civilization-${iteration}`, (action) => (
      action.type === 'openCommandPanel' && action.panel === 'civilization' && !action.disabled
    ));
  }
  if (stepIs(STEPS.civilizationTabOpened) || stepIs(STEPS.eraAdvancedTo2)) {
    return clickByPredicate(page, `advance-era-${iteration}`, (action) => action.type === 'advanceEra' && !action.disabled);
  }
  if (stepIs(STEPS.eraAdvancedTo1) || stepIs(STEPS.lumbermillBuilt)) {
    return clickByPredicate(page, `open-task-center-${iteration}`, (action) => action.type === 'openTaskCenter' && !action.disabled);
  }
  if (stepIs(STEPS.buildingsTabOpened)) {
    return clickByPredicate(page, `claim-first-task-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_first_supplies' && !action.disabled
    ));
  }
  if (stepIs(STEPS.specialEventTabOpened)) {
    return clickByPredicate(page, `open-events-${iteration}`, (action) => (
      action.type === 'openCommandPanel' && action.panel === 'events' && !action.disabled
    ));
  }
  if (stepIs(STEPS.specialEventClaimed) && !state.activeEventId) {
    return clickByPredicate(page, `open-forest-event-${iteration}`, (action) => (
      action.type === 'openEvent' && !action.disabled
    ));
  }
  if (stepIs(STEPS.specialEventClaimed) && state.activeEventId) {
    return clickByPredicate(page, `claim-forest-event-${iteration}`, (action) => (
      action.type === 'claimEvent' && !action.disabled
    ));
  }
  // Barracks segment: claim supplies -> open buildings -> build barracks ->
  // claim the first army -> claim the scout officer.
  if (stepIs(STEPS.era3Advanced) && !state.taskCenterOpen) {
    return clickByPredicate(page, `open-task-center-barracks-${iteration}`, (action) => (
      action.type === 'openTaskCenter' && !action.disabled
    ));
  }
  if (stepIs(STEPS.era3Advanced) && state.taskCenterOpen) {
    return clickByPredicate(page, `claim-barracks-supplies-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_barracks_supplies' && !action.disabled
    ));
  }
  if (stepIs(STEPS.barracksSuppliesClaimed)) {
    return clickByPredicate(page, `open-buildings-for-barracks-${iteration}`, (action) => (
      action.type === 'openCommandPanel' && action.panel === 'buildings' && !action.disabled
    ));
  }
  if (stepIs(STEPS.buildingsTabOpenedForBarracks)) {
    return clickByPredicate(page, `build-barracks-${iteration}`, (action) => (
      action.type === 'buildBuilding' && action.buildingId === 'barracks' && !action.disabled
    ));
  }
  if (stepIs(STEPS.barracksBuilt) && !state.taskCenterOpen) {
    return clickByPredicate(page, `open-task-center-first-army-${iteration}`, (action) => (
      action.type === 'openTaskCenter' && !action.disabled
    ));
  }
  if (stepIs(STEPS.barracksBuilt) && state.taskCenterOpen) {
    return clickByPredicate(page, `claim-first-army-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_first_army' && !action.disabled
    ));
  }
  if (stepIs(STEPS.firstArmyClaimed)) {
    // In-window invariant: the claimed 1000-soldier army must survive every
    // server normalize (barracks L1 cap is 300; the tutorial floor keeps it).
    const reserveSoldiers = Number(state.stateSummary?.military?.soldiers ?? 0);
    if (reserveSoldiers < 1000) {
      await writeSnapshot(page, `first-army-reserve-too-low-${iteration}`, state);
      throw createVerificationFailure('first-army-reserve', 'first-army reserve dropped below the granted 1000 soldiers', {
        reserveSoldiers,
        military: state.stateSummary?.military || null,
      });
    }
    if (!state.taskCenterOpen) {
      return clickByPredicate(page, `open-task-center-officer-${iteration}`, (action) => (
        action.type === 'openTaskCenter' && !action.disabled
      ));
    }
    return clickByPredicate(page, `claim-scout-officer-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_scout_officer' && !action.disabled
    ));
  }
  if (stepIs(STEPS.scoutFamousGranted)) {
    return clickByPredicate(page, `open-famous-${iteration}`, (action) => action.type === 'openFamousPersons' && !action.disabled);
  }
  if (stepIs(STEPS.famousPanelOpened)) {
    return clickByPredicate(page, `open-famous-detail-${iteration}`, (action) => action.type === 'openFamousPersonDetail' && !action.disabled);
  }
  if (stepIs(STEPS.famousCardViewed) && state.selectedFamousPersonId) {
    return clickByPredicate(page, `close-famous-detail-${iteration}`, (action) => action.type === 'closeFamousPersonDetail' && !action.disabled);
  }
  if (stepIs(STEPS.famousCardViewed) && state.showFamousPersons) {
    return clickByPredicate(page, `close-famous-${iteration}`, (action) => action.type === 'closeFamousPersons' && !action.disabled);
  }
  if (stepIs(STEPS.famousCardViewed) && !state.cityManagementOpen) {
    // Both openWorldSite and enterCity land in capital city management; which one owns the
    // tile's clickable center depends on hit-target stacking, so accept either.
    return clickByPredicate(page, `open-capital-for-formation-${iteration}`, (action) => (
      (action.type === 'openWorldSite' || action.type === 'enterCity')
      && (!(action.siteId || action.cityId || action.territoryId)
        || (action.siteId || action.cityId || action.territoryId) === 'capital')
      && !action.disabled
    ));
  }
  if (stepIs(STEPS.famousCardViewed) && state.cityManagementOpen && state.activeCityManagementTab !== 'military') {
    return clickByPredicate(page, `switch-city-military-${iteration}`, (action) => (
      action.type === 'switchCityManagementTab' && action.tab === 'military' && !action.disabled
    ));
  }
  if (stepIs(STEPS.famousCardViewed) && state.cityManagementOpen) {
    return clickByPredicate(page, `open-army-formation-${iteration}`, (action) => (
      action.type === 'openArmyFormation' && !action.disabled
    ));
  }
  if (stepIs(STEPS.formationPanelOpened) && state.armyFormationEditor?.open) {
    const memberTarget = findTarget(state, (action) => action.type === 'toggleArmyFormationMember' && !action.disabled);
    if (memberTarget) return clickTarget(page, `toggle-formation-member-${iteration}`, state, memberTarget);
    const editor = state.armyFormationEditor;
    const scoutId = String((editor.memberIds || [])[0] || '');
    const draftSoldiers = Number(
      (editor.soldierDraftAssignments || {})[scoutId]
      ?? (editor.soldierAssignments || {})[scoutId]
      ?? 0,
    );
    if (draftSoldiers <= 0) {
      const replenished = await clickByPredicate(page, `auto-replenish-formation-${iteration}`, (action) => (
        action.type === 'autoReplenishArmyFormation' && !action.disabled
      ));
      const afterReplenish = await getState(page);
      const afterDraft = Number(
        (afterReplenish.armyFormationEditor?.soldierDraftAssignments || {})[scoutId]
        ?? (afterReplenish.armyFormationEditor?.soldierAssignments || {})[scoutId]
        ?? 0,
      );
      if (afterDraft < 1000) {
        await writeSnapshot(page, `replenish-draft-too-low-${iteration}`, afterReplenish);
        throw createVerificationFailure('auto-replenish-draft', 'auto-replenish did not fill the scout draft to 1000 soldiers', {
          scoutId,
          afterDraft,
          editor: afterReplenish.armyFormationEditor || null,
        });
      }
      return replenished;
    }
    const foodBeforeSave = Number(state.stateSummary?.resources?.food ?? NaN);
    const saved = await clickByPredicate(page, `save-army-formation-${iteration}`, (action) => action.type === 'saveArmyFormation' && !action.disabled);
    const afterSave = await getState(page);
    const foodAfterSave = Number(afterSave.stateSummary?.resources?.food ?? NaN);
    // Assignment is free (recruit-time food cost only): saving must not deduct food.
    if (Number.isFinite(foodBeforeSave) && Number.isFinite(foodAfterSave) && foodAfterSave < foodBeforeSave) {
      await writeSnapshot(page, `formation-save-food-deducted-${iteration}`, afterSave);
      throw createVerificationFailure('formation-save-food', 'formation save deducted food (assignment must be free)', {
        foodBeforeSave,
        foodAfterSave,
      });
    }
    return saved;
  }
  if (stepIs(STEPS.scoutFormationSaved)) {
    const mapTarget = findTarget(state, (action) => action.type === 'selectWorldMarchTarget' && !action.disabled);
    if (mapTarget) return clickTarget(page, `select-world-march-target-${iteration}`, state, mapTarget);
    await writeSnapshot(page, `missing-world-march-target-step-${step}-${iteration}`, state);
    throw createVerificationFailure('select-world-march-target', 'guided world march target is not visible/clickable', {
      step,
      highlight: state.tutorialHighlight,
      worldMapDebug: state.worldMapDebug,
      targets: state.hitTargets.map((item) => item.action).slice(-100),
    });
  }
  if (stepIs(STEPS.scoutWorldPanelOpened) && !state.territoryUiState?.worldMarchTarget?.pickerOpen) {
    return clickByPredicate(page, `open-world-march-picker-${iteration}`, (action) => (
      action.type === 'openWorldMarchFormationPicker' && !action.disabled
    ));
  }
  if (stepIs(STEPS.scoutWorldPanelOpened) && state.territoryUiState?.worldMarchTarget?.pickerOpen) {
    return clickByPredicate(page, `start-world-march-${iteration}`, (action) => (
      action.type === 'startWorldMarch' && !action.disabled
    ));
  }
  if (stepIs(STEPS.scoutExploreStarted)) {
    return recordWaitAction(page, `wait-explore-${iteration}`, state, { type: 'waitExplore' }, 2000, 3600);
  }
  if (stepIs(STEPS.firstCityDiscovered)) {
    let siteId = getFirstCitySiteId(state);
    if (!state.territoryUiState?.selectedSiteId || (siteId && state.territoryUiState.selectedSiteId !== siteId)) {
      return clickByPredicate(
        page,
        `open-first-city-site-${iteration}`,
        (action) => (
          action.type === 'openWorldSite' && (!siteId || action.siteId === siteId) && !action.disabled
        ),
        18000,
        {
          onMiss: async ({ page: missPage, state: missState, attempt }) => {
            if (attempt !== 1 && attempt % 3 !== 0) return;
            const refresh = await refreshAuthorityStateAndWorldMap(missPage, `step-25-refresh-${attempt}`);
            const refreshedState = await getState(missPage);
            const refreshedSiteId = getFirstCitySiteId(refreshedState);
            if (refreshedSiteId && refreshedSiteId !== siteId) siteId = refreshedSiteId;
            if (attempt === 1 || refreshedSiteId || refresh?.error) {
              await writeSnapshot(missPage, `step-25-refresh-${attempt}`, refreshedState, {
                requestedSiteId: siteId,
                refreshedSiteId,
                refresh,
                previousState: {
                  tutorialStep: missState.tutorialStep,
                  territoryState: missState.territoryState,
                  territoryUiState: missState.territoryUiState,
                },
              });
            }
          },
        },
      );
    }
    return clickByPredicate(page, `conquer-first-city-${iteration}`, (action) => (
      action.type === 'conquer' && (!siteId || action.territoryId === siteId || action.cityId === siteId) && !action.disabled
    ));
  }
  if (stepIs(STEPS.firstCityConquestStarted)) {
    const siteId = state.tutorial?.grants?.firstExploreEmptyCity?.siteId || state.territoryUiState?.selectedSiteId || '';
    return clickByPredicate(page, `claim-first-city-${iteration}`, (action) => (
      action.type === 'claimConquest' && (!siteId || action.territoryId === siteId || action.cityId === siteId) && !action.disabled
    ));
  }
  if (stepIs(STEPS.firstCityOccupied)) {
    const siteId = state.tutorial?.grants?.firstExploreEmptyCity?.siteId || state.territoryUiState?.selectedSiteId || '';
    return clickByPredicate(page, `rename-first-city-${iteration}`, (action) => (
      action.type === 'renameCity' && (!siteId || action.territoryId === siteId || action.cityId === siteId) && !action.disabled
    ));
  }
  if (stepIs(STEPS.polityNamed)) {
    return clickByPredicate(page, `open-city-people-${iteration}`, (action) => (
      action.type === 'openCityManagement' && (action.tab || 'people') === 'people' && !action.disabled
    ));
  }
  if (stepIs(STEPS.talentPolicyOpened)) {
    if (!state.cityManagementOpen) {
      const opened = findTarget(state, (action) => (
        action.type === 'openCityManagement' && (action.tab || 'people') === 'people' && !action.disabled
      ));
      if (opened) return clickTarget(page, `open-city-people-${iteration}`, state, opened);
    }
    return clickByPredicate(page, `switch-city-people-${iteration}`, (action) => (
      action.type === 'switchCityManagementTab' && action.tab === 'people' && !action.disabled
    ));
  }
  if (stepIs(STEPS.talentPolicyApplied)) {
    return clickByPredicate(page, `assign-manual-talent-${iteration}`, (action) => (
      action.type === 'assignJob' && Number(action.delta) !== 0 && !action.disabled
    ));
  }
  if (stepIs(STEPS.manualTalentAssigned)) {
    return clickByPredicate(page, `open-famous-for-seek-${iteration}`, (action) => (
      action.type === 'openFamousPersons' && !action.disabled
    ));
  }
  if (stepIs(STEPS.famousSeekOpened)) {
    if (!state.showFamousPersons) {
      const openFamous = findTarget(state, (action) => action.type === 'openFamousPersons' && !action.disabled);
      if (openFamous) return clickTarget(page, `open-famous-for-seek-${iteration}`, state, openFamous);
    }
    return clickByPredicate(page, `seek-famous-${iteration}`, (action) => (
      action.type === 'seekFamousPerson' && !action.disabled
    ));
  }
  if (stepIs(STEPS.famousSeekCompleted)) {
    return clickByPredicate(page, `open-final-tech-${iteration}`, (action) => (
      action.type === 'openCommandPanel' && action.panel === 'tech' && !action.disabled
    ));
  }
  if (stepIs(STEPS.finalTechOpened)) {
    const advisor = await closeAdvisorDialogueIfOpen(page);
    if (advisor) return advisor;
    await writeSnapshot(page, `blocked-final-tech-step-${step}-${iteration}`, state);
    throw createVerificationFailure('final-tech-completion', 'final tutorial step has no visible completion/advisor target', {
      step,
      highlight: state.tutorialHighlight,
      targets: state.hitTargets.map((item) => item.action).slice(-100),
    });
  }

  await writeSnapshot(page, `blocked-step-${step}-${iteration}`, state);
  throw new Error(`No scripted next action at step ${step} (${STEP_NAMES[step] || 'unknown'})`);
}

async function main() {
  const firstLogin = await postJson(`${CONFIG.apiBase}/player/login`, {
    username: CONFIG.username,
    password: CONFIG.password,
  });
  if (CONFIG.resetAccount) await postJson(`${CONFIG.apiBase}/player/reset`, {}, firstLogin.token);
  const login = await postJson(`${CONFIG.apiBase}/player/login`, {
    username: CONFIG.username,
    password: CONFIG.password,
  });

  const browser = await chromium.launch({ headless: CONFIG.headless });
  const page = await browser.newPage({
    viewport: { width: CONFIG.viewportWidth, height: CONFIG.viewportHeight },
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => events.push({ type: msg.type(), text: msg.text().slice(0, 1000) }));
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack }));
  page.on('requestfailed', (req) => requestFailures.push({
    url: req.url(),
    method: req.method(),
    failure: req.failure()?.errorText || '',
  }));
  page.on('response', (resp) => {
    if (resp.status() >= 400) badResponses.push({ url: resp.url(), status: resp.status() });
  });
  await page.addInitScript(({ token, username, apiBasePath }) => {
    const originalPrompt = window.prompt;
    const originalFetch = window.fetch.bind(window);
    window.__codexPromptCalls = [];
    window.__codexApiCalls = [];
    window.prompt = (message, defaultValue) => {
      window.__codexPromptCalls.push({ message: String(message || ''), defaultValue: String(defaultValue || '') });
      if (window.__codexNamingAutoValue !== undefined) return window.__codexNamingAutoValue;
      if (typeof originalPrompt === 'function') return originalPrompt(message, defaultValue);
      return defaultValue || '';
    };
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
      const entry = {
        index: window.__codexApiCalls.length,
        url,
        path: (() => {
          // Strip the deployment's api base (e.g. '/api' on the remote test server,
          // '/wxgame-test-api' on the WSL mirror) so matching sees '/game/...'.
          try {
            const pathname = new URL(url, location.href).pathname;
            if (apiBasePath && apiBasePath !== '/' && pathname.startsWith(apiBasePath)) {
              return pathname.slice(apiBasePath.length) || '/';
            }
            return pathname.replace(/^\/api/, '') || '/';
          } catch (_) { return url; }
        })(),
        method,
        body,
        startedAt,
        completed: false,
      };
      window.__codexApiCalls.push(entry);
      try {
        const response = await originalFetch(...args);
        const clone = response.clone();
        let payload = {};
        try { payload = await clone.json(); } catch (_) {}
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
    [
      'tutorialAutoStarted',
      'tutorialStep',
      'tutorialCompleted',
      'tutorialIntroAdvisorSeen.v1',
      'tutorialIntroAdvisorSeen.v2',
      'civilizationFirePhase2',
    ].forEach((key) => localStorage.removeItem(key));
  }, {
    token: login.token,
    username: CONFIG.username,
    apiBasePath: (() => {
      try { return new URL(CONFIG.apiBase).pathname.replace(/\/$/, ''); } catch (_) { return '/api'; }
    })(),
  });

  await page.goto(normalizeUrl(CONFIG.gameUrl), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.Game && window.Game.canvasShell), null, { timeout: 45000 });
  await page.waitForTimeout(9000);
  await writeSnapshot(page, '00-start');

  const actions = [];
  let stopReason = '';
  for (let index = 1; index <= CONFIG.maxActions; index += 1) {
    const state = await getState(page);
    if (state.tutorialCompleted || state.tutorialStep >= COMPLETED_STEP_INDEX) {
      stopReason = 'tutorial-completed';
      break;
    }
    try {
      const result = await chooseNextAction(page, index);
      actions.push({ index, result: sanitize(result) });
      const after = await getState(page);
      if (after.tutorialStep !== state.tutorialStep || index === 1 || index % 5 === 0) {
        await writeSnapshot(page, `state-after-${String(index).padStart(2, '0')}-step-${after.tutorialStep}`, after, { actions });
      }
    } catch (error) {
      stopReason = error.message;
      break;
    }
  }
  if (!stopReason) stopReason = 'max-actions-reached';

  const finalState = await getState(page);
  const manualReviewIndex = createManualReviewIndex();
  await writeSnapshot(page, 'zz-final', finalState, {
    actions,
    stopReason,
    actionEvidence,
    visualFindings,
    verificationReports,
    verificationFailures,
    manualReviewIndex,
  });
  const summary = {
    outputDir: outDir,
    gameUrl: CONFIG.gameUrl,
    apiBase: CONFIG.apiBase,
    strictVisual: CONFIG.strictVisual,
    stopReason,
    finalStep: finalState.tutorialStep,
    finalStepName: STEP_NAMES[finalState.tutorialStep] || '',
    tutorialCompleted: finalState.tutorialCompleted,
    actionCount: actions.length,
    evidenceCount: actionEvidence.length,
    verificationReportCount: verificationReports.length,
    verificationFailures,
    manualReviewIndex,
    visualFindings,
    badResponses,
    requestFailures,
    pageErrors,
    apiCallCount: Array.isArray(finalState.apiCalls) ? finalState.apiCalls.length : 0,
    eventCount: events.length,
  };
  const failed = stopReason !== 'tutorial-completed'
    || !finalState.tutorialCompleted
    || visualFindings.some((finding) => finding.severity === 'error')
    || verificationFailures.length > 0
    || badResponses.length > 0
    || requestFailures.length > 0
    || pageErrors.length > 0;
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({
    ...summary,
    actions,
    actionEvidence,
    verificationReports,
  }, null, 2));
  fs.writeFileSync(path.join(outDir, 'verification-report.json'), JSON.stringify({
    runId,
    config: CONFIG,
    summary,
    steps: verificationReports,
    manualReviewIndex,
    visualFindings,
    verificationFailures,
  }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  if (failed) process.exit(1);
}

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fatal-error.txt'), error.stack || error.message);
  console.error(error.stack || error.message);
  process.exit(1);
});
