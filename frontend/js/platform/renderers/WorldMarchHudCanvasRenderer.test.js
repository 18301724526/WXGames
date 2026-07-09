const test = require('node:test');
const assert = require('node:assert/strict');

require('../../ecs/foundation/TileMapGeometry');
require('../../ecs/system/WorldMarchSystem');
require('../../config/LocaleTextRegistry');
const LocaleText = require('../../ecs/resource/LocaleText');
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

test('WorldMarchHudCanvasRenderer drawing wrappers prefer explicit drawing surface', () => {
  const explicitCalls = [];
  const fallbackCalls = [];
  const drawingSurface = {
    addHitTarget(...args) { explicitCalls.push(['addHitTarget', args]); },
    drawButton(...args) { explicitCalls.push(['drawButton', args]); },
    drawPanel(...args) { explicitCalls.push(['drawPanel', args]); },
    drawText(...args) { explicitCalls.push(['drawText', args]); },
    truncateText(...args) {
      explicitCalls.push(['truncateText', args]);
      return 'explicit-truncated';
    },
  };
  const host = createHost({
    addHitTarget(...args) { fallbackCalls.push(['addHitTarget', args]); },
    drawButton(...args) { fallbackCalls.push(['drawButton', args]); },
    drawPanel(...args) { fallbackCalls.push(['drawPanel', args]); },
    drawText(...args) { fallbackCalls.push(['drawText', args]); },
    truncateText(...args) {
      fallbackCalls.push(['truncateText', args]);
      return 'fallback-truncated';
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host, drawingSurface });

  renderer.addHitTarget({ x: 1 }, { type: 'hit' });
  renderer.drawButton(1, 2, 3, 4, 'button');
  renderer.drawPanel(1, 2, 3, 4, {});
  renderer.drawText('text', 1, 2, {});
  const truncated = renderer.truncateText('abcdef', 24, {});

  assert.deepEqual(explicitCalls.map((call) => call[0]), [
    'addHitTarget',
    'drawButton',
    'drawPanel',
    'drawText',
    'truncateText',
  ]);
  assert.deepEqual(fallbackCalls, []);
  assert.equal(truncated, 'explicit-truncated');
});

test('WorldMarchHudCanvasRenderer reads host data dynamically after proxy removal', () => {
  const firstPresenter = { buildMilitaryViewState: () => ({ formations: [] }) };
  const secondPresenter = { buildMilitaryViewState: () => ({ formations: [{ slot: 1 }] }) };
  const host = createHost({
    width: 390,
    presenter: firstPresenter,
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  assert.equal(renderer.width, 390);
  assert.equal(renderer.presenter, firstPresenter);

  host.width = 480;
  host.presenter = secondPresenter;

  assert.equal(renderer.width, 480);
  assert.equal(renderer.presenter, secondPresenter);
});

test('WorldMarchHudCanvasRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

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

test('WorldMarchHudCanvasRenderer offers no march button for a blocked (e.g. ocean) target', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    worldMarchTarget: {
      q: 2,
      r: 0,
      tileId: 'tile_2_0',
      known: true,
      terrain: 'ocean',
      terrainLabel: '海洋',
      marchDisabled: true,
      marchDisabledReason: 'EXPLORE_ROUTE_BLOCKED',
    },
  }, [], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  // The screenshot bug: an active "行军" button on a scouted ocean tile. A blocked
  // target must offer NO march hit-target and show the blocked reason instead.
  assert.equal(host.hitTargets.some((t) => t.action.type === 'openWorldMarchFormationPicker'), false);
  const blockedText = renderer.getMarchTargetBlockedText({ marchDisabledReason: 'EXPLORE_ROUTE_BLOCKED' });
  assert.equal(host.calls.some((c) => c[0] === 'drawText' && c[1][0] === blockedText), true);
});

test('WorldMarchHudCanvasRenderer blocks an ocean target even with no upstream marchDisabled flag', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    worldMarchTarget: {
      q: 2,
      r: 0,
      tileId: 'tile_2_0',
      known: true,
      terrain: 'ocean',
      terrainLabel: '海洋',
      // No marchDisabled flag — simulates a selection path that skipped it, or a
      // stale upstream. The HUD must still refuse the march for an ocean tile.
    },
  }, [], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  assert.equal(host.hitTargets.some((t) => t.action.type === 'openWorldMarchFormationPicker'), false);
});

