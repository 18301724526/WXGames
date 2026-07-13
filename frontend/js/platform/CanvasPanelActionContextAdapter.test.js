const test = require('node:test');
const assert = require('node:assert/strict');

const buildPanelActionContext = require('./CanvasPanelActionContextAdapter');

test('buildPanelActionContext separates game host from UI state owner', () => {
  const game = { id: 'game', state: { currentTab: 'resources' } };
  const host = {
    id: 'shell',
    lastGame: game,
    getCanvasGameHost() {
      return game;
    },
  };
  const context = buildPanelActionContext(host);

  assert.equal(context.getGameHost(), game);
  assert.equal(context.getUiStateOwner(), game);
  assert.equal(context.getState(), game.state);
});

test('buildPanelActionContext falls back to host surfaces', () => {
  const calls = [];
  const host = {
    state: { currentTab: 'events' },
    showFloatingText(message) {
      calls.push(['float', message]);
    },
    t(key) {
      return `t:${key}`;
    },
  };
  const context = buildPanelActionContext(host);

  assert.equal(context.getGameHost(), host);
  assert.equal(context.getUiStateOwner(), host);
  assert.equal(context.t('panel.blocked'), 't:panel.blocked');
  context.showFloatingText('blocked');
  assert.deepEqual(calls, [['float', 'blocked']]);
});

