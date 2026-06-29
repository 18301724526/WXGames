const test = require('node:test');
const assert = require('node:assert/strict');

require('../foundation/TileMapGeometry');
require('../foundation/WorldTime');
require('../system/WorldMarchProgressSnapshot');
require('../system/WorldMarchSystem');
require('./WorldMapSelectionResolver');
const WorldMapInputActionMap = require('./WorldMapInputActionMap');
const WorldMapPickingModel = require('./WorldMapPickingModel');

function createContext() {
  return {
    tileMapView: {
      geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'plains', terrainLabel: '平原', visibility: 'scouted' },
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest', terrainLabel: '森林', visibility: 'unknown' },
      ],
    },
    viewport: {
      originX: 100,
      originY: 100,
      panX: 0,
      panY: 0,
      scale: 0.5,
    },
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 },
  };
}

test('WorldMapInputActionMap resolves topmost foreground target before background action', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital' } },
  ]);

  assert.deepEqual(action, { type: 'openWorldSite', siteId: 'capital' });
});

test('WorldMapInputActionMap opens a target picker when an actor stands on a city', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital' } },
    { x: 50, y: 50, width: 42, height: 42, action: { type: 'selectWorldActor', missionId: 'march-1' } },
  ]);

  assert.equal(action.type, 'openWorldTargetPicker');
  assert.equal(action.candidates.length, 2);
  assert.equal(action.candidates.some((candidate) => candidate.action.type === 'openWorldSite'), true);
  assert.equal(action.candidates.some((candidate) => candidate.action.type === 'selectWorldActor'), true);
});

test('WorldMapInputActionMap keeps HUD controls above world entity disambiguation', () => {
  const chooseAction = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital' } },
    { x: 50, y: 50, width: 42, height: 42, action: { type: 'selectWorldActor', missionId: 'march-1' } },
    { x: 35, y: 35, width: 120, height: 32, action: { type: 'chooseWorldTarget', targetId: 'march-1' } },
  ]);
  const stopAction = WorldMapInputActionMap.getHitTarget({ x: 60, y: 50 }, [
    { x: 50, y: 50, width: 42, height: 42, action: { type: 'selectWorldActor', missionId: 'march-1' } },
    { x: 35, y: 35, width: 58, height: 24, action: { type: 'stopWorldMarch', missionId: 'march-1' } },
  ]);

  assert.deepEqual(chooseAction, { type: 'chooseWorldTarget', targetId: 'march-1' });
  assert.deepEqual(stopAction, { type: 'stopWorldMarch', missionId: 'march-1' });
});

test('WorldMapInputActionMap keeps city HUD commands out of world entity disambiguation', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'capital', tileId: 'tile_23_18' } },
    { x: 35, y: 35, width: 90, height: 90, action: { type: 'enterCity', cityId: 'capital' } },
    { x: 45, y: 45, width: 70, height: 70, action: { type: 'enterCity', cityId: 'capital', territoryId: 'capital' } },
  ]);

  assert.deepEqual(action, { type: 'enterCity', cityId: 'capital', territoryId: 'capital' });
});