test('WorldMarchHudCanvasRenderer renders overlapping world target picker actions', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {}, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, {
    pickerKind: 'worldTargetPicker',
    picker: {
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
  });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'chooseWorldTarget' && target.action.targetId === 'capital'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'chooseWorldTarget' && target.action.targetId === 'march-1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeWorldTargetPicker'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === '选择目标'), true);
});


test('WorldMarchHudCanvasRenderer renders formation picker with start action', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  const empty = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 2);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.targetQ, 2);
  assert.equal(Object.hasOwn(start.action, 'missionId'), false);
  assert.equal(empty.action.visualDisabled, true);
  assert.equal(empty.action.disabled, undefined);
  assert.equal(start.rect.y >= 84, true);
  assert.equal(start.rect.y + start.rect.height <= 84 + 696, true);
});

test('WorldMarchHudCanvasRenderer keeps zero-soldier primary formations clickable with eligibility facts', () => {
  const host = createHost({
    presenter: {
      buildMilitaryViewState() {
        return {
          formations: [
            {
              slot: 1,
              cityId: 'capital',
              name: 'Scout A',
              memberCount: 1,
              maxMembers: 5,
              members: [{ id: 'fp-1', name: 'Scout', soldiersAssigned: 0 }],
            },
          ],
        };
      },
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.visualDisabled, false);
  assert.equal(start.action.disabled, undefined);
  assert.equal(start.action.deploymentEligibility.blocked, true);
  assert.equal(start.action.deploymentEligibility.blockers[0].code, 'FORMATION_PRIMARY_NO_SOLDIERS');
});

test('WorldMarchHudCanvasRenderer keeps blocked march targets grey without suppressing start', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });
  const previousLocale = LocaleText.getLocale();

  try {
    LocaleText.setLocale('en-US');
    renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
      worldMarchTarget: {
        q: 1,
        r: 0,
        tileId: 'tile_1_0',
        marchDisabled: true,
        marchDisabledReason: 'EXPLORE_ROUTE_BLOCKED',
      },
    }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 1, r: 0, tileId: 'tile_1_0' } });

    const starts = host.hitTargets.filter((target) => target.action.type === 'startWorldMarch');
    assert.equal(starts.length > 0, true);
    assert.equal(starts.every((target) => target.action.visualDisabled === true), true);
    assert.equal(starts.every((target) => target.action.disabled === undefined), true);
    assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === 'Route blocked'), true);
  } finally {
    LocaleText.setLocale(previousLocale);
  }
});

test('WorldMarchHudCanvasRenderer includes selected actor id in formation picker start actions', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: {
      q: 2,
      r: -1,
      tileId: 'tile_2_-1',
      missionId: 'explore-idle',
      actorId: 'explore-idle',
    },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1', missionId: 'explore-idle', actorId: 'explore-idle' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(start.action.missionId, 'explore-idle');
  assert.equal(start.action.actorId, 'explore-idle');
});

test('WorldMarchHudCanvasRenderer keeps busy formations grey without suppressing start', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({
    activeCityId: 'capital',
    worldExplorerState: {
      busyFormations: [{ cityId: 'capital', slot: 1, missionId: 'explore-1', status: 'active' }],
    },
  }, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.visualDisabled, true);
  assert.equal(start.action.disabled, undefined);
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
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.visualDisabled, false);
  assert.equal(start.action.disabled, undefined);
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
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.visualDisabled, false);
  assert.equal(start.action.disabled, undefined);
});

