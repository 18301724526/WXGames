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
  maxActions: Number(process.env.PLAYTEST_MAX_ACTIONS || 48),
  viewportWidth: Number(process.env.PLAYTEST_VIEWPORT_WIDTH || 1365),
  viewportHeight: Number(process.env.PLAYTEST_VIEWPORT_HEIGHT || 768),
  outputRoot: process.env.PLAYTEST_OUTPUT_DIR || path.join('.local-logs', 'online-tutorial'),
};

const STEP_NAMES = {
  0: 'initial',
  1: 'tutorialStarted',
  2: 'cityEntered',
  3: 'houseGuideReady',
  4: 'houseBuilt',
  5: 'civilizationTabOpened',
  6: 'eraAdvancedTo1',
  7: 'buildingsTabOpened',
  8: 'farmPrepReserved',
  9: 'farmBuilt',
  10: 'era2AdvanceReady',
  11: 'eraAdvancedTo2',
  12: 'specialEventTabOpened',
  13: 'specialEventClaimed',
  14: 'buildingsTabOpenedForLumbermill',
  15: 'lumbermillBuilt',
  16: 'era3AdvanceReady',
  17: 'era3Advanced',
  18: 'scoutFamousGranted',
  19: 'famousPanelOpened',
  20: 'famousCardViewed',
  21: 'formationPanelOpened',
  22: 'scoutFormationSaved',
  23: 'scoutWorldPanelOpened',
  24: 'scoutExploreStarted',
  25: 'scoutExploreClaimed',
  26: 'firstCityConquestStarted',
  27: 'firstCityOccupied',
  28: 'firstCityNamed',
  29: 'polityNamed',
  30: 'talentPolicyOpened',
  31: 'talentPolicyApplied',
  32: 'manualTalentAssigned',
  33: 'famousSeekOpened',
  34: 'famousSeekCompleted',
  35: 'finalTechOpened',
  36: 'completed',
};

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(CONFIG.outputRoot, runId);
fs.mkdirSync(outDir, { recursive: true });

const events = [];
const badResponses = [];
const requestFailures = [];
const pageErrors = [];
const actionEvidence = [];
const visualFindings = [];

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
      tutorialStep: Number(game?.tutorial?.currentStep ?? game?.state?.tutorial?.currentStep ?? 0) || 0,
      tutorialCompleted: Boolean(game?.tutorial?.completed || game?.state?.tutorial?.completed),
      tutorial: game?.tutorial || game?.state?.tutorial || null,
      tutorialIntro: game?.tutorialIntro || shell?.tutorialIntro || null,
      tutorialHighlight: shell?.tutorialHighlight || null,
      tutorialAdvisorDialogue: shell?.tutorialAdvisorDialogue || game?.tutorialAdvisorDialogue || null,
      rewardReveal: shell?.rewardReveal || game?.rewardReveal || null,
      taskCenterOpen: Boolean(shell?.showTaskCenter || game?.showTaskCenter),
      activeTaskCenterTab: shell?.activeTaskCenterTab || game?.activeTaskCenterTab || '',
      cityManagementOpen: Boolean(shell?.showCityManagement || game?.showCityManagement),
      activeCityManagementTab: shell?.activeCityManagementTab || game?.activeCityManagementTab || '',
      activeCommandPanel: shell?.activeCommandPanel || game?.activeCommandPanel || '',
      activeEventId: shell?.activeEventId || game?.activeEventId || game?.eventController?.activeEventId || '',
      showFamousPersons: Boolean(shell?.showFamousPersons || game?.showFamousPersons),
      selectedFamousPersonId: shell?.selectedFamousPersonId || game?.selectedFamousPersonId || '',
      naming: shell?.naming || game?.naming || null,
      armyFormationEditor: shell?.armyFormationEditor || game?.armyFormationEditor || null,
      territoryUiState: shell?.territoryUiState || game?.territoryUiState || game?.territoryController?.uiState || null,
      hitTargets: hitTargets.map((target) => ({
        x: Number(target.x) || 0,
        y: Number(target.y) || 0,
        width: Number(target.width) || 0,
        height: Number(target.height) || 0,
        action: target.action || null,
      })),
      stateSummary: game?.state ? {
        gameDay: game.state.gameDay,
        totalBuildings: game.state.totalBuildings,
        currentEra: game.state.currentEra,
        currentEraName: game.state.currentEraName,
        activeCityId: game.state.activeCityId,
        buildings: game.state.buildings,
        resources: game.state.resources,
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
    };
  });
}

