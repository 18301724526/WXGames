const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasPanelSurfaceManager = require('./CanvasPanelSurfaceManager');

test('CanvasPanelSurfaceManager projects open modal entries through modal hit target pool', () => {
  const calls = [];
  const renderer = {
    id: 'renderer',
    width: 400,
    height: 700,
    pools: {},
    clearHitTargetPool(pool) {
      calls.push(['clearHitTargetPool', pool]);
      this.pools[pool] = [];
    },
    withHitTargetPool(pool, callback) {
      calls.push(['withHitTargetPool', pool]);
      this.activePool = pool;
      callback();
      this.activePool = '';
    },
    addHitTarget(_rect, action) {
      calls.push(['addHitTarget', this.activePool, action.type]);
      this.pools[this.activePool].push(action);
    },
  };
  const panel = {
    isOpen() {
      return true;
    },
    render(activeRenderer, state, options) {
      calls.push(['panel.render', activeRenderer.id, state.id, options.mode]);
    },
  };
  const manager = new CanvasPanelSurfaceManager({
    host: { renderer, state: { id: 'state-1' } },
    registry: {
      keys() {
        return ['famousPersons'];
      },
      get() {
        return {
          key: 'famousPersons',
          renderPriority: 100,
          closesOnOutsideClick: true,
          blocksBaseHitTargets: true,
          module: panel,
        };
      },
    },
  });

  assert.equal(manager.projectModalLayer(), true);
  assert.deepEqual(calls, [
    ['clearHitTargetPool', 'modal'],
    ['withHitTargetPool', 'modal'],
    ['addHitTarget', 'modal', 'panelOutsideClick'],
    ['panel.render', 'renderer', 'state-1', 'panelOverlay'],
  ]);
  assert.deepEqual(renderer.pools.modal[0], {
    type: 'panelOutsideClick',
    panelKey: 'famousPersons',
    background: false,
    blocksBaseHitTargets: true,
  });
});
