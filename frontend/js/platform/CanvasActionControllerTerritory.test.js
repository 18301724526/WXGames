const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');
const HostController = CanvasActionController;

const makeModalHost = makeModalOwnerHost;

test('CanvasActionController installs world-site compatibility methods', () => {
  const calls = [];
  const host = {
    territoryUiState: {},
    state: {
      territoryState: {
        worldMap: { tiles: [{ id: 'tile_2_3', q: 2, r: 3, siteId: 'site_2_3' }] },
        territories: [{ id: 'site_2_3', x: 2, y: 3 }],
      },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    worldMapRuntime: {
      setCamera(x, y, options) {
        calls.push(['setCamera', Math.round(x), Math.round(y), options.source]);
      },
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_openWorldSite({ type: 'openWorldSite', territoryId: 'site_2_3' }),
    true,
  );
  assert.equal(host.territoryUiState.selectedSiteId, 'site_2_3');
  assert.equal(controller.centerWorldMapOnSite('site_2_3'), true);

  assert.deepEqual(calls, [
    ['render', 'openWorldSite'],
    ['setCamera', 60, -125, 'subcityJump'],
  ]);
});

test('CanvasActionController keeps world march HUD state and refresh contract', async () => {
  const calls = [];
  const game = makeModalHost({
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
    stopWorldMarch(missionId) {
      calls.push(['stopWorldMarch', missionId]);
      return Promise.resolve(true);
    },
    tutorialController: {
      onWorldMarchTargetSelected(action) {
        calls.push(['targetSelected', action.targetQ, action.targetR]);
        return true;
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
    runtime: {
      setTimeout(callback) {
        calls.push(['setTimeout']);
        callback?.();
      },
    },
  });
  const host = makeModalHost({
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options]);
    },
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_selectWorldMarchTarget({
      type: 'selectWorldMarchTarget',
      targetQ: 4,
      targetR: -2,
    }),
    true,
  );
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
  });
  // Selecting a single target leaves no picker modal open.
  assert.equal(host.isTargetPickerSnapshotOpen(), false);

  assert.equal(
    controller.handle_openWorldMarchFormationPicker({
      type: 'openWorldMarchFormationPicker',
      targetQ: 4,
      targetR: -2,
    }),
    true,
  );
  // The march target stays in territoryUiState WITHOUT a pickerOpen flag; the
  // formation-picker modal state lives only in the owner snapshot.
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
  });
  assert.equal(host.isTargetPickerSnapshotOpen(), true);
  assert.equal(host.getTargetPickerSnapshot()?.pickerKind, 'worldMarchFormation');

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 4,
      targetR: -2,
      formationSlot: 2,
    }),
    true,
  );
  assert.equal(host.territoryUiState.worldMarchTarget, null);
  // Launching the march consumes the target and closes the formation picker.
  assert.equal(host.isTargetPickerSnapshotOpen(), false);

  assert.equal(
    await controller.handle_stopWorldMarch({
      type: 'stopWorldMarch',
      missionId: 'march-1',
      targetQ: 999,
      targetR: 999,
    }),
    true,
  );

  assert.deepEqual(calls, [
    ['targetSelected', 4, -2],
    ['render', 'selectWorldMarchTarget'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
    ['render', 'openWorldMarchFormationPicker'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
    [
      'startWorldMarch',
      {
        mode: 'manual',
        targetQ: 4,
        targetR: -2,
        formationSlot: 2,
        cityId: 'capital',
      },
    ],
    ['render', 'startWorldMarch'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
    ['stopWorldMarch', 'march-1'],
    ['render', 'stopWorldMarch'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
  ]);
});

test('CanvasActionController refreshes world march UI before start command resolves', async () => {
  const calls = [];
  let resolveStart = null;
  const startPromise = new Promise((resolve) => {
    resolveStart = resolve;
  });
  const game = {
    territoryUiState: {
      worldMarchTarget: { q: 4, r: -2, tileId: 'tile_4_-2' },
    },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options.targetQ, options.targetR]);
      return startPromise;
    },
    tutorialController: {
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
    runtime: {
      setTimeout(callback) {
        calls.push(['setTimeout']);
        callback?.();
      },
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options.force]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  const handled = controller.handle_startWorldMarch({
    type: 'startWorldMarch',
    targetQ: 4,
    targetR: -2,
  });

  assert.equal(host.territoryUiState.worldMarchTarget, null);
  assert.deepEqual(calls, [
    ['startWorldMarch', 4, -2],
    ['render', 'startWorldMarch'],
    ['refreshWorldMap', true],
    ['refreshCurrentHighlight'],
    ['setTimeout'],
    ['refreshCurrentHighlight'],
  ]);

  resolveStart(true);
  assert.equal(await handled, true);
});

test('CanvasActionController submits deployment with zero primary soldiers and returns server rejection', async () => {
  const calls = [];
  const game = makeModalHost({
    territoryUiState: {
      worldMarchTarget: { q: 4, r: -2, tileId: 'tile_4_-2' },
    },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      calls.push(['serverRejection', 'FORMATION_PRIMARY_NO_SOLDIERS']);
      return Promise.resolve(false);
    },
  });
  const host = makeModalHost({
    territoryUiState: game.territoryUiState,
    lastGame: game,
    presenter: {
      buildMilitaryViewState() {
        return {
          formations: [
            {
              slot: 1,
              cityId: 'capital',
              memberCount: 1,
              members: [{ id: 'fp-main', name: 'Main', soldiersAssigned: 0 }],
            },
          ],
        };
      },
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options.force]);
    },
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 4,
      targetR: -2,
      formationSlot: 1,
    }),
    false,
  );

  const startCall = calls.find((call) => call[0] === 'startWorldMarch');
  assert.equal(Boolean(startCall), true);
  assert.equal(startCall[1].formationSlot, 1);
  assert.deepEqual(calls.find((call) => call[0] === 'serverRejection'), [
    'serverRejection',
    'FORMATION_PRIMARY_NO_SOLDIERS',
  ]);
  assert.equal(host.isConfirmDialogSnapshotOpen(), false);
});

