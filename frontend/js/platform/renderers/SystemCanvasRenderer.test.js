const test = require('node:test');
const assert = require('node:assert/strict');

require('../../config/LocaleTextRegistry');
const LocaleText = require('../../ecs/resource/LocaleText');
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

const SYSTEM_DRAWING_METHODS = [
  'addHitTarget',
  'createGradient',
  'drawAsset',
  'drawButton',
  'drawCoverAsset',
  'drawPanel',
  'drawProgressBar',
  'drawText',
  'drawTextLines',
  'getLayout',
  'getNow',
  'setHitTargets',
  'truncateText',
  'wrapTextLimit',
];

function createDrawingSurfaceSentinel(label, calls = []) {
  return {
    width: 390,
    height: 844,
    ctx: {
      globalAlpha: 1,
      fillRect() {},
      beginPath() {},
      arc() {},
      stroke() {},
      save() {},
      restore() {},
    },
    addHitTarget(_rect, action) {
      calls.push([label, 'addHitTarget', action?.type]);
    },
    createGradient() {
      calls.push([label, 'createGradient']);
      return label;
    },
    drawAsset(assetPath) {
      calls.push([label, 'drawAsset', assetPath]);
      return false;
    },
    drawButton(_x, _y, _width, _height, buttonLabel) {
      calls.push([label, 'drawButton', buttonLabel]);
    },
    drawCoverAsset(assetPath) {
      calls.push([label, 'drawCoverAsset', assetPath]);
      return false;
    },
    drawPanel() {
      calls.push([label, 'drawPanel']);
    },
    drawProgressBar(_x, _y, _width, _height, percentage) {
      calls.push([label, 'drawProgressBar', percentage]);
    },
    drawText(text) {
      calls.push([label, 'drawText', text]);
    },
    drawTextLines(lines) {
      calls.push([label, 'drawTextLines', lines]);
    },
    getLayout() {
      calls.push([label, 'getLayout']);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    getNow() {
      calls.push([label, 'getNow']);
      return 1000;
    },
    setHitTargets(targets = []) {
      calls.push([label, 'setHitTargets', targets.length]);
    },
    truncateText(text) {
      calls.push([label, 'truncateText', text]);
      return String(text || '');
    },
    wrapTextLimit(text) {
      calls.push([label, 'wrapTextLimit', text]);
      return [String(text || '')];
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return Array.from(new Set(calls.filter((call) => call[0] === label).map((call) => call[1]))).sort();
}

function renderSystemSentinelPaths(renderer) {
  renderer.renderLoginPanel({
    view: { loginPanelVisible: true, message: 'bad password' },
    credentials: { usernameValue: 'alice', passwordValue: 'secret', rememberPasswordChecked: true },
  });
  renderer.renderLoadingScreen({ visible: true, percentage: 42, message: 'Loading' });
  renderer.renderNetworkOverlay({ status: 'reconnecting', failureCount: 3 });
  renderer.renderConfirmDialog({
    visible: true,
    kind: 'resetGame',
    source: 'settings',
    title: 'Reset',
    message: 'Reset all progress.',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  });
}

test('SystemCanvasRenderer prefers explicit drawing surface over proxy fallback host', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new SystemCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderSystemSentinelPaths(renderer);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), SYSTEM_DRAWING_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('SystemCanvasRenderer falls back to host drawing surface when none is injected', () => {
  const calls = [];
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new SystemCanvasRenderer({ host: fallbackHost });

  renderSystemSentinelPaths(renderer);

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), SYSTEM_DRAWING_METHODS);
});

test('SystemCanvasRenderer reads dynamic host state through explicit getters', () => {
  const firstCtx = { fillRect() {}, globalAlpha: 1 };
  const secondCtx = { fillRect() {}, globalAlpha: 1 };
  const host = createHost({
    width: 390,
    height: 844,
    ctx: firstCtx,
  });
  const renderer = new SystemCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.ctx, firstCtx);

  host.width = 512;
  host.height = 900;
  host.ctx = secondCtx;

  assert.equal(renderer.width, 512);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.ctx, secondCtx);
});

