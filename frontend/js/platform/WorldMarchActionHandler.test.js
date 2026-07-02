const test = require('node:test');
const assert = require('node:assert/strict');

const WorldMarchActionHandler = require('./WorldMarchActionHandler');

// Isolated slice-11 contract: the handler only talks to the controller through
// the `core` facade and to shared controller-module helpers through `helpers`,
// so a stub core is enough to pin the cluster behavior.

function makeCore({ uiState = {}, game = {}, host = {} } = {}) {
  const core = {
    host,
    calls: [],
    getSharedTerritoryUiState: () => uiState,
    getGameHost: () => game,
    getWorldMarchFormationForAction: () => null,
    refreshWorldMarchLayer(action) {
      core.calls.push(['refreshWorldMarchLayer', action.type]);
      return true;
    },
    finalize(result) {
      if (!result || typeof result.then !== 'function') return result !== false;
      return result.then((value) => value !== false);
    },
    runAction: (callback) => callback(),
  };
  return core;
}

function makeHelpers(calls = []) {
  return {
    logActorPickingDiag: () => null,
    summarizeActorPickingAction: () => ({}),
    summarizeActorPickingUiState: () => ({}),
    closeTargetPickerSnapshot(host) {
      calls.push(['closeTargetPickerSnapshot', host]);
      return true;
    },
  };
}

test('selectTarget writes the march target, clears selection, and closes the picker', async () => {
  const calls = [];
  const uiState = { selectedWorldActorId: 'old-actor', selectedSiteId: 'old-site' };
  const core = makeCore({ uiState });
  const handler = new WorldMarchActionHandler({ core, helpers: makeHelpers(calls) });

  assert.equal(
    await handler.selectTarget({ type: 'selectWorldMarchTarget', targetQ: 4, targetR: -2 }),
    true,
  );

  assert.deepEqual(uiState.worldMarchTarget, { q: 4, r: -2, tileId: 'tile_4_-2' });
  assert.equal(uiState.selectedWorldActorId, '');
  assert.equal(uiState.selectedWorldMissionId, '');
  assert.equal(uiState.selectedSiteId, '');
  assert.deepEqual(calls, [['closeTargetPickerSnapshot', core.host]]);
  assert.deepEqual(core.calls, [['refreshWorldMarchLayer', 'selectWorldMarchTarget']]);
});

test('startMarch happy path sends mode:manual options and consumes the target', async () => {
  const calls = [];
  const uiState = {
    worldMarchTarget: { q: 4, r: -2, tileId: 'tile_4_-2' },
    selectedWorldActorId: 'march-1',
  };
  const game = {
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options]);
      return Promise.resolve(true);
    },
  };
  const core = makeCore({ uiState, game });
  const handler = new WorldMarchActionHandler({ core, helpers: makeHelpers(calls) });

  assert.equal(
    await handler.startMarch({ type: 'startWorldMarch', targetQ: 4, targetR: -2, slot: 2 }),
    true,
  );

  const startCall = calls.find((call) => call[0] === 'startWorldMarch');
  assert.deepEqual(startCall[1], {
    mode: 'manual',
    targetQ: 4,
    targetR: -2,
    formationSlot: 2,
    cityId: 'capital',
  });
  assert.equal(uiState.worldMarchTarget, null);
  assert.equal(uiState.selectedWorldActorId, '');
  assert.equal(
    calls.some((call) => call[0] === 'closeTargetPickerSnapshot'),
    true,
  );
});

test('confirmDeployment closes confirm dialogs and re-runs startMarch without warnings', async () => {
  const calls = [];
  const uiState = {};
  const host = {
    closeConfirmDialog() {
      calls.push(['host.closeConfirmDialog']);
    },
    closeConfirmDialogSnapshot() {
      calls.push(['host.closeConfirmDialogSnapshot']);
      return true;
    },
  };
  const game = {
    state: { activeCityId: 'capital' },
    startWorldMarch(options) {
      calls.push(['startWorldMarch', options.targetQ, options.targetR]);
      return true;
    },
  };
  const core = makeCore({ uiState, game, host });
  const handler = new WorldMarchActionHandler({ core, helpers: makeHelpers(calls) });

  assert.equal(
    await handler.confirmDeployment({
      type: 'confirmWorldMarchDeployment',
      action: { type: 'startWorldMarch', targetQ: 1, targetR: 2, formationSlot: 1 },
    }),
    true,
  );

  assert.deepEqual(calls[0], ['host.closeConfirmDialog']);
  assert.deepEqual(calls[1], ['host.closeConfirmDialogSnapshot']);
  assert.deepEqual(
    calls.find((call) => call[0] === 'startWorldMarch'),
    ['startWorldMarch', 1, 2],
  );
});
