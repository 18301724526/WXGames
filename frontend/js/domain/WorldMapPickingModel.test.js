const test = require('node:test');
const assert = require('node:assert/strict');

require('./TileMapGeometry');
require('./WorldMarchProgressSnapshot');
require('./WorldActorProjection');
require('./WorldMarchGeometry');
require('./WorldMarchSystem');
const PickingModel = require('./WorldMapPickingModel');

function createContext() {
  const geometry = { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48, anchorY: 0.5 };
  return {
    frame: { x: 0, y: 80, width: 390, height: 600 },
    geometry,
    viewport: {
      originX: 180,
      originY: 220,
      panX: 0,
      panY: 0,
      scale: 1,
    },
    tileMapView: {
      version: 7,
      seed: 'seed',
      geometry,
      sites: [{ id: 'capital', type: 'city', owner: 'player' }],
      tiles: [
        { id: 'tile_0_0', q: 0, r: 0, terrain: 'capital', siteId: 'capital', site: { id: 'capital', type: 'city', owner: 'player' } },
        { id: 'tile_1_0', q: 1, r: 0, terrain: 'forest' },
      ],
    },
    actors: [
      {
        id: 'actor-1',
        missionId: 'mission-1',
        status: 'idle',
        current: { q: 1, r: 0, tileId: 'tile_1_0' },
      },
    ],
  };
}

test('WorldMapPickingModel builds stable site and actor targets from world context', () => {
  const snapshot = PickingModel.createSnapshot(createContext(), { inputEpoch: 3 });

  assert.equal(snapshot.schema, 'world-map-picking-snapshot-v1');
  assert.equal(snapshot.inputEpoch, 3);
  assert.equal(snapshot.counts.sites, 1);
  assert.equal(snapshot.counts.actors, 1);
  assert.equal(snapshot.targets.some((target) => target.action.type === 'openWorldSite' && target.action.siteId === 'capital'), true);
  assert.equal(snapshot.targets.some((target) => target.action.type === 'selectWorldActor' && target.action.actorId === 'actor-1'), true);
});

test('WorldMapPickingModel resolves world entities without renderer hit targets', () => {
  const context = createContext();
  const snapshot = PickingModel.createSnapshot(context);
  const siteAction = PickingModel.resolveAction({ x: 180, y: 196 }, snapshot);
  const actorAction = PickingModel.resolveAction({ x: 276, y: 252 }, snapshot);

  assert.equal(siteAction.type, 'openWorldSite');
  assert.equal(siteAction.siteId, 'capital');
  assert.equal(actorAction.type, 'selectWorldActor');
  assert.equal(actorAction.actorId, 'actor-1');
});
