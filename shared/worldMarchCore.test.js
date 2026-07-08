const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WorldMarchCore = require('./worldMarchCore');

function createMission(overrides = {}) {
  return {
    id: 'explore-1',
    kind: 'worldExplore',
    mode: 'manual',
    status: 'active',
    origin: { q: 0, r: 0, tileId: 'tile_0_0' },
    position: { q: 0, r: 0, tileId: 'tile_0_0' },
    target: { q: 3, r: 0, tileId: 'tile_3_0' },
    route: [
      { q: 1, r: 0, tileId: 'tile_1_0', step: 1 },
      { q: 2, r: 0, tileId: 'tile_2_0', step: 2 },
      { q: 3, r: 0, tileId: 'tile_3_0', step: 3 },
    ],
    stepDurationSeconds: 10,
    startedAt: '2026-06-06T00:00:00.000Z',
    nextStepAt: '2026-06-06T00:00:10.000Z',
    completesAt: '2026-06-06T00:00:30.000Z',
    ...overrides,
  };
}

test('worldMarchCore uses the unified finished status set as arrival progress sentinel', () => {
  for (const status of ['ready', 'idle', 'cancelled']) {
    const progress = WorldMarchCore.getMissionProgress(
      createMission({ status }),
      Date.parse('2026-06-06T00:00:05.000Z'),
    );

    assert.equal(progress.progress, 1);
    assert.equal(progress.segmentProgress, 1);
    assert.equal(progress.segmentIndex, 2);
  }

  const active = WorldMarchCore.getMissionProgress(
    createMission({ status: 'active' }),
    Date.parse('2026-06-06T00:00:05.000Z'),
  );
  assert.equal(active.progress > 0, true);
  assert.equal(active.progress < 1, true);
});

test('worldMarchCore floors stepDurationSeconds to milliseconds with a 1000ms minimum', () => {
  assert.equal(
    WorldMarchCore.getMissionStepDurationMs(createMission({ stepDurationSeconds: 10 })),
    10000,
  );
  assert.equal(
    WorldMarchCore.getMissionStepDurationMs(createMission({ stepDurationSeconds: 0.5 })),
    1000,
  );
  assert.equal(
    WorldMarchCore.getMissionStepDurationMs(createMission({ stepDurationSeconds: 1.9 })),
    1900,
  );
});

test('worldMarchCore starts paths from mission.origin before mission.position', () => {
  const path = WorldMarchCore.getMissionPath(
    createMission({
      origin: { q: -2, r: 0, tileId: 'stale-origin' },
      position: { q: 9, r: 9, tileId: 'stale-position' },
      route: [{ q: -1, r: 0, tileId: 'tile_-1_0', step: 1 }],
    }),
  );

  assert.equal(path[0].tileId, 'tile_-2_0');
  assert.equal(path[1].tileId, 'tile_-1_0');
});

test('worldMarchCore builds wrapped manual routes with the same linear stepping contract', () => {
  assert.deepEqual(
    WorldMarchCore.getWrappedDelta(
      { q: 511, r: 0 },
      { q: -511, r: 0 },
      { width: 1024, height: 1024, wrapping: true },
    ),
    { q: 2, r: 0 },
  );

  const route = WorldMarchCore.buildLinearMarchRoute(
    { q: 0, r: 0 },
    { q: 2, r: -1 },
    { maxLength: 16, width: 1024, height: 1024, wrapping: true },
  );

  assert.equal(route.success, true);
  assert.deepEqual(route.route, [
    { q: 1, r: -1, step: 1, tileId: 'tile_1_-1' },
    { q: 2, r: -1, step: 2, tileId: 'tile_2_-1' },
  ]);
  assert.deepEqual(route.target, { q: 2, r: -1, tileId: 'tile_2_-1' });
});

test('worldMarchCore axis-aligned route walks the four grid directions only (no diagonal shortcut)', () => {
  // Same (0,0)->(2,-1) target that the diagonal builder cuts in 2 steps becomes a
  // 3-step staircase: no step changes both q and r; each carries its facing dir.
  // Larger-remaining axis first (ties -> q): walk q,q then r for (2,-1).
  const route = WorldMarchCore.buildAxisAlignedRoute(
    { q: 0, r: 0 },
    { q: 2, r: -1 },
    { maxLength: 16, width: 1024, height: 1024, wrapping: true },
  );
  assert.equal(route.success, true);
  assert.equal(route.distance, 3, 'Manhattan distance |2|+|-1|');
  assert.deepEqual(route.route, [
    { q: 1, r: 0, step: 1, tileId: 'tile_1_0', dir: '3' }, // +q => 右下
    { q: 2, r: 0, step: 2, tileId: 'tile_2_0', dir: '3' }, // +q => 右下
    { q: 2, r: -1, step: 3, tileId: 'tile_2_-1', dir: '1' }, // -r => 右上
  ]);
  // Every step moves exactly one axis.
  let prev = { q: 0, r: 0 };
  for (const s of route.route) {
    const changed = (s.q !== prev.q ? 1 : 0) + (s.r !== prev.r ? 1 : 0);
    assert.equal(changed, 1, 'exactly one axis changes per step');
    prev = s;
  }
});

test('worldMarchCore axisStepDir maps grid axis to the four march facings', () => {
  assert.equal(WorldMarchCore.axisStepDir(0, -1), '1'); // -r 右上
  assert.equal(WorldMarchCore.axisStepDir(-1, 0), '2'); // -q 左上
  assert.equal(WorldMarchCore.axisStepDir(1, 0), '3'); // +q 右下
  assert.equal(WorldMarchCore.axisStepDir(0, 1), '4'); // +r 左下
});

