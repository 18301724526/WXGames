const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasFamousActionHandlers = require('./CanvasFamousActionHandlers');

class HostController {
  constructor(host) {
    this.host = host;
    this.awaitAsync = true;
  }

  getGameHost() {
    return this.host?.lastGame || this.host;
  }

  closePanels(except = []) {
    const keep = new Set(except);
    ['showFamousPersons', 'showTaskCenter', 'activeCommandPanel'].forEach((key) => {
      if (!keep.has(key) && key in this.host) this.host[key] = key === 'activeCommandPanel' ? '' : false;
    });
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

test('CanvasFamousActionHandlers retires pure panel wrappers and keeps API command handlers', () => {
  assert.equal(typeof HostController.prototype.handle_openFamousPersons, 'undefined');
  assert.equal(typeof HostController.prototype.handle_closeFamousPersons, 'undefined');
  assert.equal(typeof HostController.prototype.handle_openFamousPersonDetail, 'undefined');
  assert.equal(typeof HostController.prototype.handle_closeFamousPersonDetail, 'undefined');
  assert.equal(typeof HostController.prototype.handle_changeFamousPersonsPage, 'undefined');
  assert.equal(typeof HostController.prototype.handle_seekFamousPerson, 'function');
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
