const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapActorHudRenderer = require('./WorldMapActorHudRenderer');

function createTileMapView() {
  return {
    geometry: { tileWidth: 192, tileHeight: 96, stepX: 96, stepY: 48 },
    activeScouts: [{
      id: 'explore-1',
      kind: 'worldExplore',
      status: 'active',
      origin: { q: 0, r: 0, tileId: 'tile_0_0' },
      target: { q: 2, r: 0, tileId: 'tile_2_0' },
      startedAt: '2026-06-06T00:00:00.000Z',
      completesAt: '2026-06-06T00:00:20.000Z',
      stepDurationSeconds: 10,
      route: [
        { q: 1, r: 0, tileId: 'tile_1_0', revealed: false },
        { q: 2, r: 0, tileId: 'tile_2_0', revealed: false },
      ],
    }],
  };
}

function createHost(overrides = {}) {
  return {
    epochNowMs: new Date('2026-06-06T00:00:05.000Z').getTime(),
    ...overrides,
  };
}

test('WorldMapActorHudRenderer builds actors from epoch time and renders scout units', () => {
  const calls = [];
  const host = createHost();
  const renderer = new WorldMapActorHudRenderer({
    host,
    worldActorRenderer: {
      renderActors(actors, viewport, geometry) {
        calls.push(['renderActors', actors, viewport, geometry]);
        return true;
      },
    },
  });
  const viewport = { originX: 100, originY: 100, scale: 0.5 };

  assert.equal(renderer.renderWorldScoutUnits(createTileMapView(), viewport), true);
  const actors = calls[0][1];
  assert.equal(actors.length, 1);
  assert.equal(actors[0].current.q > 0, true);
  assert.equal(actors[0].current.q < 1, true);
  assert.equal(actors[0].remainingSeconds, 15);
  assert.equal(calls[0][2], viewport);
});

test('WorldMapActorHudRenderer delegates actor hit targets and snapshot actor reuse', () => {
  const calls = [];
  const snapshotActors = [{ id: 'snapshot-actor', current: { q: 0, r: 0 } }];
  const renderer = new WorldMapActorHudRenderer({
    host: createHost(),
    worldActorRenderer: {
      addActorHitTargets(...args) {
        calls.push(['addActorHitTargets', ...args]);
        return true;
      },
    },
  });

  assert.equal(renderer.buildWorldMapActors(createTileMapView(), { actors: snapshotActors }), snapshotActors);
  assert.equal(renderer.addWorldActorHitTargets(snapshotActors, { scale: 1 }, { stepX: 96 }), true);
  assert.equal(calls[0][0], 'addActorHitTargets');
  assert.equal(calls[0][1], snapshotActors);
});

test('WorldMapActorHudRenderer publishes march HUD state before rendering', () => {
  const calls = [];
  const hudRenderer = {
    renderWorldMarchHud(...args) {
      calls.push(['renderWorldMarchHud', ...args]);
      return true;
    },
  };
  const host = createHost();
  Object.defineProperty(host, 'host', {
    get() {
      throw new Error('WorldMapActorHudRenderer should not read host.host');
    },
  });
  const renderer = new WorldMapActorHudRenderer({
    host,
    worldMarchHudRenderer: hudRenderer,
  });
  const state = { id: 'game-state', military: {} };
  const actors = [{ id: 'actor-1' }];

  assert.equal(renderer.renderWorldMarchHud(state, { selected: true }, actors, { scale: 1 }, {}, { x: 1 }), true);
  assert.equal(host.lastGameState, state);
  assert.equal(host.lastWorldMarchState, state);
  assert.equal(hudRenderer.lastGameState, undefined);
  assert.equal(hudRenderer.lastWorldMarchState, undefined);
  assert.equal(calls[0][1], state);
  assert.equal(calls[0][3], actors);
});

test('WorldMapActorHudRenderer reads host epoch time dynamically after proxy removal', () => {
  const firstEpochMs = new Date('2026-06-06T00:00:05.000Z').getTime();
  const secondEpochMs = new Date('2026-06-06T00:00:12.000Z').getTime();
  const host = createHost({ epochNowMs: firstEpochMs });
  const renderer = new WorldMapActorHudRenderer({ host });

  assert.equal(renderer.epochNowMs, firstEpochMs);

  host.epochNowMs = secondEpochMs;

  assert.equal(renderer.epochNowMs, secondEpochMs);
  assert.equal(renderer.getEpochNowMs(), secondEpochMs);
});

test('WorldMapActorHudRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new WorldMapActorHudRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('WorldMapActorHudRenderer forwards march state reads and writes through host', () => {
  const host = createHost();
  const renderer = new WorldMapActorHudRenderer({ host });
  const firstState = { id: 'first-state' };
  const secondState = { id: 'second-state' };

  renderer.lastGameState = firstState;
  renderer.lastWorldMarchState = firstState;
  assert.equal(host.lastGameState, firstState);
  assert.equal(host.lastWorldMarchState, firstState);

  host.lastGameState = secondState;
  host.lastWorldMarchState = secondState;
  assert.equal(renderer.lastGameState, secondState);
  assert.equal(renderer.lastWorldMarchState, secondState);
});

test('WorldMapActorHudRenderer maps nearest world tile through march system', () => {
  const renderer = new WorldMapActorHudRenderer({ host: createHost() });
  const tileMapView = createTileMapView();
  const tile = renderer.getNearestWorldTileAtPoint(
    { x: 100, y: 100 },
    { ...tileMapView, tiles: [{ id: 'tile-0', q: 0, r: 0 }] },
    { originX: 100, originY: 100, scale: 1, geometry: tileMapView.geometry },
  );

  assert.equal(tile.id, 'tile_0_0');
  assert.equal(tile.tileId, 'tile_0_0');
  assert.equal(tile.tile.id, 'tile-0');
});

test('WorldMapActorHudRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapActorHudRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapActorHudRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapActorHudRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
