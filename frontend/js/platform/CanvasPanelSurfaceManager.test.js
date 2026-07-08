const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPanelSurfaceManager = require('./CanvasPanelSurfaceManager');

test('CanvasPanelSurfaceManager opens a registered panel and refreshes only the panel surface', () => {
  const calls = [];
  const baseTargets = [{ action: { type: 'openCity' } }];
  const renderer = {
    id: 'renderer',
    hitTargets: baseTargets,
    setHitTargets(targets) {
      calls.push(['renderer.setHitTargets', targets.map((target) => target.action.type).join(',')]);
      this.hitTargets = targets;
    },
  };
  const famousPanel = {
    opened: false,
    isOpen() {
      return this.opened;
    },
    open(host, options) {
      calls.push(['panel.open', host.id, options.source]);
      host.opened = true;
      this.opened = true;
      return true;
    },
    close(host, options) {
      calls.push(['panel.close', host.id, options.source]);
      this.opened = false;
      return true;
    },
    render(renderer, state, options) {
      calls.push(['panel.render', renderer.id, state.id, options.mode]);
    },
  };
  const host = {
    id: 'game',
    state: { id: 'state-1', currentTab: 'military' },
    renderer,
    renderPanelOverlaySurface(panelKey, manager, options) {
      calls.push(['renderPanelOverlaySurface', panelKey, options.source]);
      manager.renderPanel(panelKey, renderer, options.state, { mode: 'panelOverlay' });
      renderer.hitTargets = [{ action: { type: 'closeFamousPersons' } }];
      return true;
    },
    clearPanelOverlaySurface(panelKey, manager, options) {
      calls.push(['clearPanelOverlaySurface', panelKey, options.source]);
      return true;
    },
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
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), ['closeFamousPersons']);
  assert.equal(manager.closePanel('famousPersons', { source: 'back' }), true);
  assert.deepEqual(renderer.hitTargets, baseTargets);
  assert.deepEqual(calls, [
    ['registry.get', 'famousPersons'],
    ['panel.open', 'game', 'button'],
    ['registry.get', 'famousPersons'],
    ['renderPanelOverlaySurface', 'famousPersons', 'button'],
    ['registry.get', 'famousPersons'],
    ['panel.render', 'renderer', 'state-1', 'panelOverlay'],
    ['registry.get', 'famousPersons'],
    ['panel.close', 'game', 'back'],
    ['clearPanelOverlaySurface', 'famousPersons', 'back'],
    ['renderer.setHitTargets', 'openCity'],
  ]);
});
