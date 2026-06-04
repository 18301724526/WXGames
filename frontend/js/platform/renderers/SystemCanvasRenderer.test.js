const test = require('node:test');
const assert = require('node:assert/strict');

const SystemCanvasRenderer = require('./SystemCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: {
      globalAlpha: 1,
      fillRect(...args) { calls.push(['fillRect', ...args]); },
      beginPath() { calls.push(['beginPath']); },
      moveTo(...args) { calls.push(['moveTo', ...args]); },
      lineTo(...args) { calls.push(['lineTo', ...args]); },
      stroke() { calls.push(['stroke']); },
      arc(...args) { calls.push(['arc', ...args]); },
      save() { calls.push(['save']); },
      restore() { calls.push(['restore']); },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    setHitTargets(targets = []) {
      hitTargets.length = 0;
      targets.forEach((target) => hitTargets.push(target));
    },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawCoverAsset(assetPath) { calls.push(['drawCoverAsset', assetPath]); return false; },
    drawPanel() { calls.push(['drawPanel']); },
    drawProgressBar(x, y, width, height, percentage) { calls.push(['drawProgressBar', percentage]); },
    drawText(text) { calls.push(['drawText', text]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    getNow() { return 1000; },
    truncateText(text) { return String(text || ''); },
    ...overrides,
  };
  return host;
}

test('SystemCanvasRenderer preserves login form hit target contract', () => {
  const host = createHost();
  const renderer = new SystemCanvasRenderer({ host });

  renderer.renderLoginPanel({
    view: { loginPanelVisible: true, message: 'bad password' },
    credentials: { usernameValue: 'alice', passwordValue: 'secret', rememberPasswordChecked: true },
  });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'requestLoginUsername'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'requestLoginPassword'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'toggleRememberPassword'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'submitLogin'), true);
});

test('SystemCanvasRenderer preserves loading and network modal shields', () => {
  const host = createHost();
  const renderer = new SystemCanvasRenderer({ host });

  renderer.renderLoadingScreen({ visible: true, percentage: 42, message: 'Loading' });
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.deepEqual(host.calls.find((call) => call[0] === 'drawProgressBar'), ['drawProgressBar', 42]);

  host.hitTargets.length = 0;
  const didRender = renderer.renderNetworkOverlay({ status: 'reconnecting', failureCount: 3 });

  assert.equal(didRender, true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
});

test('SystemCanvasRenderer preserves settings and logs actions', () => {
  const host = createHost();
  const renderer = new SystemCanvasRenderer({ host });

  renderer.renderSettingsPanel();
  assert.equal(host.hitTargets.some((target) => target.action.type === 'resetGame'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'logout'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeSettings' && target.action.background === true), true);

  host.hitTargets.length = 0;
  renderer.renderLogsPanel([{ timestamp: '10:00', method: 'GET', path: '/api', statusCode: 200 }]);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeLogs'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'clearLogs'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeLogs' && target.action.background === true), true);
});

test('CanvasGameRenderer exposes system rendering through facade', () => {
  class StubSystemRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderNetworkOverlay(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    systemRendererClass: StubSystemRenderer,
  });
  const network = { status: 'reconnecting' };

  const result = renderer.renderNetworkOverlay(network);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [network]);
});
