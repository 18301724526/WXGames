const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasStageScheduler = require('./CanvasStageScheduler');

test('CanvasStageScheduler flushes modal through panel surface manager', () => {
  const calls = [];
  const scheduler = new CanvasStageScheduler({
    panelSurfaceManager: {
      projectModalLayer(options) {
        calls.push(['projectModalLayer', options.dirty.length, options.reason]);
        return true;
      },
    },
  });

  assert.equal(scheduler.markDirty('modal', 'openFamousPersons', { id: 1 }), true);
  assert.equal(scheduler.flush(['modal']), true);
  assert.deepEqual(calls, [['projectModalLayer', 1, 'openFamousPersons']]);
  assert.equal(scheduler.flush(['modal']), false);
});

test('CanvasStageScheduler runAtomic batches dirty slots', () => {
  const calls = [];
  const scheduler = new CanvasStageScheduler({
    panelSurfaceManager: {
      projectModalLayer(options) {
        calls.push(options.dirty.map((entry) => entry.reason));
        return true;
      },
    },
  });

  scheduler.runAtomic(() => {
    scheduler.markDirty('modal', 'open');
    scheduler.markDirty('modal', 'detail');
  }, { flush: ['modal'] });

  assert.deepEqual(calls, [['open', 'detail']]);
});

