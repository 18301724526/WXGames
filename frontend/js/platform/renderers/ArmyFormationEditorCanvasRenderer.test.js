const test = require('node:test');
const assert = require('node:assert/strict');

const ArmyFormationEditorCanvasRenderer = require('./ArmyFormationEditorCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const view = overrides.view || createMilitaryView();
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect(...args) { calls.push(['fillRect', ...args]); }, fillStyle: '' },
    presenter: {
      buildMilitaryViewState() {
        return view;
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel() { calls.push(['drawPanel']); },
    drawText(text) { calls.push(['drawText', text]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    renderArmyFormationPortrait(person) { calls.push(['renderArmyFormationPortrait', person && person.id]); },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

function createDrawingSurfaceSentinel(label, calls = []) {
  const surface = {
    addHitTarget(...args) {
      calls.push([label, 'addHitTarget', args]);
    },
    createGradient(...args) {
      calls.push([label, 'createGradient', args]);
      return `${label}-gradient`;
    },
    drawButton(...args) {
      calls.push([label, 'drawButton', args]);
    },
    drawPanel(...args) {
      calls.push([label, 'drawPanel', args]);
    },
    drawText(...args) {
      calls.push([label, 'drawText', args]);
    },
    drawTextLines(...args) {
      calls.push([label, 'drawTextLines', args]);
    },
    getLayout(...args) {
      calls.push([label, 'getLayout', args]);
      return { contentX: 10, contentWidth: 360, contentRight: 370 };
    },
    truncateText(...args) {
      calls.push([label, 'truncateText', args]);
      return String(args[0] || '');
    },
    wrapTextLimit(...args) {
      calls.push([label, 'wrapTextLimit', args]);
      return [String(args[0] || '')];
    },
  };
  return surface;
}

function createMilitaryView(overrides = {}) {
  const formationPeople = overrides.formationPeople || [
    { id: 'hero-1', name: 'Ada', qualityLabel: 'Rare', roleText: 'General' },
    { id: 'hero-2', name: 'Babbage', qualityLabel: 'Epic', title: 'Strategist' },
    { id: 'hero-3', name: 'Curie', qualityLabel: 'Legend', roleText: 'Officer' },
    { id: 'hero-4', name: 'Deng', qualityLabel: 'Rare', roleText: 'Scout' },
    { id: 'hero-5', name: 'Euler', qualityLabel: 'Rare', roleText: 'Guard' },
    { id: 'hero-6', name: 'Faraday', qualityLabel: 'Rare', roleText: 'Guard' },
  ];
  return {
    formationMeta: { cityId: 'capital', maxMembers: overrides.maxMembers || 2 },
    formations: [{
      cityId: 'capital',
      slot: 1,
      name: 'Vanguard',
      memberIds: overrides.memberIds || ['hero-1'],
      maxMembers: overrides.maxMembers || 2,
      maxSoldiersPerMember: 1000,
      soldierAssignments: overrides.soldierAssignments || { 'hero-1': 300 },
      soldiersAssigned: 300,
    }],
    formationPeople,
  };
}

test('ArmyFormationEditorCanvasRenderer preserves modal close and block hit targets', () => {
  const host = createHost();
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });

  renderer.renderArmyFormationEditor({}, { armyFormationEditor: { open: true, slot: 1, memberIds: ['hero-1'] } });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeArmyFormationEditor' && target.action.background === true), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'closeArmyFormationEditor' && !target.action.background), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.calls.some((call) => call[0] === 'fillRect'), true);
});

test('ArmyFormationEditorCanvasRenderer keeps member toggle and full formation block contracts', () => {
  const host = createHost({ view: createMilitaryView({ memberIds: ['hero-1', 'hero-2'], maxMembers: 2 }) });
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });

  renderer.renderArmyFormationEditor({}, { armyFormationEditor: { open: true, slot: 1, memberIds: ['hero-1', 'hero-2'] } });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'toggleArmyFormationMember' && target.action.personId === 'hero-1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'toggleArmyFormationMember' && target.action.personId === 'hero-2'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'toggleArmyFormationMember' && target.action.personId === 'hero-3'), false);
});

test('ArmyFormationEditorCanvasRenderer preserves pager and save actions', () => {
  const host = createHost();
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });

  renderer.renderArmyFormationEditor({}, { armyFormationEditor: { open: true, slot: 1, page: 1, memberIds: ['hero-1'] } });

  assert.equal(host.hitTargets.some((target) => target.action.type === 'changeArmyFormationPage' && target.action.delta === -1), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'saveArmyFormation'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'autoReplenishArmyFormation'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'confirmArmyFormationSoldiers'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'changeArmyFormationSoldiers' && target.action.personId === 'hero-1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'requestArmyFormationSoldierInput' && target.action.personId === 'hero-1'), true);

  const savingHost = createHost();
  const savingRenderer = new ArmyFormationEditorCanvasRenderer({ host: savingHost });
  savingRenderer.renderArmyFormationEditor({}, { armyFormationEditor: { open: true, slot: 1, memberIds: ['hero-1'], saving: true } });

  assert.equal(savingHost.hitTargets.some((target) => target.action.type === 'saveArmyFormation'), false);
  assert.equal(savingHost.hitTargets.some((target) => target.action.type === 'blockCanvasModal'), true);
});

