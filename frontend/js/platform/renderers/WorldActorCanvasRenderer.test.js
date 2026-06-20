const test = require('node:test');
const assert = require('node:assert/strict');

require('../../domain/TileMapGeometry');
require('../../domain/WorldMarchSystem');
require('../../config/UnitSpriteManifest');
const WorldActorCanvasRenderer = require('./WorldActorCanvasRenderer');

function withRendererDependencyRegistry(dependencies = {}, callback = null) {
  const hadRegistry = Object.prototype.hasOwnProperty.call(globalThis, 'WorldMapRendererDependencyRegistry');
  const previousRegistry = globalThis.WorldMapRendererDependencyRegistry;
  globalThis.WorldMapRendererDependencyRegistry = {
    getRendererDependency(key) {
      return Object.prototype.hasOwnProperty.call(dependencies, key) ? dependencies[key] : null;
    },
  };
  try {
    return callback();
  } finally {
    if (hadRegistry) {
      globalThis.WorldMapRendererDependencyRegistry = previousRegistry;
    } else {
      delete globalThis.WorldMapRendererDependencyRegistry;
    }
  }
}

function createHost() {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    ctx: {
      canvas: { _layerName: 'actor-layer' },
      save() { calls.push(['save']); },
      restore() { calls.push(['restore']); },
      beginPath() { calls.push(['beginPath']); },
      closePath() { calls.push(['closePath']); },
      moveTo(...args) { calls.push(['moveTo', args]); },
      lineTo(...args) { calls.push(['lineTo', args]); },
      stroke() { calls.push(['stroke']); },
      fill() { calls.push(['fill']); },
      drawImage(...args) { calls.push(['drawImage', args]); },
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
    },
    getNow() { return 1000; },
    getAsset(path) {
      calls.push(['getAsset', path]);
      return { width: 80, height: 120 };
    },
    addHitTarget(rect, action) {
      hitTargets.push({ ...rect, action });
    },
  };
}

test('WorldActorCanvasRenderer prefers registry tutorial unit renderer over host constructor fallback', () => {
  const host = createHost();
  const calls = [];
  const registryUnitRenderer = {
    renderUnit() {
      calls.push('registry');
      return true;
    },
  };
  const fallbackUnitRenderer = {
    renderUnit() {
      calls.push('fallback');
      return true;
    },
  };
  host.constructor = {
    getTutorialIntroUnitRenderer() {
      return fallbackUnitRenderer;
    },
  };
  const renderer = new WorldActorCanvasRenderer({ host });

  withRendererDependencyRegistry({ tutorialIntroUnitRenderer: registryUnitRenderer }, () => {
    assert.equal(renderer.drawActorUnit({ unitKey: 'scout_squad_default' }, { x: 10, y: 20 }, { scale: 1 }), true);
  });
  assert.deepEqual(calls, ['registry']);
  assert.equal(renderer.drawActorUnit({ unitKey: 'scout_squad_default' }, { x: 10, y: 20 }, { scale: 1 }), true);
  assert.deepEqual(calls, ['registry', 'fallback']);
});

test('WorldActorCanvasRenderer draws scout actor and exposes selection hit target', () => {
  const host = createHost();
  const renderer = new WorldActorCanvasRenderer({ host });
  const actor = {
    id: 'explore-1',
    missionId: 'explore-1',
    status: 'active',
    unitKey: 'scout_squad_default',
    current: { q: 0, r: 0 },
    target: { q: 1, r: 0 },
  };

  assert.equal(renderer.renderActors([actor], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }), true);

  assert.equal(host.calls.some((call) => call[0] === 'stroke'), true);
  assert.equal(host.calls.some((call) => call[0] === 'getAsset' && call[1].includes('assets/art/units/spearman/move/')), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldActor' && target.action.missionId === 'explore-1'), true);
  assert.equal(host.hitTargets.find((target) => target.action.type === 'selectWorldActor')?.action.inputSurface, 'worldMap');
});

test('WorldActorCanvasRenderer records actual actor and arrow canvas ids during drawing', () => {
  const host = createHost();
  const diag = {};
  const renderer = new WorldActorCanvasRenderer({ host });
  host.__worldActorOverlayActiveDiag = diag;
  const actor = {
    id: 'explore-1',
    missionId: 'explore-1',
    status: 'active',
    unitKey: 'scout_squad_default',
    current: { q: 0, r: 0 },
    target: { q: 1, r: 0 },
  };

  assert.equal(renderer.renderActors([actor], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }), true);

  assert.equal(diag.drawnCanvasId, 'actor-layer');
  assert.equal(diag.arrowCanvasId, 'actor-layer');
});

