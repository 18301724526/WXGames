const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const H5ShellAdapter = require('../js/ui/H5ShellAdapter');

const projectRoot = path.join(__dirname, '..', '..');

function makeFactory(name, calls, result = null) {
  return {
    fromDocument(doc, options) {
      calls.push([name, doc, options]);
      return result || { name };
    },
  };
}

function makeRuntimeFactory(name, calls, result = null) {
  return {
    fromRuntime(runtime, options) {
      calls.push([name, runtime, options]);
      return result || { name };
    },
  };
}

test('H5 shell adapter collects H5 adapters in one place', () => {
  const calls = [];
  const doc = { id: 'doc' };
  const runtime = {
    id: 'runtime',
    setInterval() {},
    clearInterval() {},
    setTimeout() {},
    clearTimeout() {},
  };
  const factories = {
    H5TextAdapter: makeFactory('text', calls),
    H5UpdateRuntimeAdapter: makeRuntimeFactory('updateRuntime', calls),
    H5AuthRuntimeAdapter: makeRuntimeFactory('authRuntime', calls),
    H5AuthStorageAdapter: makeRuntimeFactory('authStorage', calls),
    H5TutorialStorageAdapter: makeRuntimeFactory('tutorialStorage', calls),
    GameConfig: { API_BASE: '/api', SYNC_INTERVAL_MS: 2000 },
    UIStatePresenter: { name: 'presenter' },
    FrontendBuildingState: { name: 'buildingState' },
    FrontendGameState: { name: 'stateNormalizer' },
    GameAPI: class GameAPI {},
    GameStateSync: class GameStateSync {},
    UpdateChecker: class UpdateChecker {},
    GameStateManager: class GameStateManager {},
    TutorialController: class TutorialController {},
    EventController: class EventController {},
    BuildingController: class BuildingController {},
    TerritoryController: class TerritoryController {},
    AuthShellAdapter: makeFactory('auth', calls),
    NavigationShellAdapter: makeFactory('navigation', calls),
    TutorialCanvasRenderer: class TutorialCanvasRenderer {
      constructor() {
        calls.push(['tutorialRenderer']);
        this.name = 'tutorialRenderer';
      }
    },
  };
  const mountedModules = [];
  const registry = {
    ...factories,
    mountAuthMethods: (game, deps) => mountedModules.push(['auth', game, deps]),
    mountPopulationMethods: (game, deps) => mountedModules.push(['population', game, deps]),
    mountLogMethods: (game, deps) => mountedModules.push(['logs', game, deps]),
  };

  const setText = () => {};
  const getTerritoryUiState = () => ({ selectedSiteId: 'east' });
  const shell = H5ShellAdapter.fromDocument(doc, runtime, { registry, setText, getTerritoryUiState });
  const game = { id: 'game' };
  shell.gameModules.mount(game);

    assert.equal(mountedModules.length, 3);
    assert.deepEqual(mountedModules.map(([name, mountedGame]) => [name, mountedGame]), [['auth', game], ['population', game], ['logs', game]]);
    for (const [, , deps] of mountedModules) {
      assert.equal(deps.presenter, factories.UIStatePresenter);
      assert.deepEqual(deps.authRuntime, { name: 'authRuntime' });
      assert.deepEqual(deps.authStorage, { name: 'authStorage' });
    }
    assert.equal(shell.buildingRenderer, undefined);
    assert.equal(shell.buildingActions, undefined);
    assert.equal(shell.eventRenderer, undefined);
    assert.deepEqual(shell.updateRuntime, { name: 'updateRuntime' });
    assert.deepEqual(shell.authRuntime, { name: 'authRuntime' });
    assert.deepEqual(shell.authStorage, { name: 'authStorage' });
    assert.equal(shell.config, factories.GameConfig);
    assert.equal(shell.presenter, factories.UIStatePresenter);
    assert.equal(shell.buildingState, factories.FrontendBuildingState);
    assert.equal(shell.runtimeConstructors.GameAPI, factories.GameAPI);
    assert.equal(shell.runtimeConstructors.GameStateSync, factories.GameStateSync);
    assert.equal(shell.runtimeConstructors.UpdateChecker, factories.UpdateChecker);
    assert.equal(shell.runtimeConstructors.GameStateManager, factories.GameStateManager);
    assert.equal(shell.runtimeConstructors.TutorialController, factories.TutorialController);
    assert.equal(shell.runtimeConstructors.EventController, factories.EventController);
    assert.equal(shell.runtimeConstructors.BuildingController, factories.BuildingController);
    assert.equal(shell.runtimeConstructors.TerritoryController, factories.TerritoryController);
    assert.equal(shell.stateNormalizer, factories.FrontendGameState);
    assert.deepEqual(shell.tutorialStorage, { name: 'tutorialStorage' });
    assert.equal(typeof shell.scheduler.setInterval, 'function');
    assert.equal(typeof shell.scheduler.clearInterval, 'function');
    assert.equal(typeof shell.scheduler.setTimeout, 'function');
    assert.equal(typeof shell.scheduler.clearTimeout, 'function');
    assert.equal(shell.floatingText, undefined);
    assert.equal(shell.namingModal, undefined);
    assert.equal(shell.territoryActions, undefined);
    assert.equal(shell.logModal, undefined);
    assert.equal(shell.runtimeLog, undefined);
    assert.equal(shell.territoryRenderer, undefined);
    assert.ok(calls.some(([name, callDoc]) => name === 'auth' && callDoc === doc));
    assert.ok(calls.some(([name, callRuntime]) => name === 'updateRuntime' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'authRuntime' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'authStorage' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'tutorialStorage' && callRuntime === runtime));
    assert.equal(calls.some(([name]) => name === 'floatingText'), false);
    assert.equal(calls.some(([name]) => name === 'civilization'), false);
    assert.ok(calls.some(([name]) => name === 'tutorialRenderer'));
    assert.equal(shell.tutorialTargets, undefined);
});