test('evaluateLinearMarchRoute axisAligned delegates to the axis builder', () => {
  const diag = WorldMarchCore.evaluateLinearMarchRoute({ q: 0, r: 0 }, { q: 2, r: 2 }, {});
  const axis = WorldMarchCore.evaluateLinearMarchRoute(
    { q: 0, r: 0 },
    { q: 2, r: 2 },
    { axisAligned: true },
  );
  assert.equal(diag.route.length, 2, 'Chebyshev diagonal = 2 steps');
  assert.equal(axis.route.length, 4, 'axis staircase = 4 steps (Manhattan)');
  assert.ok(
    axis.route.every((s) => typeof s.dir === 'string' && s.dir),
    'axis steps carry a facing dir',
  );
});

test('worldMarchCore evaluates blocked and too-far manual routes deterministically', () => {
  const blocked = WorldMarchCore.evaluateLinearMarchRoute(
    { q: 0, r: 0 },
    { q: 3, r: 0 },
    {
      maxLength: 16,
      canTraverse(step) {
        return step.q !== 2;
      },
    },
  );

  assert.equal(blocked.success, false);
  assert.equal(blocked.error, 'EXPLORE_ROUTE_BLOCKED');
  assert.deepEqual(blocked.blockedStep, { q: 2, r: 0, step: 2, tileId: 'tile_2_0' });
  assert.deepEqual(blocked.route, [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0' }]);

  const tooFar = WorldMarchCore.evaluateLinearMarchRoute(
    { q: 0, r: 0 },
    { q: 17, r: 0 },
    { maxLength: 16 },
  );
  assert.equal(tooFar.success, false);
  assert.equal(tooFar.error, 'EXPLORE_TARGET_TOO_FAR');
});

test('worldMarchCore produces deterministic continuous position and route reveal data', () => {
  const nowMs = Date.parse('2026-06-06T00:00:15.000Z');
  const state = WorldMarchCore.computeMarchState(createMission(), nowMs);

  assert.equal(state.current.q > 1, true);
  assert.equal(state.current.q < 2, true);
  assert.deepEqual(state.revealedTileIds, ['tile_1_0']);
  assert.deepEqual(state.renderReadyTileIds, ['tile_1_0', 'tile_2_0']);
  assert.equal(state.renderRevealSources.length, 2);
  assert.equal(state.renderRevealSources[0].strength, 1);
  assert.equal(state.renderRevealSources[1].strength > 0, true);
  assert.equal(state.renderRevealSources[1].strength < 1, true);
});

test('worldMarchCore moves fog reveal strength continuously inside a route step', () => {
  const startedAt = Date.parse('2026-06-06T00:00:00.000Z');
  const mission = createMission({ revealedTileIds: [] });
  const first = WorldMarchCore.computeMarchState(mission, startedAt + 1000);
  const middle = WorldMarchCore.computeMarchState(mission, startedAt + 5000);
  const late = WorldMarchCore.computeMarchState(mission, startedAt + 9000);

  assert.deepEqual(first.renderReadyTileIds, ['tile_1_0']);
  assert.deepEqual(middle.renderReadyTileIds, ['tile_1_0']);
  assert.deepEqual(late.renderReadyTileIds, ['tile_1_0']);
  assert.equal(first.renderRevealSources[0].strength > 0, true);
  assert.equal(
    first.renderRevealSources[0].strength < middle.renderRevealSources[0].strength,
    true,
  );
  assert.equal(middle.renderRevealSources[0].strength < late.renderRevealSources[0].strength, true);
  assert.notEqual(first.renderRevealSignature, middle.renderRevealSignature);
  assert.notEqual(middle.renderRevealSignature, late.renderRevealSignature);
});

function loadClassicScriptCore() {
  const corePath = path.join(__dirname, 'worldMarchCore.js');
  const source = fs.readFileSync(corePath, 'utf8');
  // No `module`/`window` in the sandbox → exercises the classic-script branch
  // that exposes the core on the global, the same way the H5 <script> tag does.
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: corePath });
  return context.WorldMarchCore;
}

function toPlainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

test('worldMarchCore exposes the same core as a classic browser <script> global', () => {
  const browserCore = loadClassicScriptCore();
  const nowMs = Date.parse('2026-06-06T00:00:01.500Z');

  // Same public surface and identical behavior as the CommonJS require — this is
  // the guard that replaces the old hand-copied inline browser fallback: the one
  // canonical file now has to behave the same in both load modes.
  assert.deepEqual(Object.keys(browserCore).sort(), Object.keys(WorldMarchCore).sort());
  assert.deepEqual(
    toPlainJson(browserCore.computeMarchState(createMission(), nowMs)),
    toPlainJson(WorldMarchCore.computeMarchState(createMission(), nowMs)),
  );
  assert.deepEqual(
    toPlainJson(
      browserCore.evaluateLinearMarchRoute(
        { q: 0, r: 0 },
        { q: 3, r: 0 },
        { maxLength: 16, canTraverse: (step) => step.q !== 2 },
      ),
    ),
    toPlainJson(
      WorldMarchCore.evaluateLinearMarchRoute(
        { q: 0, r: 0 },
        { q: 3, r: 0 },
        { maxLength: 16, canTraverse: (step) => step.q !== 2 },
      ),
    ),
  );
});
