const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapRendererCompositionFactory = require('./WorldMapRendererCompositionFactory');
const WorldMapLayerCanvasRenderer = require('./WorldMapLayerCanvasRenderer');

function createClass(name, calls) {
  return class {
    constructor(options = {}) {
      this.name = name;
      this.options = options;
      calls.push({ name, options });
    }
  };
}

test('WorldMapRendererCompositionFactory creates shared child renderers with one child host', () => {
  const calls = [];
  const dependencies = {
    worldActorCanvasRenderer: createClass('actor', calls),
    worldMarchHudCanvasRenderer: createClass('march-hud', calls),
    worldMapActorHudRenderer: createClass('actor-hud', calls),
    worldMapTileMapRenderer: createClass('tile-map', calls),
  };
  const renderer = { getNow() { return 123; } };
  const composition = WorldMapRendererCompositionFactory.create({ renderer, dependencies });

  assert.equal(composition.worldActorRenderer.name, 'actor');
  assert.equal(composition.worldMarchHudRenderer.name, 'march-hud');
  assert.equal(composition.worldMapActorHudRenderer.options.worldActorRenderer, composition.worldActorRenderer);
  assert.equal(composition.worldMapActorHudRenderer.options.worldMarchHudRenderer, composition.worldMarchHudRenderer);
  assert.equal(composition.worldMapTileMapRenderer.name, 'tile-map');
  assert.equal(calls.every((call) => call.options.host === composition.childHost), true);
  assert.equal(Object.prototype.hasOwnProperty.call(composition, 'worldMapLayoutFacade'), false);
});

test('WorldMapRendererCompositionFactory injects actor renderer into tile-map layer renderer', () => {
  const fallbackActorRenderer = { id: 'fallback-actor-renderer' };
  const renderer = {
    worldActorRenderer: fallbackActorRenderer,
    worldMapActorHudRenderer: { worldActorRenderer: fallbackActorRenderer },
  };
  const rendererHost = {
    worldActorRenderer: fallbackActorRenderer,
  };
  const composition = WorldMapRendererCompositionFactory.create({
    renderer,
    rendererHost,
    dependencies: {
      worldActorCanvasRenderer: createClass('actor', []),
      worldMapTileMapRenderer: WorldMapLayerCanvasRenderer,
    },
  });

  assert.equal(composition.worldMapTileMapRenderer.getExplicitWorldActorRenderer(), composition.worldActorRenderer);
  assert.notEqual(composition.worldMapTileMapRenderer.getExplicitWorldActorRenderer(), fallbackActorRenderer);
});

test('WorldMapRendererCompositionFactory does not create retired facade instances', () => {
  const composition = WorldMapRendererCompositionFactory.create({
    renderer: {},
    options: {
      worldMapLayoutFacade: {
        getWorldTileScreenCenter() {
          throw new Error('retired facade injection must not run');
        },
      },
    },
    dependencies: {
      worldMapLayoutFacade: class {
        constructor() {
          throw new Error('retired facade class must not be constructed');
        }
      },
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(composition, 'worldMapLayoutFacade'), false);
});

test('WorldMapRendererCompositionFactory child host is the renderer owner, not a renderer-host bridge', () => {
  const renderer = {
    localValue: 7,
    getLocalValue() {
      return this.localValue;
    },
  };
  const rendererHost = {
    hostValue: 11,
    worldTileCache: 'host-cache',
    getHostValue() {
      return this.hostValue;
    },
  };
  const composition = WorldMapRendererCompositionFactory.create({ renderer, rendererHost, dependencies: {} });

  assert.equal(composition.childHost, renderer);
  assert.equal(composition.childHost.getLocalValue(), 7);
  assert.equal(composition.childHost.getHostValue, undefined);
  assert.equal('getHostValue' in composition.childHost, false);
  assert.equal(composition.childHost.worldTileCache, undefined);
  composition.childHost.worldTileCache = 'renderer-cache';
  assert.equal(renderer.worldTileCache, 'renderer-cache');
});

test('WorldMapRendererCompositionFactory loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapRendererCompositionFactory.js') > -1);
  assert.ok(html.indexOf('WorldMapRendererDependencyRegistry.js') < html.indexOf('WorldMapRendererCompositionFactory.js'));
  assert.ok(html.indexOf('WorldMapRendererCompositionFactory.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapRendererDependencyRegistry') < miniGameEntry.indexOf('WorldMapRendererCompositionFactory'));
  assert.ok(miniGameEntry.indexOf('WorldMapRendererCompositionFactory') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
