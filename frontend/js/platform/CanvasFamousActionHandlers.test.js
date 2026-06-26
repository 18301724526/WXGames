const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasFamousActionHandlers = require('./CanvasFamousActionHandlers');
const CanvasModeOwnershipBridge = require('./CanvasModeOwnershipBridge');
const CanvasModalSnapshotAdapter = require('./CanvasModalSnapshotAdapter');

// Batch 8F: the blocking panels are owned modal subtypes. A modal-capable host
// carries the ownership bridge (openModal/isModalOpen/getRendererSnapshot) and the
// snapshot adapter (openBlockingPanelSnapshot/closeBlockingPanelsSnapshot/
// isBlockingPanelSnapshotOpen/getCommandPanelValue) so the famous handlers can route
// through the owner instead of host mirrors.
class ModalHost {}
CanvasModeOwnershipBridge.install(ModalHost);
CanvasModalSnapshotAdapter.install(ModalHost);

function makeModalHost(fields = {}) {
  return Object.assign(new ModalHost(), fields);
}

class HostController {
  constructor(host) {
    this.host = host;
    this.awaitAsync = true;
  }

  getGameHost() {
    return this.host?.lastGame || this.host;
  }

  closePanels(except = []) {
    this.host?.closeBlockingPanelsSnapshot?.(except);
  }

  forward() {
    return undefined;
  }

  finalize(result) {
    if (!result || typeof result.then !== 'function') return result !== false;
    return result.then((value) => value !== false);
  }

  async runAction(callback) {
    return callback();
  }

  afterHandled(action) {
    this.host.renderCanvasAction?.(action);
    return true;
  }
}

CanvasFamousActionHandlers.install(HostController);

test('CanvasFamousActionHandlers installs famous compatibility methods', () => {
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
  const controller = new HostController(host);

  assert.equal(controller.handle_openFamousPersons({ type: 'openFamousPersons' }), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isModalOpen('modal:famousPersons'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(host.famousPersonsPage, 0);
  assert.equal(host.selectedFamousPersonId, '');

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
  const controller = new HostController({ lastGame: game });

  assert.equal(await controller.handle_seekFamousPerson({ type: 'seekFamousPerson', source: 'guide' }), true);
  assert.deepEqual(calls, [['seek', 'guide'], ['tutorial', result]]);
});

test('famous action handler entrypoints load before CanvasActionController', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.indexOf('CanvasFamousActionHandlers.js') < html.indexOf('CanvasActionController.js'), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasFamousActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasActionController')"), true);
});
