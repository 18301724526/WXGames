const test = require('node:test');
const assert = require('node:assert/strict');

const CanvasGameApp = require('./CanvasGameApp');
const CanvasGameShell = require('./CanvasGameShell');

// PRE-1 of the god-file re-decomposition: a single canonical state accessor on the
// base App class (Shell inherits it) so every later SHAPE-A module resolves state
// through one code path. Locks the App/Shell dedup contract: App reads its own live
// state, Shell reads the mounted game's state (this.lastGame.state) -- the divergence
// that used to force ~142 duplicated overrides (e.g. getArmyFormation App vs Shell).

test('getStateHost/getState resolve the App itself and its live state (bare app)', () => {
  const app = Object.create(CanvasGameApp.prototype);
  app.state = { activeCityId: 'capital', tag: 'app-live' };
  assert.equal(app.getStateHost(), app, 'bare app resolves to itself');
  assert.deepEqual(app.getState(), { activeCityId: 'capital', tag: 'app-live' });
});

test('getState returns {} when the app has no state yet', () => {
  const app = Object.create(CanvasGameApp.prototype);
  assert.deepEqual(app.getState(), {});
});

test('Shell inherits getState and resolves the mounted game state (this.lastGame.state)', () => {
  const shell = Object.create(CanvasGameShell.prototype);
  const mounted = { state: { activeCityId: 'front', tag: 'mounted-live' } };
  shell.lastGame = mounted;
  assert.equal(shell.getStateHost(), mounted, 'shell resolves to the mounted game');
  assert.deepEqual(shell.getState(), { activeCityId: 'front', tag: 'mounted-live' });
});

test('Shell with no mounted game falls back to itself (getState {})', () => {
  const shell = Object.create(CanvasGameShell.prototype);
  shell.lastGame = null;
  assert.equal(shell.getStateHost(), shell);
  assert.deepEqual(shell.getState(), {});
});
