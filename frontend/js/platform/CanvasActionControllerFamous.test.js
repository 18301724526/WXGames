const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
const CanvasActionDispatcher = require('./CanvasActionDispatcher');
const ChangeEventBus = require('../state/ChangeEventBus');
const ModalStore = require('../state/ModalStore');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

const HostController = CanvasActionController;

test('CanvasActionController retires famous panel wrappers but keeps API commands', () => {
  assert.equal(typeof HostController.prototype.handle_openFamousPersons, 'undefined');
  assert.equal(typeof HostController.prototype.handle_closeFamousPersons, 'undefined');
  assert.equal(typeof HostController.prototype.handle_openFamousPersonDetail, 'undefined');
  assert.equal(typeof HostController.prototype.handle_closeFamousPersonDetail, 'undefined');
  assert.equal(typeof HostController.prototype.handle_changeFamousPersonsPage, 'undefined');
  assert.equal(typeof HostController.prototype.handle_seekFamousPerson, 'function');
});

test('open and close famous persons sync shell, game, renderer, and tutorial state', () => {
  const calls = [];
  const game = makeModalHost({
    famousPersonsPage: 3,
    selectedFamousPersonId: 'fp-old',
    tutorialController: {
      onFamousPersonsOpened() {
        calls.push(['opened']);
      },
      onFamousPersonsClosed() {
        calls.push(['closed']);
      },
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
    runtime: {
      setTimeout(callback) {
        calls.push(['timeout']);
        callback();
      },
    },
  });
  const host = makeModalHost({
    famousPersonsPage: 2,
    selectedFamousPersonId: 'fp-old',
    lastGame: game,
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearTooltip']);
      },
    },
    renderPanelOverlaySurface(panelKey, _manager, options) {
      calls.push(['renderPanelOverlaySurface', panelKey, options.action.type]);
      return true;
    },
    clearPanelOverlaySurface(panelKey, _manager, options) {
      calls.push(['clearPanelOverlaySurface', panelKey, options.action?.type || '']);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  game.canvasShell = host;
  // The famous open sweeps the other blocking panels (Axis-1): seed an open task
  // center + command panel so the close-on-open is observable through the owner.
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'famous');
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({ type: 'openFamousPersons' }, host), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isModalOpen('modal:famousPersons'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.famousPersonsPage, 2);
  assert.equal(host.selectedFamousPersonId, 'fp-old');
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');

  assert.equal(dispatcher.handle({ type: 'closeFamousPersons' }, host), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(host.isModalOpen('modal:famousPersons'), false);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  assert.deepEqual(calls, [
    ['clearTooltip'],
    ['renderPanelOverlaySurface', 'famousPersons', 'openFamousPersons'],
    ['opened'],
    ['refresh'],
    ['timeout'],
    ['refresh'],
    ['clearTooltip'],
    ['clearPanelOverlaySurface', 'famousPersons', 'closeFamousPersons'],
    ['closed'],
    ['timeout'],
    ['refresh'],
  ]);
});

// UI-REDO ⑦a sibling characterization: a tutorial-locked 「名人」 dock tap must be a
// pure no-op on the modal owner. The regression this locks: the panel action route
// opened modal:famousPersons eagerly and ignored the tutorial's answer, so a vetoed
// step (canOpenTab('famousPersons') false) still got the panel -- the tab lock leaked.
test('CanvasActionController vetoes tutorial-locked famous persons without mutating the modal owner', () => {
  ModalStore.closeAll();
  const calls = [];
  const game = makeModalHost({
    famousPersonsPage: 3,
    selectedFamousPersonId: 'fp-old',
    tutorialController: {
      canOpenTab(tabId) {
        calls.push(['canOpenTab', tabId]);
        return false;
      },
      onFamousPersonsOpened() {
        calls.push(['onFamousPersonsOpened']);
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
  });
  const host = makeModalHost({
    getCanvasGameHost() {
      return game;
    },
    showFloatingText(message) {
      calls.push(['showFloatingText', message]);
      return true;
    },
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearTooltip']);
      },
    },
    renderPanelOverlaySurface(panelKey, _manager, options) {
      calls.push(['renderPanelOverlaySurface', panelKey, options.action.type]);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  // Seed another blocking panel: a veto must not run the close-on-open sweep either.
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({ type: 'openFamousPersons' }, host), false);

  // No panel on the modal owner (the policy-leak regression proxy)...
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(host.isModalOpen('modal:famousPersons'), false);
  // ...the sibling panel survives (no close-on-open sweep ran)...
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), true);
  // ...and the famous-persons owner fields are untouched.
  assert.equal(game.famousPersonsPage, 3);
  assert.equal(game.selectedFamousPersonId, 'fp-old');
  // The veto is decided by the sync gate with player feedback; the tutorial event
  // never fires, no tooltip clear, no render (nothing changed).
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['canOpenTab', 'famousPersons']);
  assert.equal(calls[1][0], 'showFloatingText');
  assert.ok(String(calls[1][1] || '').length > 0);
});

test('CanvasActionController opens famous persons when the tutorial gate allows it', () => {
  ModalStore.closeAll();
  const calls = [];
  const game = makeModalHost({
    famousPersonsPage: 3,
    selectedFamousPersonId: 'fp-old',
    tutorialController: {
      canOpenTab(tabId) {
        calls.push(['canOpenTab', tabId]);
        return true;
      },
      onFamousPersonsOpened() {
        calls.push(['onFamousPersonsOpened']);
      },
      refreshCurrentHighlight() {
        calls.push(['refreshCurrentHighlight']);
      },
    },
    runtime: {
      setTimeout(callback) {
        calls.push(['timeout']);
        callback();
      },
    },
  });
  const host = makeModalHost({
    getCanvasGameHost() {
      return game;
    },
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearTooltip']);
      },
    },
    renderPanelOverlaySurface(panelKey, _manager, options) {
      calls.push(['renderPanelOverlaySurface', panelKey, options.action.type]);
      return true;
    },
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  const dispatcher = new CanvasActionDispatcher();

  assert.equal(dispatcher.handle({ type: 'openFamousPersons' }, host), true);

  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isModalOpen('modal:famousPersons'), true);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  // canOpenTab -> open/clear/render -> tutorial event -> highlight refresh: the
  // allowed path keeps the pre-gate order exactly (zero-regression lock).
  assert.deepEqual(calls, [
    ['canOpenTab', 'famousPersons'],
    ['clearTooltip'],
    ['renderPanelOverlaySurface', 'famousPersons', 'openFamousPersons'],
    ['onFamousPersonsOpened'],
    ['refreshCurrentHighlight'],
    ['timeout'],
    ['refreshCurrentHighlight'],
  ]);
});

test('seek famous person notifies tutorial with async result', async () => {
  const calls = [];
  const result = { candidate: { id: 'candidate-1' } };
  const changeEventBus = ChangeEventBus.createEventBus();
  changeEventBus.subscribe('tutorialStateChanged', (payload) => {
    calls.push(['tutorial', payload.result]);
  });
  const game = {
    async seekFamousPerson(source) {
      calls.push(['seek', source]);
      return result;
    },
  };
  const controller = new HostController({
    host: { lastGame: game },
    awaitAsync: true,
    changeEventBus,
  });

  assert.equal(
    await controller.handle_seekFamousPerson({ type: 'seekFamousPerson', source: 'guide' }),
    true,
  );
  assert.deepEqual(calls, [
    ['seek', 'guide'],
    ['tutorial', result],
  ]);
});

test('entrypoints load CanvasActionController without retired famous action handler module', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.includes('CanvasFamousActionHandlers.js'), false);
  assert.equal(html.includes('CanvasActionController.js'), true);
  assert.equal(minigame.includes("require('../js/platform/CanvasFamousActionHandlers')"), false);
  assert.equal(minigame.includes("require('../js/platform/CanvasActionController')"), true);
});