test('CanvasActionController confirms deployment when deputies have zero soldiers', async () => {
  const calls = [];
  const game = makeModalHost({
    territoryUiState: {
      worldMarchTarget: { q: 4, r: -2, tileId: 'tile_4_-2' },
    },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  });
  const host = makeModalHost({
    territoryUiState: game.territoryUiState,
    lastGame: game,
    presenter: {
      buildMilitaryViewState() {
        return {
          formations: [
            {
              slot: 1,
              cityId: 'capital',
              memberCount: 2,
              members: [
                { id: 'fp-main', name: 'Main', soldiersAssigned: 120 },
                { id: 'fp-deputy', name: 'Deputy', soldiersAssigned: 0 },
              ],
            },
          ],
        };
      },
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options.force]);
    },
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 4,
      targetR: -2,
      formationSlot: 1,
    }),
    true,
  );

  assert.equal(
    calls.some((call) => call[0] === 'startWorldMarch'),
    false,
  );
  const dialog = host.getConfirmDialogSnapshot();
  assert.equal(dialog.kind, 'worldMarchDeploymentWarning');
  assert.equal(dialog.confirmAction.type, 'confirmWorldMarchDeployment');

  assert.equal(await controller.handle_confirmWorldMarchDeployment(dialog.confirmAction), true);
  const startCall = calls.find((call) => call[0] === 'startWorldMarch');
  assert.equal(Boolean(startCall), true);
  assert.equal(startCall[1].formationSlot, 1);
  assert.equal(host.isConfirmDialogSnapshotOpen(), false);
  assert.equal(host.territoryUiState.worldMarchTarget, null);
});

