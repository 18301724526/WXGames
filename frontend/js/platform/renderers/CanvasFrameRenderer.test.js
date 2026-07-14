const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasFrameRenderer = require('./CanvasFrameRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const calls = [];
  const host = {
    calls,
    width: 390,
    height: 844,
    bottomSafeArea: 12,
    presenter: {
      buildTechViewState(input) {
        calls.push(['buildTechViewState', input]);
        return { detail: { id: input.selectedTechId || input.techUiState?.selectedTechId || 'tech-1' } };
      },
      buildMilitaryViewState(input) {
        calls.push(['buildMilitaryViewState', input]);
        return {
          formations: [
            { slot: 1, name: '第一队', isEmpty: false },
            { slot: 2, name: '第二队', isEmpty: false },
            { slot: 3, name: '侦察队', isEmpty: false },
          ],
        };
      },
    },
    beginFrame(options) { calls.push(['beginFrame', options]); },
    clear() { calls.push(['clear']); },
    appendWorldMapRuntimeHitTargets(targets = []) {
      calls.push(['appendWorldMapRuntimeHitTargets', [targets]]);
      return Array.isArray(targets) && targets.length > 0;
    },
    collectMapHomeWorldSiteHitTargets(...args) { calls.push(['collectMapHomeWorldSiteHitTargets', args]); },
    getWorldMapLayerLayout() {
      calls.push(['getWorldMapLayerLayout']);
      return { map: { x: 0, y: 96, width: 390, height: 684 } };
    },
    addHitTarget(...args) { calls.push(['addHitTarget', args]); },
    drawButton(...args) { calls.push(['drawButton', args]); },
    drawAsset(...args) { calls.push(['drawAsset', args]); return false; },
    drawPanel(...args) { calls.push(['drawPanel', args]); },
    drawText(...args) { calls.push(['drawText', args]); },
    truncateText(text) { return String(text || ''); },
    ctx: {
      fillRect(...args) { calls.push(['fillRect', args]); },
      fillStyle: '',
    },
    endFrame(options) { calls.push(['endFrame', options]); },
    getTransitionFrame(transition) {
      calls.push(['getTransitionFrame', transition]);
      return transition?.frame || null;
    },
    renderArmyFormationEditor(...args) { calls.push(['renderArmyFormationEditor', args]); },
    renderBattleSceneOverlay(...args) { calls.push(['renderBattleSceneOverlay', args]); },
    renderCityManagementPanel(...args) { calls.push(['renderCityManagementPanel', args]); },
    renderCitySwitcherMenu(...args) { calls.push(['renderCitySwitcherMenu', args]); },
    renderConfirmDialog(...args) { calls.push(['renderConfirmDialog', args]); },
    renderEventModal(...args) { calls.push(['renderEventModal', args]); },
    renderFamousPersonsPanel(...args) { calls.push(['renderFamousPersonsPanel', args]); },
    renderFloatingAccountButton(...args) { calls.push(['renderFloatingAccountButton', args]); },
    renderFloatingEventButton(...args) { calls.push(['renderFloatingEventButton', args]); },
    renderFloatingSubcityButton(...args) { calls.push(['renderFloatingSubcityButton', args]); },
    renderFloatingTexts(...args) { calls.push(['renderFloatingTexts', args]); },
    renderHudOverlay(...args) { calls.push(['renderHudOverlay', args]); },
    renderLoadingScreen(...args) { calls.push(['renderLoadingScreen', args]); },
    renderLoginPanel(...args) { calls.push(['renderLoginPanel', args]); },
    renderEntityBattleOverlay(...args) { calls.push(['renderEntityBattleOverlay', args]); },
    renderMainPanel(...args) { calls.push(['renderMainPanel', args]); },
    renderMapCommandPanel(...args) { calls.push(['renderMapCommandPanel', args]); },
    renderMapHomeWorldView(...args) { calls.push(['renderMapHomeWorldView', args]); },
    renderNamingModal(...args) { calls.push(['renderNamingModal', args]); },
    renderNetworkOverlay(...args) { calls.push(['renderNetworkOverlay', args]); },
    renderPopulation(...args) { calls.push(['renderPopulation', args]); return 180; },
    renderResourceDetailsPanel(...args) { calls.push(['renderResourceDetailsPanel', args]); },
    renderRewardReveal(...args) { calls.push(['renderRewardReveal', args]); },
    renderSettingsPanel(...args) { calls.push(['renderSettingsPanel', args]); },
    renderSubcityListPanel(...args) { calls.push(['renderSubcityListPanel', args]); },
    renderTabs(...args) { calls.push(['renderTabs', args]); },
    renderTaskCenterPanel(...args) { calls.push(['renderTaskCenterPanel', args]); },
    renderTechDetailModal(...args) { calls.push(['renderTechDetailModal', args]); },
    renderTopBar(...args) { calls.push(['renderTopBar', args]); return 96; },
    renderWorldMarchHud(...args) { calls.push(['renderWorldMarchHud', args]); },
    renderWorldSiteModal(...args) { calls.push(['renderWorldSiteModal', args]); },
    setHitTargets(targets) { calls.push(['setHitTargets', targets]); },
    withSlideClip(...args) {
      calls.push(['withSlideClip', args.slice(0, 5)]);
      args[5]?.();
    },
    withSuppressedHitTargets(callback) {
      calls.push(['withSuppressedHitTargets']);
      callback?.();
    },
    ...overrides,
  };
  return host;
}

