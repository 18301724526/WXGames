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
      buildAdvisorViewState(softGuide) {
        calls.push(['buildAdvisorViewState', softGuide]);
        return { hidden: false };
      },
      buildTechViewState(input) {
        calls.push(['buildTechViewState', input]);
        return { detail: { id: input.selectedTechId || input.techUiState?.selectedTechId || 'tech-1' } };
      },
    },
    beginFrame(options) { calls.push(['beginFrame', options]); },
    clear() { calls.push(['clear']); },
    appendWorldMapRuntimeHitTargets(...args) { calls.push(['appendWorldMapRuntimeHitTargets', args]); },
    collectMapHomeWorldSiteHitTargets(...args) { calls.push(['collectMapHomeWorldSiteHitTargets', args]); },
    getWorldMapLayerLayout() {
      calls.push(['getWorldMapLayerLayout']);
      return { map: { x: 0, y: 96, width: 390, height: 684 } };
    },
    addHitTarget(...args) { calls.push(['addHitTarget', args]); },
    drawButton(...args) { calls.push(['drawButton', args]); },
    drawPanel(...args) { calls.push(['drawPanel', args]); },
    drawText(...args) { calls.push(['drawText', args]); },
    ctx: {
      fillRect(...args) { calls.push(['fillRect', args]); },
      fillStyle: '',
    },
    endFrame(options) { calls.push(['endFrame', options]); },
    getTransitionFrame(transition) {
      calls.push(['getTransitionFrame', transition]);
      return transition?.frame || null;
    },
    renderAdvisor(...args) { calls.push(['renderAdvisor', args]); },
    renderAdvisorPanel(...args) { calls.push(['renderAdvisorPanel', args]); },
    renderArmyFormationEditor(...args) { calls.push(['renderArmyFormationEditor', args]); },
    renderBattleSceneOverlay(...args) { calls.push(['renderBattleSceneOverlay', args]); },
    renderCityManagementPanel(...args) { calls.push(['renderCityManagementPanel', args]); },
    renderCitySwitcherMenu(...args) { calls.push(['renderCitySwitcherMenu', args]); },
    renderConfirmDialog(...args) { calls.push(['renderConfirmDialog', args]); },
    renderEventModal(...args) { calls.push(['renderEventModal', args]); },
    renderFamousPersonsPanel(...args) { calls.push(['renderFamousPersonsPanel', args]); },
    renderFloatingAdvisorButton(...args) { calls.push(['renderFloatingAdvisorButton', args]); },
    renderFloatingEventButton(...args) { calls.push(['renderFloatingEventButton', args]); },
    renderFloatingSubcityButton(...args) { calls.push(['renderFloatingSubcityButton', args]); },
    renderFloatingTexts(...args) { calls.push(['renderFloatingTexts', args]); },
    renderGuidebookPanel(...args) { calls.push(['renderGuidebookPanel', args]); },
    renderHomeFeatureGrid(...args) { calls.push(['renderHomeFeatureGrid', args]); return 260; },
    renderHudOverlay(...args) { calls.push(['renderHudOverlay', args]); },
    renderLoadingScreen(...args) { calls.push(['renderLoadingScreen', args]); },
    renderLoginPanel(...args) { calls.push(['renderLoginPanel', args]); },
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
    renderTalentPolicyPanel(...args) { calls.push(['renderTalentPolicyPanel', args]); },
    renderTaskCenterPanel(...args) { calls.push(['renderTaskCenterPanel', args]); },
    renderTechDetailModal(...args) { calls.push(['renderTechDetailModal', args]); },
    renderTopBar(...args) { calls.push(['renderTopBar', args]); return 96; },
    renderTutorialAdvisorDialogue(...args) { calls.push(['renderTutorialAdvisorDialogue', args]); },
    renderTutorialHighlight(...args) { calls.push(['renderTutorialHighlight', args]); },
    renderTutorialIntro(...args) { calls.push(['renderTutorialIntro', args]); },
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

test('CanvasFrameRenderer preserves login and loading early return frame flow', () => {
  const loginHost = createHost();
  new CanvasFrameRenderer({ host: loginHost }).render({}, { auth: { view: { loginPanelVisible: true } } });
  assert.deepEqual(callNames(loginHost), ['beginFrame', 'setHitTargets', 'clear', 'renderLoginPanel', 'endFrame']);

  const loadingHost = createHost();
  new CanvasFrameRenderer({ host: loadingHost }).render({}, { loading: { visible: true } });
  assert.deepEqual(callNames(loadingHost), ['beginFrame', 'setHitTargets', 'clear', 'renderLoadingScreen', 'endFrame']);
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
    floatingTexts: [{ text: '+1' }],
    rewardReveal: { rewardText: '+1' },
    network: { status: 'ok' },
  };

  renderer.render({ territoryState: {} }, options);

  const names = callNames(host);
  assert.equal(names.includes('appendWorldMapRuntimeHitTargets'), true);
  assert.equal(names.includes('collectMapHomeWorldSiteHitTargets'), true);
  assert.equal(names.includes('getWorldMapLayerLayout'), true);
  assert.equal(host.calls.some((call) => call[0] === 'addHitTarget' && call[1][1].type === 'startExplore'), false);
  assert.equal(host.calls.some((call) => call[0] === 'addHitTarget' && call[1][1].type === 'resetWorldPan'), true);
  assert.equal(names.includes('renderMapCommandPanel'), true);
  assert.equal(names.includes('renderSubcityListPanel'), true);
  assert.equal(names.includes('renderSettingsPanel'), true);
  assert.equal(names.includes('renderTutorialIntro'), true);
  assert.equal(names.at(-1), 'endFrame');
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
    showGuidebook: true,
    showFamousPersons: true,
    showTalentPolicy: true,
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
  assert.equal(names.includes('renderTechDetailModal'), true);
  assert.equal(names.includes('renderNamingModal'), true);
  assert.equal(names.at(-1), 'endFrame');
});

