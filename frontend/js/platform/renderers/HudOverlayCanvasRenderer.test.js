const test = require('node:test');
const assert = require('node:assert/strict');

const HudOverlayCanvasRenderer = require('./HudOverlayCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [{ action: { type: 'old' } }];
  const host = {
    calls,
    hitTargets,
    presenter: {
      buildTechViewState(input) {
        calls.push(['buildTechViewState', input]);
        return { detail: { id: input.selectedTechId || input.techUiState?.selectedTechId || 'tech-1' } };
      },
    },
    beginFrame(options) { calls.push(['beginFrame', options]); },
    clear() { calls.push(['clear']); },
    collectMapHomeWorldSiteHitTargets(...args) { calls.push(['collectMapHomeWorldSiteHitTargets', args]); },
    endFrame(options) { calls.push(['endFrame', options]); },
    renderMapHomeExplorerHud(...args) { calls.push(['renderMapHomeExplorerHud', args]); },
    renderAdvisorPanel(...args) { calls.push(['renderAdvisorPanel', args]); },
    renderArmyFormationEditor(...args) { calls.push(['renderArmyFormationEditor', args]); },
    renderBattleSceneOverlay(...args) { calls.push(['renderBattleSceneOverlay', args]); },
    renderCitySwitcherMenu(...args) { calls.push(['renderCitySwitcherMenu', args]); },
    renderEventModal(...args) { calls.push(['renderEventModal', args]); },
    renderFamousPersonsPanel(...args) { calls.push(['renderFamousPersonsPanel', args]); },
    renderFloatingTexts(...args) { calls.push(['renderFloatingTexts', args]); },
    renderGuidebookPanel(...args) { calls.push(['renderGuidebookPanel', args]); },
    renderHudTabPageWithTransition(...args) { calls.push(['renderHudTabPageWithTransition', args]); },
    renderLoadingScreen(...args) { calls.push(['renderLoadingScreen', args]); },
    renderLoginPanel(...args) { calls.push(['renderLoginPanel', args]); },
    renderLogsPanel(...args) { calls.push(['renderLogsPanel', args]); },
    renderMapHomeOverlays(...args) { calls.push(['renderMapHomeOverlays', args]); },
    renderNamingModal(...args) { calls.push(['renderNamingModal', args]); },
    renderNetworkOverlay(...args) { calls.push(['renderNetworkOverlay', args]); },
    renderResourceDetailsPanel(...args) { calls.push(['renderResourceDetailsPanel', args]); },
    renderRewardReveal(...args) { calls.push(['renderRewardReveal', args]); },
    renderSettingsPanel(...args) { calls.push(['renderSettingsPanel', args]); },
    renderTabs(...args) { calls.push(['renderTabs', args]); },
    renderTalentPolicyPanel(...args) { calls.push(['renderTalentPolicyPanel', args]); },
    renderTaskCenterPanel(...args) { calls.push(['renderTaskCenterPanel', args]); },
    renderTechDetailModal(...args) { calls.push(['renderTechDetailModal', args]); },
    renderCanvasDebugResetButton(...args) { calls.push(['renderCanvasDebugResetButton', args]); },
    renderTopBar(...args) { calls.push(['renderTopBar', args]); return 96; },
    renderTutorialAdvisorDialogue(...args) { calls.push(['renderTutorialAdvisorDialogue', args]); },
    renderTutorialHighlight(...args) { calls.push(['renderTutorialHighlight', args]); },
    renderTutorialIntro(...args) { calls.push(['renderTutorialIntro', args]); },
    renderWorldSiteModal(...args) { calls.push(['renderWorldSiteModal', args]); },
    setHitTargets(targets = []) {
      calls.push(['setHitTargets', targets]);
      hitTargets.length = 0;
      targets.forEach((target) => hitTargets.push(target));
    },
    ...overrides,
  };
  return host;
}

function callNames(host) {
  return host.calls.map((call) => call[0]);
}

test('HudOverlayCanvasRenderer preserves login early-return flow', () => {
  const host = createHost();
  const renderer = new HudOverlayCanvasRenderer({ host });
  const options = { preserveCanvas: true, auth: { view: { loginPanelVisible: true } } };

  renderer.renderHudOverlay({}, options);

  assert.deepEqual(callNames(host), ['beginFrame', 'setHitTargets', 'clear', 'renderLoginPanel', 'endFrame']);
  assert.deepEqual(host.hitTargets, []);
});

