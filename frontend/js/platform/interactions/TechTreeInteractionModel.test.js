const test = require('node:test');
const assert = require('node:assert/strict');

const TechTreeInteractionModel = require('./TechTreeInteractionModel');
const CanvasActionController = require('../CanvasActionController');
const GameAPI = require('../../api/GameAPI');
const { makeModalOwnerHost } = require('../../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

function makeChangeEventBus(calls, handlers = {}) {
  return {
    emit(eventName, payload = {}) {
      calls.push(['changeEvent', eventName, payload.panelId || payload.view || '']);
      return { results: [handlers[eventName]?.(payload)] };
    },
  };
}

function createHost() {
  const calls = [];
  const host = {
    state: { techs: {} },
    techTreePanX: 0,
    techTreePanY: 0,
    techTreeZoom: 1,
    presenter: {
      buildTechViewState(state) {
        calls.push(['buildTechViewState', state]);
        return { nodes: [{ id: 'writing' }], links: [] };
      },
    },
    renderer: {
      width: 390,
      height: 844,
      lastTechTreeScroll: {
        panel: { x: 20, y: 100, width: 300, height: 240 },
      },
      getTechTreeLayout(view, panel, options) {
        calls.push(['getTechTreeLayout', view, panel, options]);
        return {
          minPanX: -100,
          maxPanX: 40,
          minPanY: -80,
          maxPanY: 30,
        };
      },
    },
    getTechTreePan() {
      return { x: this.techTreePanX, y: this.techTreePanY };
    },
    setTechTreePan(pan) {
      calls.push(['setTechTreePan', pan]);
      this.techTreePanX = pan.x;
      this.techTreePanY = pan.y;
    },
    getTechTreeZoom() {
      return this.techTreeZoom;
    },
    setTechTreeZoom(zoom) {
      calls.push(['setTechTreeZoom', zoom]);
      this.techTreeZoom = zoom;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  };
  return { host, calls };
}

test('TechTreeInteractionModel clamps drag pan through renderer layout boundary', () => {
  const { host } = createHost();
  const model = new TechTreeInteractionModel({ host, getState: () => host.state });

  assert.equal(model.handleDrag({ phase: 'start', pointer: { x: 10, y: 10 } }), true);
  assert.equal(model.handleDrag({ phase: 'move', pointer: { x: 180, y: 160 } }), true);

  assert.equal(host.techTreePanX, 40);
  assert.equal(host.techTreePanY, 30);
  assert.deepEqual(host.techTreeDragStart, { x: 10, y: 10, panX: 0, panY: 0 });
  assert.equal(model.handleDrag({ phase: 'end', pointer: { x: 180, y: 160 } }), true);
  assert.equal(host.techTreeDragStart, null);
});

test('TechTreeInteractionModel keeps zoom centered and clamps resulting pan', () => {
  const { host } = createHost();
  host.techTreePanX = -20;
  host.techTreePanY = -10;
  const model = new TechTreeInteractionModel({ host, getState: () => host.state });

  assert.equal(model.handleZoom({ gesture: { scaleDelta: 1.2, centerX: 140, centerY: 180 } }), true);

  assert.equal(Math.round(host.techTreeZoom * 100), 120);
  assert.equal(Math.round(host.techTreePanX), -48);
  assert.equal(Math.round(host.techTreePanY), -28);
});

test('CanvasActionController delegates tech tree drag and zoom to interaction model', () => {
  const calls = [];
  const host = {
    render() {
      calls.push(['render']);
      return true;
    },
  };
  const controller = new CanvasActionController({
    host,
    techTreeInteraction: {
      handleDrag(action) {
        calls.push(['handleDrag', action.phase]);
        return true;
      },
      handleZoom(action) {
        calls.push(['handleZoom', action.gesture.scaleDelta]);
        return true;
      },
    },
  });

  assert.equal(controller.handle({ type: 'techTreeDrag', phase: 'move', pointer: { x: 1, y: 2 } }), true);
  assert.equal(controller.handle({ type: 'techTreeZoom', gesture: { scaleDelta: 1.1 } }), true);
  assert.deepEqual(calls, [
    ['handleDrag', 'move'],
    ['render'],
    ['handleZoom', 1.1],
    ['render'],
  ]);
});

test('CanvasActionController records input intent on action errors', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    inputId: 'wmi-error-21',
    clientSequence: 21,
  };
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type } : null;
    },
    summarizeInputIntent(intent) {
      return intent ? { inputId: intent.inputId, clientSequence: intent.clientSequence } : null;
    },
    summarizeUiState() {
      return {};
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };

  try {
    const syncController = new CanvasActionController({
      host: {
        forwardCanvasAction() {
          throw new Error('sync boom');
        },
      },
    });
    assert.throws(
      () => syncController.handle({ type: 'unknownSync' }, { inputIntent }),
      /sync boom/,
    );

    const asyncController = new CanvasActionController({
      awaitAsync: true,
      host: {
        forwardCanvasAction() {
          return Promise.reject(new Error('async boom'));
        },
      },
    });
    await assert.rejects(
      () => asyncController.handle({ type: 'asyncBoom' }, { inputIntent }),
      /async boom/,
    );
  } finally {
    global.ClientOperationLog = previous;
  }

  const errorEvents = events.filter((event) => event[0] === 'action:error').map((event) => event[1]);
  assert.equal(errorEvents.length, 2);
  assert.deepEqual(errorEvents.map((event) => event.inputIntent), [
    { inputId: 'wmi-error-21', clientSequence: 21 },
    { inputId: 'wmi-error-21', clientSequence: 21 },
  ]);
});

