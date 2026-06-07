const test = require('node:test');
const assert = require('node:assert/strict');

require('../../domain/TileMapGeometry');
require('../../domain/WorldMarchSystem');
const WorldMarchHudCanvasRenderer = require('./WorldMarchHudCanvasRenderer');

function createHost(overrides = {}) {
  const calls = [];
  const hitTargets = [];
  return {
    calls,
    hitTargets,
    width: 390,
    height: 844,
    presenter: {
      buildMilitaryViewState() {
        return {
          formations: [
            { slot: 1, cityId: 'capital', name: 'Scout A', memberCount: 1, maxMembers: 5, members: [{ id: 'fp-1' }] },
            { slot: 2, cityId: 'capital', name: 'Scout B', memberCount: 0, maxMembers: 5, members: [] },
          ],
        };
      },
    },
    drawPanel(...args) { calls.push(['drawPanel', args]); },
    drawButton(...args) { calls.push(['drawButton', args]); },
    drawText(...args) { calls.push(['drawText', args]); },
    truncateText(text) { return String(text || ''); },
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    ...overrides,
  };
}

test('WorldMarchHudCanvasRenderer renders target march action', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0' },
  }, [], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'openWorldMarchFormationPicker'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && String(call[1][0]).includes(',')), false);
});

test('WorldMarchHudCanvasRenderer renders formation picker with start action', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  const empty = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 2);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.targetQ, 2);
  assert.equal(empty.action.disabled, true);
  assert.equal(start.rect.y >= 84, true);
  assert.equal(start.rect.y + start.rect.height <= 84 + 696, true);
});

test('WorldMarchHudCanvasRenderer separates target info and march command', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    worldMarchTarget: { q: -4, r: 2, tileId: 'tile_-4_2', known: false, terrainLabel: '未知' },
  }, [], {
    originX: 120,
    originY: 130,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  const infoPanel = host.calls.find((call) => call[0] === 'drawPanel' && call[1][2] === 148 && call[1][3] === 48);
  const marchButton = host.calls.find((call) => call[0] === 'drawButton' && call[1][4] === '行军');
  assert.equal(Boolean(infoPanel), true);
  assert.equal(Boolean(marchButton), true);
  const info = { x: infoPanel[1][0], y: infoPanel[1][1], width: infoPanel[1][2], height: infoPanel[1][3] };
  const button = { x: marchButton[1][0], y: marchButton[1][1], width: marchButton[1][2], height: marchButton[1][3] };
  const overlap = button.x < info.x + info.width
    && button.x + button.width > info.x
    && button.y < info.y + info.height
    && button.y + button.height > info.y;
  assert.equal(overlap, false);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === '未知区域'), true);
});

test('WorldMarchHudCanvasRenderer renders selected actor commands', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    selectedWorldActorId: 'explore-1',
  }, [{
    id: 'explore-1',
    missionId: 'explore-1',
    current: { q: 0, r: 0 },
    stopTile: { q: 1, r: 0 },
    formation: { label: 'Scout A' },
  }], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'returnWorldMarch' && target.action.missionId === 'explore-1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'stopWorldMarch' && target.action.targetQ === 1), true);
});
