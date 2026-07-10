const test = require('node:test');
const assert = require('node:assert/strict');

const UiRuntimeStateStore = require('./UiRuntimeStateStore');
const StateWriter = require('./StateWriter');

test('UiRuntimeStateStore owns navigation fields behind host accessors', () => {
  const host = {
    state: { currentTab: 'military', militaryView: 'world' },
    activeTab: 'resources',
    militaryView: 'army',
  };

  const runtimeState = UiRuntimeStateStore.ensure(host);
  assert.equal(runtimeState.activeTab, 'military');
  assert.equal(runtimeState.militaryView, 'world');

  host.activeTab = 'tech';
  host.militaryView = 'scout';

  assert.deepEqual(UiRuntimeStateStore.getNavigation(host), {
    activeTab: 'tech',
    militaryView: 'scout',
  });
  assert.equal(host.state.currentTab, 'tech');
  assert.equal(host.state.militaryView, 'scout');
});

test('UiRuntimeStateStore delegates shell accessors to the mounted game owner', () => {
  const game = {
    state: { currentTab: 'resources', militaryView: 'army' },
  };
  const shell = { lastGame: game };

  UiRuntimeStateStore.ensure(shell);
  shell.activeTab = 'military';
  shell.militaryView = 'world';

  assert.equal(game.activeTab, 'military');
  assert.equal(game.militaryView, 'world');
  assert.equal(game.state.currentTab, 'military');
  assert.equal(game.state.militaryView, 'world');
  assert.deepEqual(UiRuntimeStateStore.getNavigation(game), {
    activeTab: 'military',
    militaryView: 'world',
  });
});

test('UiRuntimeStateStore syncs StateWriter currentTab and militaryView commits', () => {
  const host = {};
  UiRuntimeStateStore.ensure(host);

  StateWriter.commit(host, {
    resources: {},
    currentTab: 'military',
    militaryView: 'veteranCamp',
  }, { source: 'test' });

  assert.equal(host.activeTab, 'military');
  assert.equal(host.militaryView, 'veteranCamp');
  assert.deepEqual(UiRuntimeStateStore.getNavigation(host), {
    activeTab: 'military',
    militaryView: 'veteranCamp',
  });
});

test('UiRuntimeStateStore projects owner.state navigation only through StateWriter', () => {
  const originalStateWriter = global.StateWriter;
  const commits = [];
  global.StateWriter = {
    commit(host, patcher, meta) {
      commits.push({ host, patcher, meta });
      return host.state;
    },
  };

  try {
    const host = {
      state: { currentTab: 'resources', militaryView: 'army' },
    };

    UiRuntimeStateStore.ensure(host);
    UiRuntimeStateStore.setField(host, 'activeTab', 'tech');

    assert.equal(host.state.currentTab, 'resources');
    assert.equal(commits.length, 1);
    assert.equal(commits[0].host, host);
    assert.deepEqual(commits[0].patcher, { currentTab: 'tech', militaryView: 'army' });
    assert.deepEqual(commits[0].meta, { source: 'UiRuntimeStateStore.syncOwnerState' });
  } finally {
    global.StateWriter = originalStateWriter;
  }
});

test('UiRuntimeStateStore normalizes and closes armyFormationEditor', () => {
  const host = {};

  UiRuntimeStateStore.setField(host, 'armyFormationEditor', {
    open: true,
    cityId: 'capital',
    slot: 2,
    memberIds: ['p1'],
    soldierAssignments: { p1: 10 },
    page: 3,
    saving: true,
  });

  assert.deepEqual(host.armyFormationEditor, {
    open: true,
    cityId: 'capital',
    slot: 2,
    memberIds: ['p1'],
    soldierAssignments: { p1: 10 },
    soldierDraftAssignments: {},
    page: 3,
    saving: true,
  });

  UiRuntimeStateStore.closeFormationEditor(host);
  assert.equal(host.armyFormationEditor.open, false);
  assert.equal(host.armyFormationEditor.cityId, '');
  assert.deepEqual(host.armyFormationEditor.memberIds, []);
});
