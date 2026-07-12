const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TutorialGuideTargetResolver = require('./TutorialGuideTargetResolver');
const TutorialGuideController = require('./TutorialGuideController');
const taskPanelStepScripts = require('../tutorial-config/TaskPanelStepScripts');

function attachTutorialController(host) {
  const controller = new TutorialGuideController({ game: host.game });
  host.game.tutorialController = controller;
  return controller;
}

const S2_HIGHLIGHT_PANEL_EXPECTATIONS = Object.freeze({
  advanceEra: '',
  buildBuilding: '',
  claimConquest: '',
  claimEvent: '',
  claimTaskReward: '',
  closeFamousPersonDetail: 'famousPersons',
  closeFamousPersons: 'famousPersons',
  openArmyFormation: '',
  openCommandPanel: '',
  openEvent: '',
  openFamousPersons: '',
  openTaskCenter: '',
  openWorldMarchFormationPicker: '',
  seekFamousPerson: 'famousPersons',
  selectWorldMarchTarget: '',
  startWorldMarch: '',
  switchCityManagementTab: '',
});

test('legacy and StepScript highlights have an explicit panel coverage decision for every type', () => {
  const inventory = require('../../../docs/architecture/artifacts/northstar-s2-tutorial-rule-inventory.json');
  const legacyHighlightTypes = inventory.flowRules
    .filter((rule) => rule.kind.startsWith('highlight:'))
    .map((rule) => rule.kind.slice('highlight:'.length));
  const stepScriptTargets = Object.values(taskPanelStepScripts).flatMap((script) => (
    Array.isArray(script.clauses) ? script.clauses : [script]
  )).map((entry) => String(entry.target || '').split(':')[0]).filter(Boolean);
  const highlightTypes = [...new Set([...legacyHighlightTypes, ...stepScriptTargets])].sort();
  assert.deepEqual(Object.keys(S2_HIGHLIGHT_PANEL_EXPECTATIONS).sort(), highlightTypes);
  const panelTable = TutorialGuideTargetResolver.MODAL_TARGET_PANEL_BY_ACTION_TYPE;
  Object.entries(S2_HIGHLIGHT_PANEL_EXPECTATIONS).forEach(([type, panelKey]) => {
    assert.equal(panelTable[type] || '', panelKey, `${type} panel coverage drift`);
  });
  assert.equal(panelTable.assignFamousAttributePoint, 'famousPersons');
});

test('resolveTarget declares hitTarget, worldSiteAnchor, and softGuideId kinds', () => {
  const kinds = TutorialGuideTargetResolver.TARGET_RESOLVER_KINDS;
  let anchorTick = 0;
  const resolver = new TutorialGuideTargetResolver({
    context: {
      queryCanvasTarget(type) {
        return type === 'openTaskCenter' ? { action: { type } } : null;
      },
      resolveWorldSiteAnchorTarget() {
        anchorTick += 1;
        return { available: true, target: anchorTick === 1 ? { frame: 1 } : null };
      },
    },
  });

  assert.equal(resolver.resolveTarget({ kind: kinds.HIT_TARGET, type: 'openTaskCenter' }).target.action.type, 'openTaskCenter');
  assert.deepEqual(resolver.resolveTarget({ kind: kinds.WORLD_SITE_ANCHOR, siteId: 'capital' }), {
    kind: 'worldSiteAnchor',
    available: true,
    target: { frame: 1 },
  });
  assert.deepEqual(resolver.resolveTarget({ kind: kinds.WORLD_SITE_ANCHOR, siteId: 'capital' }), {
    kind: 'worldSiteAnchor',
    available: true,
    target: null,
  });
  assert.deepEqual(resolver.resolveTarget({ kind: kinds.SOFT_GUIDE_ID, id: 'task-center-main-claim' }).target.action, {
    type: 'openTaskCenter',
    tab: 'main',
    source: 'advisor',
  });
});

