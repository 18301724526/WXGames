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
