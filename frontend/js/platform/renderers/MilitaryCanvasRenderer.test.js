const test = require('node:test');
const assert = require('node:assert/strict');

const MilitaryCanvasRenderer = require('./MilitaryCanvasRenderer');
const CanvasGameRenderer = require('../CanvasGameRenderer');

function createHost(overrides = {}) {
  const hitTargets = [];
  const calls = [];
  const host = {
    width: 390,
    height: 844,
    ctx: { fillRect() {}, globalAlpha: 1 },
    presenter: {
      buildMilitaryNavigationViewState() {
        return createMilitaryNav(overrides.activeView || 'army');
      },
      buildMilitaryViewState() {
        return createMilitaryView();
      },
      buildScoutControlViewState() {
        return createScoutView();
      },
    },
    hitTargets,
    calls,
    addHitTarget(rect, action) { hitTargets.push({ rect, action }); },
    createGradient() { return '#123'; },
    drawAsset(assetPath) { calls.push(['drawAsset', assetPath]); return false; },
    drawButton(x, y, width, height, label, options = {}) { calls.push(['drawButton', label, options]); },
    drawPanel() { calls.push(['drawPanel']); },
    drawProgressBar(x, y, width, height, percentage) { calls.push(['drawProgressBar', percentage]); },
    drawText(text) { calls.push(['drawText', text]); },
    drawTextLines(lines) { calls.push(['drawTextLines', lines]); },
    drawFamousPortrait() { calls.push(['drawFamousPortrait']); return false; },
    getLayout() { return { contentX: 10, contentWidth: 360, contentRight: 370 }; },
    renderMilitaryWorldView(...args) { calls.push(['renderMilitaryWorldView', args]); },
    renderSectionHeader(title) { calls.push(['renderSectionHeader', title]); },
    truncateText(text) { return String(text || ''); },
    wrapTextLimit(text) { return [String(text || '')]; },
    ...overrides,
  };
  return host;
}

function createMilitaryNav(activeView = 'army') {
  return {
    activeView,
    views: [
      { id: 'army', isActive: activeView === 'army' },
      { id: 'scout', isActive: activeView === 'scout' },
      { id: 'world', isActive: activeView === 'world', disabled: false },
    ],
  };
}

function createMilitaryView() {
  return {
    text: {
      soldierCount: '12/20',
      militaryDefense: 8,
      availableSoldierCount: 6,
      soldiersOnMission: 2,
      soldierTrainingText: 'Training',
    },
    training: { progressWidth: '35' },
    formationMeta: { cityId: 'capital', summary: '3 squads', maxMembers: 5 },
    formations: [{
      cityId: 'capital',
      slot: 1,
      name: 'Vanguard',
      maxMembers: 5,
      members: [{ id: 'hero-1', name: 'Ada' }],
    }],
  };
}

function createScoutView() {
  return {
    statusText: 'Scout nearby tiles.',
    cells: [
      { id: 'n', label: 'North', actionText: 'Scout', action: 'scout', actionValue: 'n', status: 'ready' },
      { id: 'e', label: 'East', actionText: 'Claim', action: 'claim', actionValue: 'mission-1', status: 'active' },
      { id: 's', label: 'South', actionText: 'Locked', action: null, actionValue: 's', status: 'locked', disabled: true },
    ],
    reports: [{ title: 'Found river', text: 'Fresh water nearby.' }],
  };
}

test('MilitaryCanvasRenderer preserves military tab and formation hit targets', () => {
  const host = createHost();
  const renderer = new MilitaryCanvasRenderer({ host });

  renderer.renderMilitary({}, 100, 480, {});

  assert.equal(host.calls.some((call) => call[0] === 'renderSectionHeader' && call[1] === '军事'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'switchMilitaryView' && target.action.view === 'scout'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'openArmyFormation' && target.action.slot === 1), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawProgressBar' && call[1] === 35), true);
});

test('MilitaryCanvasRenderer preserves scout and claim hit target contracts', () => {
  const host = createHost({ activeView: 'scout' });
  const renderer = new MilitaryCanvasRenderer({ host });

  renderer.renderMilitary({}, 100, 520, {});

  assert.equal(host.hitTargets.some((target) => target.action.type === 'scoutTerritory' && target.action.direction === 'n'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'claimScout' && target.action.missionId === 'mission-1'), true);
  assert.equal(host.hitTargets.some((target) => target.action.type === 'scoutTerritory' && target.action.disabled === true), true);
  assert.equal(host.calls.some((call) => call[0] === 'drawText' && call[1] === '侦察报告'), true);
});

test('CanvasGameRenderer exposes military rendering through facade', () => {
  class StubMilitaryRenderer {
    constructor(options) {
      this.host = options.host;
    }

    renderMilitary(...args) {
      return { host: this.host, args };
    }
  }

  const renderer = new CanvasGameRenderer({
    ctx: {},
    presenter: {},
    militaryRendererClass: StubMilitaryRenderer,
  });
  const state = { military: {} };
  const options = { territoryUiState: { selectedSiteId: 'site-1' } };

  const result = renderer.renderMilitary(state, 120, 260, options);

  assert.equal(result.host, renderer);
  assert.deepEqual(result.args, [state, 120, 260, options]);
});