test('WorldMarchHudCanvasRenderer does not read formations from host state when action state is incomplete', () => {
  const host = createHost({
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
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.visualDisabled, true);
  assert.equal(start.action.disabled, undefined);
});

test('WorldMarchHudCanvasRenderer uses passed state as authoritative formation source', () => {
  const explicitState = {
    activeCityId: 'frontier',
    military: {
      formations: {
        frontier: [{ slot: 1, cityId: 'frontier', name: 'Explicit Formation', memberIds: ['fp-1'], maxMembers: 5 }],
      },
    },
    famousPersons: {
      people: [{ id: 'fp-1', name: 'Meng' }],
    },
  };
  const staleState = {
    activeCityId: 'stale-city',
    military: {
      formations: {
        'stale-city': [{ slot: 1, cityId: 'stale-city', name: 'Stale Formation', memberIds: [], maxMembers: 5 }],
      },
    },
  };
  const host = createHost({
    worldMapRenderer: {
      state: staleState,
    },
    presenter: {
      buildMilitaryViewState(state = {}) {
        const formation = state.military?.formations?.[state.activeCityId]?.[0] || {};
        return {
          formations: [
            {
              slot: 1,
              cityId: formation.cityId || state.activeCityId || 'capital',
              name: formation.name || 'Formation 1',
              memberIds: formation.memberIds || [],
              memberCount: Array.isArray(formation.memberIds) ? formation.memberIds.length : 0,
              maxMembers: formation.maxMembers || 5,
            },
            { slot: 2, cityId: state.activeCityId || 'capital', name: 'Formation 2', memberCount: 0, maxMembers: 5, memberIds: [] },
            { slot: 3, cityId: state.activeCityId || 'capital', name: 'Formation 3', memberCount: 0, maxMembers: 5, memberIds: [] },
          ],
        };
      },
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud(explicitState, {
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const starts = host.hitTargets.filter((target) => target.action.type === 'startWorldMarch');
  assert.equal(starts.length, 3);
  const explicitStart = starts.find((target) => target.action.formationSlot === 1);
  assert.equal(explicitStart.action.visualDisabled, false);
  assert.equal(explicitStart.action.disabled, undefined);
  assert.equal(explicitStart.action.cityId, 'frontier');
  assert.equal(starts.find((target) => target.action.formationSlot === 2).action.visualDisabled, true);
});

test('WorldMarchHudCanvasRenderer resolves only passed military state over stale host candidates', () => {
  const explicitState = {
    __sentinelSource: 'explicit',
    activeCityId: 'capital',
    military: {
      formations: {
        capital: [
          { slot: 1, cityId: 'capital', name: 'Explicit', memberIds: ['fp-explicit'], maxMembers: 5 },
        ],
      },
    },
  };
  const hostHostState = {
    __sentinelSource: 'hosthost',
    activeCityId: 'capital',
    military: {
      formations: {
        capital: [
          { slot: 1, cityId: 'capital', name: 'HostHost', memberIds: ['fp-hosthost'], maxMembers: 5 },
        ],
      },
    },
  };
  const host = createHost({
    host: {
      state: hostHostState,
      worldMapRenderer: {
        state: hostHostState,
      },
      worldMapLayerRenderer: {
        state: hostHostState,
      },
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  const resolved = renderer.resolveMilitaryState(explicitState);

  assert.equal(host.host.state.__sentinelSource, 'hosthost');
  assert.equal(host.host.worldMapLayerRenderer.state.__sentinelSource, 'hosthost');
  assert.equal(resolved.__sentinelSource, 'explicit');
});

test('WorldMarchHudCanvasRenderer uses explicit host presenter over host host presenter', () => {
  const testState = { activeCityId: 'capital' };
  const explicitPresenter = {
    buildMilitaryViewState() {
      return {
        __sentinelSource: 'explicit',
        formations: [{ slot: 1, cityId: 'capital', name: 'Explicit Presenter' }],
      };
    },
  };
  const hostHostPresenter = {
    buildMilitaryViewState() {
      return {
        __sentinelSource: 'hosthost',
        formations: [{ slot: 1, cityId: 'capital', name: 'Host Host Presenter' }],
      };
    },
  };
  const host = createHost({
    presenter: explicitPresenter,
    host: {
      presenter: hostHostPresenter,
    },
  });
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  const hostHostView = host.host.presenter.buildMilitaryViewState(testState);
  const view = renderer.buildMilitaryViewState(testState);

  assert.equal(hostHostView.__sentinelSource, 'hosthost');
  assert.equal(typeof host.host.presenter.buildMilitaryViewState, 'function');
  assert.equal(view.__sentinelSource, 'explicit');
});

test('WorldMarchHudCanvasRenderer does not fill activeCity-only state from host copies', () => {
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
    state: fullState,
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
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(start.action.visualDisabled, true);
  assert.equal(start.action.disabled, undefined);
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
    worldMarchTarget: { q: 2, r: -1, tileId: 'tile_2_-1' },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const starts = host.hitTargets.filter((target) => target.action.type === 'startWorldMarch');
  assert.equal(starts.find((target) => target.action.formationSlot === 1).action.visualDisabled, false);
  assert.equal(starts.find((target) => target.action.formationSlot === 2).action.visualDisabled, true);
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
    worldMarchTarget: { q: 1, r: 0, tileId: 'tile_1_0' },
  }, [], {}, {}, frame, { pickerKind: 'worldMarchFormation', target: { q: 1, r: 0, tileId: 'tile_1_0' } });

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

test('WorldMarchHudCanvasRenderer renders selected combat actor attack flow', () => {
  LocaleText.setLocale('zh-CN');
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });
  const combatTarget = {
    encounterId: 'hostile_force_capital_ridge',
    q: 2,
    r: -1,
    tileId: 'tile_2_-1',
    name: 'Frontier Patrol',
    terrain: 'forest',
    defender: { soldiers: 40 },
  };

  renderer.renderWorldMarchHud({}, {
    selectedWorldActorId: 'hostile_force_capital_ridge',
  }, [{
    id: 'hostile_force_capital_ridge',
    actorId: 'hostile_force_capital_ridge',
    type: 'hostileForce',
    status: 'idle',
    current: { q: 2, r: -1, tileId: 'tile_2_-1' },
    combatTarget,
  }], {
    originX: 100,
    originY: 100,
    panX: 0,
    panY: 0,
    scale: 0.5,
  }, { stepX: 96, stepY: 48 }, { x: 0, y: 84, width: 390, height: 696 });

  const attack = host.hitTargets.find((target) => target.action.type === 'openWorldMarchFormationPicker');
  assert.equal(Boolean(attack), true);
  assert.equal(attack.action.combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(attack.action.targetQ, 2);
  assert.equal(attack.action.targetR, -1);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'returnWorldMarch'), false);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1][4] === '进攻'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === '40 名士兵'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1][4] === 'Attack'), false);
});

test('WorldMarchHudCanvasRenderer resolves hostile fallback copy through active locale', () => {
  LocaleText.setLocale('en-US');
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({}, {
    selectedWorldActorId: 'hostile_force_unnamed',
  }, [{
    id: 'hostile_force_unnamed',
    actorId: 'hostile_force_unnamed',
    type: 'hostileForce',
    status: 'idle',
    current: { q: 2, r: -1, tileId: 'tile_2_-1' },
    nameKey: 'world.combat.hostileForce.title',
    combatTarget: {
      encounterId: 'hostile_force_unnamed',
      q: 2,
      r: -1,
      tileId: 'tile_2_-1',
      nameKey: 'world.combat.hostileForce.title',
      defender: { soldiers: 12 },
    },
  }], {}, {}, { x: 0, y: 84, width: 390, height: 696 });

  assert.equal(host.calls.some((call) => call[0] === 'drawButton' && call[1][4] === 'Attack'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === '12 soldiers'), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1][0] === 'Hostile Force'), true);
  LocaleText.setLocale('zh-CN');
});

test('WorldMarchHudCanvasRenderer carries combat encounter id through formation start actions', () => {
  const host = createHost();
  const renderer = new WorldMarchHudCanvasRenderer({ host });

  renderer.renderWorldMarchHud({ activeCityId: 'capital' }, {
    worldMarchTarget: {
      q: 2,
      r: -1,
      tileId: 'tile_2_-1',
      combatEncounterId: 'hostile_force_capital_ridge',
      combatTarget: { encounterId: 'hostile_force_capital_ridge', defender: { soldiers: 40 } },
    },
  }, [], {}, {}, { x: 0, y: 84, width: 390, height: 696 }, { pickerKind: 'worldMarchFormation', target: { q: 2, r: -1, tileId: 'tile_2_-1' } });

  const start = host.hitTargets.find((target) => target.action.type === 'startWorldMarch' && target.action.formationSlot === 1);
  assert.equal(Boolean(start), true);
  assert.equal(start.action.combatEncounterId, 'hostile_force_capital_ridge');
  assert.equal(start.action.combatTarget.defender.soldiers, 40);
});
