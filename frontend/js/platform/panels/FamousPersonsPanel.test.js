const test = require('node:test');
const assert = require('node:assert/strict');

const FamousPersonsPanel = require('./FamousPersonsPanel');

test('FamousPersonsPanel owns opening and resetting game-owned panel state', () => {
  const calls = [];
  const game = {
    showFamousPersons: false,
    famousPersonsPage: 5,
    selectedFamousPersonId: 'fp-old',
  };
  const host = {
    showFamousPersons: false,
    showTaskCenter: true,
    activeCommandPanel: 'famous',
    lastGame: game,
    renderer: {
      clearFamousSkillTooltip() {
        calls.push(['clearFamousSkillTooltip']);
      },
    },
  };

  assert.equal(FamousPersonsPanel.open(host, {
    context: {
      getUiStateOwner: () => game,
      getGameHost: () => game,
    },
  }), true);

  assert.equal(game.showFamousPersons, true);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, '');
  assert.equal(host.showTaskCenter, false);
  assert.equal(host.activeCommandPanel, '');
  assert.deepEqual(calls, [['clearFamousSkillTooltip']]);
});

test('FamousPersonsPanel renders through the famous renderer module', () => {
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
    drawButton() {},
    drawText() {},
    drawTextLines() {},
    wrapTextLimit() { return []; },
    truncateText(text) { return text; },
    renderFamousSkillTooltip() {},
    createGradient() { return '#000'; },
    t(key) { return key; },
  };

  assert.equal(FamousPersonsPanel.render(renderer, {}, { famousPersonsPage: 0 }), undefined);
  assert.deepEqual(calls, [['buildFamousPersonViewState']]);
});