test('CanvasFrameRenderer preserves map-home overlay toggles as a separate facade target', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });

  renderer.renderMapHomeOverlays({}, {
    activeCommandPanel: 'capital',
    showCityManagement: true,
    showAdvisor: true,
    activeEventId: 'event-1',
    naming: { visible: true },
  });

  const names = callNames(host);
  assert.equal(names.includes('renderFloatingSubcityButton'), true);
  assert.equal(names.includes('renderFloatingEventButton'), true);
  assert.equal(names.includes('renderFloatingAdvisorButton'), true);
  assert.equal(names.includes('renderCityManagementPanel'), true);
  assert.equal(names.includes('renderAdvisorPanel'), true);
  assert.equal(names.includes('renderWorldSiteModal'), true);
  assert.equal(names.includes('renderNamingModal'), true);
});

test('CanvasFrameRenderer renders explorer countdown and claim controls on the UI frame', () => {
  const readyHost = createHost();
  const renderer = new CanvasFrameRenderer({ host: readyHost });
  renderer.renderMapHomeExplorerHud({
    worldExplorerState: { readyMissions: [{ id: 'mission-1' }] },
  }, 96, {});

  assert.equal(readyHost.calls.some((call) => call[0] === 'addHitTarget' && call[1][1].type === 'claimExplore' && call[1][1].missionId === 'mission-1'), true);

  const activeHost = createHost({
    getNow() {
      return new Date('2026-06-06T00:00:04.250Z').getTime();
    },
  });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud({
    worldExplorerState: {
      activeMission: {
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        nextStepAt: '2026-06-06T00:00:10.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        stepDurationSeconds: 10,
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
      },
    },
  }, 96, {});

  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '6s'), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'fillRect'), true);
});

test('CanvasFrameRenderer keeps explorer countdown on epoch time, not animation frame time', () => {
  const epochNowMs = new Date('2026-06-06T00:00:04.250Z').getTime();
  const activeHost = createHost({
    epochNowMs,
    getNow() {
      return 4321.25;
    },
  });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud({
    worldExplorerState: {
      activeMission: {
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        nextStepAt: '2026-06-06T00:00:10.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        stepDurationSeconds: 10,
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
      },
    },
  }, 96, {});

  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '6s'), true);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && String(call[1][0]).includes('1780')), false);
});

test('CanvasFrameRenderer treats expired manual active mission as idle in explorer HUD', () => {
  const activeHost = createHost({
    epochNowMs: new Date('2026-06-06T00:00:25.000Z').getTime(),
  });
  new CanvasFrameRenderer({ host: activeHost }).renderMapHomeExplorerHud({
    worldExplorerState: {
      activeMission: {
        id: 'manual-1',
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        stepDurationSeconds: 10,
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
      },
    },
  }, 96, {});

  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && String(call[1][0]).includes('探索中')), false);
  assert.equal(activeHost.calls.some((call) => call[0] === 'drawText' && call[1][0] === '0s'), false);
});

test('CanvasFrameRenderer renders debug reset as canvas hit target above tutorial shields', () => {
  const host = createHost({
    renderTutorialHighlight(...args) {
      this.calls.push(['renderTutorialHighlight', args]);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'blockCanvasModal' });
    },
  });
  const renderer = new CanvasFrameRenderer({ host });

  renderer.render({ resources: {} }, {
    activeTab: 'resources',
    tutorialHighlight: {
      rect: { left: 12, top: 160, width: 80, height: 40 },
      message: 'guide',
    },
  });

  const resetIndex = host.calls.findLastIndex((call) => call[0] === 'addHitTarget' && call[1][1].type === 'requestResetGame');
  const blockIndex = host.calls.findLastIndex((call) => call[0] === 'addHitTarget' && call[1][1].type === 'blockCanvasModal');
  assert.equal(resetIndex > -1, true);
  assert.equal(blockIndex > -1, true);
  assert.equal(resetIndex > blockIndex, true);
});

test('CanvasFrameRenderer prioritizes tutorial spine advisor over generic advisor panels', () => {
  const host = createHost();
  const renderer = new CanvasFrameRenderer({ host });
  const tutorialAdvisorDialogue = {
    message: '民居已经建立起来了。',
    advisorName: '谋士',
    source: 'houseBuilt',
  };

  renderer.render({ resources: {}, softGuide: { message: 'generic' } }, {
    activeTab: 'resources',
    showAdvisor: true,
    tutorialAdvisorDialogue,
  });

  let names = callNames(host);
  assert.equal(names.includes('renderTutorialAdvisorDialogue'), true);
  assert.equal(names.includes('renderAdvisor'), false);
  assert.equal(names.includes('renderAdvisorPanel'), false);

  host.calls.length = 0;
  renderer.renderMapHomeOverlays({}, {
    showAdvisor: true,
    tutorialAdvisorDialogue,
  });

  names = callNames(host);
  assert.equal(names.includes('renderTutorialAdvisorDialogue'), true);
  assert.equal(names.includes('renderAdvisorPanel'), false);
  const dialogueCall = host.calls.find((call) => call[0] === 'renderTutorialAdvisorDialogue');
  assert.deepEqual(dialogueCall[1][2], { action: { type: 'closeAdvisor', source: 'houseBuilt' } });
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