test('ArmyFormationEditorCanvasRenderer skips closed editor without drawing', () => {
  const host = createHost();
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });

  renderer.renderArmyFormationEditor({}, { armyFormationEditor: { open: false } });

  assert.equal(host.hitTargets.length, 0);
  assert.equal(host.calls.length, 0);
});

test('ArmyFormationEditorCanvasRenderer reads host state dynamically after proxy removal', () => {
  const firstCtx = { fillRect() {}, fillStyle: '' };
  const secondCtx = { fillRect() {}, fillStyle: '' };
  const firstPresenter = { buildMilitaryViewState: () => createMilitaryView() };
  const secondPresenter = { buildMilitaryViewState: () => createMilitaryView({ memberIds: [] }) };
  const host = createHost({
    ctx: firstCtx,
    height: 844,
    presenter: firstPresenter,
    width: 390,
  });
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });

  assert.equal(renderer.ctx, firstCtx);
  assert.equal(renderer.height, 844);
  assert.equal(renderer.presenter, firstPresenter);
  assert.equal(renderer.width, 390);

  host.ctx = secondCtx;
  host.height = 900;
  host.presenter = secondPresenter;
  host.width = 512;

  assert.equal(renderer.ctx, secondCtx);
  assert.equal(renderer.height, 900);
  assert.equal(renderer.presenter, secondPresenter);
  assert.equal(renderer.width, 512);
});

test('ArmyFormationEditorCanvasRenderer does not proxy unknown host properties after proxy removal', () => {
  const host = createHost({ someRandomProp: 'host-only' });
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });

  assert.equal(renderer.someRandomProp, undefined);
});

test('ArmyFormationEditorCanvasRenderer drawing wrappers prefer explicit drawing surface over host fallback', () => {
  const calls = [];
  const explicitSurface = createDrawingSurfaceSentinel('explicit', calls);
  const fallbackHost = createDrawingSurfaceSentinel('fallback', calls);
  const renderer = new ArmyFormationEditorCanvasRenderer({
    host: fallbackHost,
    drawingSurface: explicitSurface,
  });

  renderer.addHitTarget({ x: 0 }, { type: 'test' });
  assert.equal(renderer.createGradient(0, 0, 1, 1, [], '#000'), 'explicit-gradient');
  renderer.drawButton(0, 0, 10, 10, 'ok');
  renderer.drawPanel(0, 0, 10, 10);
  renderer.drawText('hello', 0, 0);
  renderer.drawTextLines(['hello'], 0, 0);
  assert.deepEqual(renderer.getLayout(), { contentX: 10, contentWidth: 360, contentRight: 370 });
  assert.equal(renderer.truncateText('Ada', 100), 'Ada');
  assert.deepEqual(renderer.wrapTextLimit('Ada', 100), ['Ada']);

  const explicitMethods = calls.filter((call) => call[0] === 'explicit').map((call) => call[1]).sort();
  const fallbackHits = calls.filter((call) => call[0] === 'fallback');
  assert.deepEqual(explicitMethods, [
    'addHitTarget',
    'createGradient',
    'drawButton',
    'drawPanel',
    'drawText',
    'drawTextLines',
    'getLayout',
    'truncateText',
    'wrapTextLimit',
  ].sort());
  assert.equal(fallbackHits.length, 0);
});

test('ArmyFormationEditorCanvasRenderer delegates portrait rendering to host method', () => {
  const result = { rendered: true };
  const calls = [];
  const host = createHost({
    renderArmyFormationPortrait(...args) {
      calls.push(args);
      return result;
    },
  });
  const renderer = new ArmyFormationEditorCanvasRenderer({ host });
  const person = { id: 'hero-1' };

  assert.equal(renderer.renderArmyFormationPortrait(person, 1, 2, 3, 4, { radius: 5 }), result);
  assert.deepEqual(calls, [[person, 1, 2, 3, 4, { radius: 5 }]]);
});

test('CanvasGameRenderer exposes army formation editor through facade', () => {
  class StubArmyFormationEditorRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderArmyFormationEditor(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    armyFormationEditorRendererClass: StubArmyFormationEditorRenderer,
  });
  const state = { activeCityId: 'capital' };
  const options = { armyFormationEditor: { open: true, slot: 1 } };

  const result = renderer.renderArmyFormationEditor(state, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, options]);
});
