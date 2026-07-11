const test = require('node:test');
const assert = require('node:assert/strict');

const TargetPickerActionHandler = require('./TargetPickerActionHandler');

// Isolated slice-11 contract: the handler only talks to the controller through
// the `core` facade (dispatch via core.handle) and to the shared
// closeTargetPickerSnapshot helper through `helpers`.

function makeCore({ uiState = {}, host = {} } = {}) {
  const core = {
    host,
    calls: [],
    getSharedTerritoryUiState: () => uiState,
    getGameHost: () => ({}),
    refreshWorldMarchLayer(action) {
      core.calls.push(['refreshWorldMarchLayer', action.type]);
      return true;
    },
    handle(action, meta = {}) {
      core.calls.push(['handle', action.type, meta]);
      return true;
    },
  };
  return core;
}

function makeHelpers(calls = []) {
  return {
    closeTargetPickerSnapshot(host) {
      calls.push(['closeTargetPickerSnapshot', host]);
      return true;
    },
  };
}

test('openWorldTargetPicker sanitizes candidates into the snapshot and clears selection', () => {
  const snapshots = [];
  const host = {
    openTargetPickerSnapshot(payload) {
      snapshots.push(payload);
      return true;
    },
  };
  const uiState = { selectedSiteId: 'old-site', worldMarchTarget: { q: 0, r: 0 } };
  const core = makeCore({ uiState, host });
  const handler = new TargetPickerActionHandler({ core, helpers: makeHelpers() });

  assert.equal(
    handler.openWorldTargetPicker({
      type: 'openWorldTargetPicker',
      q: 0,
      r: 0,
      tileId: 'tile_0_0',
      candidates: [
        { id: 'capital', label: 'Capital', action: { type: 'openWorldSite', siteId: 'capital' } },
        { label: 'Scout A', action: { type: 'selectWorldActor', actorId: 'march-1' } },
        { label: 'No action candidate is dropped', action: {} },
      ],
    }),
    true,
  );

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].pickerKind, 'worldTargetPicker');
  assert.equal(snapshots[0].picker.candidates.length, 2);
  assert.deepEqual(
    snapshots[0].picker.candidates.map((candidate) => [candidate.id, candidate.kind]),
    [
      ['capital', 'site'],
      ['march-1', 'actor'],
    ],
  );
  assert.equal(uiState.worldMarchTarget, null);
  assert.equal(uiState.selectedSiteId, '');
  assert.deepEqual(core.calls, [['refreshWorldMarchLayer', 'openWorldTargetPicker']]);
});

test('chooseWorldTarget closes the picker and dispatches the candidate action via core.handle', () => {
  const calls = [];
  const host = {
    getTargetPickerSnapshot() {
      return {
        picker: {
          candidates: [
            { id: 'capital', action: { type: 'openWorldSite', siteId: 'capital' } },
            { id: 'march-1', action: { type: 'selectWorldActor', actorId: 'march-1' } },
          ],
        },
      };
    },
  };
  const core = makeCore({ host });
  const handler = new TargetPickerActionHandler({ core, helpers: makeHelpers(calls) });

  assert.equal(handler.chooseWorldTarget({ type: 'chooseWorldTarget', targetId: 'march-1' }), true);

  assert.deepEqual(calls, [['closeTargetPickerSnapshot', host]]);
  assert.deepEqual(core.calls, [['handle', 'selectWorldActor', {}]]);
});

test('opening and closing the world target picker publishes the tutorial state funnel', () => {
  // Regression for the restored-session picker stall: without this notification
  // nothing re-runs the guide registry when the picker opens (the in-session
  // flow only recovered via incidental march-poll renders), so the follow-through
  // rule never registered chooseWorldTarget and the input shield blocked the
  // picker entries.
  const refreshes = [];
  const scheduled = [];
  const game = {
    changeEventBus: {
      emit(eventName) {
        assert.equal(eventName, 'state.changed');
        refreshes.push('refresh');
      },
    },
  };
  const host = {
    openTargetPickerSnapshot: () => true,
    runtime: { setTimeout: (callback) => scheduled.push(callback) },
  };
  const core = makeCore({ host });
  core.getGameHost = () => game;
  const handler = new TargetPickerActionHandler({ core, helpers: makeHelpers() });

  assert.equal(
    handler.openWorldTargetPicker({
      type: 'openWorldTargetPicker',
      q: 0,
      r: 0,
      tileId: 'tile_0_0',
      candidates: [{ id: 'capital', action: { type: 'openWorldSite', siteId: 'capital' } }],
    }),
    true,
  );
  assert.equal(refreshes.length, 1, 'open refreshes the guide synchronously');
  assert.equal(scheduled.length, 1, 'open schedules the settle refresh');
  scheduled.pop()();
  assert.equal(refreshes.length, 2, 'the scheduled refresh re-runs the guide');

  assert.equal(handler.closeWorldTargetPicker({ type: 'closeWorldTargetPicker' }), true);
  assert.equal(refreshes.length, 3, 'close refreshes the guide synchronously');
  assert.equal(scheduled.length, 1, 'close schedules its settle refresh');
});

test('closeWorldTargetPicker closes the snapshot and refreshes the march layer', () => {
  const calls = [];
  const core = makeCore({});
  const handler = new TargetPickerActionHandler({ core, helpers: makeHelpers(calls) });

  assert.equal(handler.closeWorldTargetPicker({ type: 'closeWorldTargetPicker' }), true);

  assert.deepEqual(calls, [['closeTargetPickerSnapshot', core.host]]);
  assert.deepEqual(core.calls, [['refreshWorldMarchLayer', 'closeWorldTargetPicker']]);
});