test('HudOverlayCanvasRenderer preserves battle early-return flow', () => {
  const host = createHost();
  const renderer = new HudOverlayCanvasRenderer({ host });
  const options = { battleScene: { visible: true } };

  renderer.renderHudOverlay({ battle: {} }, options);

  assert.equal(callNames(host).includes('clear'), true);
  assert.equal(callNames(host).includes('renderBattleSceneOverlay'), true);
  assert.equal(callNames(host).includes('renderTopBar'), false);
});

test('HudOverlayCanvasRenderer preserves map-home HUD overlay sequence', () => {
  const host = createHost();
  const renderer = new HudOverlayCanvasRenderer({ host });
  const options = {
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
    floatingTexts: [{ text: '+1' }],
    rewardReveal: { rewardText: '+1' },
    network: { status: 'ok' },
  };

  renderer.renderHudOverlay({ militaryView: 'world' }, options);

  const names = callNames(host);
  assert.equal(names.includes('collectMapHomeWorldSiteHitTargets'), true);
  assert.equal(names.includes('renderMapHomeExplorerHud'), true);
  assert.equal(names.includes('renderMapHomeOverlays'), true);
  assert.equal(names.includes('renderTutorialIntro'), true);
  assert.equal(names.includes('renderResourceDetailsPanel'), false);
  assert.equal(names.at(-1), 'endFrame');
});

test('HudOverlayCanvasRenderer preserves standard overlay and tech detail flow', () => {
  const host = createHost();
  const renderer = new HudOverlayCanvasRenderer({ host });
  const options = {
    activeTab: 'tech',
    showResourceDetails: true,
    showSettings: true,
    showLogs: true,
    showCitySwitcher: true,
    showAdvisor: true,
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

  renderer.renderHudOverlay({ techUiState: { detailOpen: true } }, options);

  const names = callNames(host);
  assert.equal(names.includes('renderResourceDetailsPanel'), true);
  assert.equal(names.includes('renderSettingsPanel'), true);
  assert.equal(names.includes('renderLogsPanel'), true);
  assert.equal(names.includes('renderTechDetailModal'), true);
  assert.equal(names.includes('renderNamingModal'), true);
  assert.equal(names.includes('renderCanvasDebugResetButton'), true);
  assert.equal(names.at(-1), 'endFrame');
});

test('HudOverlayCanvasRenderer renders canvas debug reset on map home overlay frames', () => {
  const host = createHost();
  const renderer = new HudOverlayCanvasRenderer({ host });

  renderer.renderHudOverlay({ militaryView: 'world' }, {
    activeTab: 'military',
    isMapHome: true,
    skipWorldMapLayer: true,
  });

  const names = callNames(host);
  assert.equal(names.includes('renderCanvasDebugResetButton'), true);
  assert.equal(names.at(-2), 'renderCanvasDebugResetButton');
});

test('HudOverlayCanvasRenderer prioritizes tutorial spine advisor over generic advisor panel', () => {
  const host = createHost();
  const renderer = new HudOverlayCanvasRenderer({ host });
  const options = {
    activeTab: 'resources',
    showAdvisor: true,
    tutorialAdvisorDialogue: {
      message: '民居已经建立起来了。',
      advisorName: '谋士',
      source: 'houseBuilt',
    },
  };

  renderer.renderHudOverlay({ resources: {} }, options);

  const names = callNames(host);
  assert.equal(names.includes('renderTutorialAdvisorDialogue'), true);
  assert.equal(names.includes('renderAdvisorPanel'), false);
  const dialogueCall = host.calls.find((call) => call[0] === 'renderTutorialAdvisorDialogue');
  assert.deepEqual(dialogueCall[1][2], { action: { type: 'closeAdvisor', source: 'houseBuilt' } });
});

test('CanvasGameRenderer exposes HUD overlay rendering through facade', () => {
  class StubHudOverlayRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderHudOverlay(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    hudOverlayRendererClass: StubHudOverlayRenderer,
  });
  const state = { resources: {} };
  const options = { mode: 'hud' };

  const result = renderer.renderHudOverlay(state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, options]);
});
