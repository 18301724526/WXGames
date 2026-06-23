const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../../config/LocaleTextRegistry');
const LocaleText = require('../../domain/LocaleText');
const WorldMapMilitaryViewRenderer = require('./WorldMapMilitaryViewRenderer');

const DRAWING_WRAPPER_METHODS = [
  'addHitTarget',
  'drawButton',
  'drawPanel',
  'drawText',
  'drawTextLines',
  'wrapTextLimit',
];

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    ctx: {
      clearRect(...args) {
        calls.push(['clearRect', ...args]);
      },
      save() {
        calls.push(['ctxSave']);
      },
      beginPath() {
        calls.push(['ctxBeginPath']);
      },
      arc(...args) {
        calls.push(['ctxArc', ...args]);
      },
      clip() {
        calls.push(['ctxClip']);
      },
      restore() {
        calls.push(['ctxRestore']);
      },
    },
    presenter: {
      buildTerritorySummaryViewState() {
        return { text: { polityName: 'Tribe', territoryCount: '1/3' } };
      },
    },
    addHitTarget(rect, action) {
      hitTargets.push({ rect, action });
    },
    createGradient(...args) {
      calls.push(['createGradient', ...args]);
      return '#123';
    },
    drawAsset(...args) {
      calls.push(['drawAsset', ...args]);
      return false;
    },
    drawButton(...args) {
      calls.push(['drawButton', ...args]);
    },
    drawLine(...args) {
      calls.push(['drawLine', ...args]);
    },
    drawPanel(...args) {
      calls.push(['drawPanel', ...args]);
    },
    drawText(...args) {
      calls.push(['drawText', ...args]);
    },
    drawTextLines(...args) {
      calls.push(['drawTextLines', ...args]);
    },
    isWorldTileMapWaterAnimated() {
      return false;
    },
    renderWorldTileMap(...args) {
      calls.push(['renderWorldTileMap', ...args]);
    },
    resolveWorldTileMapView(territoryState = {}, uiState = {}) {
      return {
        ...(territoryState.worldMap || {}),
        pan: { x: Number(uiState.worldPanX) || 0, y: Number(uiState.worldPanY) || 0 },
      };
    },
    truncateText(text) {
      return String(text || '');
    },
    wrapTextLimit(text) {
      return [String(text || '')];
    },
    ...overrides,
  };
}

function createTileMapView() {
  return {
    tiles: [
      { id: 'tile-1', q: 0, r: 0 },
      { id: 'tile-2', q: 1, r: 0 },
    ],
  };
}

function createDrawingSurfaceSentinel(label, calls) {
  return {
    addHitTarget(...args) { calls.push([label, 'addHitTarget', args]); },
    drawButton(...args) { calls.push([label, 'drawButton', args]); },
    drawPanel(...args) { calls.push([label, 'drawPanel', args]); },
    drawText(...args) { calls.push([label, 'drawText', args]); },
    drawTextLines(...args) { calls.push([label, 'drawTextLines', args]); },
    wrapTextLimit(...args) {
      calls.push([label, 'wrapTextLimit', args]);
      return [`${label}-wrapped`];
    },
  };
}

function getCalledDrawingSurfaceMethods(calls, label) {
  return calls.filter((call) => call[0] === label).map((call) => call[1]);
}

test('WorldMapMilitaryViewRenderer renders tile-map branch without clearing the map viewport', () => {
  LocaleText.setLocale('zh-CN');
  const host = createHost({
    isWorldTileMapWaterAnimated() {
      return true;
    },
  });
  const renderer = new WorldMapMilitaryViewRenderer({ host });
  const uiState = {};

  renderer.renderMilitaryWorldView({
    territoryState: { worldMap: createTileMapView() },
  }, 10, 20, 360, 300, {
    territoryUiState: uiState,
    skipWorldMapLayer: true,
  });

  const renderCall = host.calls.find((call) => call[0] === 'renderWorldTileMap');
  assert.equal(Boolean(renderCall), true);
  assert.equal(renderCall[2], 22);
  assert.equal(renderCall[3], 66);
  assert.equal(renderCall[6].tileMapWaterAnimated, true);
  assert.equal(renderCall[7].hitTargetsOnly, true);
  assert.equal(host.calls.some((call) => call[0] === 'drawPanel' && call[4] === 300), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawPanel' && call[4] === 40), true);
  assert.equal(host.calls.some((call) => call[0] === 'clearRect'), false);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'resetWorldPan'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[5] === '回中'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '2 格'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[5] === 'Home'), false);
});