async function waitForRender(page, ms = 700) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.Game?.canvasShell?.renderActive?.());
  await page.waitForTimeout(150);
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
  const fullPath = path.join(outDir, `${safeLabel}-full.png`);
  const cropPath = path.join(outDir, `${safeLabel}-target.png`);
  const exactPath = path.join(outDir, `${safeLabel}-target-exact.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  const cropBuffer = await page.screenshot({ clip: padded });
  const exactBuffer = await page.screenshot({ clip: exact });
  fs.writeFileSync(cropPath, cropBuffer);
  fs.writeFileSync(exactPath, exactBuffer);
  const cropMetrics = analyzePng(cropBuffer);
  const exactMetrics = analyzePng(exactBuffer);
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
    cropMetrics,
    exactMetrics,
    highlight: sanitize(state.tutorialHighlight),
  };
  actionEvidence.push(evidence);
  if (cropMetrics.suspiciousBlank || exactMetrics.suspiciousBlank) {
    visualFindings.push({
      severity: 'warning',
      label,
      step: state.tutorialStep,
      stepName: STEP_NAMES[state.tutorialStep] || '',
      action: sanitize(target.action),
      reason: 'Target crop has low visual variance; inspect screenshot for clickable-but-invisible guide target.',
      cropPath,
      exactPath,
      cropMetrics,
      exactMetrics,
    });
  }
  return evidence;
}

async function clickTarget(page, label, state, target) {
  await captureTargetEvidence(page, label, state, target);
  const rect = toViewportRect(state, target, 0);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await waitForRender(page, 900);
  return { label, action: sanitize(target.action), step: state.tutorialStep, stepName: STEP_NAMES[state.tutorialStep] || '' };
}

async function clickByPredicate(page, label, predicate, timeoutMs = 12000) {
  const start = Date.now();
  let lastState = null;
  while (Date.now() - start < timeoutMs) {
    const state = await getState(page);
    lastState = state;
    const target = findTarget(state, predicate);
    if (target) return clickTarget(page, label, state, target);
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
  await page.evaluate(() => window.Game?.canvasShell?.closeRewardReveal?.());
  await waitForRender(page, 400);
  return { label: 'close-reward-direct' };
}

async function closeAdvisorDialogueIfOpen(page) {
  const state = await getState(page);
  const target = findTarget(state, (action) => action.type === 'closeAdvisor' && !action.disabled);
  if (!state.tutorialAdvisorDialogue && !target) return null;
  if (target) return clickTarget(page, `close-advisor-step-${state.tutorialStep}`, state, target);
  await page.evaluate(() => window.Game?.canvasShell?.actionController?.handle?.({ type: 'closeAdvisor' }));
  await waitForRender(page, 500);
  return {
    label: `close-advisor-direct-step-${state.tutorialStep}`,
    action: { type: 'closeAdvisor' },
    step: state.tutorialStep,
    stepName: STEP_NAMES[state.tutorialStep] || '',
  };
}

async function fillNamingIfOpen(page) {
  const state = await getState(page);
  if (!state.naming?.visible) return null;
  if (!String(state.naming.inputValue || '').trim()) {
    await writeSnapshot(page, `naming-before-fill-step-${state.tutorialStep}`, state);
    await page.evaluate(() => {
      const game = window.Game;
      const shell = game?.canvasShell;
      const view = shell?.naming?.view || game?.naming?.view || shell?.naming?.prompt || game?.naming?.prompt || {};
      const value = view?.type === 'polity' ? 'Fireseed' : 'Riverbend';
      if (shell?.naming) shell.naming.inputValue = value;
      if (game?.naming) game.naming.inputValue = value;
      shell?.renderActive?.();
    });
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
    await waitForRender(page, 700);
    return { label: `wait-intro-${introStep}`, action: { type: 'wait', introStep }, step: state.tutorialStep };
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

  const allowed = state.tutorialHighlight?.allowedAction || null;
  if (allowed?.type) {
    const target = findTarget(state, (action) => actionMatches(allowed, action))
      || findTarget(state, (action) => action.type === allowed.type && !action.disabled);
    if (target) return clickTarget(page, `highlight-${allowed.type}-${iteration}`, state, target);
  }

  const step = state.tutorialStep;
  if (step === 3 || step === 8 || step === 14) {
    const buildingId = step === 3 ? 'house' : (step === 8 ? 'farm' : 'lumbermill');
    return clickByPredicate(page, `build-${buildingId}-${iteration}`, (action) => (
      action.type === 'buildBuilding' && action.buildingId === buildingId && !action.disabled
    ));
  }
  if (step === 4 || step === 10 || step === 16) {
    return clickByPredicate(page, `open-civilization-${iteration}`, (action) => (
      action.type === 'openCommandPanel' && action.panel === 'civilization' && !action.disabled
    ));
  }
  if (step === 5 || step === 11 || step === 17) {
    return clickByPredicate(page, `advance-era-${iteration}`, (action) => action.type === 'advanceEra' && !action.disabled);
  }
  if (step === 6 || step === 15) {
    return clickByPredicate(page, `open-task-center-${iteration}`, (action) => action.type === 'openTaskCenter' && !action.disabled);
  }
  if (step === 7) {
    return clickByPredicate(page, `claim-first-task-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_first_supplies' && !action.disabled
    ));
  }
  if (step === 12) {
    return clickByPredicate(page, `open-events-${iteration}`, (action) => (
      action.type === 'openCommandPanel' && action.panel === 'events' && !action.disabled
    ));
  }
  if (step === 13 && !state.activeEventId) {
    return clickByPredicate(page, `open-forest-event-${iteration}`, (action) => (
      action.type === 'openEvent' && !action.disabled
    ));
  }
  if (step === 13 && state.activeEventId) {
    return clickByPredicate(page, `claim-forest-event-${iteration}`, (action) => (
      action.type === 'claimEvent' && !action.disabled
    ));
  }
  if (step === 16 && state.taskCenterOpen) {
    return clickByPredicate(page, `claim-lumber-task-${iteration}`, (action) => (
      action.type === 'claimTaskReward' && action.taskId === 'main_lumbermill_supplies' && !action.disabled
    ));
  }
  if (step === 18) {
    return clickByPredicate(page, `open-famous-${iteration}`, (action) => action.type === 'openFamousPersons' && !action.disabled);
  }
  if (step === 19) {
    return clickByPredicate(page, `open-famous-detail-${iteration}`, (action) => action.type === 'openFamousPersonDetail' && !action.disabled);
  }
  if (step === 20 && state.selectedFamousPersonId) {
    return clickByPredicate(page, `close-famous-detail-${iteration}`, (action) => action.type === 'closeFamousPersonDetail' && !action.disabled);
  }
  if (step === 20 && state.showFamousPersons) {
    return clickByPredicate(page, `close-famous-${iteration}`, (action) => action.type === 'closeFamousPersons' && !action.disabled);
  }
  if (step === 20 && !state.cityManagementOpen) {
    return clickByPredicate(page, `open-capital-for-formation-${iteration}`, (action) => (
      action.type === 'openWorldSite' && (!action.siteId || action.siteId === 'capital') && !action.disabled
    ));
  }
  if (step === 20 && state.cityManagementOpen && state.activeCityManagementTab !== 'military') {
    return clickByPredicate(page, `switch-city-military-${iteration}`, (action) => (
      action.type === 'switchCityManagementTab' && action.tab === 'military' && !action.disabled
    ));
  }
  if (step === 20 && state.cityManagementOpen) {
    return clickByPredicate(page, `open-army-formation-${iteration}`, (action) => (
      action.type === 'openArmyFormation' && !action.disabled
    ));
  }
  if (step === 21 && state.armyFormationEditor?.open) {
    const memberTarget = findTarget(state, (action) => action.type === 'toggleArmyFormationMember' && !action.disabled);
    if (memberTarget) return clickTarget(page, `toggle-formation-member-${iteration}`, state, memberTarget);
    return clickByPredicate(page, `save-army-formation-${iteration}`, (action) => action.type === 'saveArmyFormation' && !action.disabled);
  }
  if (step === 22) {
    const mapTarget = findTarget(state, (action) => action.type === 'selectWorldMarchTarget' && !action.disabled);
    if (mapTarget) return clickTarget(page, `select-world-march-target-${iteration}`, state, mapTarget);
    await page.evaluate(() => window.Game?.tutorialController?.ensureMapHomeGuideVisible?.({ clearWorldMarchTarget: true }));
    await waitForRender(page, 500);
    return { label: 'force-map-home-for-world-march', action: { type: 'forceMapHome' }, step };
  }
  if (step === 23 && !state.territoryUiState?.worldMarchTarget?.pickerOpen) {
    return clickByPredicate(page, `open-world-march-picker-${iteration}`, (action) => (
      action.type === 'openWorldMarchFormationPicker' && !action.disabled
    ));
  }
  if (step === 23 && state.territoryUiState?.worldMarchTarget?.pickerOpen) {
    return clickByPredicate(page, `start-world-march-${iteration}`, (action) => (
      action.type === 'startWorldMarch' && !action.disabled
    ));
  }
  if (step === 24) {
    const readyMission = state.stateSummary?.worldExplorerState?.readyMissions?.[0] || null;
    if (readyMission) {
      return clickByPredicate(page, `claim-explore-${iteration}`, (action) => (
        action.type === 'claimExplore' && (!action.missionId || action.missionId === readyMission.id) && !action.disabled
      ));
    }
    await waitForRender(page, 2000);
    return { label: `wait-explore-${iteration}`, action: { type: 'waitExplore' }, step };
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
  await page.addInitScript(({ token, username }) => {
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
  }, { token: login.token, username: CONFIG.username });

  await page.goto(normalizeUrl(CONFIG.gameUrl), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.Game && window.Game.canvasShell), null, { timeout: 45000 });
  await page.waitForTimeout(9000);
  await writeSnapshot(page, '00-start');

  const actions = [];
  let stopReason = '';
  for (let index = 1; index <= CONFIG.maxActions; index += 1) {
    const state = await getState(page);
    if (state.tutorialCompleted || state.tutorialStep >= 36) {
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
  await writeSnapshot(page, 'zz-final', finalState, { actions, stopReason, actionEvidence, visualFindings });
  const summary = {
    outputDir: outDir,
    gameUrl: CONFIG.gameUrl,
    apiBase: CONFIG.apiBase,
    stopReason,
    finalStep: finalState.tutorialStep,
    finalStepName: STEP_NAMES[finalState.tutorialStep] || '',
    tutorialCompleted: finalState.tutorialCompleted,
    actionCount: actions.length,
    evidenceCount: actionEvidence.length,
    visualFindings,
    badResponses,
    requestFailures,
    pageErrors,
    eventCount: events.length,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify({
    ...summary,
    actions,
    actionEvidence,
  }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'fatal-error.txt'), error.stack || error.message);
  console.error(error.stack || error.message);
  process.exit(1);
});