function callNames(host) {
  return host.calls.map((call) => call[0]);
}

test('CanvasFrameRenderer delegates hud mode to hud overlay without clearing normal frame', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });
  const options = { mode: 'hud', activeTab: 'tech' };

  renderer.render({ resources: {} }, options);

  assert.deepEqual(callNames(host), ['renderHudOverlay']);
  assert.deepEqual(host.calls[0][1], [{ resources: {} }, options]);
});

[
  {
    name: 'login',
    options: { auth: { view: { loginPanelVisible: true } } },
    renderCall: 'renderLoginPanel',
  },
  {
    name: 'loading',
    options: { loading: { visible: true } },
    renderCall: 'renderLoadingScreen',
  },
  {
    name: 'entity battle',
    options: { entityBattle: { visible: true } },
    renderCall: 'renderEntityBattleOverlay',
  },
  {
    name: 'battle scene',
    options: { battleScene: { visible: true } },
    renderCall: 'renderBattleSceneOverlay',
  },
].forEach((scenario) => {
  test(`CanvasFrameRenderer preserves the ${scenario.name} early return`, () => {
    const host = createHost();

    new CanvasFrameRenderer({ host }).render({}, scenario.options);

    assert.deepEqual(callNames(host), [
      'beginFrame',
      'setHitTargets',
      'clear',
      scenario.renderCall,
      'endFrame',
    ]);
  });
});

test('CanvasFrameRenderer preserves map-home military frame overlay sequence', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });
  const options = {
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
    worldMapRuntimeHitTargets: [
      { x: 10, y: 20, width: 30, height: 40, action: { type: 'openWorldSite', siteId: 'site_2_2' } },
    ],
    activeCommandPanel: 'capital',
    showSubcityList: true,
    showSettings: true,
    territoryUiState: {
      worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0', pickerOpen: true },
    },
    worldMapRuntimeContext: {
      actors: [{ id: 'scout-1' }],
      frame: { x: 1, y: 96, width: 388, height: 684 },
      geometry: { tileWidth: 192, tileHeight: 96 },
      viewport: { originX: 195, originY: 360, scale: 0.78 },
    },
    floatingTexts: [{ text: '+1' }],
    rewardReveal: { rewardText: '+1' },
    network: { status: 'ok' },
  };

  renderer.render({ territoryState: {} }, options);

  const names = callNames(host);
  assert.equal(names.includes('appendWorldMapRuntimeHitTargets'), true);
  assert.equal(names.includes('collectMapHomeWorldSiteHitTargets'), true);
  assert.equal(names.includes('renderWorldMarchHud'), true);
  assert.equal(names.includes('getWorldMapLayerLayout'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addHitTarget' && call[1][1].type === 'startExplore'), false);
  assert.equal(host.calls.some((call) => call[0] === 'collectMapHomeWorldSiteHitTargets' && call[1][2].collectHitTargets === false), true);
  assert.equal(names.includes('renderMapCommandPanel'), true);
  assert.equal(names.includes('renderSubcityListPanel'), true);
  assert.equal(names.includes('renderSettingsPanel'), true);
  assert.equal(names.includes('renderFloatingAccountButton'), true);
  assert.equal(names.at(-1), 'endFrame');
});

