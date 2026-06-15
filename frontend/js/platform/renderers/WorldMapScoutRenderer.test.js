const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapScoutRenderer = require('./WorldMapScoutRenderer');

function createHost(overrides = {}) {
  const calls = [];
  return {
    calls,
    epochNowMs: new Date('2026-06-06T00:00:15.000Z').getTime(),
    constructor: {
      getUnitSpriteManifest() {
        return {
          getFramePaths() {
            return ['assets/art/units/spearman/move/000.png', 'assets/art/units/spearman/move/001.png'];
          },
          getFrameDurationMs() {
            return 80;
          },
        };
      },
      getTutorialIntroUnitRenderer() {
        return {
          renderUnit(...args) {
            calls.push(['renderUnit', ...args]);
          },
        };
      },
      getWorldTime() {
        return {
          toEpochMs(input, fallback) {
            const ms = new Date(input).getTime();
            return Number.isFinite(ms) ? ms : fallback;
          },
        };
      },
    },
    drawPanel(...args) {
      calls.push(['drawPanel', ...args]);
    },
    drawPolyline(...args) {
      calls.push(['drawPolyline', ...args]);
    },
    ctx: {
      beginPath() { calls.push(['beginPath']); },
      getLineDash() { calls.push(['getLineDash']); return []; },
      lineTo(...args) { calls.push(['lineTo', ...args]); },
      moveTo(...args) { calls.push(['moveTo', ...args]); },
      restore() { calls.push(['restore']); },
      save() { calls.push(['save']); },
      setLineDash(...args) { calls.push(['setLineDash', ...args]); },
      stroke() { calls.push(['stroke']); },
      lineCap: 'butt',
      lineDashOffset: 0,
      lineJoin: 'miter',
      lineWidth: 1,
      strokeStyle: '',
    },
    getEpochNowMs() {
      return this.epochNowMs;
    },
    getNow() {
      return 80;
    },
    getWorldTileScreenCenter(tile, viewport, geometry) {
      calls.push(['getWorldTileScreenCenter', tile.q, tile.r]);
      const stepX = Number(geometry.stepX) || 96;
      const stepY = Number(geometry.stepY) || 48;
      return {
        x: viewport.originX + (Number(tile.q) || 0) * stepX * (Number(viewport.scale) || 1),
        y: viewport.originY + (Number(tile.r) || 0) * stepY * (Number(viewport.scale) || 1),
      };
    },
    ...overrides,
  };
}

function createMission(overrides = {}) {
  return {
    id: 'scout-1',
    kind: 'worldExplore',
    status: 'active',
    origin: { q: 0, r: 0 },
    startedAt: '2026-06-06T00:00:00.000Z',
    stepDurationSeconds: 10,
    route: [
      { q: 1, r: 0, revealed: false },
      { q: 2, r: 0, revealed: true },
    ],
    ...overrides,
  };
}

test('WorldMapScoutRenderer renders dynamic dashed routes from actor current position', () => {
  const host = createHost();
  const renderer = new WorldMapScoutRenderer({ host });
  const tileMapView = {
    geometry: { stepX: 96, stepY: 48 },
    activeScouts: [createMission({
      id: 'scout-1',
      route: [
        { q: 1, r: 0, step: 1, revealed: false },
        { q: 2, r: 0, step: 2, revealed: false },
        { q: 3, r: 0, step: 3, revealed: false },
      ],
    })],
  };
  const actors = [{
    id: 'scout-1',
    missionId: 'scout-1',
    status: 'active',
    current: { q: 1.5, r: 0, segmentIndex: 1, segmentProgress: 0.5 },
    progress: { segmentIndex: 1, segmentProgress: 0.5 },
  }];

  assert.equal(renderer.renderWorldScoutRoutes(tileMapView, { originX: 100, originY: 80, scale: 0.5 }, actors), true);

  assert.equal(host.calls.some((call) => call[0] === 'setLineDash' && call[1][0] === 10), true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileScreenCenter' && call[1] === 1.5 && call[2] === 0), true);
  assert.equal(host.calls.some((call) => call[0] === 'getWorldTileScreenCenter' && call[1] === 1 && call[2] === 0), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawPanel'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawPolyline'), false);
});

test('WorldMapScoutRenderer skips idle actor routes', () => {
  const host = createHost();
  const renderer = new WorldMapScoutRenderer({ host });
  const tileMapView = {
    geometry: { stepX: 96, stepY: 48 },
    activeScouts: [createMission({ status: 'idle' })],
  };
  const actors = [{
    id: 'scout-1',
    missionId: 'scout-1',
    status: 'idle',
    current: { q: 2, r: 0 },
  }];

  assert.equal(renderer.renderWorldScoutRoutes(tileMapView, { originX: 100, originY: 80, scale: 0.5 }, actors), false);
  assert.equal(host.calls.some((call) => call[0] === 'stroke'), false);
});

test('WorldMapScoutRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapScoutRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapScoutRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapScoutRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
