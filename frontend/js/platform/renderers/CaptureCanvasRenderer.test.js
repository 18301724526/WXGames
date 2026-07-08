const test = require('node:test');
const assert = require('node:assert/strict');

const CaptureCanvasRenderer = require('./CaptureCanvasRenderer');

function makeRenderer() {
  const hitTargets = [];
  const buttons = [];
  const ctx = { fillRect() {}, fillText() {}, set fillStyle(_v) {}, set font(_v) {}, set textAlign(_v) {} };
  const host = {
    width: 800,
    height: 600,
    ctx,
    addHitTarget: (rect, action) => hitTargets.push({ rect, action }),
    createGradient: () => 'grad',
    drawPanel: () => {},
    drawButton: (x, y, w, h, label) => buttons.push(label),
    getLayout: () => ({ contentWidth: 400 }),
  };
  return { renderer: new CaptureCanvasRenderer({ host }), hitTargets, buttons };
}

const pendingState = {
  captureDecisions: [{ id: 'cap_1', status: 'pending', recruitChance: 0.4, captive: { name: '林烈' } }],
};

test('renderCaptureModal draws three choice buttons + registers their hit targets', () => {
  const { renderer, hitTargets, buttons } = makeRenderer();
  renderer.renderCaptureModal(pendingState, 'cap_1');
  assert.equal(buttons.length, 3); // 斩杀/招降/放生
  const captureTargets = hitTargets.filter((h) => h.action.type === 'resolveCapture');
  assert.deepEqual(captureTargets.map((h) => h.action.choice), ['execute', 'recruit', 'release']);
  assert.ok(captureTargets.every((h) => h.action.decisionId === 'cap_1'));
  assert.ok(hitTargets.some((h) => h.action.type === 'blockCanvasModal')); // must-choose scrim blocks
});

test('renderCaptureModal draws nothing when there is no pending decision', () => {
  const { renderer, hitTargets, buttons } = makeRenderer();
  renderer.renderCaptureModal({ captureDecisions: [] }, null);
  assert.equal(buttons.length, 0);
  assert.equal(hitTargets.length, 0);
});
