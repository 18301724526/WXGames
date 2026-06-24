const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sharedCore = require('../../../shared/worldMarchCore');

function createMission(overrides = {}) {
  return {
    id: 'adapter-mission-1',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 3, r: 0, tileId: 'tile_3_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
      { q: 3, r: 0, tileId: 'tile_3_0', step: 3 },
    ],
    stepDurationSeconds: 0.5,
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:01.000Z',
    completesAt: '2026-06-06T00:00:03.000Z',
    ...overrides,
  };
}

function loadClassicScriptAdapter() {
  const adapterPath = path.join(__dirname, 'WorldMarchCoreAdapter.js');
  const source = fs.readFileSync(adapterPath, 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: adapterPath });
  return context.WorldMarchCore;
}

function toPlainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

test('WorldMarchCoreAdapter exposes the shared core in classic browser script mode', () => {
  const browserCore = loadClassicScriptAdapter();
  const nowMs = Date.parse('2026-06-06T00:00:01.500Z');

  assert.deepEqual(Object.keys(browserCore).sort(), Object.keys(sharedCore).sort());
  assert.deepEqual(
    toPlainJson(browserCore.computeMarchState(createMission(), nowMs)),
    toPlainJson(sharedCore.computeMarchState(createMission(), nowMs)),
  );
  assert.deepEqual(
    toPlainJson(browserCore.evaluateLinearMarchRoute(
      { q: 0, r: 0 },
      { q: 3, r: 0 },
      { maxLength: 16, canTraverse: (step) => step.q !== 2 },
    )),
    toPlainJson(sharedCore.evaluateLinearMarchRoute(
      { q: 0, r: 0 },
      { q: 3, r: 0 },
      { maxLength: 16, canTraverse: (step) => step.q !== 2 },
    )),
  );
});

test('WorldMarchCoreAdapter uses the canonical shared module in CommonJS mode', () => {
  const modulePath = require.resolve('./WorldMarchCoreAdapter');
  const previousGlobal = globalThis.WorldMarchCore;
  delete require.cache[modulePath];
  delete globalThis.WorldMarchCore;

  try {
    const adapterCore = require('./WorldMarchCoreAdapter');
    assert.equal(adapterCore, sharedCore);
    assert.equal(globalThis.WorldMarchCore, sharedCore);
  } finally {
    delete require.cache[modulePath];
    if (previousGlobal) globalThis.WorldMarchCore = previousGlobal;
    else delete globalThis.WorldMarchCore;
  }
});