test('CanvasActionController preserves async forwarded action failures and input intent', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    inputId: 'wmi-forward-reject-22',
    clientSequence: 22,
  };
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type } : null;
    },
    summarizeInputIntent(intent) {
      return intent ? { inputId: intent.inputId, clientSequence: intent.clientSequence } : null;
    },
    summarizeUiState() {
      return {};
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };

  try {
    const controller = new CanvasActionController({
      awaitAsync: true,
      host: {
        forwardCanvasAction(action, meta) {
          assert.equal(meta.inputIntent, inputIntent);
          return Promise.reject(new Error(`forward rejected: ${action.type}`));
        },
      },
    });

    await assert.rejects(
      () => controller.handle({ type: 'externalWorldCommand' }, { inputIntent }),
      /forward rejected: externalWorldCommand/,
    );
  } finally {
    global.ClientOperationLog = previous;
  }

  const actionError = events.find((event) => event[0] === 'action:error')?.[1];
  assert.deepEqual(actionError.inputIntent, {
    inputId: 'wmi-forward-reject-22',
    clientSequence: 22,
  });
});

test('CanvasActionController and GameAPI keep the same input id on failed world march', async () => {
  const previous = global.ClientOperationLog;
  const events = [];
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    inputId: 'wmi-e2e-error-31',
    clientSequence: 31,
    target: { kind: 'tile', tileId: 'tile_5_-3', targetQ: 5, targetR: -3 },
    picking: { inputEpoch: 31, signature: 'pick-31' },
    rendererPayload: 'x'.repeat(2000),
  };
  global.ClientOperationLog = {
    summarizeAction(action) {
      return action ? { type: action.type, targetQ: action.targetQ, targetR: action.targetR } : null;
    },
    summarizeInputIntent(intent) {
      return intent ? { inputId: intent.inputId, clientSequence: intent.clientSequence } : null;
    },
    summarizeUiState() {
      return {};
    },
    record(type, detail) {
      events.push([type, detail]);
    },
  };

  const shell = {
    territoryUiState: {},
    api: new GameAPI('/api', 'token-a', {
      timeoutMs: 0,
      maxRetries: 0,
      transport: {
        async request() {
          return {
            ok: false,
            status: 409,
            headers: { get() { return ''; } },
            async json() {
              return { error: 'blocked', message: 'not allowed' };
            },
          };
        },
      },
    }),
    state: { activeCityId: 'capital' },
    getCanvasGameHost() {
      return { state: this.state, territoryUiState: this.territoryUiState };
    },
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new CanvasActionController({ host: shell, awaitAsync: true });

  try {
    await assert.rejects(
      () => controller.handle({
        type: 'startWorldMarch',
        targetQ: 5,
        targetR: -3,
        formationSlot: 1,
      }, { inputIntent }),
      /not allowed/,
    );
  } finally {
    global.ClientOperationLog = previous;
  }

  const actionError = events.find((event) => event[0] === 'action:error')?.[1];
  const apiError = events.find((event) => event[0] === 'api:error')?.[1];

  assert.equal(actionError.inputIntent.inputId, 'wmi-e2e-error-31');
  assert.equal(actionError.inputIntent.clientSequence, 31);
  assert.equal(apiError.clientInput.inputId, 'wmi-e2e-error-31');
  assert.equal(apiError.clientInput.clientSequence, 31);
  assert.equal(apiError.clientInput.target.tileId, 'tile_5_-3');
  assert.equal(JSON.stringify(apiError.clientInput).includes('rendererPayload'), false);
});

