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

test('CanvasPanelSurfaceManager normalizes rich registry entries', () => {
  const calls = [];
  const panelModule = {
    opened: false,
    isOpen() {
      return this.opened;
    },
    open() {
      calls.push(['module.open']);
      this.opened = true;
      return true;
    },
    close() {
      calls.push(['module.close']);
      this.opened = false;
      return true;
    },
    actions: {
      changePage(_host, action) {
        calls.push(['module.action', action.delta]);
        return true;
      },
    },
    render(_renderer, _state, options) {
      calls.push(['module.render', options.mode]);
    },
  };
  const entry = {
    key: 'famousPersons',
    module: panelModule,
    open(host, options) {
      calls.push(['entry.open', host.id, options.source]);
      return panelModule.open(host, options);
    },
    close(host, options) {
      calls.push(['entry.close', host.id, options.source]);
      return panelModule.close(host, options);
    },
    actions: {
      changePage(host, action, options) {
        calls.push(['entry.action', host.id, options.source]);
        return panelModule.actions.changePage(host, action, options);
      },
    },
    render(renderer, state, options) {
      calls.push(['entry.render', state.id, options.mode]);
      return panelModule.render(renderer, state, options);
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host: {
      id: 'game',
      state: { id: 'state' },
      renderPanelOverlaySurface(panelKey, surfaceManager, options) {
        calls.push(['overlay', panelKey]);
        surfaceManager.renderPanel(panelKey, {}, options.state, { mode: 'panelOverlay' });
        return true;
      },
      clearPanelOverlaySurface() {
        calls.push(['clearOverlay']);
        return true;
      },
    },
    registry: {
      get(panelKey) {
        return panelKey === 'famousPersons' ? entry : null;
      },
    },
  });

  assert.equal(manager.openPanel('famousPersons', { source: 'button' }), true);
  assert.equal(manager.runPanelAction('famousPersons', 'changePage', { delta: 1 }, { source: 'pager' }), true);
  assert.equal(manager.closePanel('famousPersons', { source: 'back' }), true);
  assert.deepEqual(calls, [
    ['entry.open', 'game', 'button'],
    ['module.open'],
    ['overlay', 'famousPersons'],
    ['entry.render', 'state', 'panelOverlay'],
    ['module.render', 'panelOverlay'],
    ['entry.action', 'game', 'pager'],
    ['module.action', 1],
    ['overlay', 'famousPersons'],
    ['entry.render', 'state', 'panelOverlay'],
    ['module.render', 'panelOverlay'],
    ['entry.close', 'game', 'back'],
    ['module.close'],
    ['clearOverlay'],
  ]);
});

test('CanvasPanelSurfaceManager supplies adapted context to panel handlers', () => {
  const calls = [];
  const game = {
    id: 'game',
    state: { id: 'state' },
    famousPersonsPage: 3,
    selectedFamousPersonId: 'fp-old',
  };
  const host = {
    id: 'shell',
    lastGame: game,
    getCanvasGameHost() {
      return game;
    },
  };
  const panel = {
    open(_host, options) {
      const owner = options.context?.getUiStateOwner?.();
      calls.push(['open', owner?.id, options.source]);
      owner.famousPersonsPage = 0;
      return true;
    },
    close(_host, options) {
      calls.push(['close', options.context?.getGameHost?.()?.id]);
      return true;
    },
    actions: {
      openDetail(_host, action, options) {
        const owner = options.context?.getUiStateOwner?.();
        calls.push(['action', owner?.id, action.personId]);
        owner.selectedFamousPersonId = action.personId;
        return true;
      },
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host,
    registry: {
      get(panelKey) {
        return panelKey === 'famousPersons' ? panel : null;
      },
    },
  });

  assert.equal(manager.openPanel('famousPersons', { source: 'button', render: false }), true);
  assert.equal(manager.runPanelAction(
    'famousPersons',
    'openDetail',
    { personId: 'fp-new' },
    { render: false },
  ), true);
  assert.equal(manager.closePanel('famousPersons'), true);
  assert.equal(game.famousPersonsPage, 0);
  assert.equal(game.selectedFamousPersonId, 'fp-new');
  assert.deepEqual(calls, [
    ['open', 'game', 'button'],
    ['action', 'game', 'fp-new'],
    ['close', 'game'],
  ]);
});
