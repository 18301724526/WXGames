const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WorldMapWaterEntryRenderer = require('./WorldMapWaterEntryRenderer');

function createHost(overrides = {}) {
  const calls = [];
  return {
    calls,
    drawWorldTileWater(...args) {
      calls.push(['drawWorldTileWater', ...args]);
      return true;
    },
    ...overrides,
  };
}

function createEntry(tile) {
  return {
    tile,
    center: { x: 10, y: 20 },
    drawRect: { x: 1, y: 2, width: 30, height: 16 },
  };
}

test('WorldMapWaterEntryRenderer draws only water entries with dry template disabled', () => {
  const host = createHost();
  const renderer = new WorldMapWaterEntryRenderer({ host });
  const viewport = { scale: 1 };
  const waterEntry = createEntry({ id: 'water-1', water: { kind: 'river', asset: 'river.png' } });
  const dryEntry = createEntry({ id: 'dry-1', terrain: 'plains' });

  assert.equal(renderer.renderWorldTileWaterEntries({}, viewport, [waterEntry, dryEntry], 1234), true);
  assert.equal(host.calls.length, 1);
  assert.equal(host.calls[0][1], waterEntry.tile);
  assert.equal(host.calls[0][4], viewport);
  assert.deepEqual(host.calls[0][5], { drawDryTemplate: false, waterTimeMs: 1234 });
});

test('WorldMapWaterEntryRenderer reports false when no water entry is drawn', () => {
  const host = createHost();
  const renderer = new WorldMapWaterEntryRenderer({ host });

  assert.equal(renderer.renderWorldTileWaterEntries({}, {}, [createEntry({ id: 'dry-1' })]), false);
  assert.equal(host.calls.length, 0);
});

test('WorldMapWaterEntryRenderer loads before WorldMapCanvasRenderer in browser entrypoints', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../..', 'index.html'), 'utf8');
  const miniGameEntry = fs.readFileSync(path.join(__dirname, '../../..', 'minigame/game.js'), 'utf8');

  assert.ok(html.indexOf('WorldMapWaterEntryRenderer.js') > -1);
  assert.ok(html.indexOf('WorldMapWaterEntryRenderer.js') < html.indexOf('WorldMapCanvasRenderer.js'));
  assert.ok(miniGameEntry.indexOf('WorldMapWaterEntryRenderer') < miniGameEntry.indexOf('WorldMapCanvasRenderer'));
});