test('WorldMapInputActionMap preserves topmost background target over older background', () => {
  const action = WorldMapInputActionMap.getHitTarget({ x: 60, y: 60 }, [
    { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    { x: 40, y: 40, width: 80, height: 60, action: { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true } },
  ]);

  assert.deepEqual(action, { type: 'selectWorldMarchTarget', targetQ: 1, targetR: 0, background: true });
});

test('WorldMapInputActionMap infers known and unknown march target actions from map context', () => {
  const knownAction = WorldMapInputActionMap.getBackgroundMarchTargetAction({ x: 148, y: 124 }, createContext());
  const unknownAction = WorldMapInputActionMap.getBackgroundMarchTargetAction({ x: 100, y: 148 }, createContext());

  assert.equal(knownAction.type, 'selectWorldMarchTarget');
  assert.equal(knownAction.tileId, 'tile_1_0');
  assert.equal(knownAction.known, false);
  assert.equal(knownAction.terrainLabel, '未知');
  assert.equal(unknownAction.tileId, 'tile_1_1');
  assert.equal(unknownAction.known, false);
});

test('WorldMapInputActionMap accepts stable x/y tile mapper output for input actions', () => {
  const action = WorldMapInputActionMap.getBackgroundMarchTargetAction({ x: 1, y: 1 }, createContext(), {
    screenPointToAxialTile() {
      return { x: '2', y: '-1' };
    },
  });

  assert.equal(action.type, 'selectWorldMarchTarget');
  assert.equal(action.tileId, 'tile_2_-1');
  assert.equal(action.targetQ, 2);
  assert.equal(action.targetR, -1);
});

test('WorldMapInputActionMap matches known background tiles by coordinates over colliding raw ids', () => {
  const context = {
    ...createContext(),
    tileMapView: {
      ...createContext().tileMapView,
      tiles: [
        {
          id: 'tile_2_0',
          q: 1,
          r: 0,
          terrain: 'mountain',
          terrainLabel: 'mountain',
          visibility: 'scouted',
        },
        {
          id: 'legacy-visible-id',
          q: 2,
          r: 0,
          terrain: 'forest',
          terrainLabel: 'forest',
          visibility: 'scouted',
        },
      ],
    },
  };
  const action = WorldMapInputActionMap.getBackgroundMarchTargetAction({ x: 1, y: 1 }, context, {
    screenPointToAxialTile() {
      return { q: 2, r: 0 };
    },
  });

  assert.equal(action.type, 'selectWorldMarchTarget');
  assert.equal(action.tileId, 'tile_2_0');
  assert.equal(action.targetQ, 2);
  assert.equal(action.targetR, 0);
  assert.equal(action.terrain, 'forest');
  assert.equal(action.terrainLabel, 'forest');
});

test('WorldMapInputActionMap resolves background tiles from context without renderer background targets', () => {
  const action = WorldMapInputActionMap.resolveTapAction({ x: 148, y: 124 }, {
    hitTargets: [],
    context: {
      ...createContext(),
      frame: { x: 0, y: 0, width: 300, height: 300 },
    },
  });

  assert.equal(action.type, 'selectWorldMarchTarget');
  assert.equal(action.targetQ, 1);
  assert.equal(action.targetR, 0);
});

test('WorldMapInputActionMap resolves world entities from picking snapshot before renderer world targets', () => {
  const context = createContext();
  const pickingSnapshot = WorldMapPickingModel.createSnapshot({
    ...context,
    frame: { x: 0, y: 0, width: 300, height: 300 },
    actors: [{ id: 'actor-1', missionId: 'mission-1', current: { q: 1, r: 0 } }],
  });
  const action = WorldMapInputActionMap.resolveTapAction({ x: 148, y: 124 }, {
    hitTargets: [
      { x: 120, y: 100, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'stale-renderer-site' } },
    ],
    backgroundPoint: { x: 148, y: 124 },
    context,
    pickingSnapshot,
  });

  assert.equal(action.type, 'selectWorldActor');
  assert.equal(action.actorId, 'actor-1');
});

test('WorldMapInputActionMap opens target picker for overlapping picking snapshot entities', () => {
  const context = createContext();
  context.tileMapView.sites = [{ id: 'capital', type: 'city', owner: 'player' }];
  context.tileMapView.tiles = [
    { id: 'tile_1_0', q: 1, r: 0, terrain: 'capital', siteId: 'capital', site: { id: 'capital', type: 'city', owner: 'player' } },
  ];
  const pickingSnapshot = WorldMapPickingModel.createSnapshot({
    ...context,
    frame: { x: 0, y: 0, width: 300, height: 300 },
    actors: [{ id: 'actor-1', missionId: 'mission-1', current: { q: 1, r: 0 } }],
  });

  const action = WorldMapInputActionMap.resolveTapAction({ x: 148, y: 124 }, {
    hitTargets: [{ x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } }],
    backgroundPoint: { x: 148, y: 124 },
    context,
    pickingSnapshot,
  });

  assert.equal(action.type, 'openWorldTargetPicker');
  assert.equal(action.candidates.length, 2);
});

test('WorldMapInputActionMap does not dispatch stale renderer world entity targets when stable picking misses', () => {
  const context = {
    ...createContext(),
    frame: { x: 0, y: 0, width: 300, height: 300 },
  };
  const pickingSnapshot = {
    schema: 'world-map-picking-snapshot-v1',
    inputEpoch: 1,
    signature: 'empty-current-world',
    targets: [],
    counts: { sites: 0, actors: 0, targets: 0 },
  };
  const siteAction = WorldMapInputActionMap.resolveTapAction({ x: 60, y: 60 }, {
    hitTargets: [
      { x: 40, y: 40, width: 80, height: 60, action: { type: 'openWorldSite', siteId: 'stale-site' } },
    ],
    backgroundPoint: { x: 148, y: 124 },
    context,
    pickingSnapshot,
  });
  const actorAction = WorldMapInputActionMap.resolveTapAction({ x: 60, y: 60 }, {
    hitTargets: [
      { x: 40, y: 40, width: 80, height: 60, action: { type: 'selectWorldActor', actorId: 'stale-actor' } },
    ],
    backgroundPoint: { x: 148, y: 124 },
    context,
    pickingSnapshot,
  });

  assert.equal(siteAction.type, 'selectWorldMarchTarget');
  assert.notEqual(siteAction.siteId, 'stale-site');
  assert.equal(siteAction.targetQ, 1);
  assert.equal(actorAction.type, 'selectWorldMarchTarget');
  assert.notEqual(actorAction.actorId, 'stale-actor');
  assert.equal(actorAction.targetQ, 1);
});

