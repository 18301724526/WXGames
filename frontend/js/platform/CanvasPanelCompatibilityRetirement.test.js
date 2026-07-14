const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ModalStore = require('../state/ModalStore');
require('./CanvasActionDispatcher');
const CanvasGameApp = require('./CanvasGameApp');
const CanvasGameShell = require('./CanvasGameShell');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PLATFORM_DIR = path.join(REPO_ROOT, 'frontend/js/platform');

function walkJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsFiles(fullPath);
    if (!entry.isFile() || !entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) return [];
    return [fullPath];
  });
}

function createScheduler() {
  return {
    markDirty() {},
    flush() {},
    isAtomic() {
      return false;
    },
  };
}

function runFamousPanelActions(host) {
  assert.equal(host.dispatchCanvasAction({ type: 'openFamousPersons' }), true);
  assert.equal(host.dispatchCanvasAction({ type: 'changeFamousPersonsPage', delta: 1 }), true);
  assert.equal(host.dispatchCanvasAction({ type: 'openFamousPersonDetail', personId: 'fp-1' }), true);
  assert.equal(host.dispatchCanvasAction({ type: 'closeFamousPersonDetail' }), true);
  assert.equal(host.dispatchCanvasAction({ type: 'closeFamousPersons' }), true);
}

test('production code does not expose retired panel compatibility paths', () => {
  const forbidden = [
    /handle_(openFamousPersons|closeFamousPersons|openFamousPersonDetail|closeFamousPersonDetail|changeFamousPersonsPage)/,
    /refreshPanelSurface/,
    /renderPanelCanvasAction|isPanelSurfaceAction/,
    /syncOpenPanelSurfacesAfterBaseRender|baseHitTargetsByPanel/,
    /panelAction\.controllerWrapper\.count/,
    /panelSurface\.refreshAlias\.count/,
  ];

  walkJsFiles(PLATFORM_DIR).forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    forbidden.forEach((pattern) => {
      assert.equal(pattern.test(text), false, `${pattern} should not appear in ${path.relative(REPO_ROOT, file)}`);
    });
  });
});

test('App and Shell famous dispatcher paths leave retired compatibility counters at zero', () => {
  const previousCounters = global.__panelRefactorCounters;
  global.__panelRefactorCounters = {};
  ModalStore.closeAll();
  try {
    const app = new CanvasGameApp({
      runtimeRequired: false,
      apiRequired: false,
      rendererRequired: false,
      useWorldMapRuntime: false,
      renderer: { clearFamousSkillTooltip() {} },
      initialState: {
        currentTab: 'military',
        famousPersons: { people: [{ id: 'fp-1' }], candidates: [] },
      },
    });
    app.stageScheduler = createScheduler();

    const shell = new CanvasGameShell({
      previewEnabled: false,
      inputEnabled: false,
      renderer: { clearFamousSkillTooltip() {} },
    });
    shell.stageScheduler = createScheduler();
    shell.lastGame = {
      state: {
        currentTab: 'military',
        famousPersons: { people: [{ id: 'fp-1' }], candidates: [] },
      },
      famousPersonsPage: 0,
      selectedFamousPersonId: '',
    };

    runFamousPanelActions(app);
    runFamousPanelActions(shell);

    assert.equal(Number(global.__panelRefactorCounters['panelAction.controllerWrapper.count'] || 0), 0);
    assert.equal(Number(global.__panelRefactorCounters['panelAction.dispatcherFallback.count'] || 0), 0);
    assert.equal(Number(global.__panelRefactorCounters['panelSurface.refreshAlias.count'] || 0), 0);
    assert.equal(Number(global.__panelRefactorCounters['panelSurface.syncAfterBaseRender.count'] || 0), 0);
    assert.equal(Number(global.__panelRefactorCounters['panelSurface.baseHitTargetsSnapshot.count'] || 0), 0);
  } finally {
    ModalStore.closeAll();
    if (previousCounters === undefined) delete global.__panelRefactorCounters;
    else global.__panelRefactorCounters = previousCounters;
  }
});
