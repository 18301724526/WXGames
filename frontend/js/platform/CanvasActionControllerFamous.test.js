const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasActionController = require('./CanvasActionController');
const CanvasActionDispatcher = require('./CanvasActionDispatcher');
const ChangeEventBus = require('../state/ChangeEventBus');
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

test('open and close famous persons sync shell, game, and renderer state', () => {
  const calls = [];
  const game = makeModalHost({
    famousPersonsPage: 3,
    selectedFamousPersonId: 'fp-old',
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
    ['clearTooltip'],
    ['clearPanelOverlaySurface', 'famousPersons', 'closeFamousPersons'],
  ]);
});
test('seek famous person publishes the completion event with async result', async () => {
  const calls = [];
  const result = { candidate: { id: 'candidate-1' } };
  const changeEventBus = ChangeEventBus.createEventBus();
  changeEventBus.subscribe('famousSeekCompleted', (payload) => {
    calls.push(['completed', payload.result]);
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
    ['completed', result],
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