test('CanvasActionController publishes command panel event when opening civilization panel', async () => {
  const calls = [];
  const game = makeModalHost();
  const changeEventBus = makeChangeEventBus(calls, {
    commandPanelOpened: async () => true,
  });
  const host = makeModalHost({
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  });
  const controller = new CanvasActionController({ host, awaitAsync: true, changeEventBus });

  assert.equal(await controller.handle_openCommandPanel({ type: 'openCommandPanel', panel: 'civilization' }), true);

  assert.equal(host.getCommandPanelValue(), 'civilization');
  assert.deepEqual(calls, [
    ['changeEvent', 'commandPanelOpened', 'civilization'],
    ['render'],
  ]);
});

test('CanvasActionController syncs opened event id across shell and game hosts', () => {
  const calls = [];
  const ownerCalls = [];
  // Shared snapshot store for this test double; production modal reads resolve to a
  // canonical game owner instead of writing host mirrors.
  const eventStore = { snapshot: null };
  const eventSnapshotMock = {
    openEventSnapshot(eventId) {
      ownerCalls.push(['openEventSnapshot', eventId]);
      eventStore.snapshot = eventId ? { eventId, visible: true } : null;
      return eventId;
    },
    closeEventSnapshot() {
      ownerCalls.push(['closeEventSnapshot']);
      eventStore.snapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(eventStore.snapshot);
    },
    getEventSnapshot() {
      return eventStore.snapshot;
    },
  };
  const shell = makeModalHost({
    ...eventSnapshotMock,
    state: { eventQueue: [{ id: 'event-1' }] },
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  });
  const game = {
    ...eventSnapshotMock,
    canvasShell: shell,
    state: { eventQueue: [{ id: 'event-1' }] },
  };
  shell.openBlockingPanelSnapshot('activeCommandPanel', 'events');
  shell.openBlockingPanelSnapshot('showTaskCenter', true);
  const controller = new CanvasActionController({ host: shell });

  assert.equal(controller.handle_openEvent({ type: 'openEvent', eventId: 'event-1' }), true);

  assert.equal(shell.isEventSnapshotOpen(), true);
  assert.equal(game.isEventSnapshotOpen(), true);
  assert.equal(game.canvasShell.isEventSnapshotOpen(), true);
  assert.equal(shell.getEventSnapshot().eventId, 'event-1');
  assert.equal(shell.getCommandPanelValue(), '');
  assert.equal(shell.isBlockingPanelSnapshotOpen('showTaskCenter'), false);
  assert.deepEqual(ownerCalls, [['openEventSnapshot', 'event-1']]);
  assert.deepEqual(calls, [['render']]);

  assert.equal(controller.handle_closeEvent({ type: 'closeEvent' }), true);
  assert.equal(shell.isEventSnapshotOpen(), false);
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.equal(game.canvasShell.isEventSnapshotOpen(), false);
  assert.deepEqual(ownerCalls, [['openEventSnapshot', 'event-1'], ['closeEventSnapshot']]);
});

test('CanvasActionController opens task center above city management', () => {
  const calls = [];
  const ownerCalls = [];
  const eventStore = { snapshot: { eventId: 'event-1', visible: true } };
  const shell = makeModalHost({
    activeTaskCenterTab: '',
    getCanvasGameHost() {
      return game;
    },
    closeEventSnapshot() {
      ownerCalls.push(['shellCloseEventSnapshot']);
      eventStore.snapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(eventStore.snapshot);
    },
    render() {
      calls.push(['render']);
      return true;
    },
  });
  const game = makeModalHost({
    activeTaskCenterTab: '',
    canvasShell: shell,
    closeEventSnapshot() {
      ownerCalls.push(['gameCloseEventSnapshot']);
      eventStore.snapshot = null;
    },
    isEventSnapshotOpen() {
      return Boolean(eventStore.snapshot);
    },
  });
  // The bidirectional shell<->game link lets the owner fan the opens out to both.
  shell.openBlockingPanelSnapshot('showCityManagement', true);
  shell.openBlockingPanelSnapshot('showSubcityList', true);
  shell.openBlockingPanelSnapshot('activeCommandPanel', 'capital');
  const controller = new CanvasActionController({ host: shell });

  assert.equal(controller.handle_openTaskCenter({ type: 'openTaskCenter', tab: 'main' }), true);

  assert.equal(shell.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  assert.equal(game.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), false);
  assert.equal(game.isBlockingPanelSnapshotOpen('showCityManagement'), false);
  assert.equal(shell.isBlockingPanelSnapshotOpen('showSubcityList'), false);
  assert.equal(game.isBlockingPanelSnapshotOpen('showSubcityList'), false);
  assert.equal(shell.getCommandPanelValue(), '');
  assert.equal(game.getCommandPanelValue(), '');
  assert.equal(shell.isEventSnapshotOpen(), false);
  assert.equal(game.isEventSnapshotOpen(), false);
  assert.equal(shell.activeTaskCenterTab, 'main');
  assert.equal(game.activeTaskCenterTab, 'main');
  assert.deepEqual(ownerCalls, [['shellCloseEventSnapshot'], ['gameCloseEventSnapshot']]);
  assert.deepEqual(calls, [['render']]);
});