test('CanvasFrameRenderer renders dynamic world HUD on the main HUD frame', () => {
  const staleContext = {
    actors: [{ id: 'stale-scout' }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const freshContext = {
    actors: [{ id: 'fresh-scout' }],
    frame: { x: 2, y: 97, width: 386, height: 682 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    viewport: { originX: 196, originY: 361, scale: 0.78 },
  };
  const host = createHost({
    collectMapHomeWorldSiteHitTargets(...args) {
      this.calls.push(['collectMapHomeWorldSiteHitTargets', args]);
      this.lastMapHomeWorldHudContext = freshContext;
    },
  });
  const renderer = new CanvasFrameRenderer({ host });

  renderer.render({ territoryState: {} }, {
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
    territoryUiState: {},
    worldMapRuntimeContext: staleContext,
  });

  assert.equal(host.calls.some((call) => call[0] === 'collectMapHomeWorldSiteHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), true);
});

test('CanvasFrameRenderer renders selected actor commands on the screen HUD layer', () => {
  const staleContext = {
    actors: [{ id: 'stale-scout' }],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    viewport: { originX: 195, originY: 360, scale: 0.78 },
  };
  const runtimeContext = {
    actors: [{ id: 'fresh-scout', missionId: 'explore-active-1' }],
    frame: { x: 2, y: 97, width: 386, height: 682 },
    geometry: { tileWidth: 192, tileHeight: 96 },
    viewport: { originX: 196, originY: 361, scale: 0.78 },
  };
  const host = createHost({
    lastMapHomeWorldHudContext: staleContext,
  });
  const renderer = new CanvasFrameRenderer({ host });

  renderer.render({ territoryState: {} }, {
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
    territoryUiState: { selectedWorldActorId: 'explore-active-1' },
    worldMapRuntimeContext: runtimeContext,
  });

  assert.equal(host.calls.some((call) => call[0] === 'collectMapHomeWorldSiteHitTargets'), true);
  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), true);
});

test('CanvasFrameRenderer can derive dynamic actor commands on the screen HUD layer', () => {
  const emptyContext = {
    actors: [],
    frame: { x: 1, y: 96, width: 388, height: 684 },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
    viewport: { originX: 195, originY: 360, scale: 0.78, panX: 0, panY: 0 },
  };
  const host = createHost({
    lastMapHomeWorldHudContext: emptyContext,
  });
  const renderer = new CanvasFrameRenderer({ host });
  const state = {
    territoryState: {},
    worldExplorerState: {
      activeMission: {
        id: 'explore-active-1',
        status: 'active',
        origin: { q: 0, r: 0, tileId: 'tile_0_0' },
        route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false }],
        target: { q: 1, r: 0, tileId: 'tile_1_0' },
        startedAt: '2026-06-06T00:00:00.000Z',
        stepDurationSeconds: 10,
        formation: { cityId: 'capital', slot: 1, label: 'Scout A' },
      },
    },
  };

  renderer.render(state, {
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
    territoryUiState: { selectedWorldActorId: 'explore-active-1' },
  });

  assert.equal(host.calls.some((call) => call[0] === 'renderWorldMarchHud'), true);
});

test('CanvasFrameRenderer preserves standard tab transition and modal overlays', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });
  const options = {
    activeTab: 'tech',
    pageTransition: {
      fromTab: 'buildings',
      toTab: 'tech',
      fromBuildingOffset: 24,
      frame: { direction: 1, eased: 0.4 },
    },
    showResourceDetails: true,
    showCitySwitcher: true,
    showTaskCenter: true,
    showFamousPersons: true,
    armyFormationEditor: { open: true },
    activeEventId: 'event-1',
    techDetailOpen: true,
    selectedTechId: 'fire',
    naming: { visible: true },
  };

  renderer.render({ techUiState: { detailOpen: true } }, options);

  const names = callNames(host);
  assert.equal(names.filter((name) => name === 'withSlideClip').length, 2);
  assert.equal(names.includes('withSuppressedHitTargets'), true);
  assert.equal(names.includes('renderResourceDetailsPanel'), true);
  assert.equal(names.includes('renderFamousPersonsPanel'), false);
  assert.equal(names.includes('renderTechDetailModal'), true);
  assert.equal(names.includes('renderNamingModal'), true);
  assert.equal(names.at(-1), 'endFrame');
});

test('CanvasFrameRenderer keeps resources page out of city people ownership', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });

  renderer.render({ resources: {} }, { activeTab: 'resources' });

  const names = callNames(host);
  assert.equal(names.includes('renderPopulation'), false);
  assert.equal(names.includes('renderHomeFeatureGrid'), false);
  assert.equal(names.includes('renderMainPanel'), false);
});

test('CanvasFrameRenderer preserves map-home overlay toggles as a separate facade target', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });

  renderer.renderMapHomeOverlays({}, {
    activeCommandPanel: 'capital',
    showCityManagement: true,
    activeEventId: 'event-1',
    naming: { visible: true },
  });

  const names = callNames(host);
  assert.equal(names.includes('renderFloatingSubcityButton'), true);
  assert.equal(names.includes('renderFloatingEventButton'), true);
  assert.equal(names.includes('renderFloatingAccountButton'), true);
  assert.equal(names.includes('renderCityManagementPanel'), true);
  assert.equal(names.includes('renderWorldSiteModal'), true);
  assert.equal(names.includes('renderNamingModal'), true);
});

function createActiveExplorerState() {
  return {
    worldExplorerState: {
      activeMission: {
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        nextStepAt: '2026-06-06T00:00:10.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        stepDurationSeconds: 10,
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: true },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
      },
    },
  };
}

