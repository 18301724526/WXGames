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

function makeDocumentFactory(name, calls, result = null) {
  return {
    fromDocument(...args) {
      calls.push([name, ...args]);
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
  const originalGlobals = {};
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
    FloatingTextAdapter: makeFactory('floatingText', calls),
    ResourceRenderer: makeDocumentFactory('resource', calls),
    ResourceDetailModalAdapter: makeFactory('resourceDetail', calls),
    AdvisorPanelAdapter: makeFactory('advisor', calls),
    NamingModalAdapter: makeFactory('naming', calls),
    AuthShellAdapter: makeFactory('auth', calls),
    PopulationPanelAdapter: makeFactory('population', calls),
    CitySwitcherAdapter: makeFactory('city', calls),
    NavigationShellAdapter: makeFactory('navigation', calls),
    TutorialTargetAdapter: makeFactory('tutorialTargets', calls),
    CivilizationPanelAdapter: makeFactory('civilization', calls),
    MilitaryPanelAdapter: makeFactory('military', calls),
    BuildingActionAdapter: makeFactory('buildingActions', calls, { name: 'buildingActions', getContainer: () => 'building-grid' }),
    LogModalAdapter: makeFactory('logModal', calls),
    RuntimeLogAdapter: makeFactory('runtimeLog', calls),
    TerritoryActionAdapter: makeFactory('territoryActions', calls, { name: 'territoryActions', getContainer: () => 'territory-grid' }),
    TutorialUIRenderer: makeFactory('tutorialRenderer', calls),
  };

  try {
    for (const [key, value] of Object.entries(factories)) {
      originalGlobals[key] = globalThis[key];
      globalThis[key] = value;
    }
    originalGlobals.BuildingUIRenderer = globalThis.BuildingUIRenderer;
    originalGlobals.EventUIRenderer = globalThis.EventUIRenderer;
    originalGlobals.TerritoryUIRenderer = globalThis.TerritoryUIRenderer;
    globalThis.BuildingUIRenderer = class {
      constructor(container, buildingConfig, options) {
        this.container = container;
        this.buildingConfig = buildingConfig;
        this.options = options;
      }
    };
    globalThis.EventUIRenderer = class {
      constructor(setText) {
        this.setText = setText;
      }
    };
    globalThis.TerritoryUIRenderer = class {
      constructor(container, options) {
        this.container = container;
        this.options = options;
      }
    };
    originalGlobals.mountAuthMethods = globalThis.mountAuthMethods;
    originalGlobals.mountPopulationMethods = globalThis.mountPopulationMethods;
    originalGlobals.mountLogMethods = globalThis.mountLogMethods;
    const mountedModules = [];
    globalThis.mountAuthMethods = (game, deps) => mountedModules.push(['auth', game, deps]);
    globalThis.mountPopulationMethods = (game, deps) => mountedModules.push(['population', game, deps]);
    globalThis.mountLogMethods = (game, deps) => mountedModules.push(['logs', game, deps]);

    const setText = () => {};
    const getTerritoryUiState = () => ({ selectedSiteId: 'east' });
    const shell = H5ShellAdapter.fromDocument(doc, runtime, { setText, getTerritoryUiState });
    const game = { id: 'game' };
    shell.gameModules.mount(game);

    assert.equal(mountedModules.length, 3);
    assert.deepEqual(mountedModules.map(([name, mountedGame]) => [name, mountedGame]), [['auth', game], ['population', game], ['logs', game]]);
    for (const [, , deps] of mountedModules) {
      assert.equal(deps.presenter, factories.UIStatePresenter);
      assert.deepEqual(deps.authRuntime, { name: 'authRuntime' });
      assert.deepEqual(deps.authStorage, { name: 'authStorage' });
    }
    assert.equal(shell.buildingRenderer.container, 'building-grid');
    assert.deepEqual(shell.buildingRenderer.buildingConfig, {});
    assert.equal(shell.buildingRenderer.options.presenter, factories.UIStatePresenter);
    assert.equal(shell.eventRenderer.setText, setText);
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
    assert.deepEqual(shell.floatingText, { name: 'floatingText' });
    assert.equal(shell.territoryRenderer.container, 'territory-grid');
    assert.equal(shell.territoryRenderer.options.getUiState, getTerritoryUiState);
    assert.deepEqual(shell.territoryRenderer.options.getUiState(), { selectedSiteId: 'east' });
    assert.ok(calls.some(([name, callDoc]) => name === 'auth' && callDoc === doc));
    assert.ok(calls.some(([name, callRuntime]) => name === 'updateRuntime' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'authRuntime' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'authStorage' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'tutorialStorage' && callRuntime === runtime));
    assert.ok(calls.some(([name, callDoc]) => name === 'floatingText' && callDoc === doc));
    assert.ok(calls.some(([name, callDoc, callSetText, options]) => (
      name === 'resource'
      && callDoc === doc
      && callSetText === setText
      && options.presenter === factories.UIStatePresenter
    )));
    assert.ok(calls.some(([name, callDoc, options]) => name === 'civilization' && callDoc === doc && options.setText === setText));
    assert.ok(calls.some(([name, callDoc]) => name === 'tutorialRenderer' && callDoc === doc));
  } finally {
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test('app receives H5 shell instead of assembling every document adapter itself', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');

  assert.match(html, /js\/ui\/H5ShellAdapter\.js\?v=state-manager-building-v1/);
  assert.match(html, /js\/services\/GameStateSync\.js\?v=sync-scheduler-v2[\s\S]*js\/services\/UpdateChecker\.js\?v=update-scheduler-v1[\s\S]*js\/ui\/H5ShellAdapter\.js\?v=state-manager-building-v1[\s\S]*app\.js\?v=state-manager-building-v1/);
  assert.match(appJs, /const shell = window\.H5ShellAdapter\?\.fromDocument\(document, window/);
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
  assert.doesNotMatch(appJs, /ResourceRenderer\.fromDocument\(document/);
  assert.doesNotMatch(appJs, /AuthShellAdapter\?\.fromDocument\(document/);
  assert.doesNotMatch(appJs, /PopulationPanelAdapter\?\.fromDocument\(document/);
});
