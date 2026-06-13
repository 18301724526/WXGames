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

test('WorldMapRuntimeHitTargetPolicy rejects partial snapshot map targets while preserving stable map targets', () => {
  const stableBackground = { x: 0, y: 80, width: 360, height: 520, action: { type: 'worldMapDrag', background: true } };
  const stableSite = { x: 100, y: 150, width: 60, height: 50, action: { type: 'openWorldSite', siteId: 'capital' } };
  const oldActorTarget = { x: 150, y: 180, width: 42, height: 42, action: { type: 'selectWorldActor', actorId: 'old' } };
  const partialSnapshotTarget = { x: 8, y: 8, width: 40, height: 40, action: { type: 'resetWorldPan' } };
  const nextActorTarget = { x: 180, y: 220, width: 42, height: 42, action: { type: 'selectWorldActor', actorId: 'next' } };

  assert.deepEqual(Policy.resolveBaseHitTargets({
    preserveOnEmpty: true,
    previousBaseHitTargets: [stableBackground, stableSite, oldActorTarget],
    mapTargets: [partialSnapshotTarget],
    actorTargets: [nextActorTarget],
    sourceTargets: [partialSnapshotTarget, nextActorTarget],
  }), {
    preserved: true,
    targets: [stableBackground, stableSite, nextActorTarget],
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
