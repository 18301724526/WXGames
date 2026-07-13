const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameRendererCompositionFactory = require('./CanvasGameRendererCompositionFactory');
const CanvasGameRenderer = require('./CanvasGameRenderer');

function createClass(name, calls) {
  return class {
    constructor(options = {}) {
      this.name = name;
      this.options = options;
      calls.push({ name, options });
    }
  };
}

test('CanvasGameRendererCompositionFactory creates child renderers with the game renderer host', () => {
  const calls = [];
  const host = { id: 'game-renderer' };
  const dependencies = {
    canvasSurfaceRenderer: createClass('surface', calls),
    canvasAssetRenderer: createClass('asset', calls),
    worldMapCanvasRenderer: createClass('world-map', calls),
    resourceTopBarCanvasRenderer: createClass('resource-top-bar', calls),
    cityPeopleCanvasRenderer: createClass('city-people', calls),
    canvasFrameRenderer: createClass('frame', calls),
  };

  const composition = CanvasGameRendererCompositionFactory.create({ host, dependencies });

  assert.equal(composition.rendererMap.surfaceRenderer.name, 'surface');
  assert.equal(composition.rendererMap.assetRenderer.name, 'asset');
  assert.equal(composition.rendererMap.worldMapRenderer.name, 'world-map');
  assert.equal(composition.rendererMap.resourceTopBarRenderer.name, 'resource-top-bar');
  assert.equal(composition.rendererMap.cityPeopleRenderer.name, 'city-people');
  assert.equal(composition.rendererMap.frameRenderer.name, 'frame');
  assert.equal(Object.hasOwn(composition.rendererMap, 'homeRenderer'), false);
  assert.equal(calls.every((call) => call.options.host === host), true);
  assert.deepEqual(
    composition.renderers.map((renderer) => renderer.name),
    ['surface', 'asset', 'world-map', 'resource-top-bar', 'city-people', 'frame'],
  );
});

test('CanvasGameRendererCompositionFactory preserves injected child instances before class fallback', () => {
  const injectedSurface = { id: 'surface-instance' };
  const composition = CanvasGameRendererCompositionFactory.create({
    host: {},
    options: { surfaceRenderer: injectedSurface },
    dependencies: {
      canvasSurfaceRenderer: class {
        constructor() {
          throw new Error('injected surface renderer should win');
        }
      },
    },
  });

  assert.equal(composition.rendererMap.surfaceRenderer, injectedSurface);
});

test('CanvasGameRendererCompositionFactory injects host facade into drawing surface renderers', () => {
  const calls = [];
  const host = { id: 'game-renderer-facade' };
  const dependencies = {
    advisorCanvasRenderer: createClass('advisor', calls),
    resourceTopBarCanvasRenderer: createClass('resource-top-bar', calls),
    guideTaskCanvasRenderer: createClass('guide-task', calls),
    civilizationCanvasRenderer: createClass('civilization', calls),
    militaryCanvasRenderer: createClass('military', calls),
    techCanvasRenderer: createClass('tech', calls),
    cityCanvasRenderer: createClass('city', calls),
    systemCanvasRenderer: createClass('system', calls),
    battleCanvasRenderer: createClass('battle', calls),
    eventCanvasRenderer: createClass('event', calls),
    buildingCanvasRenderer: createClass('building', calls),
    overlayCanvasRenderer: createClass('overlay', calls),
    mapCommandCanvasRenderer: createClass('map-command', calls),
    cityPeopleCanvasRenderer: createClass('city-people', calls),
    armyFormationEditorCanvasRenderer: createClass('army-formation-editor', calls),
  };

  const composition = CanvasGameRendererCompositionFactory.create({ host, dependencies });

  [
    'advisorRenderer',
    'resourceTopBarRenderer',
    'guideTaskRenderer',
    'civilizationRenderer',
    'militaryRenderer',
    'techRenderer',
    'cityRenderer',
    'systemRenderer',
    'battleRenderer',
    'eventRenderer',
    'buildingRenderer',
    'overlayRenderer',
    'mapCommandRenderer',
    'cityPeopleRenderer',
    'armyFormationEditorRenderer',
  ].forEach((property) => {
    assert.equal(composition.rendererMap[property].options.host, host);
    assert.equal(composition.rendererMap[property].options.drawingSurface, host);
  });
});

test('CanvasGameRendererCompositionFactory injects shared surface state only into surface-owned renderers', () => {
  const calls = [];
  const surfaceState = { id: 'surface-state' };
  const host = { id: 'game-renderer', surfaceState };
  const dependencies = {
    canvasSurfaceRenderer: createClass('surface', calls),
    famousCanvasRenderer: createClass('famous', calls),
    advisorCanvasRenderer: createClass('advisor', calls),
  };

  const composition = CanvasGameRendererCompositionFactory.create({ host, dependencies });

  assert.equal(composition.rendererMap.surfaceRenderer.options.surfaceState, surfaceState);
  assert.equal(composition.rendererMap.famousRenderer.options.surfaceState, surfaceState);
  assert.equal(composition.rendererMap.advisorRenderer.options.surfaceState, undefined);
  assert.equal(composition.rendererMap.advisorRenderer.options.drawingSurface, host);
});

test('CanvasGameRendererCompositionFactory syncs presenter through descriptor fallback boundary', () => {
  const host = { presenter: { id: 'presenter' } };
  const renderer = {};

  assert.equal(CanvasGameRendererCompositionFactory.syncChildRendererPresenter(host, renderer), true);
  assert.equal(renderer.presenter, host.presenter);
  assert.equal(Object.getOwnPropertyDescriptor(renderer, 'presenter').enumerable, false);
});

test('CanvasGameRenderer delegates child composition and presenter sync to the factory', () => {
  const presenter = { id: 'presenter-1' };
  const renderer = new CanvasGameRenderer({
    presenter,
    surfaceRendererClass: createClass('surface', []),
    assetRendererClass: createClass('asset', []),
  });

  assert.equal(renderer.surfaceRenderer.options.host, renderer);
  assert.equal(renderer.assetRenderer.options.host, renderer);
  assert.equal(renderer.surfaceRenderer.presenter, presenter);
  assert.deepEqual(
    renderer.getChildRenderers().slice(0, 2).map((child) => child.name),
    ['surface', 'asset'],
  );

  const nextPresenter = { id: 'presenter-2' };
  renderer.setPresenter(nextPresenter);
  assert.equal(renderer.surfaceRenderer.presenter, nextPresenter);
  assert.equal(renderer.assetRenderer.presenter, nextPresenter);
});

test('CanvasGameRendererCompositionFactory loads before CanvasGameRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('CanvasGameRendererCompositionFactory.js') > -1);
  assert.ok(html.indexOf('CanvasFrameRenderer.js') < html.indexOf('CanvasGameRendererCompositionFactory.js'));
  assert.ok(html.indexOf('CanvasGameRendererCompositionFactory.js') < html.indexOf('CanvasGameRenderer.js'));
  assert.ok(miniGameEntry.indexOf('CanvasFrameRenderer') < miniGameEntry.indexOf('CanvasGameRendererCompositionFactory'));
  assert.ok(miniGameEntry.indexOf('CanvasGameRendererCompositionFactory') < miniGameEntry.indexOf('MiniGameCanvasRenderer'));
});
