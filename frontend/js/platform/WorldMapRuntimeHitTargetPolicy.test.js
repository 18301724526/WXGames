const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('./WorldMapRuntimeHitTargetPolicy');

test('WorldMapRuntimeHitTargetPolicy collects map and actor layer hit targets', () => {
  const mapTarget = { action: { type: 'openWorldSite' } };
  const actorTarget = { action: { type: 'selectWorldActor' } };

  assert.deepEqual(Policy.collectRendererHitTargets({
    hitTargets: [mapTarget],
    worldActorLayerRenderer: {
      hitTargets: [actorTarget],
    },
  }), [mapTarget, actorTarget]);
});

test('WorldMapRuntimeHitTargetPolicy preserves stable targets on empty snapshot sources', () => {
  const previous = [{ x: 1, y: 2, action: { type: 'openWorldSite', siteId: 'capital' } }];

  assert.deepEqual(Policy.resolveBaseHitTargets({
    preserveOnEmpty: true,
    previousBaseHitTargets: previous,
    sourceTargets: [],
  }), {
    preserved: true,
    targets: previous,
  });
});

test('WorldMapRuntimeHitTargetPolicy preserves map targets while replacing actor targets on actor-only snapshots', () => {
  const mapTarget = { x: 1, y: 2, action: { type: 'openWorldSite', siteId: 'capital' } };
  const oldActorTarget = { x: 3, y: 4, action: { type: 'selectWorldActor', actorId: 'old' } };
  const nextActorTarget = { x: 5, y: 6, action: { type: 'selectWorldActor', actorId: 'next' } };

  assert.deepEqual(Policy.resolveBaseHitTargets({
    preserveOnEmpty: true,
    previousBaseHitTargets: [mapTarget, oldActorTarget],
    mapTargets: [],
    actorTargets: [nextActorTarget],
    sourceTargets: [nextActorTarget],
  }), {
    preserved: true,
    targets: [mapTarget, nextActorTarget],
  });
});

test('WorldMapRuntimeHitTargetPolicy allows full renders to commit an empty target set', () => {
  assert.deepEqual(Policy.resolveBaseHitTargets({
    preserveOnEmpty: false,
    previousBaseHitTargets: [{ action: { type: 'openWorldSite' } }],
    sourceTargets: [],
  }), {
    preserved: false,
    targets: [],
  });
});
