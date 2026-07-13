const test = require('node:test');
const assert = require('node:assert/strict');

const GameCommandService = require('./GameCommandService');
const LocaleText = require('../ecs/resource/LocaleText');
const CanvasGameApp = require('./CanvasGameApp');
const ChangeEventBus = require('../state/ChangeEventBus');
const { CanvasModalOwnerTestHost } = require('../../test-support/CanvasOwnerTestHarness');

function createCommandHost(api) {
  const calls = [];
  const host = {
    api,
    state: { activeCityId: 'capital', currentTab: 'resources', techUiState: { detailOpen: true } },
    canvasShell: new CanvasModalOwnerTestHost(),
    pendingBuildingAction: null,
    closeCitySwitcher(options) {
      calls.push(['closeCitySwitcher', options]);
    },
    setPendingBuildingAction(pending) {
      this.pendingBuildingAction = pending;
      calls.push(['setPendingBuildingAction', pending]);
    },
    applyApiState(result) {
      calls.push(['applyApiState', result]);
      if (result?.gameState) this.state = result.gameState;
    },
    showFloatingText(message) {
      calls.push(['showFloatingText', message]);
    },
    log(message) {
      calls.push(['log', message]);
    },
    renderCanvasSurface(tab) {
      calls.push(['renderCanvasSurface', tab]);
    },
    getGameApi() {
      return this.api;
    },
  };
  return { host, calls };
}

test('GameCommandService runs build and upgrade commands through API and applies state', async () => {
  const apiCalls = [];
  const api = {
    async build(buildingId) {
      apiCalls.push(['build', buildingId]);
      return { message: 'built' };
    },
    async upgrade(buildingId) {
      apiCalls.push(['upgrade', buildingId]);
      return { message: 'upgraded' };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.buildBuilding('farm'), true);
  assert.equal(await service.upgradeBuilding('house'), true);

  assert.deepEqual(apiCalls, [['build', 'farm'], ['upgrade', 'house']]);
  assert.equal(calls.filter(([name]) => name === 'applyApiState').length, 2);
  assert.deepEqual(host.pendingBuildingAction, null);
  assert.deepEqual(calls.filter(([name]) => name === 'setPendingBuildingAction').map(([, pending]) => pending), [
    { buildingId: 'farm', action: 'build' },
    null,
    { buildingId: 'house', action: 'upgrade' },
    null,
  ]);
});

test('GameCommandService research applies API state and keeps selected tech UI state', async () => {
  const api = {
    async research(techId) {
      return { message: `researched ${techId}`, gameState: { currentTab: 'tech', techUiState: { detailOpen: true } } };
    },
  };
  const { host, calls } = createCommandHost(api);
  host.canvasShell.openBlockingPanelSnapshot('techDetailOpen', true);
  assert.equal(host.canvasShell.isBlockingPanelSnapshotOpen('techDetailOpen'), true);
  const service = new GameCommandService({ host });

  assert.equal(await service.research('writing'), true);

  assert.equal(host.state.techUiState.selectedTechId, 'writing');
  assert.equal(host.state.techUiState.detailOpen, false);
  assert.equal(host.canvasShell.selectedTechId, undefined);
  assert.equal(host.canvasShell.isBlockingPanelSnapshotOpen('techDetailOpen'), false);
  assert.deepEqual(calls.find(([name]) => name === 'showFloatingText'), ['showFloatingText', 'researched writing']);
});

test('GameCommandService submits non-house building commands', async () => {
  const apiCalls = [];
  const api = {
    async build(buildingId) {
      apiCalls.push(buildingId);
      return { message: 'built' };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.buildBuilding('farm'), true);
  assert.deepEqual(apiCalls, ['farm']);
  assert.equal(calls.some(([name]) => name === 'showFloatingText'), true);
});

test('GameCommandService propagates BuildingController build failures', async () => {
  const { host, calls } = createCommandHost({});
  host.buildingController = {
    async handleAction({ buildingId, action }) {
      calls.push(['handleAction', buildingId, action]);
      return false;
    },
  };
  const service = new GameCommandService({ host });

  assert.equal(await service.buildBuilding('barracks'), false);
  assert.deepEqual(calls.filter(([name]) => name === 'handleAction'), [['handleAction', 'barracks', 'build']]);
  assert.deepEqual(host.pendingBuildingAction, null);
});

test('GameCommandService resyncs committed building commands after projection failure', async () => {
  const apiCalls = [];
  const api = {
    async build(buildingId) {
      apiCalls.push(['build', buildingId]);
      return {
        success: true,
        committed: true,
        resyncRequired: true,
        message: 'Command committed; client state must resync.',
      };
    },
    async getState() {
      apiCalls.push(['getState']);
      return { gameState: { playerId: 'player-1', buildings: { barracks: { level: 1 } } } };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.buildBuilding('barracks'), true);
  assert.deepEqual(apiCalls, [['build', 'barracks'], ['getState']]);
  assert.equal(host.state.buildings.barracks.level, 1);
  assert.equal(calls.filter(([name]) => name === 'applyApiState').length, 1);
});

test('GameCommandService switchCity closes picker, calls API, and applies state', async () => {
  const apiCalls = [];
  const api = {
    async switchCity(cityId) {
      apiCalls.push(cityId);
      return { message: `switched ${cityId}`, gameState: { activeCityId: cityId, currentTab: 'resources' } };
    },
  };
  const { host, calls } = createCommandHost(api);
  const service = new GameCommandService({ host });

  assert.equal(await service.switchCity('harbor'), true);
  assert.deepEqual(apiCalls, ['harbor']);
  assert.deepEqual(calls[0], ['closeCitySwitcher', { skipRender: true }]);
  assert.deepEqual(calls.find(([name]) => name === 'applyApiState'), [
    'applyApiState',
    { message: 'switched harbor', gameState: { activeCityId: 'harbor', currentTab: 'resources' } },
  ]);
});

test('GameCommandService resolves command fallback text through active locale', async () => {
  const previousLocale = LocaleText.getLocale();
  LocaleText.setLocale('en-US');
  try {
    const api = {
      async switchCity(cityId) {
        return { gameState: { activeCityId: cityId, currentTab: 'resources' } };
      },
    };
    const { host, calls: hostCalls } = createCommandHost(api);
    const localizedService = new GameCommandService({ host });

    assert.equal(await localizedService.switchCity('harbor'), true);
    assert.deepEqual(hostCalls.find(([name]) => name === 'showFloatingText'), [
      'showFloatingText',
      'City switched',
    ]);
  } finally {
    LocaleText.setLocale(previousLocale);
  }
});

test('CanvasGameApp keeps command facades and delegates to command service', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    commandService: {
      host: null,
      buildBuilding(buildingId) {
        calls.push(['buildBuilding', buildingId, this.host]);
        return 'build-result';
      },
      upgradeBuilding(buildingId) {
        calls.push(['upgradeBuilding', buildingId, this.host]);
        return 'upgrade-result';
      },
      research(techId) {
        calls.push(['research', techId, this.host]);
        return 'research-result';
      },
      switchCity(cityId) {
        calls.push(['switchCity', cityId, this.host]);
        return 'switch-result';
      },
    },
  });

  assert.equal(await app.buildBuilding('farm'), 'build-result');
  assert.equal(await app.upgradeBuilding('house'), 'upgrade-result');
  assert.equal(await app.research('writing'), 'research-result');
  assert.equal(await app.switchCity('harbor'), 'switch-result');
  assert.deepEqual(calls.map(([name, id]) => [name, id]), [
    ['buildBuilding', 'farm'],
    ['upgradeBuilding', 'house'],
    ['research', 'writing'],
    ['switchCity', 'harbor'],
  ]);
  assert.equal(calls.every(([, , host]) => host === app), true);
});

