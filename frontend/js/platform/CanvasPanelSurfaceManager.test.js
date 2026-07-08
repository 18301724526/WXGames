const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPanelSurfaceManager = require('./CanvasPanelSurfaceManager');

test('CanvasPanelSurfaceManager opens a registered panel and refreshes only the panel surface', () => {
  const calls = [];
  const famousPanel = {
    open(host, options) {
      calls.push(['panel.open', host.id, options.source]);
      host.opened = true;
      return true;
    },
    render(renderer, state, options) {
      calls.push(['panel.render', renderer.id, state.id, options.mode]);
    },
  };
  const host = {
    id: 'game',
    state: { id: 'state-1', currentTab: 'military' },
    renderPanelSurface(activeTab, options) {
      calls.push(['renderPanelSurface', activeTab, options.source]);
      return true;
    },
    render() {
      calls.push(['render']);
    },
    renderCanvasSurface() {
      calls.push(['renderCanvasSurface']);
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host,
    registry: {
      get(panelKey) {
        calls.push(['registry.get', panelKey]);
        return panelKey === 'famousPersons' ? famousPanel : null;
      },
    },
  });

  assert.equal(manager.openPanel('famousPersons', { source: 'button' }), true);
  assert.equal(host.opened, true);
  assert.equal(manager.renderPanel('famousPersons', { id: 'renderer' }, host.state, { mode: 'hud' }), true);
  assert.deepEqual(calls, [
    ['registry.get', 'famousPersons'],
    ['panel.open', 'game', 'button'],
    ['renderPanelSurface', 'military', 'button'],
    ['registry.get', 'famousPersons'],
    ['panel.render', 'renderer', 'state-1', 'hud'],
  ]);
});