test('WorldMapMilitaryViewRenderer shows empty world copy when tile map is unavailable', () => {
  const host = createHost();
  const renderer = new WorldMapMilitaryViewRenderer({ host });

  renderer.renderMilitaryWorldView({
    territoryState: {
      territories: [
        { id: 'capital', name: 'Capital', owner: 'player' },
        { id: 'site-2', name: 'Ruins', owner: 'neutral' },
      ],
    },
  }, 10, 20, 360, 360, {
    territoryUiState: { selectedSiteId: 'capital', worldPanX: 4, worldPanY: -2 },
  });

  assert.equal(host.calls.some((call) => call[0] === 'drawTextLines'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite'), false);
});

test('WorldMapMilitaryViewRenderer shows empty exploration copy without site targets', () => {
  LocaleText.setLocale('zh-CN');
  const host = createHost();
  const renderer = new WorldMapMilitaryViewRenderer({ host });

  renderer.renderMilitaryWorldView({ territoryState: { territories: [] } }, 10, 20, 360, 300, {});

  assert.equal(host.calls.some((call) => call[0] === 'drawTextLines'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawTextLines' && call[1][0] === '派遣侦察队揭开外部世界。'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite'), false);
});

test('WorldMapMilitaryViewRenderer resolves world-view chrome through active locale', () => {
  LocaleText.setLocale('en-US');
  const host = createHost({
    presenter: {
      buildTerritorySummaryViewState() {
        return { text: {} };
      },
    },
  });
  const renderer = new WorldMapMilitaryViewRenderer({ host });

  renderer.renderMilitaryWorldView({
    territoryState: { worldMap: createTileMapView() },
  }, 10, 20, 360, 300, {
    territoryUiState: {},
  });

  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === 'Unnamed polity'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '0/0 controlled'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[5] === 'Home'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '2 tiles'), true);
  LocaleText.setLocale('zh-CN');
});

test('WorldMapMilitaryViewRenderer reads host presenter dynamically after proxy removal', () => {
  const host = createHost();
  const renderer = new WorldMapMilitaryViewRenderer({ host });
  const nextPresenter = {
    buildTerritorySummaryViewState() {
      return { text: { polityName: 'Dynasty', territoryCount: '2/5' } };
    },
  };

  host.presenter = nextPresenter;

  assert.equal(renderer.presenter, nextPresenter);
});

test('WorldMapMilitaryViewRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new WorldMapMilitaryViewRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('WorldMapMilitaryViewRenderer drawing wrappers prefer explicit drawing surface over host fallback', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new WorldMapMilitaryViewRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderer.addHitTarget({ x: 1 }, { type: 'resetWorldPan' });
  renderer.drawButton(1, 2, 3, 4, 'Home');
  renderer.drawPanel(1, 2, 3, 4, {});
  renderer.drawText('label', 1, 2, {});
  renderer.drawTextLines(['line'], 1, 2, {});
  renderer.wrapTextLimit('copy', 100, 2, {});

  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'explicit'), DRAWING_WRAPPER_METHODS);
  assert.deepEqual(getCalledDrawingSurfaceMethods(calls, 'fallback'), []);
});

test('WorldMapMilitaryViewRenderer delegates world map methods to host', () => {
  const calls = [];
  const expectedTileMapView = { tiles: [{ id: 'tile-1' }] };
  const expectedRenderResult = { source: 'host-renderWorldTileMap' };
  const host = createHost({
    isWorldTileMapWaterAnimated(...args) {
      calls.push(['isWorldTileMapWaterAnimated', args]);
      return true;
    },
    renderWorldTileMap(...args) {
      calls.push(['renderWorldTileMap', args]);
      return expectedRenderResult;
    },
    resolveWorldTileMapView(...args) {
      calls.push(['resolveWorldTileMapView', args]);
      return expectedTileMapView;
    },
  });
  const renderer = new WorldMapMilitaryViewRenderer({ host });
  const territoryState = { id: 'territory' };
  const uiState = { worldPanX: 2 };
  const options = { worldExplorerState: {} };

  assert.equal(renderer.isWorldTileMapWaterAnimated(expectedTileMapView), true);
  assert.equal(renderer.renderWorldTileMap(expectedTileMapView, 1, 2, 3, 4, uiState, options), expectedRenderResult);
  assert.equal(renderer.resolveWorldTileMapView(territoryState, uiState, options), expectedTileMapView);
  assert.deepEqual(calls, [
    ['isWorldTileMapWaterAnimated', [expectedTileMapView]],
    ['renderWorldTileMap', [expectedTileMapView, 1, 2, 3, 4, uiState, options]],
    ['resolveWorldTileMapView', [territoryState, uiState, options]],
  ]);
});

test('WorldMapMilitaryViewRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapMilitaryViewRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapMilitaryViewRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapMilitaryViewRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