test('softGuideId resolver preserves legacy advisor navigation without DOM id branches in CanvasGameApp', () => {
  assert.deepEqual(TutorialGuideTargetResolver.resolveSoftGuideId('btn-advance-era'), {
    kind: 'tab', id: 'btn-advance-era', tabId: 'civilization',
  });
  assert.deepEqual(TutorialGuideTargetResolver.resolveSoftGuideId('card-house'), {
    kind: 'tab', id: 'card-house', tabId: 'buildings',
  });
  assert.deepEqual(TutorialGuideTargetResolver.resolveSoftGuideId('scout-action-first'), {
    kind: 'guideTask',
    id: 'scout-action-first',
    nextAction: { type: 'switchMilitaryView', view: 'scout' },
  });
  const appSource = fs.readFileSync(path.resolve(__dirname, '../platform/CanvasGameApp.js'), 'utf8');
  assert.doesNotMatch(appSource, /getFallbackGuideTarget\s*\(/);
  assert.doesNotMatch(appSource, /target\s*===\s*['"](?:task-center-button|scout-action-first)['"]/);
});

test('TutorialGuideTargetResolver retries target lookup after render and shows highlight', () => {
  const calls = [];
  let rendered = false;
  const shell = {
    getCanvasTarget(type, predicate) {
      calls.push(['getCanvasTarget', type]);
      if (!rendered) return null;
      const action = { type: 'buildBuilding', buildingId: 'house' };
      if (predicate && !predicate(action)) return null;
      return { x: 10, y: 20, width: 100, height: 30 };
    },
    showTutorialHighlight(target, message, options) {
      calls.push(['showTutorialHighlight', message, options]);
      return true;
    },
  };
  const host = {
    game: {
      state: { currentTab: 'buildings' },
      canvasShell: shell,
      renderCanvasSurface(tab) {
        calls.push(['renderCanvasSurface', tab]);
        rendered = true;
      },
    },
  };
  const controller = attachTutorialController(host);
  const resolver = new TutorialGuideTargetResolver({ host: controller });

  assert.equal(resolver.showHighlight(
    'buildBuilding',
    (action) => action.buildingId === 'house',
    'build a house',
    { type: 'buildBuilding', buildingId: 'house' },
  ), true);
  assert.deepEqual(calls.map((call) => call[0]), [
    'getCanvasTarget',
    'renderCanvasSurface',
    'getCanvasTarget',
    'showTutorialHighlight',
  ]);
  assert.equal(calls.at(-1)[2].allowedAction.buildingId, 'house');
  assert.equal(controller.retryingHighlightAfterRender, false);
});

test('TutorialGuideTargetResolver reprojects modal targets without rendering the base surface', () => {
  const calls = [];
  let modalProjected = false;
  const shell = {
    getCanvasTarget(type, predicate) {
      calls.push(['getCanvasTarget', type]);
      if (!modalProjected) return null;
      const action = { type: 'seekFamousPerson' };
      if (predicate && !predicate(action)) return null;
      return { x: 280, y: 210, width: 72, height: 30, action };
    },
    getPanelSurfaceManager() {
      return {
        projectModalLayer(options) {
          calls.push(['projectModalLayer', options.requestedPanelKey, options.source]);
          modalProjected = true;
          return true;
        },
      };
    },
    showTutorialHighlight(target, message, options) {
      calls.push(['showTutorialHighlight', message, options.allowedAction.type, target.action.type]);
      return true;
    },
  };
  const host = {
    game: {
      state: { currentTab: 'military' },
      canvasShell: shell,
      renderCanvasSurface() {
        calls.push(['renderCanvasSurface']);
      },
    },
  };
  const controller = attachTutorialController(host);
  const resolver = new TutorialGuideTargetResolver({ host: controller });

  assert.equal(resolver.showHighlight(
    'seekFamousPerson',
    (action) => action.type === 'seekFamousPerson',
    'seek famous',
    { type: 'seekFamousPerson' },
  ), true);
  assert.deepEqual(calls, [
    ['getCanvasTarget', 'seekFamousPerson'],
    ['projectModalLayer', 'famousPersons', 'tutorialTargetResolver'],
    ['getCanvasTarget', 'seekFamousPerson'],
    ['showTutorialHighlight', 'seek famous', 'seekFamousPerson', 'seekFamousPerson'],
  ]);
  assert.equal(controller.retryingHighlightAfterRender, false);
});

test('TutorialGuideTargetResolver hides stale highlight when target is unavailable', () => {
  const calls = [];
  const resolver = new TutorialGuideTargetResolver({
    host: attachTutorialController({
      game: {
        canvasShell: {
          getCanvasTarget() {
            return null;
          },
          hideTutorialHighlight() {
            calls.push('hideTutorialHighlight');
          },
        },
      },
    }),
  });

  assert.equal(resolver.showHighlight('missing', null, 'missing', { type: 'missing' }), false);
  assert.deepEqual(calls, ['hideTutorialHighlight']);
});

test('TutorialGuideTargetResolver rejects visualDisabled command highlight targets', () => {
  const calls = [];
  const action = { type: 'claimTaskReward', taskId: 'task-1', visualDisabled: true };
  const shell = {
    getCanvasTarget(type, predicate) {
      calls.push(['getCanvasTarget', type]);
      return predicate(action) ? { x: 10, y: 20, width: 100, height: 30, action } : null;
    },
    hideTutorialHighlight() {
      calls.push(['hideTutorialHighlight']);
    },
  };
  const resolver = new TutorialGuideTargetResolver({
    host: attachTutorialController({
      game: {
        canvasShell: shell,
        renderCanvasSurface() {
          calls.push(['renderCanvasSurface']);
        },
      },
    }),
  });

  assert.equal(resolver.showHighlight(
    'claimTaskReward',
    (candidate) => candidate.taskId === 'task-1',
    'claim reward',
    { type: 'claimTaskReward', taskId: 'task-1' },
  ), false);
  assert.equal(calls.some(([name]) => name === 'hideTutorialHighlight'), true);
});

test('TutorialGuideTargetResolver normalizes rects and checks viewport visibility', () => {
  const resolver = new TutorialGuideTargetResolver({
    host: attachTutorialController({
      game: {
        canvasShell: {
          runtime: { width: 200, height: 100 },
        },
      },
    }),
  });

  assert.deepEqual(resolver.getCanvasTargetRect({ x: 10, y: 20, width: 30, height: 40 }), {
    left: 10,
    top: 20,
    width: 30,
    height: 40,
    right: 40,
    bottom: 60,
  });
  assert.equal(resolver.isCanvasTargetVisible({ x: 10, y: 20, width: 30, height: 40 }), true);
  assert.equal(resolver.isCanvasTargetVisible({ x: -30, y: 20, width: 20, height: 40 }), false);
  assert.equal(resolver.getCanvasTargetRect({ x: 10, y: 20, width: 0, height: 40 }), null);
});

test('TutorialGuideTargetResolver shows open-world-site highlight only for visible matching targets', () => {
  const calls = [];
  const shell = {
    runtime: { width: 320, height: 240 },
    getCanvasTarget(type, predicate) {
      const action = { type: 'openWorldSite', siteId: 'city-1' };
      if (type !== 'openWorldSite' || !predicate(action)) return null;
      return { x: 100, y: 80, width: 40, height: 40 };
    },
    showTutorialHighlight(target, message, options) {
      calls.push({ target, message, options });
      return true;
    },
  };
  const resolver = new TutorialGuideTargetResolver({
    host: attachTutorialController({ game: { canvasShell: shell } }),
  });

  assert.equal(resolver.showOpenWorldSiteHighlight({
    siteId: 'city-1',
    message: 'open city',
  }), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.allowedAction, { type: 'openWorldSite', siteId: 'city-1' });
});

test('TutorialGuideTargetResolver prefers live world-site anchors over stale hit targets', () => {
  const calls = [];
  const shell = {
    runtime: { width: 320, height: 240 },
    worldMapRuntime: {
      getLastTileMapContext() {
        return { fresh: true };
      },
    },
    worldMapRenderer: {
      getWorldSiteCanvasAnchor(siteId, state, options) {
        calls.push(['anchor', siteId, Boolean(options.worldMapRuntimeContext)]);
        return {
          hitRect: { x: 140, y: 92, width: 48, height: 40 },
          site: { id: siteId },
          tile: { id: 'tile_live' },
        };
      },
    },
    getCanvasTarget(type, predicate) {
      const action = { type: 'openWorldSite', siteId: 'city-1' };
      if (type !== 'openWorldSite' || !predicate(action)) return null;
      return { x: 12, y: 16, width: 40, height: 40, action };
    },
    showTutorialHighlight(target, message, options) {
      calls.push({ target, message, options });
      return true;
    },
  };
  const resolver = new TutorialGuideTargetResolver({
    host: attachTutorialController({
      game: {
        state: { territoryState: { worldMap: { tiles: [] } } },
        canvasShell: shell,
      },
    }),
  });

  assert.equal(resolver.showOpenWorldSiteHighlight({
    siteId: 'city-1',
    message: 'open city',
  }), true);

  const highlightCall = calls.find((call) => call.target);
  assert.deepEqual(highlightCall.target.getRect(), {
    left: 140,
    top: 92,
    width: 48,
    height: 40,
    right: 188,
    bottom: 132,
  });
  assert.deepEqual(highlightCall.options.locator, { type: 'worldSite', siteId: 'city-1' });
  assert.equal(highlightCall.options.targetAction.tileId, 'tile_live');
});

test('TutorialGuideTargetResolver does not fall back to hit targets when live anchor context is unavailable', () => {
  const calls = [];
  const shell = {
    runtime: { width: 320, height: 240 },
    worldMapRenderer: {
      getWorldSiteCanvasAnchor() {
        calls.push(['anchor']);
        return null;
      },
    },
    getCanvasTarget(type, predicate) {
      calls.push(['hitTarget', type]);
      const action = { type: 'openWorldSite', siteId: 'city-1' };
      if (type !== 'openWorldSite' || !predicate(action)) return null;
      return { x: 12, y: 16, width: 40, height: 40, action };
    },
    hideTutorialHighlight() {
      calls.push(['hideTutorialHighlight']);
    },
    showTutorialHighlight() {
      calls.push(['showTutorialHighlight']);
      return true;
    },
  };
  const resolver = new TutorialGuideTargetResolver({
    host: attachTutorialController({ game: { state: {}, canvasShell: shell } }),
  });

  assert.equal(resolver.showOpenWorldSiteHighlight({ siteId: 'city-1' }), false);
  assert.deepEqual(calls, [['hideTutorialHighlight']]);
});
