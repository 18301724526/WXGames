const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapMilitaryViewRenderer = require('./WorldMapMilitaryViewRenderer');

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

test('WorldMapMilitaryViewRenderer renders tile-map branch and reset target', () => {
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
  assert.equal(host.calls.some((call) => call[0] === 'clearRect'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'resetWorldPan'), true);
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
  const host = createHost();
  const renderer = new WorldMapMilitaryViewRenderer({ host });

  renderer.renderMilitaryWorldView({ territoryState: { territories: [] } }, 10, 20, 360, 300, {});

  assert.equal(host.calls.some((call) => call[0] === 'drawTextLines'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldSite'), false);
});

test('WorldMapMilitaryViewRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapMilitaryViewRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapMilitaryViewRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapMilitaryViewRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
