const test = require('node:test');
const assert = require('node:assert/strict');

global.EcsModeRuntime = require('../ecs/mode/EcsModeRuntimeEntry');
const CanvasModeOwnershipRuntime = require('./CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');
const CanvasGameAppRenderingRuntime = require('./CanvasGameAppRenderingRuntime');
const CanvasGameAppSecondaryPanels = require('./CanvasGameAppSecondaryPanels');

// Batch 8F: the App rendering runtime now SOURCES its blocking-panel render options
// from the renderer snapshot (snapshot.panel.showX) instead of host mirrors, and its
// reset paths CLOSE panels through the snapshot owner instead of writing host mirrors.

function makeApp() {
  class App {}
  CanvasModeOwnershipRuntime.install(App);
  CanvasModalSnapshotAdapter.install(App);
  CanvasGameAppRenderingRuntime.install(App);
  CanvasGameAppSecondaryPanels.install(App);
  const app = new App();
  const renderCalls = [];
  app.state = { currentTab: 'resources', militaryView: 'army', techUiState: {} };
  app.renderer = {
    render(state, options) {
      renderCalls.push(options);
      return true;
    },
    clearFamousSkillTooltip() {},
  };
  app.getActiveTab = () => 'resources';
  app.buildRendererSnapshot();
  return { app, renderCalls };
}

test('App runtime renderCanvasSurface sources blocking-panel options from snapshot panel, not host mirrors', () => {
  const { app, renderCalls } = makeApp();
  // Host mirror fields are stale/absent; the snapshot owner is the source of truth.
  app.showResourceDetails = false;
  app.activeCommandPanel = '';
  app.openBlockingPanelSnapshot('showResourceDetails', true);
  app.openBlockingPanelSnapshot('showTaskCenter', true);
  app.openBlockingPanelSnapshot('showFamousPersons', true);
  app.openBlockingPanelSnapshot('activeCommandPanel', 'tech');

  assert.equal(app.renderCanvasSurface('resources'), true);
  const options = renderCalls[renderCalls.length - 1];
  assert.equal(options.showResourceDetails, true);
  assert.equal(options.showTaskCenter, true);
  assert.equal(options.showFamousPersons, true);
  assert.equal(options.showCitySwitcher, false);
  assert.equal(options.activeCommandPanel, 'tech');
});

test('App runtime techDetailOpen option keeps the techUiState.detailOpen carve-out', () => {
  const { app, renderCalls } = makeApp();
  // techDetailOpen owned by the snapshot, OR-ed with state.techUiState.detailOpen.
  app.state = { currentTab: 'resources', militaryView: 'army', techUiState: { detailOpen: true } };
  app.renderCanvasSurface('resources');
  assert.equal(renderCalls[renderCalls.length - 1].techDetailOpen, true);

  app.state = { currentTab: 'resources', militaryView: 'army', techUiState: { detailOpen: false } };
  app.renderCanvasSurface('resources');
  assert.equal(renderCalls[renderCalls.length - 1].techDetailOpen, false);

  app.openBlockingPanelSnapshot('techDetailOpen', true);
  app.renderCanvasSurface('resources');
  assert.equal(renderCalls[renderCalls.length - 1].techDetailOpen, true);
});

test('App runtime resetForCanvasTabSwitch closes its subset of blocking panels through the snapshot', () => {
  const { app } = makeApp();
  app.openBlockingPanelSnapshot('showResourceDetails', true);
  app.openBlockingPanelSnapshot('showCitySwitcher', true);
  app.openBlockingPanelSnapshot('showSubcityList', true);
  app.openBlockingPanelSnapshot('showCityManagement', true);
  app.openBlockingPanelSnapshot('showTaskCenter', true);
  app.openBlockingPanelSnapshot('showGuidebook', true);
  app.openBlockingPanelSnapshot('showFamousPersons', true);
  app.openBlockingPanelSnapshot('activeCommandPanel', 'capital');
  app.openBlockingPanelSnapshot('techDetailOpen', true);
  // Panels OUTSIDE the reset subset must survive (settings/logs/advisor not touched).
  app.openBlockingPanelSnapshot('showSettings', true);
  app.openBlockingPanelSnapshot('showAdvisor', true);

  app.resetForCanvasTabSwitch();

  const panel = app.getRendererSnapshot().panel;
  assert.equal(panel.showResourceDetails, false);
  assert.equal(panel.showCitySwitcher, false);
  assert.equal(panel.showSubcityList, false);
  assert.equal(panel.showCityManagement, false);
  assert.equal(panel.showTaskCenter, false);
  assert.equal(panel.showGuidebook, false);
  assert.equal(panel.showFamousPersons, false);
  assert.equal(panel.activeCommandPanel, '');
  assert.equal(panel.techDetailOpen, false);
  // Out-of-subset panels preserved.
  assert.equal(panel.showSettings, true);
  assert.equal(panel.showAdvisor, true);
});

test('App runtime resetLocalViewToResources closes its subset of blocking panels through the snapshot', () => {
  const { app } = makeApp();
  app.resolveMapHomeViewState = () => ({
    activeTab: 'military',
    militaryView: 'world',
    isMapHome: true,
  });
  app.openBlockingPanelSnapshot('showResourceDetails', true);
  app.openBlockingPanelSnapshot('showCitySwitcher', true);
  app.openBlockingPanelSnapshot('showSubcityList', true);
  app.openBlockingPanelSnapshot('showCityManagement', true);
  app.openBlockingPanelSnapshot('showTaskCenter', true);
  app.openBlockingPanelSnapshot('showGuidebook', true);
  app.openBlockingPanelSnapshot('showFamousPersons', true);
  app.openBlockingPanelSnapshot('activeCommandPanel', 'military');
  app.openBlockingPanelSnapshot('techDetailOpen', true);
  app.openBlockingPanelSnapshot('showSettings', true);

  app.resetLocalViewToResources({ skipRender: true, skipShell: true });

  const panel = app.getRendererSnapshot().panel;
  assert.equal(panel.showResourceDetails, false);
  assert.equal(panel.showCityManagement, false);
  assert.equal(panel.showTaskCenter, false);
  assert.equal(panel.showGuidebook, false);
  assert.equal(panel.showFamousPersons, false);
  assert.equal(panel.activeCommandPanel, '');
  assert.equal(panel.techDetailOpen, false);
  // Out-of-subset panel preserved.
  assert.equal(panel.showSettings, true);
});

test('App runtime switchTab clears techDetailOpen through the snapshot', () => {
  const { app } = makeApp();
  app.presenter = { buildTabNavigationViewState: () => ({ activeTab: 'buildings' }) };
  app.getPreferredMilitaryView = () => 'army';
  app.startPageTransition = () => true;
  app.renderMilitaryView = () => {};
  app.renderSoftGuide = () => {};
  app.openBlockingPanelSnapshot('techDetailOpen', true);

  app.switchTab('buildings');

  assert.equal(app.getRendererSnapshot().panel.techDetailOpen, false);
});
