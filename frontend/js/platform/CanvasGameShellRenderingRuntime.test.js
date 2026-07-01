const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');
const CanvasGameShellRenderingRuntime = require('./CanvasGameShellRenderingRuntime');
const CanvasGameShellTransitionTimers = require('./CanvasGameShellTransitionTimers');

// Batch 8F: the Shell rendering runtime option-builder now SOURCES its blocking-panel
// reads from the renderer snapshot (snapshot.panel.showX) instead of host mirrors.

function makeShell(stateOverrides = {}) {
  class Shell {}
  CanvasModeOwnershipRuntime.install(Shell);
  CanvasModalSnapshotAdapter.install(Shell);
  CanvasGameShellRenderingRuntime.install(Shell);
  CanvasGameShellTransitionTimers.install(Shell);
  const shell = new Shell();
  shell.lastGame = {
    state: { currentTab: 'resources', militaryView: 'army', techUiState: {}, ...stateOverrides },
  };
  shell.getFloatingTextView = () => [];
  shell.buildRendererSnapshot();
  return shell;
}

test('Shell runtime buildRenderOptions sources blocking-panel options from snapshot panel, not host mirrors', () => {
  const shell = makeShell();
  shell.showSettings = false;
  shell.activeCommandPanel = '';
  shell.openBlockingPanelSnapshot('showSettings', true);
  shell.openBlockingPanelSnapshot('showLogs', true);
  shell.openBlockingPanelSnapshot('showAdvisor', true);
  shell.openBlockingPanelSnapshot('showResourceDetails', true);
  shell.openBlockingPanelSnapshot('showCityManagement', true);
  shell.openBlockingPanelSnapshot('showTaskCenter', true);
  shell.openBlockingPanelSnapshot('showGuidebook', true);
  shell.openBlockingPanelSnapshot('showFamousPersons', true);
  shell.openBlockingPanelSnapshot('activeCommandPanel', 'tech');

  const options = shell.buildRenderOptions('resources');
  assert.equal(options.showSettings, true);
  assert.equal(options.showLogs, true);
  assert.equal(options.showAdvisor, true);
  assert.equal(options.showResourceDetails, true);
  assert.equal(options.showCityManagement, true);
  assert.equal(options.showTaskCenter, true);
  assert.equal(options.showGuidebook, true);
  assert.equal(options.showFamousPersons, true);
  assert.equal(options.showCitySwitcher, false);
  assert.equal(options.showSubcityList, false);
  assert.equal(options.activeCommandPanel, 'tech');
});

test('Shell runtime buildRenderOptions techDetailOpen keeps the state.techUiState.detailOpen carve-out', () => {
  const shellWithDetail = makeShell({ techUiState: { detailOpen: true } });
  assert.equal(shellWithDetail.buildRenderOptions('tech').techDetailOpen, true);

  const shell = makeShell({ techUiState: { detailOpen: false } });
  assert.equal(shell.buildRenderOptions('tech').techDetailOpen, false);

  shell.openBlockingPanelSnapshot('techDetailOpen', true);
  assert.equal(shell.buildRenderOptions('tech').techDetailOpen, true);
});

test('Shell runtime buildRenderOptions closing a panel through the snapshot clears its option', () => {
  const shell = makeShell();
  shell.openBlockingPanelSnapshot('showFamousPersons', true);
  assert.equal(shell.buildRenderOptions('resources').showFamousPersons, true);

  shell.closeBlockingPanelSnapshot('showFamousPersons');
  assert.equal(shell.buildRenderOptions('resources').showFamousPersons, false);
});