test('CanvasGameApp advanceEra returns true after applying successful API state', async () => {
  const calls = [];
  const changeEventBus = ChangeEventBus.createEventBus();
  changeEventBus.subscribe('eraAdvanced', ({ result }) => {
    calls.push(['eraAdvanced', result.gameState.currentEra]);
  });
  const app = new CanvasGameApp({
    changeEventBus,
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    initialState: {
      currentTab: 'military',
      currentEra: 0,
      isCapitalCity: true,
      eraProgress: { canAdvance: true },
    },
    presenter: {
      buildCivilizationViewState() {
        return { advanceButton: { canAdvance: true } };
      },
    },
    api: {
      async advanceEra() {
        calls.push(['advanceEra']);
        return {
          success: true,
          message: '进入农耕时代',
          gameState: {
            currentTab: 'military',
            currentEra: 1,
            isCapitalCity: true,
            eraProgress: { canAdvance: false },
          },
        };
      },
    },
  });
  app.showFloatingText = (message) => calls.push(['showFloatingText', message]);
  app.log = (message) => calls.push(['log', message]);
  app.renderMilitary = () => calls.push(['renderMilitary']);
  app.render = () => calls.push(['render']);

  assert.equal(await app.advanceEra(), true);
  assert.equal(app.state.currentEra, 1);
  assert.deepEqual(calls.filter(([name]) => ['advanceEra', 'eraAdvanced', 'showFloatingText'].includes(name)), [
    ['advanceEra'],
    ['eraAdvanced', 1],
    ['showFloatingText', '进入农耕时代'],
  ]);
});

test('CanvasGameApp openNaming writes the owner snapshot through the modal funnel', () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    presenter: {
      buildNamingPromptViewState(prompt) {
        return {
          key: `${prompt.type}:${prompt.territoryId || 'polity'}`,
          title: prompt.title || 'Name',
          message: prompt.message || '',
          placeholder: 'Name',
          maxLength: 12,
        };
      },
    },
  });
  app.canvasShell = {};
  app.render = () => calls.push(['render']);

  app.openNaming({ type: 'city', territoryId: 'site_1' });

  const naming = app.getRendererSnapshot().modal['modal:naming'].payload;
  assert.equal(naming.visible, true);
  assert.equal(naming.prompt.territoryId, 'site_1');
  assert.deepEqual(calls, [['render']]);
});

test('CanvasGameApp updates naming input through the modal funnel', async () => {
  const calls = [];
  const app = new CanvasGameApp({
    runtimeRequired: false,
    apiRequired: false,
    rendererRequired: false,
    runtime: {
      async requestTextInput() {
        calls.push(['requestTextInput']);
        return 'River League';
      },
    },
  });
  app.openNamingSnapshot({
    visible: true,
    view: { title: 'Name', maxLength: 12 },
    inputValue: '',
    submitting: false,
  });
  app.canvasShell = {};
  app.render = () => calls.push(['render', app.getNamingInputValue()]);

  await app.requestNamingInput();

  assert.equal(app.getRendererSnapshot().modal['modal:naming'].payload.inputValue, 'River League');
  assert.deepEqual(calls, [
    ['requestTextInput'],
    ['render', 'River League'],
  ]);
});
