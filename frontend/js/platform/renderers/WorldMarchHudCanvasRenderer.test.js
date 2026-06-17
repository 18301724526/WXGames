const test = require('node:test');
const assert = require('node:assert/strict');

require('../../domain/TileMapGeometry');
require('../../domain/WorldMarchSystem');
require('../../state/UIStatePresenter');
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

test('WorldMarchHudCanvasRenderer renders overlapping world target picker actions', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    worldTargetPicker: {
      q: 0,
      r: 0,
      tileId: 'tile_0_0',
      anchorX: 180,
      anchorY: 240,
      candidates: [
        { id: 'capital', kind: 'site', label: 'Capital', subtitle: 'City', action: { type: 'openWorldSite', siteId: 'capital' } },
        { id: 'march-1', kind: 'actor', label: 'Scout A', subtitle: 'Idle', action: { type: 'selectWorldActor', actorId: 'march-1' } },
      ],
    },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'chooseWorldTarget' && target.action.targetId === 'capital'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'chooseWorldTarget' && target.action.targetId === 'march-1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeWorldTargetPicker'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === '选择目标'), true);
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

test('WorldMarchHudCanvasRenderer disables busy formations in march picker', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({
    activeCityId: 'capital',
    worldExplorerState: {
      busyFormations: [{ cityId: 'capital', slot: 1, missionId: 'explore-1', status: 'active' }],
    },
  }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.disabled, true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === '行军中'), true);
});

test('WorldMarchHudCanvasRenderer allows idle formations to march again', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({
    activeCityId: 'capital',
    worldExplorerState: {
      busyFormations: [{ cityId: 'capital', slot: 1, missionId: 'explore-1', status: 'idle' }],
    },
  }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.disabled, false);
});