test('app receives H5 shell instead of assembling every document adapter itself', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  const shellJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'ui', 'H5ShellAdapter.js'), 'utf8');

  assert.match(html, /js\/ui\/H5ShellAdapter\.js\?v=h5-shell-registry-v1/);
  assert.doesNotMatch(html, /CitySwitcherAdapter|citySwitcher/);
  assert.doesNotMatch(html, /PopulationPanelAdapter/);
  assert.doesNotMatch(html, /AdvisorPanelAdapter|advisorModal|advisorBtn/);
  assert.match(html, /js\/services\/GameStateSync\.js\?v=sync-scheduler-v2[\s\S]*js\/services\/UpdateChecker\.js\?v=update-scheduler-v2[\s\S]*js\/ui\/H5ShellAdapter\.js\?v=h5-shell-registry-v1[\s\S]*app\.js\?v=h5-bootstrap-explicit-doc-v3/);
  assert.match(appJs, /const shell = window\.H5ShellAdapter\?\.fromDocument\(document, window/);
  assert.match(appJs, /registry: window/);
  assert.match(shellJs, /const registry = options\.registry \|\| runtimeHost/);
  assert.doesNotMatch(shellJs, /BuildingActionAdapter|BuildingUIRenderer|buildingActions|buildingRenderer|EventUIRenderer|eventRenderer/);
  assert.doesNotMatch(shellJs, /global\.(?:GameConfig|UIStatePresenter|FrontendBuildingState|GameAPI|GameStateSync|UpdateChecker|GameStateManager|TutorialController|EventController|BuildingController|TerritoryController|FrontendGameState|mountAuthMethods|mountPopulationMethods|mountLogMethods)/);
  assert.doesNotMatch(appJs, /new window\./);
  assert.doesNotMatch(appJs, /window\.FrontendGameState/);
  assert.doesNotMatch(appJs, /window\.GameConfig/);
  assert.doesNotMatch(appJs, /window\.UIStatePresenter/);
  assert.match(appJs, /new constructors\.GameStateManager\(this\.state, \{ buildingState: this\.buildingState \}\)/);
  assert.doesNotMatch(appJs, /[^\w.]setInterval\(/);
  assert.doesNotMatch(appJs, /[^\w.]clearInterval\(/);
  assert.doesNotMatch(appJs, /window\.mountFloatingText/);
  assert.doesNotMatch(appJs, /window\.mount(?:AuthMethods|PopulationMethods|LogMethods)/);
  assert.match(appJs, /this\.gameModules\?\.mount\?\.\(this\)/);
  assert.doesNotMatch(appJs, /AuthShellAdapter\?\.fromDocument\(document/);
  assert.doesNotMatch(appJs, /PopulationPanelAdapter\?\.fromDocument\(document/);
  assert.doesNotMatch(shellJs, /ResourceRenderer|ResourceDetailModalAdapter|CitySwitcherAdapter|PopulationPanelAdapter|populationPanel|AdvisorPanelAdapter|advisorPanel/);
  assert.doesNotMatch(shellJs, /CivilizationPanelAdapter|civilizationPanel/);
  assert.doesNotMatch(shellJs, /MilitaryPanelAdapter|militaryPanel|TerritoryActionAdapter|TerritoryUIRenderer|territoryActions|territoryRenderer/);
  assert.doesNotMatch(shellJs, /NamingModalAdapter|namingModal/);
  assert.doesNotMatch(shellJs, /FloatingTextAdapter|floatingText/);
  assert.doesNotMatch(shellJs, /TutorialTargetAdapter|tutorialTargets|TutorialUIRenderer/);
  assert.doesNotMatch(shellJs, /LogModalAdapter|RuntimeLogAdapter|logModal|runtimeLog/);
  assert.doesNotMatch(appJs, /renderRecentLogView|showRecentLogs|runtimeLog|logModal/);
  assert.match(html, /js\/ui\/TutorialCanvasRenderer\.js\?v=tutorial-canvas-v1/);
});
