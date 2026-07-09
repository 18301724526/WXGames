const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPanelSurfaceManager = require('./CanvasPanelSurfaceManager');

function createPooledRenderer(baseTargets = [], options = {}) {
  const renderer = {
    id: options.id || 'renderer',
    width: options.width || 420,
    height: options.height || 747,
    hitTargetPools: {
      base: Array.isArray(baseTargets) ? baseTargets : [],
      modal: [],
      guide: [],
    },
    activeHitTargetPool: 'base',
    hitTargets: [],
    sync() {
      this.hitTargets = [
        ...this.hitTargetPools.base,
        ...this.hitTargetPools.modal,
        ...this.hitTargetPools.guide,
      ];
      return this.hitTargets;
    },
    setHitTargets(targets = [], pool = this.activeHitTargetPool) {
      options.calls?.push?.(['renderer.setHitTargets', pool, targets.map((target) => target.action?.type).join(',')]);
      this.hitTargetPools[pool || 'base'] = Array.isArray(targets) ? targets : [];
      return this.sync();
    },
    clearHitTargetPool(pool = 'base') {
      options.calls?.push?.(['renderer.clearHitTargetPool', pool]);
      this.hitTargetPools[pool || 'base'] = [];
      return this.sync();
    },
    addHitTarget(rect, action) {
      this.hitTargetPools[this.activeHitTargetPool || 'base'].push({ ...rect, action });
      return this.sync();
    },
    withHitTargetPool(pool = 'base', callback = null) {
      const previous = this.activeHitTargetPool;
      this.activeHitTargetPool = pool || 'base';
      try {
        return typeof callback === 'function' ? callback() : undefined;
      } finally {
        this.activeHitTargetPool = previous;
        this.sync();
      }
    },
  };
  renderer.sync();
  return renderer;
}

test('CanvasPanelSurfaceManager opens a registered panel and refreshes only the panel surface', () => {
  const calls = [];
  const baseTargets = [{ action: { type: 'openCity' } }];
  const renderer = createPooledRenderer(baseTargets, { calls });
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
      renderer.addHitTarget({ x: 12, y: 12, width: 40, height: 30 }, { type: 'closeFamousPersons' });
    },
  };
  const host = {
    id: 'game',
    state: { id: 'state-1', currentTab: 'military' },
    renderer,
    renderPanelOverlaySurface(panelKey, manager, options) {
      calls.push(['renderPanelOverlaySurface', panelKey, options.source]);
      renderer.withHitTargetPool('modal', () => {
        if (options.clear !== false) renderer.clearHitTargetPool('modal');
        manager.renderPanel(panelKey, renderer, options.state, { ...options, mode: 'panelOverlay' });
      });
      return true;
    },
    clearPanelOverlaySurface(panelKey, manager, options) {
      calls.push(['clearPanelOverlaySurface', panelKey, options.source]);
      renderer.clearHitTargetPool('modal');
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
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), ['openCity', 'closeFamousPersons', 'panelOutsideClick']);
  assert.deepEqual(renderer.hitTargets.at(-1).action, {
    type: 'panelOutsideClick',
    panelKey: 'famousPersons',
    background: true,
    blocksBaseHitTargets: false,
    closesOnOutsideClick: true,
  });
  assert.equal(manager.closePanel('famousPersons', { source: 'back' }), true);
  assert.deepEqual(renderer.hitTargets, baseTargets);
  assert.deepEqual(calls, [
    ['registry.get', 'famousPersons'],
    ['panel.open', 'game', 'button'],
    ['registry.get', 'famousPersons'],
    ['renderPanelOverlaySurface', 'famousPersons', 'button'],
    ['renderer.clearHitTargetPool', 'modal'],
    ['registry.get', 'famousPersons'],
    ['panel.render', 'renderer', 'state-1', 'panelOverlay'],
    ['registry.get', 'famousPersons'],
    ['panel.close', 'game', 'back'],
    ['registry.get', 'famousPersons'],
    ['clearPanelOverlaySurface', 'famousPersons', 'back'],
    ['renderer.clearHitTargetPool', 'modal'],
  ]);
});