test('SystemCanvasRenderer does not proxy unknown host properties', () => {
  const host = createHost({
    someRandomProp: 'host-only',
  });
  const renderer = new SystemCanvasRenderer({ host });

  assert.equal(host.someRandomProp, 'host-only');
  assert.equal(renderer.someRandomProp, undefined);
});

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
  assert.equal(host.hitTargets.some((target) => target.action.type === 'requestResetGame'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'resetGame'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'downloadClientOperationLog'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'logout'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeSettings' && target.action.background === true), true);

  // UI-REDO ⑦c: settings is a CENTERED modal (was a top-right dropdown) —
  // dim mask + horizontally centered panel block + explicit ✕ close target.
  const settingsBlock = host.hitTargets.find((target) => target.action.type === 'blockCanvasModal');
  assert.ok(settingsBlock, 'centered settings panel must block taps behind it');
  const panelRect = settingsBlock.rect;
  assert.equal(Math.abs((panelRect.x + panelRect.width / 2) - host.width / 2) <= 1, true);
  assert.equal(panelRect.y >= 86, true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeSettings' && !target.action.background), true);
  // Every settings button must sit INSIDE the panel block (hit targets moved with the panel).
  ['requestResetGame', 'downloadClientOperationLog', 'logout'].forEach((type) => {
    const target = host.hitTargets.find((item) => item.action.type === type);
    assert.ok(target, `${type} target exists`);
    assert.equal(target.rect.x >= panelRect.x && target.rect.x + target.rect.width <= panelRect.x + panelRect.width, true);
    assert.equal(target.rect.y >= panelRect.y && target.rect.y + target.rect.height <= panelRect.y + panelRect.height, true);
  });
  // The dim mask actually painted (mask regression guard).
  assert.equal(host.calls.some((call) => call[0] === 'fillRect' && call[1] === 0 && call[2] === 0 && call[3] === host.width && call[4] === host.height), true);

  host.hitTargets.length = 0;
  renderer.renderLogsPanel([{ timestamp: '10:00', method: 'GET', path: '/api', statusCode: 200 }]);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeLogs'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'clearLogs'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeLogs' && target.action.background === true), true);
});

test('SystemCanvasRenderer resolves system chrome through active locale', () => {
  LocaleText.setLocale('en-US');
  const host = createHost({
    drawTextLines(lines) { this.calls.push(['drawTextLines', lines]); },
    wrapTextLimit(text) { return [String(text || '')]; },
  });
  const renderer = new SystemCanvasRenderer({ host });

  renderer.renderLoginPanel({ view: { loginPanelVisible: true }, credentials: {} });
  renderer.renderLoadingScreen({ visible: true, percentage: 12 });
  renderer.renderNetworkOverlay({ status: 'reconnecting', failureCount: 2 });
  renderer.renderSettingsPanel();
  renderer.renderConfirmDialog({ visible: true, message: 'Reset?' });
  renderer.renderLogsPanel([]);

  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Civilization Spark'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1] === 'Log In'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Preparing settlement resources'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Network connection is unstable'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '2 missed heartbeats'), true);
  // UI-REDO knife 8: settings buttons go through the shared ModalPlate painter
  // (drawPanel + drawText), no longer through host.drawButton.
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Reset Game'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1] === 'Confirm'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Recent Request Log'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'No logs'), true);
  LocaleText.setLocale('zh-CN');
});

test('SystemCanvasRenderer renders reset confirmation as canvas actions', () => {
  const host = createHost({
    drawTextLines(lines) { this.calls.push(['drawTextLines', lines]); },
    wrapTextLimit(text) { return [String(text || '')]; },
  });
  const renderer = new SystemCanvasRenderer({ host });

  renderer.renderConfirmDialog({
    visible: true,
    kind: 'resetGame',
    source: 'settings',
    title: '重置游戏进度',
    message: '当前账号的所有发展将回到初始状态。',
    confirmLabel: '确认重置',
    cancelLabel: '取消',
  });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeConfirmDialog' && target.action.background === true), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeConfirmDialog' && !target.action.background), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'confirmResetGame' && target.action.source === 'settings'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
});

test('SystemCanvasRenderer renders custom confirm actions from dialog payload', () => {
  const host = createHost({
    drawTextLines(lines) { this.calls.push(['drawTextLines', lines]); },
    wrapTextLimit(text) { return [String(text || '')]; },
  });
  const renderer = new SystemCanvasRenderer({ host });

  renderer.renderConfirmDialog({
    visible: true,
    kind: 'worldMarchDeploymentWarning',
    title: 'Confirm Deployment',
    message: 'Deputy has no soldiers.',
    confirmAction: {
      type: 'confirmWorldMarchDeployment',
      action: { type: 'startWorldMarch', targetQ: 2, targetR: -1, formationSlot: 1 },
    },
  });

  const confirmTarget = host.hitTargets.find((target) => target.action.type === 'confirmWorldMarchDeployment');
  assert.equal(Boolean(confirmTarget), true);
  assert.equal(confirmTarget.action.action.type, 'startWorldMarch');
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
