const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasTalentPolicyActionHandlers = require('./CanvasTalentPolicyActionHandlers');

class HostController {
  constructor(host) {
    this.host = host;
    this.awaitAsync = true;
  }

  getGameHost() {
    return this.host?.lastGame || this.host;
  }

  getState() {
    return this.host?.state || this.getGameHost()?.state || {};
  }

  closePanels(except = []) {
    const keep = new Set(except);
    ['showTaskCenter', 'activeCommandPanel'].forEach((key) => {
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

  render(action = {}) {
    if (typeof this.host?.render === 'function') return this.host.render(action);
    this.host.renderCanvasAction?.(action);
    return true;
  }

  afterHandled(action) {
    this.host.renderCanvasAction?.(action);
    return true;
  }
}

CanvasTalentPolicyActionHandlers.install(HostController);

test('CanvasTalentPolicyActionHandlers installs talent policy compatibility methods', () => {
  assert.equal(typeof HostController.prototype.handle_openTalentPolicy, 'function');
  assert.equal(typeof HostController.prototype.handle_applyTalentPolicy, 'function');
  assert.equal(typeof HostController.prototype.finalizeTalentPolicyApply, 'function');
});

test('open talent policy shortcut routes to city people tab after async tutorial advance', async () => {
  const calls = [];
  let resolveAdvance = null;
  const game = {
    showCityManagement: false,
    activeCityManagementTab: '',
    canvasShell: null,
    tutorialController: {
      onTalentPolicyOpened() {
        calls.push(['opened']);
        return new Promise((resolve) => {
          resolveAdvance = resolve;
        });
      },
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };
  const host = {
    showCityManagement: false,
    activeCityManagementTab: '',
    showTaskCenter: true,
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['renderCanvasAction', action.type]);
    },
    render() {
      calls.push(['render', this.activeCityManagementTab]);
    },
  };
  game.canvasShell = host;
  const controller = new HostController(host);

  assert.equal(controller.handle_openTalentPolicy({ type: 'openTalentPolicy' }), true);
  assert.equal(host.showCityManagement, true);
  assert.equal(game.showCityManagement, true);
  assert.equal(host.activeCityManagementTab, 'people');
  assert.equal(game.activeCityManagementTab, 'people');
  assert.equal(host.showTaskCenter, false);
  assert.deepEqual(calls, [['renderCanvasAction', 'openTalentPolicy'], ['opened']]);

  resolveAdvance({ currentStep: 30 });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(host.showCityManagement, true);
  assert.equal(game.showCityManagement, true);
  assert.equal(host.activeCityManagementTab, 'people');
  assert.equal(game.activeCityManagementTab, 'people');
  assert.deepEqual(calls, [
    ['renderCanvasAction', 'openTalentPolicy'],
    ['opened'],
    ['render', 'people'],
    ['refresh'],
  ]);
});

test('apply talent policy keeps policy service available without the old panel', async () => {
  const calls = [];
  const game = {
    applyTalentPolicy(policyId) {
      calls.push(['applyPolicy', policyId]);
      return Promise.resolve({ policyId });
    },
    tutorialController: {
      onTalentPolicyApplied(result) {
        calls.push(['applied', result.policyId]);
      },
      refreshCurrentHighlight() {
        calls.push(['refresh']);
      },
    },
  };
  const host = {
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_applyTalentPolicy({ type: 'applyTalentPolicy', policyId: 'balanced' }), true);

  assert.deepEqual(calls, [
    ['applyPolicy', 'balanced'],
    ['applied', 'balanced'],
    ['render', 'applyTalentPolicy'],
    ['refresh'],
  ]);
});

test('talent policy action handler entrypoints load before CanvasActionController', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
  const minigame = fs.readFileSync(path.resolve(__dirname, '../../minigame/game.js'), 'utf8');

  assert.equal(html.indexOf('CanvasTalentPolicyActionHandlers.js') < html.indexOf('CanvasActionController.js'), true);
  assert.equal(minigame.indexOf("require('../js/platform/CanvasTalentPolicyActionHandlers')")
    < minigame.indexOf("require('../js/platform/CanvasActionController')"), true);
});