test('CanvasActionController mirrors city management open to the game host', () => {
  const calls = [];
  const shell = makeModalHost({
    activeCityManagementTab: '',
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  });
  const game = makeModalHost({
    activeCityManagementTab: '',
    canvasShell: shell,
  });
  const controller = new CanvasActionController({ host: shell });

  assert.equal(
    controller.handle_openCityManagement({ type: 'openCityManagement', tab: 'people' }),
    true,
  );

  assert.equal(shell.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(game.isBlockingPanelSnapshotOpen('showCityManagement'), true);
  assert.equal(shell.activeCityManagementTab, '');
  assert.equal(game.activeCityManagementTab, 'people');
});

test('CanvasActionController closes command panel after switching military view', () => {
  const calls = [];
  const shell = makeModalHost({
    getCanvasGameHost() {
      return game;
    },
    render() {
      calls.push(['render']);
      return true;
    },
  });
  const game = makeModalHost({
    canvasShell: shell,
    switchMilitaryView(view) {
      calls.push(['switchMilitaryView', view]);
      return true;
    },
  });
  const changeEventBus = makeChangeEventBus(calls, {
    militaryViewSwitched: () => true,
  });
  shell.openBlockingPanelSnapshot('activeCommandPanel', 'military');
  const controller = new CanvasActionController({ host: shell, changeEventBus });

  assert.equal(controller.handle_switchMilitaryView({ type: 'switchMilitaryView', view: 'world' }), true);

  assert.equal(shell.getCommandPanelValue(), '');
  assert.equal(game.getCommandPanelValue(), '');
  assert.deepEqual(calls, [
    ['switchMilitaryView', 'world'],
    ['changeEvent', 'militaryViewSwitched', 'world'],
    ['render'],
  ]);
});

test('CanvasActionController opens world site from territory id aliases', () => {
  const calls = [];
  const host = {
    territoryUiState: {},
    lastGame: {},
    render() {
      calls.push(['render']);
    },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle_openWorldSite({ type: 'openWorldSite', territoryId: 'site_1_2' }), true);

  assert.equal(host.territoryUiState.selectedSiteId, 'site_1_2');
  assert.deepEqual(calls, [['render']]);
});

test('CanvasActionController keeps local world site HUD open after forwarded action', () => {
  const calls = [];
  const host = {
    territoryUiState: {},
    forwardCanvasAction(action) {
      calls.push(['forward', action.type, action.siteId]);
      return true;
    },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.handle_openWorldSite({ type: 'openWorldSite', siteId: 'site_0_-8' }), true);

  assert.equal(host.territoryUiState.selectedSiteId, 'site_0_-8');
  assert.deepEqual(calls, [['forward', 'openWorldSite', 'site_0_-8']]);
});

test('CanvasActionController centers far world sites inside the map viewport', () => {
  const calls = [];
  const host = {
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    worldMapRuntime: {
      setCamera(x, y, options) {
        calls.push(['setCamera', x, y, options.source]);
        return true;
      },
    },
    state: {
      territoryState: {
        worldMap: {
          tiles: [{ id: 'tile_3_8', q: 3, r: 8, siteId: 'site_3_8' }],
        },
        territories: [{ id: 'site_3_8', x: 3, y: 8 }],
      },
    },
  };
  const controller = new CanvasActionController({ host });

  assert.equal(controller.centerWorldMapOnSite('site_3_8'), true);

  const [, panX, panY] = calls[0];
  const scale = 0.62;
  const projectedX = 210 + panX + (3 - 8) * 96 * scale;
  const visibleMapY = 84;
  const visibleMapH = 747 - 64 - visibleMapY;
  const projectedY = visibleMapY + visibleMapH * 0.42 + panY + (3 + 8) * 48 * scale;
  assert.equal(Math.round(projectedX), 210);
  assert.equal(Math.round(projectedY), Math.round(visibleMapY + visibleMapH * 0.46));
});

test('CanvasActionController refreshes world map layer after world march HUD changes', async () => {
  const calls = [];
  const shell = makeModalHost({
    territoryUiState: {},
    renderCanvasAction(action) {
      calls.push(['renderCanvasAction', action.type]);
      return true;
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['requestWorldMapRenderAnimationFrame', options]);
      return true;
    },
    getCanvasGameHost() {
      return game;
    },
  });
  const game = makeModalHost({
    canvasShell: shell,
    territoryUiState: shell.territoryUiState,
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return true;
    },
    returnWorldMarch(missionId) {
      calls.push(['returnWorldMarch', missionId]);
      return true;
    },
    stopWorldMarch(missionId) {
      calls.push(['stopWorldMarch', missionId]);
      return true;
    },
  });
  const controller = new CanvasActionController({ host: shell, awaitAsync: true });

  assert.equal(controller.handle_openWorldMarchFormationPicker({
    type: 'openWorldMarchFormationPicker',
    targetQ: 2,
    targetR: -1,
    tileId: 'tile_2_-1',
  }), true);
  assert.deepEqual(shell.territoryUiState.worldMarchTarget, {
    q: 2,
    r: -1,
    tileId: 'tile_2_-1',
  });
  assert.equal(shell.isTargetPickerSnapshotOpen(), true);
  assert.equal(shell.getTargetPickerSnapshot()?.pickerKind, 'worldMarchFormation');

  assert.equal(controller.handle_closeWorldMarchHud({ type: 'closeWorldMarchHud' }), true);
  assert.equal(shell.territoryUiState.worldMarchTarget, null);
  assert.equal(shell.isTargetPickerSnapshotOpen(), false);

  assert.equal(controller.handle_selectWorldActor({
    type: 'selectWorldActor',
    missionId: 'march-1',
  }), true);
  assert.equal(shell.territoryUiState.selectedWorldActorId, 'march-1');

  assert.equal(await controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: 0,
    formationSlot: 1,
  }), true);
  assert.equal(shell.territoryUiState.worldMarchTarget, null);
  assert.equal(shell.territoryUiState.selectedWorldActorId, '');
  const startCall = calls.find((call) => call[0] === 'startWorldMarch');
  assert.equal(startCall[1].missionId, 'march-1');

  assert.equal(await controller.handle_returnWorldMarch({
    type: 'returnWorldMarch',
    missionId: 'march-1',
  }), true);

  assert.equal(await controller.handle_stopWorldMarch({
    type: 'stopWorldMarch',
    missionId: 'march-1',
    targetQ: 1,
    targetR: 0,
  }), true);

  const refreshes = calls.filter((call) => call[0] === 'requestWorldMapRenderAnimationFrame');
  assert.equal(refreshes.length, 6);
  assert.deepEqual(refreshes.map((call) => call[1]), Array.from({ length: 6 }, () => ({
    force: true,
    invalidateWorldTileView: false,
  })));
  assert.deepEqual(calls.filter((call) => call[0] === 'renderCanvasAction').map((call) => call[1]), [
    'openWorldMarchFormationPicker',
    'closeWorldMarchHud',
    'selectWorldActor',
    'startWorldMarch',
    'returnWorldMarch',
    'stopWorldMarch',
  ]);
});