test('WorldActorCanvasRenderer uses explicit ctx through actor and arrow drawing', () => {
  const host = createHost();
  let unitRendererCtx = null;
  host.constructor = {
    getTutorialIntroUnitRenderer() {
      return {
        renderUnit(renderHost, x, y, scale, framePath) {
          unitRendererCtx = renderHost.ctx;
          renderHost.ctx.drawImage({ width: 80, height: 120 }, x, y, scale, scale);
          return true;
        },
      };
    },
  };
  const explicitCalls = [];
  const explicitCtx = {
    ...createHost().ctx,
    canvas: { _layerName: 'worldActor' },
    save() { explicitCalls.push(['save']); },
    restore() { explicitCalls.push(['restore']); },
    beginPath() { explicitCalls.push(['beginPath']); },
    closePath() { explicitCalls.push(['closePath']); },
    moveTo(...args) { explicitCalls.push(['moveTo', args]); },
    lineTo(...args) { explicitCalls.push(['lineTo', args]); },
    stroke() { explicitCalls.push(['stroke']); },
    fill() { explicitCalls.push(['fill']); },
    drawImage(...args) { explicitCalls.push(['drawImage', args]); },
  };
  const diag = {};
  const renderer = new WorldActorCanvasRenderer({ host });
  host.__worldActorOverlayActiveDiag = diag;
  const actor = {
    id: 'explore-1',
    missionId: 'explore-1',
    status: 'active',
    unitKey: 'scout_squad_default',
    current: { q: 0, r: 0 },
    target: { q: 1, r: 0 },
  };

  assert.equal(renderer.renderActors([actor], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { ctx: explicitCtx }), true);

  assert.equal(diag.drawnCanvasId, 'worldActor');
  assert.equal(diag.arrowCanvasId, 'worldActor');
  assert.equal(unitRendererCtx, explicitCtx);
  assert.equal(explicitCalls.some((call) => call[0] === 'stroke'), true);
  assert.equal(explicitCalls.some((call) => call[0] === 'drawImage'), true);
  assert.equal(host.calls.some((call) => call[0] === 'stroke'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawImage'), false);
});

test('WorldActorCanvasRenderer reads host ctx dynamically after proxy removal', () => {
  const firstCtx = createHost().ctx;
  const secondCtx = { ...createHost().ctx, canvas: { _layerName: 'second-layer' } };
  const host = createHost();
  host.ctx = firstCtx;
  const renderer = new WorldActorCanvasRenderer({ host });

  assert.equal(renderer.ctx, firstCtx);

  host.ctx = secondCtx;

  assert.equal(renderer.ctx, secondCtx);
});

test('WorldActorCanvasRenderer reads active overlay diagnostics dynamically from host', () => {
  const host = createHost();
  const renderer = new WorldActorCanvasRenderer({ host });
  const firstDiag = { drawnCanvasId: 'first' };
  const secondDiag = { drawnCanvasId: 'second' };

  host.__worldActorOverlayActiveDiag = firstDiag;
  assert.equal(renderer.__worldActorOverlayActiveDiag, firstDiag);

  host.__worldActorOverlayActiveDiag = secondDiag;
  assert.equal(renderer.__worldActorOverlayActiveDiag, secondDiag);
});

test('WorldActorCanvasRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost();
  host.someRandomProp = 'host-only';
  const renderer = new WorldActorCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('WorldActorCanvasRenderer delegates host helpers explicitly after proxy removal', () => {
  const calls = [];
  const asset = { width: 80, height: 120 };
  const host = {
    addHitTarget(...args) {
      calls.push(['addHitTarget', args]);
      return { sentinel: 'hit-target' };
    },
    getAsset(...args) {
      calls.push(['getAsset', args]);
      return asset;
    },
    getNow(...args) {
      calls.push(['getNow', args]);
      return 4321;
    },
  };
  const renderer = new WorldActorCanvasRenderer({ host });

  assert.deepEqual(renderer.addHitTarget({ x: 1 }, { type: 'test' }), { sentinel: 'hit-target' });
  assert.equal(renderer.getAsset('asset.png'), asset);
  assert.equal(renderer.getNow('clock'), 4321);
  assert.deepEqual(calls, [
    ['addHitTarget', [{ x: 1 }, { type: 'test' }]],
    ['getAsset', ['asset.png']],
    ['getNow', ['clock']],
  ]);
});

test('WorldActorCanvasRenderer render host exposes explicit ctx and roundRectPath without proxy', () => {
  const host = createHost();
  const renderer = new WorldActorCanvasRenderer({ host });
  const calls = [];
  const ctx = {
    beginPath() {
      calls.push(['beginPath']);
    },
    rect(...args) {
      calls.push(['rect', args]);
    },
  };

  const renderHost = renderer.getActorRenderHost(ctx);

  assert.equal(renderHost.ctx, ctx);
  assert.equal(renderHost.getAsset, renderer.getAsset);
  renderHost.roundRectPath(1, 2, 3, 4, 5);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['rect', [1, 2, 3, 4]],
  ]);
});

test('WorldActorCanvasRenderer renders active actors between tile centers', () => {
  const host = createHost();
  const renderer = new WorldActorCanvasRenderer({ host });
  const actor = {
    id: 'explore-1',
    missionId: 'explore-1',
    status: 'active',
    unitKey: 'scout_squad_default',
    current: { q: 0.5, r: 0 },
    target: { q: 1, r: 0 },
  };

  const point = renderer.getActorScreenPoint(actor, {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 });

  assert.deepEqual(point, { x: 124, y: 112 });
});

test('WorldActorCanvasRenderer keeps idle units on first frame without march arrow', () => {
  const host = createHost();
  const renderer = new WorldActorCanvasRenderer({ host });
  const actor = {
    id: 'explore-1',
    missionId: 'explore-1',
    status: 'idle',
    unitKey: 'scout_squad_default',
    current: { q: 1, r: 0 },
    target: { q: 2, r: 0 },
  };

  assert.equal(renderer.renderActors([actor], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }), true);

  assert.equal(host.calls.some((call) => call[0] === 'stroke'), false);
  assert.equal(host.calls.some((call) => call[0] === 'getAsset' && call[1].endsWith('/001.png')), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'selectWorldActor'), true);
});
