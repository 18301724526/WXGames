const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
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