test('CanvasActionController dismisses an open target picker when a map drag starts', () => {
  const host = makeModalHost({
    territoryUiState: {},
    territoryController: {
      closeSiteDialog() {},
      startWorldDrag() {},
      moveWorldDrag() {},
      endWorldDrag() {},
    },
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_openWorldTargetPicker({
      type: 'openWorldTargetPicker',
      q: 0,
      r: 0,
      tileId: 'tile_0_0',
      candidates: [
        {
          id: 'capital',
          kind: 'site',
          label: 'Capital',
          action: { type: 'openWorldSite', siteId: 'capital' },
        },
        {
          id: 'march-1',
          kind: 'actor',
          label: 'Scout A',
          action: { type: 'selectWorldActor', actorId: 'march-1' },
        },
      ],
    }),
    true,
  );
  assert.equal(host.isTargetPickerSnapshotOpen(), true);

  // Regression (Batch 8E): starting a map drag must dismiss an open target picker.
  // The TerritoryController mirror-clear that used to do this was removed, so the
  // handler must close the owner snapshot explicitly.
  controller.handle_worldMapDrag({ type: 'worldMapDrag', phase: 'start', pointer: { x: 5, y: 5 } });
  assert.equal(host.isTargetPickerSnapshotOpen(), false);
});

test('CanvasActionController opens and resolves world target picker candidates', () => {
  const calls = [];
  const host = makeModalHost({
    territoryUiState: {},
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options]);
    },
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_openWorldTargetPicker({
      type: 'openWorldTargetPicker',
      q: 0,
      r: 0,
      tileId: 'tile_0_0',
      candidates: [
        {
          id: 'capital',
          kind: 'site',
          label: 'Capital',
          action: { type: 'openWorldSite', siteId: 'capital' },
        },
        {
          id: 'march-1',
          kind: 'actor',
          label: 'Scout A',
          action: { type: 'selectWorldActor', actorId: 'march-1' },
        },
      ],
    }),
    true,
  );

  // The picker candidate list lives ONLY in the owner snapshot, not on uiState.
  assert.equal(host.territoryUiState.worldTargetPicker, undefined);
  const pickerSnap = host.getTargetPickerSnapshot();
  assert.equal(pickerSnap?.pickerKind, 'worldTargetPicker');
  assert.equal(pickerSnap.picker.candidates.length, 2);
  assert.equal(host.territoryUiState.selectedSiteId, '');

  assert.equal(
    controller.handle_chooseWorldTarget({
      type: 'chooseWorldTarget',
      targetId: 'march-1',
    }),
    true,
  );

  assert.equal(host.isTargetPickerSnapshotOpen(), false);
  assert.equal(host.territoryUiState.selectedWorldActorId, 'march-1');
  assert.deepEqual(
    calls.map((call) => (call[0] === 'render' ? call : [call[0]])),
    [
      ['render', 'openWorldTargetPicker'],
      ['refreshWorldMap'],
      ['render', 'selectWorldActor'],
      ['refreshWorldMap'],
    ],
  );
});

test('CanvasActionController closes the world target picker without dispatching a candidate', () => {
  const calls = [];
  const host = makeModalHost({
    territoryUiState: {},
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
    requestWorldMapRenderAnimationFrame(options) {
      calls.push(['refreshWorldMap', options]);
    },
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.handle_openWorldTargetPicker({
      type: 'openWorldTargetPicker',
      q: 0,
      r: 0,
      tileId: 'tile_0_0',
      candidates: [
        {
          id: 'capital',
          kind: 'site',
          label: 'Capital',
          action: { type: 'openWorldSite', siteId: 'capital' },
        },
      ],
    }),
    true,
  );
  assert.equal(host.isTargetPickerSnapshotOpen(), true);

  assert.equal(controller.handle_closeWorldTargetPicker({ type: 'closeWorldTargetPicker' }), true);
  // Closing only dismisses the picker snapshot; no candidate action is dispatched.
  assert.equal(host.isTargetPickerSnapshotOpen(), false);
  assert.equal(host.territoryUiState.selectedSiteId, '');
  assert.deepEqual(calls, [
    ['render', 'openWorldTargetPicker'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
    ['render', 'closeWorldTargetPicker'],
    ['refreshWorldMap', { force: true, invalidateWorldTileView: false }],
  ]);
});

test('CanvasActionController forwards selected world mission id on start march only when present', async () => {
  const calls = [];
  const game = makeModalHost({
    territoryUiState: { selectedWorldActorId: 'march-1', selectedWorldMissionId: 'march-1' },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  });
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 4,
      targetR: -2,
      formationSlot: 1,
    }),
    true,
  );
  assert.equal(calls[0][1].missionId, 'march-1');
  assert.equal(host.territoryUiState.selectedWorldActorId, '');

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 5,
      targetR: -3,
      formationSlot: 1,
    }),
    true,
  );
  assert.equal(Object.hasOwn(calls[1][1], 'missionId'), false);
});