test('CanvasFrameRenderer squad quick panel consumes the presenter projection only', () => {
  const activeHost = createHost({
    epochNowMs: new Date('2026-06-06T00:00:04.250Z').getTime(),
    presenter: {
      buildSquadQuickPanelViewState() {
        return {
          hidden: false,
          rows: [
            { slot: 1, cityId: 'capital', name: '第一队', memberCount: 3, marching: false, action: { type: 'openArmyFormation', cityId: 'capital', slot: 1, source: 'squadQuickPanel' } },
            { slot: 3, cityId: 'capital', name: '侦察队', memberCount: 1, marching: true, action: { type: 'openArmyFormation', cityId: 'capital', slot: 3, source: 'squadQuickPanel' } },
          ],
        };
      },
    },
  });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud(createActiveExplorerState(), 96, {});

  // Only presenter rows render: slot 2 was projected away (empty formation).
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '第一队'), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '侦察队'), true);
  const rowTargets = activeHost.calls
    .filter((call) => call[0] === 'addHitTarget' && call[1][1]?.type === 'openArmyFormation');
  assert.equal(rowTargets.length, 2);
  assert.deepEqual(rowTargets.map((call) => call[1][1].slot), [1, 3]);
  assert.equal(rowTargets.every((call) => call[1][1].source === 'squadQuickPanel'), true);
  // Crest chips request the squad crest asset per row slot.
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawAsset' && call[1][0].includes('hud-squad-crest-1')), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawAsset' && call[1][0].includes('hud-squad-crest-3')), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawAsset' && call[1][0].includes('hud-squad-crest-2')), false);
  // Rows never clip off the left canvas edge (device regression).
  const rowRects = rowTargets.map((call) => call[1][0]);
  assert.equal(rowRects.every((rect) => rect.x >= 8), true);
});

test('CanvasFrameRenderer hides the squad quick panel when the projection is empty', () => {
  const activeHost = createHost({
    presenter: {
      buildSquadQuickPanelViewState() {
        return { hidden: true, rows: [] };
      },
    },
  });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud({}, 96, {});

  assert.equal(activeHost.calls.some((call) => call[0] === 'addHitTarget' && call[1][1]?.type === 'openArmyFormation'), false);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '第一队'), false);
});

test('CanvasFrameRenderer explore chip shows progress while a mission is active', () => {
  const activeHost = createHost({
    epochNowMs: new Date('2026-06-06T00:00:04.250Z').getTime(),
    presenter: { buildSquadQuickPanelViewState() { return { hidden: true, rows: [] }; } },
  });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud(createActiveExplorerState(), 96, {});

  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && String(call[1][0]).includes('探索中')), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '回到本城'), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'addHitTarget' && call[1][1].type === 'resetWorldPan'), true);
  // The redesigned chip has no countdown text -- just the thin progress line.
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && String(call[1][0]).endsWith('s') && /^\d+s$/.test(String(call[1][0]))), false);
});

test('CanvasFrameRenderer treats expired manual active mission as idle in explorer HUD', () => {
  const activeHost = createHost({
    epochNowMs: new Date('2026-06-06T00:00:25.000Z').getTime(),
    presenter: { buildSquadQuickPanelViewState() { return { hidden: true, rows: [] }; } },
  });
  const state = createActiveExplorerState();
  delete state.worldExplorerState.activeMission.nextStepAt;
  state.worldExplorerState.activeMission.id = 'manual-1';
  state.worldExplorerState.activeMission.route.forEach((step) => { step.revealed = false; });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud(state, 96, {});

  // Mission expired -> no explore progress chip, but back-to-city stays.
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && String(call[1][0]).includes('探索中')), false);
  assert.equal(activeHost.calls.some((call) => call[0] === 'addHitTarget' && call[1][1].type === 'resetWorldPan'), true);
});

test('CanvasGameRenderer exposes root frame rendering through facade', () => {
  class StubFrameRenderer {
    constructor(options) {
      this.host = options.host;
    }

    render(...args) {
      return { method: 'render', host: this.host, args };
    }

    renderMapHomeOverlays(...args) {
      return { method: 'renderMapHomeOverlays', host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    frameRendererClass: StubFrameRenderer,
  });
  const state = { resources: {} };
  const options = { activeTab: 'resources' };

  const frame = renderer.render(state, options);
  const overlays = renderer.renderMapHomeOverlays(state, options);

  assert.equal(frame.method, 'render');
  assert.equal(frame.host, renderer);
  assert.deepEqual(frame.args, [state, options]);
  assert.equal(overlays.method, 'renderMapHomeOverlays');
  assert.equal(overlays.host, renderer);
});
