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

test('WorldMapRuntimeHitTargetPolicy partitions renderer actor targets from map targets', () => {
  const backgroundTarget = { action: { type: 'worldMapDrag', background: true } };
  const siteTarget = { action: { type: 'openWorldSite', siteId: 'capital' } };
  const actorTarget = { action: { type: 'selectWorldActor', actorId: 'scout-1' } };

  const groups = Policy.collectRendererHitTargetGroups({
    hitTargets: [backgroundTarget, actorTarget, siteTarget],
    worldActorLayerRenderer: {
      hitTargets: [],
    },
  });

  assert.deepEqual(groups.mapTargets, [backgroundTarget, siteTarget]);
  assert.deepEqual(groups.actorTargets, [actorTarget]);
  assert.deepEqual(groups.sourceTargets, [backgroundTarget, siteTarget, actorTarget]);
});

test('WorldMapRuntimeHitTargetPolicy treats the registered world actor action type as actor-layer target', () => {
  const actorTarget = { action: { type: 'selectWorldActor', actorId: 'scout-1' } };

  assert.equal(Policy.isActorLayerTarget(actorTarget), true);
  assert.deepEqual([...Policy.getActorActionTypes([actorTarget])], ['selectWorldActor']);
});

test('WorldMapRuntimeHitTargetPolicy preserves actor layer source and de-duplicates actor targets', () => {
  const mapTarget = { action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true } };
  const rendererActorTarget = { x: 10, y: 20, width: 42, height: 42, action: { type: 'selectWorldActor', actorId: 'renderer-scout' } };
  const sharedActorTarget = { x: 30, y: 40, width: 42, height: 42, action: { type: 'selectWorldActor', actorId: 'shared-scout' } };
  const sharedActorClone = { x: 30, y: 40, width: 42, height: 42, action: { type: 'selectWorldActor', actorId: 'shared-scout' } };
  const actorLayerTarget = { x: 50, y: 60, width: 42, height: 42, action: { type: 'selectWorldActor', actorId: 'layer-scout' } };

  const groups = Policy.collectRendererHitTargetGroups({
    hitTargets: [mapTarget, rendererActorTarget, sharedActorTarget],
    worldActorLayerRenderer: {
      hitTargets: [sharedActorClone, actorLayerTarget],
    },
  });

  assert.deepEqual(groups.mapTargets, [mapTarget]);
  assert.deepEqual(groups.actorTargets, [rendererActorTarget, sharedActorTarget, actorLayerTarget]);
  assert.deepEqual(groups.sourceTargets, [mapTarget, rendererActorTarget, sharedActorTarget, actorLayerTarget]);
  assert.equal(groups.sourceTargets.filter((target) => target.action.actorId === 'shared-scout').length, 1);
});

test('WorldMapRuntimeHitTargetPolicy keeps partitioned source target count exact', () => {
  const mapTargets = [
    { action: { type: 'worldMapDrag', background: true } },
    { action: { type: 'openWorldSite', siteId: 'capital' } },
    { action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true } },
  ];
  const actorTargets = [
    { action: { type: 'selectWorldActor', actorId: 'scout-1' } },
    { action: { type: 'selectWorldActor', actorId: 'scout-2' } },
  ];
  const rendererTargets = [mapTargets[0], actorTargets[0], mapTargets[1], actorTargets[1], mapTargets[2]];
  const groups = Policy.collectRendererHitTargetGroups({
    hitTargets: rendererTargets,
    worldActorLayerRenderer: {
      hitTargets: [],
    },
  });

  assert.equal(groups.mapTargets.length + groups.actorTargets.length, rendererTargets.length);
  assert.deepEqual(groups.mapTargets, mapTargets);
  assert.deepEqual(groups.actorTargets, actorTargets);
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