test('WorldMapInputActionMap normalizes allowed hit targets with offsets', () => {
  const targets = WorldMapInputActionMap.normalizeHitTargets([
    { x: 10, y: 20, width: 30, height: 40, action: { type: 'worldMapDrag', background: true } },
    { x: 20, y: 30, width: 40, height: 50, action: { type: 'unsupportedAction' } },
  ], { offsetX: -2, offsetY: 3 });

  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0], {
    x: 8,
    y: 23,
    width: 30,
    height: 40,
    action: { type: 'worldMapDrag', background: true },
  });
});

test('WorldMapInputActionMap resolves tap action through action map contract', () => {
  const action = WorldMapInputActionMap.resolveTapAction({ x: 148, y: 124 }, {
    hitTargets: [
      { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
    ],
    context: createContext(),
  });

  assert.equal(action.type, 'selectWorldMarchTarget');
  assert.equal(action.targetQ, 1);
  assert.equal(action.targetR, 0);
});

test('WorldMapInputActionMap records one tap resolution diagnostic with final action', () => {
  const previousEnabled = global.__actorPickingDiag;
  const previousEvents = global.__actorPickingDiagEvents;
  const previousTraceId = global.__actorPickingDiagActiveTapTraceId;
  const previousSignatures = global.__actorPickingDiagLastSignatureByStage;
  global.__actorPickingDiag = true;
  global.__actorPickingDiagEvents = [];
  global.__actorPickingDiagActiveTapTraceId = '';
  global.__actorPickingDiagLastSignatureByStage = {};

  try {
    const action = WorldMapInputActionMap.resolveTapAction({ x: 148, y: 124 }, {
      tapTraceId: 'tap-test-1',
      hitTargets: [
        { x: 0, y: 0, width: 300, height: 300, action: { type: 'worldMapDrag', background: true } },
      ],
      context: {
        ...createContext(),
        frame: { x: 0, y: 0, width: 300, height: 300 },
      },
    }, { tapTraceId: 'tap-test-1' });

    assert.equal(action.type, 'selectWorldMarchTarget');
    assert.equal(global.__actorPickingDiagEvents.length, 1);
    assert.equal(global.__actorPickingDiagEvents[0].stage, 'inputActionMap:resolveTapAction');
    assert.equal(global.__actorPickingDiagEvents[0].tapTraceId, 'tap-test-1');
    assert.equal(global.__actorPickingDiagEvents[0].reason, 'renderer-world-surface-background');
    assert.equal(global.__actorPickingDiagEvents[0].finalAction.type, 'selectWorldMarchTarget');
    assert.equal(global.__actorPickingDiagEvents[0].hitTargets.targetCount, 1);
  } finally {
    global.__actorPickingDiag = previousEnabled;
    global.__actorPickingDiagEvents = previousEvents;
    global.__actorPickingDiagActiveTapTraceId = previousTraceId;
    global.__actorPickingDiagLastSignatureByStage = previousSignatures;
  }
});

test('WorldMapInputActionMap shares the runtime-routing predicate for app and shell input', () => {
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime(null), true);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({ type: 'worldMapDrag', background: true }), true);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({
    type: 'selectWorldMarchTarget',
    background: true,
  }), true);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({
    type: 'selectWorldMarchTarget',
    background: false,
  }), false);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({ type: 'openWorldSite' }), false);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({
    type: 'openWorldSite',
    inputSurface: 'worldMap',
  }), true);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({
    type: 'selectWorldActor',
    inputSurface: 'worldMap',
  }), true);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({ type: 'blockCanvasModal' }), false);
  assert.equal(WorldMapInputActionMap.shouldRouteTapThroughWorldMapRuntime({ type: 'worldMapDrag', disabled: true }), false);
});