test('CanvasActionController writes world march selection into the shared territory UI owner', async () => {
  const calls = [];
  const game = {
    territoryUiState: {},
    territoryController: {
      uiState: {},
      closeSiteDialog(options) {
        calls.push(['closeSiteDialog', options]);
        this.uiState.selectedSiteId = '';
        this.uiState.worldMarchTarget = null;
        this.uiState.selectedWorldActorId = '';
      },
    },
  };
  const host = makeModalHost({
    territoryUiState: {},
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['renderCanvasAction', action.type]);
      return true;
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['requestWorldMapRenderAnimationFrame', options]);
      return true;
    },
  });
  const controller = new CanvasActionController({ host, awaitAsync: true });

  assert.equal(await controller.handle_selectWorldMarchTarget({
    type: 'selectWorldMarchTarget',
    targetQ: 5,
    targetR: -3,
  }), true);

  const sharedUiState = game.territoryUiState;
  assert.strictEqual(host.territoryUiState, sharedUiState);
  assert.strictEqual(game.territoryController.uiState, sharedUiState);
  assert.deepEqual(sharedUiState.worldMarchTarget, {
    q: 5,
    r: -3,
    tileId: 'tile_5_-3',
  });
  assert.equal(sharedUiState.selectedSiteId, '');
  assert.equal(sharedUiState.selectedWorldActorId, '');
  assert.equal(calls.some((call) => call[0] === 'requestWorldMapRenderAnimationFrame'), true);
});
