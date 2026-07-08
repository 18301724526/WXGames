const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
const ModalStore = require('../state/ModalStore');
const { makeModalOwnerHost } = require('../../test-support/CanvasOwnerTestHarness');

const makeModalHost = makeModalOwnerHost;

const HostController = CanvasActionController;

test('CanvasActionController installs famous compatibility methods', () => {
  assert.equal(typeof HostController.prototype.handle_openFamousPersons, 'function');
  assert.equal(typeof HostController.prototype.handle_seekFamousPerson, 'function');
  assert.equal(typeof HostController.prototype.handle_changeFamousPersonsPage, 'function');
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
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  game.canvasShell = host;
  // The famous open sweeps the other blocking panels (Axis-1): seed an open task
  // center + command panel so the close-on-open is observable through the owner.
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'famous');
  const controller = new HostController({ host: host, awaitAsync: true });

  assert.equal(controller.handle_openFamousPersons({ type: 'openFamousPersons' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isModalOpen('modal:famousPersons'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.famousPersonsPage, 2);
  assert.equal(host.selectedFamousPersonId, 'fp-old');
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');

  assert.equal(controller.handle_closeFamousPersons({ type: 'closeFamousPersons' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), false);
  assert.equal(host.isModalOpen('modal:famousPersons'), false);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  assert.deepEqual(calls, [
    ['clearTooltip'],
    ['render', 'openFamousPersons'],
    ['opened'],
    ['refresh'],
    ['timeout'],
    ['refresh'],
    ['clearTooltip'],
    ['render', 'closeFamousPersons'],
    ['closed'],
    ['timeout'],
    ['refresh'],
  ]);
});

// UI-REDO ⑦a sibling characterization: a tutorial-locked 「名人」 dock tap must be a
// pure no-op on the modal owner. The regression this locks: handle_openFamousPersons
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
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  // Seed another blocking panel: a veto must not run the close-on-open sweep either.
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  const controller = new HostController({ host, awaitAsync: true });

  assert.equal(controller.handle_openFamousPersons({ type: 'openFamousPersons' }), false);

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
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  });
  const controller = new HostController({ host, awaitAsync: true });

  assert.equal(controller.handle_openFamousPersons({ type: 'openFamousPersons' }), true);

  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isModalOpen('modal:famousPersons'), true);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  // canOpenTab -> open/clear/render -> tutorial event -> highlight refresh: the
  // allowed path keeps the pre-gate order exactly (zero-regression lock).
  assert.deepEqual(calls, [
    ['canOpenTab', 'famousPersons'],
    ['clearTooltip'],
    ['render', 'openFamousPersons'],
    ['onFamousPersonsOpened'],
    ['refreshCurrentHighlight'],
    ['timeout'],
    ['refreshCurrentHighlight'],
  ]);
});

test('seek famous person notifies tutorial with async result', async () => {
  const calls = [];
  const result = { candidate: { id: 'candidate-1' } };
  const game = {
    async seekFamousPerson(source) {
      calls.push(['seek', source]);
      return result;
    },
    tutorialController: {
      onFamousPersonSought(nextResult) {
        calls.push(['tutorial', nextResult]);
      },
    },
  };
  const controller = new HostController({ host: { lastGame: game }, awaitAsync: true });

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