test('CanvasActionController preserves selected world actor id through target and picker handoff', async () => {
  const calls = [];
  const game = makeModalHost({
    territoryUiState: { selectedWorldActorId: 'march-1', selectedWorldMissionId: 'march-1' },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  });
  const host = makeModalHost({
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  });
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_selectWorldMarchTarget({
      type: 'selectWorldMarchTarget',
      targetQ: 4,
      targetR: -2,
    }),
    true,
  );
  assert.equal(host.territoryUiState.worldMarchTarget.missionId, 'march-1');
  assert.equal(host.territoryUiState.selectedWorldActorId, '');

  assert.equal(
    controller.handle_openWorldMarchFormationPicker({
      type: 'openWorldMarchFormationPicker',
      targetQ: 4,
      targetR: -2,
    }),
    true,
  );
  assert.equal(host.territoryUiState.worldMarchTarget.missionId, 'march-1');
  // The march-formation modal flag lives in the owner snapshot, not on the target.
  assert.equal(host.territoryUiState.worldMarchTarget.pickerOpen, undefined);
  assert.equal(host.isTargetPickerSnapshotOpen(), true);
  assert.equal(host.getTargetPickerSnapshot()?.pickerKind, 'worldMarchFormation');
  assert.equal(host.getTargetPickerSnapshot()?.target?.missionId, 'march-1');

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 4,
      targetR: -2,
      formationSlot: 1,
    }),
    true,
  );
  assert.equal(calls[0][1].missionId, 'march-1');
  assert.equal(host.isTargetPickerSnapshotOpen(), false);
});

test('CanvasActionController carries combat encounter id into world march options', async () => {
  const calls = [];
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    tutorialController: {
      onWorldMarchTargetSelected() {
        return true;
      },
      refreshCurrentHighlight() {},
    },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_selectWorldMarchTarget({
      type: 'selectWorldMarchTarget',
      targetQ: 2,
      targetR: -1,
      combatEncounterId: 'hostile_force_capital_ridge',
      combatTarget: { encounterId: 'hostile_force_capital_ridge', defender: { soldiers: 40 } },
    }),
    true,
  );
  assert.equal(
    host.territoryUiState.worldMarchTarget.combatEncounterId,
    'hostile_force_capital_ridge',
  );

  assert.equal(
    controller.handle_openWorldMarchFormationPicker({
      type: 'openWorldMarchFormationPicker',
      targetQ: 2,
      targetR: -1,
    }),
    true,
  );

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 2,
      targetR: -1,
      formationSlot: 1,
    }),
    true,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(Object.hasOwn(calls[0][1], 'missionId'), false);
  assert.equal(calls[0][1].targetQ, 2);
  assert.equal(calls[0][1].targetR, -1);
});

