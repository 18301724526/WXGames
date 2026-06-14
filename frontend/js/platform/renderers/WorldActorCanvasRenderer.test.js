const test = require('node:test');
const assert = require('node:assert/strict');

require('../../domain/TileMapGeometry');
require('../../domain/WorldMarchSystem');
require('../../config/UnitSpriteManifest');
const WorldActorCanvasRenderer = require('./WorldActorCanvasRenderer');

function createHost() {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    ctx: {
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
