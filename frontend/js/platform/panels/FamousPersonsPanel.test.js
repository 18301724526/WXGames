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
  host.openBlockingPanelSnapshot('showTaskCenter', true);
  host.openBlockingPanelSnapshot('activeCommandPanel', 'famous');

  assert.equal(FamousPersonsPanel.open(host), true);

  assert.equal(host.isBlockingPanelSnapshotOpen('showFamousPersons'), true);
  assert.equal(host.isBlockingPanelSnapshotOpen('showTaskCenter'), false);
  assert.equal(host.getCommandPanelValue(), '');
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
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