test('CanvasActionController keeps combat actor identity out of march mission payloads', async () => {
  const calls = [];
  const game = {
    territoryUiState: { selectedWorldActorId: 'hostile_force_capital_ridge' },
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController({ host: host, awaitAsync: true });
  const combatTarget = { encounterId: 'hostile_force_capital_ridge', defender: { soldiers: 40 } };

  assert.equal(
    controller.handle_openWorldMarchFormationPicker({
      type: 'openWorldMarchFormationPicker',
      targetQ: 2,
      targetR: -1,
      combatEncounterId: 'hostile_force_capital_ridge',
      combatTarget,
    }),
    true,
  );

  assert.equal(
    host.territoryUiState.worldMarchTarget.combatEncounterId,
    'hostile_force_capital_ridge',
  );
  assert.equal(Object.hasOwn(host.territoryUiState.worldMarchTarget, 'missionId'), false);
  assert.equal(Object.hasOwn(host.territoryUiState.worldMarchTarget, 'actorId'), false);

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 2,
      targetR: -1,
      formationSlot: 1,
      combatEncounterId: 'hostile_force_capital_ridge',
    }),
    true,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(Object.hasOwn(calls[0][1], 'missionId'), false);
});

test('CanvasActionController resets runtime world camera for return-home control', () => {
  const calls = [];
  const runtime = {
    camera: { x: 32, y: -18 },
    resetCamera(options) {
      calls.push(['resetCamera', options]);
      this.camera = { x: 0, y: 0 };
    },
  };
  const host = {
    territoryUiState: { worldPanX: 32, worldPanY: -18 },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
      };
    },
    renderWorldMapLayerFrame(options) {
      calls.push(['renderWorldMapLayerFrame', options]);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.handle_resetWorldPan({ type: 'resetWorldPan' }), true);
  assert.deepEqual(runtime.camera, { x: 0, y: 0 });
  assert.equal(host.territoryUiState.worldPanX, 0);
  assert.equal(host.territoryUiState.worldPanY, 0);
  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['resetCamera', { source: 'resetWorldPan', render: false }],
    ['clearTransform'],
    [
      'renderWorldMapLayerFrame',
      {
        force: true,
        reuseCachedWorldTileView: false,
        snapshotOnly: false,
        waterTimeMs: null,
      },
    ],
    ['render', 'resetWorldPan'],
  ]);
});

