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
  const runtime = { id: 'runtime' };
  const originalGlobals = {};
  const factories = {
    H5TextAdapter: makeFactory('text', calls),
    H5UpdateRuntimeAdapter: makeRuntimeFactory('updateRuntime', calls),
    H5AuthStorageAdapter: makeRuntimeFactory('authStorage', calls),
    H5TutorialStorageAdapter: makeRuntimeFactory('tutorialStorage', calls),
    ResourceRenderer: makeFactory('resource', calls),
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
      constructor(container) {
        this.container = container;
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

    const setText = () => {};
    const getTerritoryUiState = () => ({ selectedSiteId: 'east' });
    const shell = H5ShellAdapter.fromDocument(doc, runtime, { setText, getTerritoryUiState });

    assert.equal(shell.buildingRenderer.container, 'building-grid');
    assert.equal(shell.eventRenderer.setText, setText);
    assert.deepEqual(shell.updateRuntime, { name: 'updateRuntime' });
    assert.deepEqual(shell.authStorage, { name: 'authStorage' });
    assert.deepEqual(shell.tutorialStorage, { name: 'tutorialStorage' });
    assert.equal(shell.territoryRenderer.container, 'territory-grid');
    assert.equal(shell.territoryRenderer.options.getUiState, getTerritoryUiState);
    assert.deepEqual(shell.territoryRenderer.options.getUiState(), { selectedSiteId: 'east' });
    assert.ok(calls.some(([name, callDoc]) => name === 'auth' && callDoc === doc));
    assert.ok(calls.some(([name, callRuntime]) => name === 'updateRuntime' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'authStorage' && callRuntime === runtime));
    assert.ok(calls.some(([name, callRuntime]) => name === 'tutorialStorage' && callRuntime === runtime));
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

  assert.match(html, /js\/ui\/H5ShellAdapter\.js\?v=h5-tutorial-storage-v1/);
  assert.match(html, /js\/ui\/H5ShellAdapter\.js\?v=h5-tutorial-storage-v1[\s\S]*app\.js\?v=h5-tutorial-storage-v1/);
  assert.match(appJs, /const shell = window\.H5ShellAdapter\?\.fromDocument\(document, window/);
  assert.doesNotMatch(appJs, /ResourceRenderer\.fromDocument\(document/);
  assert.doesNotMatch(appJs, /AuthShellAdapter\?\.fromDocument\(document/);
  assert.doesNotMatch(appJs, /PopulationPanelAdapter\?\.fromDocument\(document/);
});
