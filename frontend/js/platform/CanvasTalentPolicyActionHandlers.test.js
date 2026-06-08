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
    ['showTalentPolicy', 'showTaskCenter', 'activeCommandPanel'].forEach((key) => {
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
  assert.equal(typeof HostController.prototype.handle_confirmTalentPolicy, 'function');
  assert.equal(typeof HostController.prototype.finalizeTalentPolicyApply, 'function');
});

test('open talent policy keeps shell and game panel open after async tutorial advance', async () => {
  const calls = [];
  let resolveAdvance = null;
  const game = {
    showTalentPolicy: false,
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
    showTalentPolicy: false,
    showTaskCenter: true,
    lastGame: game,
    renderCanvasAction(action) {
      calls.push(['renderCanvasAction', action.type]);
    },
    render() {
      calls.push(['render', this.showTalentPolicy]);
    },
  };
  game.canvasShell = host;
  const controller = new HostController(host);

  assert.equal(controller.handle_openTalentPolicy({ type: 'openTalentPolicy' }), true);
  assert.equal(host.showTalentPolicy, true);
  assert.equal(game.showTalentPolicy, true);
  assert.equal(host.showTaskCenter, false);
  assert.deepEqual(calls, [['renderCanvasAction', 'openTalentPolicy'], ['opened']]);

  resolveAdvance({ currentStep: 30 });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(host.showTalentPolicy, true);
  assert.equal(game.showTalentPolicy, true);
  assert.deepEqual(calls, [
    ['renderCanvasAction', 'openTalentPolicy'],
    ['opened'],
    ['render', true],
    ['refresh'],
  ]);
});

test('confirm talent policy applies default base policy and closes panel after success', async () => {
  const calls = [];
  const game = {
    showTalentPolicy: true,
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
    showTalentPolicy: true,
    lastGame: game,
    state: {
      talentPolicies: {
        activePolicyId: 'balanced',
        systemPolicies: [{ id: 'balanced' }],
        defaultTiers: { agriculture: 2, knowledge: 2, industry: 2 },
      },
    },
    talentPolicyUiState: {},
    renderCanvasAction(action) {
      calls.push(['render', action.type]);
    },
  };
  const controller = new HostController(host);

  assert.equal(await controller.handle_confirmTalentPolicy({ type: 'confirmTalentPolicy' }), true);

  assert.equal(host.showTalentPolicy, false);
  assert.equal(game.showTalentPolicy, false);
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