test('CanvasActionController resets world camera to the current capital spawn', () => {
  const calls = [];
  const runtime = {
    camera: { x: 12, y: -8 },
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      this.camera = { x, y };
      host.territoryUiState.worldPanX = x;
      host.territoryUiState.worldPanY = y;
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const host = {
    territoryUiState: { worldPanX: 12, worldPanY: -8 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 18, r: -4 },
          tiles: [{ id: 'tile_18_-4', q: 18, r: -4, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 18, y: -4 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.handle_resetWorldPan({ type: 'resetWorldPan' }), true);

  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['setCamera', 0, 24, 'resetWorldPan', false],
    ['clearTransform'],
    ['requestRender', { force: true }],
    ['render', 'resetWorldPan'],
  ]);
  assert.equal(Math.round(host.territoryUiState.worldPanX), 0);
  assert.equal(Math.round(host.territoryUiState.worldPanY), 24);
});

test('CanvasActionController centers a non-zero world-origin capital in render space', () => {
  const calls = [];
  const host = {
    territoryUiState: { worldPanX: -1131, worldPanY: -1076 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 28, r: 9, tileId: 'tile_28_9' },
          tiles: [{ id: 'tile_28_9', q: 28, r: 9, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 28, y: 9 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    worldMapRuntime: {
      setCamera(x, y, options) {
        calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
        host.territoryUiState.worldPanX = x;
        host.territoryUiState.worldPanY = y;
      },
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.centerWorldMapOnCapital({ source: 'resumeWorldMap', render: false }),
    true,
  );

  assert.deepEqual(calls, [['setCamera', 0, 24, 'resumeWorldMap', false]]);
  assert.equal(Math.round(host.territoryUiState.worldPanX), 0);
  assert.equal(Math.round(host.territoryUiState.worldPanY), 24);
});

test('CanvasActionController resolves the capital site id from state when resetting camera', () => {
  const calls = [];
  const runtime = {
    camera: { x: 0, y: 0 },
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const host = {
    territoryUiState: { worldPanX: 0, worldPanY: 0 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 7, r: 2 },
          tiles: [{ id: 'tile_7_2', q: 7, r: 2, siteId: 'capital_a' }],
        },
        territories: [{ id: 'capital_a', x: 7, y: 2 }],
      },
      cityState: { capitalCityId: 'capital_a' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset' }), true);

  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['setCamera', 0, 24, 'accountReset', false],
    ['clearTransform'],
    ['requestRender', { force: true }],
  ]);
});

test('CanvasActionController can invalidate world runtime before account reset state is applied', () => {
  const calls = [];
  const runtime = {
    resetWorldState(options) {
      calls.push(['resetWorldState', options.source]);
    },
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return false;
    },
  };
  const host = {
    territoryUiState: { worldPanX: 5, worldPanY: 6 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 0, r: 0 },
          tiles: [{ id: 'tile_0_0', q: 0, r: 0, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 0, y: 0 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      lastWorldTileMapContext: { stale: true },
      invalidateWorldTileCaches() {
        calls.push(['invalidateRendererCaches']);
      },
      getTopBarBottom() {
        return 84;
      },
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    controller.resetWorldMapCamera({
      source: 'accountReset',
      render: false,
      resetRuntimeState: true,
    }),
    true,
  );

  assert.deepEqual(calls, [
    ['ensureRuntime'],
    ['resetWorldState', 'accountReset'],
    ['invalidateRendererCaches'],
    ['setCamera', 0, 24, 'accountReset', false],
    ['invalidateRendererCaches'],
    ['clearTransform'],
  ]);
  assert.equal(host.renderer.lastWorldTileMapContext, null);
});

test('CanvasActionController clears cyclic world renderer graph without recursion overflow', () => {
  const calls = [];
  const runtime = {
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const worldMapRenderer = {
    lastWorldTileMapContext: { stale: 'map' },
    lastMapHomeWorldHudContext: { stale: 'mapHud' },
    lastWorldMapLayerRenderResult: { stale: 'mapResult' },
    hitTargets: [{ action: { type: 'openWorldSite' } }],
    invalidateWorldTileCaches() {
      calls.push(['invalidateWorldTileCaches', 'map']);
    },
    invalidateWorldTileViewCache() {
      calls.push(['invalidateWorldTileViewCache', 'map']);
    },
    setHitTargets(targets) {
      calls.push(['setHitTargets', 'map', targets.length]);
      this.hitTargets = targets;
    },
  };
  const worldActorLayerRenderer = {
    lastWorldTileMapContext: { stale: 'actor' },
    lastMapHomeWorldHudContext: { stale: 'actorHud' },
    hitTargets: [{ action: { type: 'openWorldSite' } }],
    invalidateWorldTileCaches() {
      calls.push(['invalidateWorldTileCaches', 'actor']);
    },
    invalidateWorldTileViewCache() {
      calls.push(['invalidateWorldTileViewCache', 'actor']);
    },
    setHitTargets(targets) {
      calls.push(['setHitTargets', 'actor', targets.length]);
      this.hitTargets = targets;
    },
  };
  worldMapRenderer.worldActorLayerRenderer = worldActorLayerRenderer;
  worldActorLayerRenderer.worldMapRenderer = worldMapRenderer;
  const host = {
    territoryUiState: { worldPanX: 3, worldPanY: 4 },
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 12, r: 6 },
          tiles: [{ id: 'tile_12_6', q: 12, r: 6, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 12, y: 6 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    runtime: { width: 420, height: 747 },
    renderer: { getTopBarBottom: () => 84 },
    worldMapRenderer,
    worldActorLayerRenderer,
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset' }), true);

  assert.equal(worldMapRenderer.lastWorldTileMapContext, null);
  assert.equal(worldMapRenderer.lastMapHomeWorldHudContext, null);
  assert.equal(worldMapRenderer.lastWorldMapLayerRenderResult, null);
  assert.deepEqual(worldMapRenderer.hitTargets, []);
  assert.equal(worldActorLayerRenderer.lastWorldTileMapContext, null);
  assert.equal(worldActorLayerRenderer.lastMapHomeWorldHudContext, null);
  assert.deepEqual(worldActorLayerRenderer.hitTargets, []);
  assert.deepEqual(
    calls.filter((call) => call[0] === 'setCamera'),
    [['setCamera', 0, 24, 'accountReset', false]],
  );
  assert.deepEqual(
    calls.filter((call) => call[0] === 'requestRender'),
    [['requestRender', { force: true }]],
  );
});

test('CanvasActionController centers account reset camera from the updated game state behind the shell', () => {
  const calls = [];
  const runtime = {
    setCamera(x, y, options) {
      calls.push(['setCamera', Math.round(x), Math.round(y), options.source, options.render]);
      return true;
    },
    requestRender(options) {
      calls.push(['requestRender', options]);
      return true;
    },
  };
  const game = {
    state: {
      territoryState: {
        worldMap: {
          origin: { q: 18, r: -4 },
          tiles: [{ id: 'tile_18_-4', q: 18, r: -4, siteId: 'capital' }],
        },
        territories: [{ id: 'capital', x: 18, y: -4 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['gameEnsureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
  };
  const shell = {
    lastGame: game,
    state: {
      territoryState: {
        worldMap: { tiles: [{ id: 'tile_0_0', q: 0, r: 0, siteId: 'capital' }] },
        territories: [{ id: 'capital', x: 0, y: 0 }],
      },
      cityState: { capitalCityId: 'capital' },
    },
    getCanvasGameHost() {
      return game;
    },
    getCanvasActionState() {
      return game.state;
    },
    runtime: { width: 420, height: 747 },
    renderer: {
      getTopBarBottom() {
        return 84;
      },
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['shellEnsureRuntime']);
          return runtime;
        },
        getMapRuntime() {
          return runtime;
        },
      };
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
  };
  game.canvasShell = shell;
  const controller = new CanvasActionController({ host: shell });

  assert.equal(controller.resetWorldMapCamera({ source: 'accountReset', render: true }), true);

  assert.deepEqual(calls, [
    ['shellEnsureRuntime'],
    ['setCamera', 0, 24, 'accountReset', false],
    ['clearTransform'],
    ['requestRender', { force: true }],
  ]);
});

test('CanvasActionController forwards runtime input intent evidence to world march commands', async () => {
  const calls = [];
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    target: { kind: 'tile', tileId: 'tile_4_-2', targetQ: 4, targetR: -2 },
    picking: { inputEpoch: 3, signature: 'pick-3' },
  };
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
    returnWorldMarch(missionId, options) {
      calls.push(['returnWorldMarch', missionId, options]);
      return Promise.resolve(true);
    },
    stopWorldMarch(missionId, options) {
      calls.push(['stopWorldMarch', missionId, options]);
      return Promise.resolve(true);
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_startWorldMarch(
      {
        type: 'startWorldMarch',
        targetQ: 4,
        targetR: -2,
        formationSlot: 2,
      },
      { inputIntent },
    ),
    true,
  );
  assert.equal(
    await controller.handle_returnWorldMarch(
      {
        type: 'returnWorldMarch',
        missionId: 'march-1',
      },
      { inputIntent },
    ),
    true,
  );
  assert.equal(
    await controller.handle_stopWorldMarch(
      {
        type: 'stopWorldMarch',
        missionId: 'march-1',
      },
      { inputIntent },
    ),
    true,
  );

  assert.equal(calls[0][1].clientInputIntent, inputIntent);
  assert.equal(calls[1][2].clientInputIntent, inputIntent);
  assert.equal(calls[2][2].clientInputIntent, inputIntent);
});

test('CanvasActionController derives world march tile identity from target coordinates', async () => {
  const calls = [];
  const game = {
    territoryUiState: {},
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
    tutorialController: {
      onWorldMarchTargetSelected() {
        return true;
      },
      refreshCurrentHighlight() {},
    },
  };
  const host = {
    territoryUiState: game.territoryUiState,
    lastGame: game,
    renderCanvasAction() {},
    requestWorldMapRenderAnimationFrame() {},
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(
    await controller.handle_selectWorldMarchTarget({
      type: 'selectWorldMarchTarget',
      targetQ: 4,
      targetR: -2,
      tileId: 'stale-renderer-tile',
      marchDisabled: true,
      marchDisabledReason: 'EXPLORE_ROUTE_BLOCKED',
    }),
    true,
  );
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
    marchDisabled: true,
    marchDisabledReason: 'EXPLORE_ROUTE_BLOCKED',
  });

  assert.equal(
    controller.handle_openWorldMarchFormationPicker({
      type: 'openWorldMarchFormationPicker',
      targetQ: 4,
      targetR: -2,
      tileId: 'stale-picker-tile',
    }),
    true,
  );
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 4,
    r: -2,
    tileId: 'tile_4_-2',
    marchDisabled: true,
    marchDisabledReason: 'EXPLORE_ROUTE_BLOCKED',
  });

  assert.equal(
    controller.handle_openWorldMarchFormationPicker({
      type: 'openWorldMarchFormationPicker',
      targetQ: 5,
      targetR: -3,
      tileId: 'stale-picker-tile',
    }),
    true,
  );
  assert.deepEqual(host.territoryUiState.worldMarchTarget, {
    q: 5,
    r: -3,
    tileId: 'tile_5_-3',
  });

  assert.equal(
    await controller.handle_startWorldMarch({
      type: 'startWorldMarch',
      targetQ: 5,
      targetR: -3,
      tileId: 'stale-start-tile',
    }),
    true,
  );
  assert.deepEqual(calls[0][1], {
    mode: 'manual',
    targetQ: 5,
    targetR: -3,
    formationSlot: 1,
    cityId: 'capital',
  });
  assert.equal(Object.hasOwn(calls[0][1], 'tileId'), false);
});

test('CanvasActionController resets local shell camera after forwarded return-home action', () => {
  const calls = [];
  const runtime = {
    camera: { x: -44, y: 26 },
    resetCamera(options) {
      calls.push(['resetCamera', options]);
      this.camera = { x: 0, y: 0 };
    },
  };
  const host = {
    territoryUiState: { worldPanX: -44, worldPanY: 26 },
    forwardCanvasAction(action) {
      calls.push(['forward', action.type]);
      return true;
    },
    clearWorldMapLayerTransform() {
      calls.push(['clearTransform']);
      return true;
    },
    ensureWorldMapRuntimeCoordinator() {
      return {
        ensureRuntime() {
          calls.push(['ensureRuntime']);
          return runtime;
        },
      };
    },
    renderWorldMapLayerFrame(options) {
      calls.push(['renderWorldMapLayerFrame', options]);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.handle_resetWorldPan({ type: 'resetWorldPan' }), true);
  assert.deepEqual(runtime.camera, { x: 0, y: 0 });
  assert.equal(host.territoryUiState.worldPanX, 0);
  assert.equal(host.territoryUiState.worldPanY, 0);
  assert.deepEqual(calls, [
    ['forward', 'resetWorldPan'],
    ['ensureRuntime'],
    ['resetCamera', { source: 'resetWorldPan', render: false }],
    ['clearTransform'],
    [
      'renderWorldMapLayerFrame',
      {
        force: true,
        reuseCachedWorldTileView: false,
        snapshotOnly: false,
        waterTimeMs: null,
      },
    ],
    ['render', 'resetWorldPan'],
  ]);
});

test('entrypoints load CanvasActionController without retired action handler modules', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');
  [
    'CanvasTerritoryActionHandlers',
    'CanvasBattleActionHandlers',
    'CanvasExpeditionActionHandlers',
    'CanvasWorldMarchActionHandlers',
  ].forEach((moduleName) => {
    assert.equal(html.includes(`${moduleName}.js`), false);
    assert.equal(minigame.includes(`require('../js/platform/${moduleName}')`), false);
  });
  assert.equal(html.includes('CanvasActionController.js'), true);
  assert.equal(minigame.includes("require('../js/platform/CanvasActionController')"), true);
});
