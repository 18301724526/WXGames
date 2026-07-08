const test = require('node:test');
const assert = require('node:assert/strict');

const ModalStore = require('../../state/ModalStore');
const FamousPersonsPanel = require('./FamousPersonsPanel');
const { makeModalOwnerHost } = require('../../../test-support/CanvasOwnerTestHarness');

test.beforeEach(() => {
  ModalStore.closeAll();
});

test('FamousPersonsPanel owns opening and resetting its panel state', () => {
  const calls = [];
  const game = makeModalOwnerHost({
    famousPersonsPage: 5,
    selectedFamousPersonId: 'fp-old',
  });
  const host = makeModalOwnerHost({
    lastGame: game,
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
  });
  const context = {
    getGameHost() {
      return game;
    },
    getUiStateOwner() {
      return game;
    },
  };
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'famous');

  assert.equal(FamousPersonsPanel.open(host, { context }), true);

  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  assert.deepEqual(calls, [['clearFamousSkillTooltip']]);
});

test('FamousPersonsPanel actions use the adapted UI state owner', () => {
  const game = makeModalOwnerHost({
    famousPersonsPage: 4,
    selectedFamousPersonId: 'fp-old',
  });
  const host = makeModalOwnerHost({
    famousPersonsPage: 1,
    selectedFamousPersonId: 'shell-stale',
    renderer: {
      clearFamousSkillTooltip() {},
    },
  });
  const context = {
    getUiStateOwner() {
      return game;
    },
  };

  assert.equal(FamousPersonsPanel.actions.changePage(host, { delta: -2 }, { context }), true);
  assert.equal(game.famousPersonsPage, 2);
  assert.equal(game.selectedFamousPersonId, '');
  assert.equal(host.famousPersonsPage, 1);
  assert.equal(host.selectedFamousPersonId, 'shell-stale');

  assert.equal(FamousPersonsPanel.actions.openDetail(host, { personId: 'fp-new' }, { context }), true);
  assert.equal(game.selectedFamousPersonId, 'fp-new');
  assert.equal(host.selectedFamousPersonId, 'shell-stale');
});

test('FamousPersonsPanel direct calls fall back to host without host-type lookups', () => {
  const calls = [];
  const host = makeModalOwnerHost({
    famousPersonsPage: 2,
    selectedFamousPersonId: 'fp-old',
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
    getCanvasGameHost() {
      throw new Error('panel direct fallback must not call getCanvasGameHost');
    },
  });
  Object.defineProperty(host, 'lastGame', {
    configurable: true,
    get() {
      throw new Error('panel direct fallback must not read lastGame');
    },
  });

  assert.equal(FamousPersonsPanel.actions.changePage(host, { delta: 1 }), true);
  assert.equal(host.famousPersonsPage, 3);
  assert.equal(host.selectedFamousPersonId, '');
  assert.deepEqual(calls, [['clearFamousSkillTooltip']]);
});

test('FamousPersonsPanel renders through the famous panel renderer module', () => {
  const calls = [];
  const renderer = {
    presenter: {
      buildFamousPersonViewState() {
        calls.push(['buildFamousPersonViewState']);
        return {
          title: 'Famous',
          subtitle: '',
          peopleCount: 0,
          candidateCount: 0,
          maxCandidates: 3,
          seek: { message: '', available: false },
          candidates: [],
          people: [],
          emptyText: '',
        };
      },
    },
    height: 640,
    width: 390,
    getLayout() {
      return { contentWidth: 360 };
    },
    addHitTarget() {},
    drawPanel() {},
    drawText() {},
    drawTextLines() {},
    wrapTextLimit() { return []; },
    truncateText(text) { return text; },
    renderFamousSkillTooltip() {},
    t(key) { return key; },
  };

  assert.equal(FamousPersonsPanel.render(renderer, {}, { famousPersonsPage: 0 }), undefined);
  assert.deepEqual(calls, [['buildFamousPersonViewState']]);
});
