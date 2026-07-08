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

test('CanvasPanelSurfaceManager base-render sync re-asserts panel targets and refreshes the base snapshot', () => {
  const renderer = {
    hitTargets: [{ action: { type: 'openCity' } }],
    setHitTargets(targets) {
      this.hitTargets = targets;
    },
  };
  const famousPanel = {
    opened: false,
    isOpen() {
      return this.opened;
    },
    open() {
      this.opened = true;
      return true;
    },
    close() {
      this.opened = false;
      return true;
    },
    render() {},
  };
  const host = {
    renderer,
    state: { id: 'state-1' },
    renderPanelOverlaySurface(panelKey, manager, options) {
      manager.renderPanel(panelKey, renderer, options.state, { mode: 'panelOverlay' });
      renderer.setHitTargets([{ action: { type: 'closeFamousPersons' } }]);
      return true;
    },
    clearPanelOverlaySurface() {
      return true;
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host,
    registry: {
      get(panelKey) {
        return panelKey === 'famousPersons' ? famousPanel : null;
      },
      keys() {
        return ['famousPersons'];
      },
    },
  });

  assert.equal(manager.openPanel('famousPersons'), true);
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), ['closeFamousPersons']);

  // A full-frame render stomps the shared pool with fresh base targets.
  renderer.setHitTargets([{ action: { type: 'openCity' } }, { action: { type: 'openTaskCenter' } }]);
  assert.equal(manager.syncOpenPanelSurfacesAfterBaseRender(), true);
  // Panel targets are authoritative again without any pointer movement...
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), ['closeFamousPersons']);
  // ...and closing restores the latest base targets, not the open-time snapshot.
  assert.equal(manager.closePanel('famousPersons'), true);
  assert.deepEqual(
    renderer.hitTargets.map((target) => target.action.type),
    ['openCity', 'openTaskCenter'],
  );
});

test('CanvasPanelSurfaceManager base-render sync is a no-op while no panel is open', () => {
  const calls = [];
  const renderer = {
    hitTargets: [{ action: { type: 'openCity' } }],
    setHitTargets(targets) {
      this.hitTargets = targets;
    },
  };
  const famousPanel = {
    isOpen() {
      return false;
    },
    render() {
      calls.push('panel.render');
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host: {
      renderer,
      renderPanelOverlaySurface() {
        calls.push('renderPanelOverlaySurface');
        return true;
      },
    },
    registry: {
      get(panelKey) {
        return panelKey === 'famousPersons' ? famousPanel : null;
      },
      keys() {
        return ['famousPersons'];
      },
    },
  });

  assert.equal(manager.syncOpenPanelSurfacesAfterBaseRender(), false);
  assert.deepEqual(calls, []);
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), ['openCity']);
});