test('WorldMarchHudCanvasRenderer allows expired active manual marches to reuse the formation', () => {
  const host = createHost({
    epochNowMs: new Date('2026-06-06T00:00:25.000Z').getTime(),
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({
    activeCityId: 'capital',
    worldExplorerState: {
      activeMission: {
        id: 'explore-1',
        status: 'active',
        mode: 'manual',
        startedAt: '2026-06-06T00:00:00.000Z',
        completesAt: '2026-06-06T00:00:20.000Z',
        route: [{ q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false }],
        formation: { cityId: 'capital', slot: 1 },
      },
      busyFormations: [{ cityId: 'capital', slot: 1, missionId: 'explore-1', status: 'active' }],
    },
  }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.disabled, false);
});

test('WorldMarchHudCanvasRenderer reads formations from last game state when refreshed with action state', () => {
  const host = createHost({
    lastGame: {
      state: {
        activeCityId: 'capital',
        military: {
          formations: {
            capital: [{ slot: 1, cityId: 'capital', name: '部队一', memberIds: ['fp-1'], maxMembers: 5 }],
          },
        },
        famousPersons: {
          people: [{ id: 'fp-1', name: '孟隼' }],
        },
      },
    },
    presenter: {
      buildMilitaryViewState(state = {}) {
        const person = state.famousPersons?.people?.[0];
        return {
          formations: [
            { slot: 1, cityId: 'capital', name: '部队一', memberCount: person ? 1 : 0, maxMembers: 5, members: person ? [person] : [] },
            { slot: 2, cityId: 'capital', name: '部队二', memberCount: 0, maxMembers: 5, members: [] },
            { slot: 3, cityId: 'capital', name: '部队三', memberCount: 0, maxMembers: 5, members: [] },
          ],
        };
      },
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ type: 'openWorldMarchFormationPicker' }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.disabled, false);
});

test('WorldMarchHudCanvasRenderer reads formations from renderer chain state in map runtime flow', () => {
  const fullState = {
    activeCityId: 'capital',
    military: {
      formations: {
        capital: [{ slot: 1, cityId: 'capital', name: '部队一', memberIds: ['fp-1'], maxMembers: 5 }],
      },
    },
    famousPersons: {
      people: [{ id: 'fp-1', name: '孟隼' }],
    },
  };
  const host = createHost({
    worldMapRenderer: {
      lastWorldMarchState: fullState,
    },
    presenter: {
      buildMilitaryViewState(state = {}) {
        const formation = state.military?.formations?.capital?.[0] || {};
        return {
          formations: [
            {
              slot: 1,
              cityId: 'capital',
              name: formation.name || '部队一',
              memberIds: formation.memberIds || [],
              memberCount: Array.isArray(formation.memberIds) ? formation.memberIds.length : 0,
              maxMembers: formation.maxMembers || 5,
            },
            { slot: 2, cityId: 'capital', name: '部队二', memberCount: 0, maxMembers: 5, memberIds: [] },
            { slot: 3, cityId: 'capital', name: '部队三', memberCount: 0, maxMembers: 5, memberIds: [] },
          ],
        };
      },
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ type: 'openWorldMarchFormationPicker' }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const starts = host.hitTargets.filter((target) => target.action.type === 'startWorldMarch');
  assert.equal(starts.length, 3);
  assert.equal(starts.find((target) => target.action.formationSlot === 1).action.disabled, false);
  assert.equal(starts.find((target) => target.action.formationSlot === 2).action.disabled, true);
});

test('WorldMarchHudCanvasRenderer skips activeCity-only state when resolving formations', () => {
  const fullState = {
    activeCityId: 'capital',
    military: {
      formations: {
        capital: [{ slot: 1, cityId: 'capital', name: '部队一', memberIds: ['fp-1'], maxMembers: 5 }],
      },
    },
    famousPersons: {
      people: [{ id: 'fp-1', name: '孟隼' }],
    },
  };
  const host = createHost({
    lastWorldMarchState: fullState,
    presenter: {
      buildMilitaryViewState(state = {}) {
        const formation = state.military?.formations?.capital?.[0] || {};
        return {
          formations: [
            {
              slot: 1,
              cityId: 'capital',
              name: formation.name || '部队一',
              memberCount: Array.isArray(formation.memberIds) ? formation.memberIds.length : 0,
              maxMembers: formation.maxMembers || 5,
              members: Array.isArray(formation.memberIds) ? formation.memberIds.map((id) => ({ id })) : [],
            },
            { slot: 2, cityId: 'capital', name: '部队二', memberCount: 0, maxMembers: 5, members: [] },
          ],
        };
      },
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(start.action.disabled, false);
});

test('WorldMarchHudCanvasRenderer falls back to shared presenter when host presenter is split out', () => {
  const state = {
    activeCityId: 'capital',
    military: {
      formations: {
        capital: [
          { slot: 1, cityId: 'capital', name: '部队一', memberIds: ['fp-1'], maxMembers: 5 },
          { slot: 2, cityId: 'capital', name: '部队二', memberIds: [], maxMembers: 5 },
        ],
      },
    },
    famousPersons: {
      people: [{ id: 'fp-1', name: '孟隼' }],
    },
  };
  const host = createHost({
    presenter: {},
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud(state, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1', pickerOpen: true },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  const starts = host.hitTargets.filter((target) => target.action.type === 'startWorldMarch');
  assert.equal(starts.find((target) => target.action.formationSlot === 1).action.disabled, false);
  assert.equal(starts.find((target) => target.action.formationSlot === 2).action.disabled, true);
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

test('WorldMarchHudCanvasRenderer clamps HUD controls to the visible game viewport', () => {
  const host = createHost({
    width: 805,
    height: 1120,
    viewportOffsetX: 200,
    viewportOffsetY: 200,
    viewportWidth: 405,
    viewportHeight: 720,
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });
  const frame = { x: 1, y: 73, width: 803, height: 982 };

  renderer.renderWorldMarchHud({}, {
    worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0', known: true, terrainLabel: 'Plains' },
  }, [], {
    originX: 402.5,
    originY: 405.12,
    panX: 0,
    panY: 0,
    scale: 0.78,
  }, { stepX: 96, stepY: 48 }, frame);

  const marchButton = host.calls.find((call) => call[0] === 'drawButton' && call[1][4] === '行军');
  assert.equal(Boolean(marchButton), true);
  assert.equal(marchButton[1][0] + marchButton[1][2] <= 200 + 405 - 8, true);

  host.calls.length = 0;
  host.hitTargets.length = 0;
  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0', pickerOpen: true },
  }, [], {}, {}, frame);

  const starts = host.hitTargets.filter((target) => target.action.type === 'startWorldMarch');
  assert.equal(starts.length, 3);
  assert.equal(starts.every((target) => target.rect.x >= 200 && target.rect.x + target.rect.width <= 200 + 405), true);
  assert.equal(starts.every((target) => target.rect.y >= 200 && target.rect.y + target.rect.height <= 200 + 720), true);
});

test('WorldMarchHudCanvasRenderer renders selected actor commands', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    selectedWorldActorId: 'explore-1',
  }, [{
    id: 'explore-1',
    missionId: 'explore-1',
    status: 'active',
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
  const stopTarget = host.hitTargets.find((target) => target.action.type === 'stopWorldMarch');
  assert.equal(stopTarget?.action.missionId, 'explore-1');
  assert.equal(Object.prototype.hasOwnProperty.call(stopTarget.action, 'targetQ'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stopTarget.action, 'targetR'), false);
});

test('WorldMarchHudCanvasRenderer hides stop command for idle parked actors', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    selectedWorldActorId: 'explore-idle',
  }, [{
    id: 'explore-idle',
    missionId: 'explore-idle',
    status: 'idle',
    current: { q: 2, r: 0 },
    target: { q: 2, r: 0 },
    formation: { label: 'Scout Idle' },
  }], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'returnWorldMarch' && target.action.missionId === 'explore-idle'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'stopWorldMarch'), false);
});
