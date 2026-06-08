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

test('WorldMapScoutRenderer renders scout route lines and route markers', () => {
  const host = createHost();
  const renderer = new WorldMapScoutRenderer({ host });
  const tileMapView = {
    geometry: { stepX: 96, stepY: 48 },
    activeScouts: [createMission({ status: 'ready' })],
  };

  renderer.renderWorldScoutRoutes(tileMapView, { originX: 100, originY: 80, scale: 0.5 });

  assert.equal(host.calls.some((call) => call[0] === 'drawPolyline' && call[2].color === 'rgba(116, 211, 160, 0.72)'), true);
  assert.equal(host.calls.filter((call) => call[0] === 'drawPanel').length, 2);
});

test('WorldMapScoutRenderer computes legacy scout progress and interpolated point', () => {
  const host = createHost();
  const renderer = new WorldMapScoutRenderer({ host });
  const mission = createMission();
  const viewport = { originX: 100, originY: 80, scale: 0.5 };
  const geometry = { stepX: 96, stepY: 48 };

  assert.equal(renderer.getWorldScoutUnitProgress(mission), 0.75);
  const point = renderer.getWorldScoutUnitPoint(mission, viewport, geometry);
  assert.equal(point.progress, 0.75);
  assert.equal(point.x, 172);
  assert.equal(point.y, 80);
});

test('WorldMapScoutRenderer renders legacy scout units with manifest frame paths', () => {
  const host = createHost();
  const renderer = new WorldMapScoutRenderer({ host });
  const tileMapView = {
    geometry: { stepX: 96, stepY: 48 },
    activeScouts: [createMission()],
  };

  assert.equal(renderer.renderWorldScoutUnitsLegacy(tileMapView, { originX: 100, originY: 80, scale: 0.5 }), true);
  const renderCall = host.calls.find((call) => call[0] === 'renderUnit');
  assert.equal(Boolean(renderCall), true);
  assert.equal(renderCall.some((value) => String(value).includes('assets/art/units/spearman/move/')), true);
});

test('WorldMapScoutRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapScoutRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapScoutRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapScoutRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