test('CanvasPanelSurfaceManager modal projection survives base hit target rebuilds', () => {
  const renderer = createPooledRenderer([{ action: { type: 'openCity' } }]);
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
    render(renderHost) {
      renderHost.addHitTarget({ x: 12, y: 12, width: 40, height: 30 }, { type: 'closeFamousPersons' });
    },
  };
  const host = {
    renderer,
    state: { id: 'state-1' },
    renderPanelOverlaySurface(panelKey, manager, options) {
      renderer.withHitTargetPool('modal', () => {
        if (options.clear !== false) renderer.clearHitTargetPool('modal');
        manager.renderPanel(panelKey, renderer, options.state, { ...options, mode: 'panelOverlay' });
      });
      return true;
    },
    clearPanelOverlaySurface() {
      renderer.clearHitTargetPool('modal');
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

  renderer.withHitTargetPool('guide', () => {
    renderer.addHitTarget({ x: 1, y: 1, width: 20, height: 20 }, { type: 'guideFocus' });
  });
  assert.equal(manager.openPanel('famousPersons'), true);
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), ['openCity', 'closeFamousPersons', 'panelOutsideClick', 'guideFocus']);

  renderer.setHitTargets([{ action: { type: 'openCity' } }, { action: { type: 'openTaskCenter' } }], 'base');
  assert.deepEqual(
    renderer.hitTargets.map((target) => target.action.type),
    ['openCity', 'openTaskCenter', 'closeFamousPersons', 'panelOutsideClick', 'guideFocus'],
  );

  assert.equal(manager.closePanel('famousPersons'), true);
  assert.deepEqual(
    renderer.hitTargets.map((target) => target.action.type),
    ['openCity', 'openTaskCenter', 'guideFocus'],
  );
});

test('CanvasPanelSurfaceManager does not expose the retired base-render repair method', () => {
  const manager = new CanvasPanelSurfaceManager({ host: {} });

  assert.equal('syncOpenPanelSurfacesAfterBaseRender' in manager, false);
});

test('CanvasPanelSurfaceManager projects open panels once in band and priority order', () => {
  const calls = [];
  const renderer = createPooledRenderer([{ action: { type: 'openCity' } }]);
  const makeEntry = (key, band, renderPriority) => ({
    key,
    band,
    renderPriority,
    closesOnOutsideClick: false,
    blocksBaseHitTargets: false,
    isOpen() {
      return true;
    },
    render(renderHost, _state, options) {
      calls.push(['render', key, options.mode]);
      renderHost.addHitTarget({ x: 10, y: 10, width: 10, height: 10 }, { type: `${key}:hit` });
    },
  });
  const entries = {
    settings: makeEntry('settings', 'dialog', 1),
    famousPersons: makeEntry('famousPersons', 'panel', 100),
    guide: makeEntry('guide', 'panel', 10),
  };
  const manager = new CanvasPanelSurfaceManager({
    host: {
      renderer,
      state: { id: 'state' },
      renderPanelOverlaySurface(panelKey, surfaceManager, options) {
        calls.push(['overlay', panelKey, options.clear]);
        renderer.withHitTargetPool('modal', () => {
          if (options.clear !== false) renderer.clearHitTargetPool('modal');
          surfaceManager.renderPanel(panelKey, renderer, options.state, { ...options, mode: 'panelOverlay' });
        });
        return true;
      },
    },
    registry: {
      get(panelKey) {
        return entries[panelKey] || null;
      },
      keys() {
        return ['settings', 'famousPersons', 'guide'];
      },
    },
  });

  assert.equal(manager.projectModalLayer({ source: 'test' }), true);
  assert.deepEqual(calls, [
    ['overlay', 'guide', true],
    ['render', 'guide', 'panelOverlay'],
    ['overlay', 'famousPersons', false],
    ['render', 'famousPersons', 'panelOverlay'],
    ['overlay', 'settings', false],
    ['render', 'settings', 'panelOverlay'],
  ]);
  assert.deepEqual(renderer.hitTargets.map((target) => target.action.type), [
    'openCity',
    'guide:hit',
    'famousPersons:hit',
    'settings:hit',
  ]);
});

test('CanvasPanelSurfaceManager does not expose the retired refreshPanelSurface alias', () => {
  const manager = new CanvasPanelSurfaceManager({ host: {} });

  assert.equal('refreshPanelSurface' in manager, false);
});

test('CanvasPanelSurfaceManager clears modal projection without changing base targets when no panels are open', () => {
  const calls = [];
  const baseTargets = [{ action: { type: 'openCity' } }];
  const renderer = createPooledRenderer(baseTargets, { calls });
  const panel = {
    isOpen() {
      return false;
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host: {
      renderer,
      clearPanelOverlaySurface(panelKey, _surfaceManager, options) {
        calls.push(['clear', panelKey, options.source]);
        renderer.clearHitTargetPool('modal');
        return true;
      },
    },
    registry: {
      get(panelKey) {
        return panelKey === 'famousPersons' ? panel : null;
      },
      keys() {
        return ['famousPersons'];
      },
    },
  });
  renderer.setHitTargets([{ action: { type: 'panelOutsideClick' } }], 'modal');

  assert.equal(manager.projectModalLayer({ requestedPanelKey: 'famousPersons', source: 'close' }), true);
  assert.deepEqual(renderer.hitTargets, baseTargets);
  assert.deepEqual(calls, [
    ['renderer.setHitTargets', 'modal', 'panelOutsideClick'],
    ['clear', 'famousPersons', 'close'],
    ['renderer.clearHitTargetPool', 'modal'],
  ]);
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
