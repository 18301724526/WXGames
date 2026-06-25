const test = require('node:test');
const assert = require('node:assert/strict');

const ModeKeys = require('./ModeKeys');
const ModeResolver = require('./ModeResolver');
const ModeWorld = require('./ModeWorld');

test('ModeKeys exposes reviewed mode ids and modal mask bits', () => {
  assert.equal(ModeKeys.MODE_ID_BY_KEY.worldMap > 0, true);
  assert.equal(ModeKeys.modeKeyForId(ModeKeys.MODE_ID_BY_KEY['modal:naming']), 'modal:naming');
  assert.equal(ModeKeys.isModalModeKey('modal:confirmDialog'), true);
  assert.equal(ModeKeys.normalizeModeKey('unknown'), 'city');
});

test('ModeResolver creates serializable snapshots with capture and routing facts', () => {
  const snapshot = ModeResolver.createModeSnapshot({
    baseModeKey: 'worldMap',
    modalKeys: ['modal:naming'],
    tutorialActive: false,
    entityBattleActive: false,
    worldMapHomeActive: true,
  });

  assert.equal(snapshot.baseModeKey, 'worldMap');
  assert.deepEqual(snapshot.modalKeys, ['modal:naming']);
  assert.equal(snapshot.blockingOverlayActive, true);
  assert.equal(snapshot.canRouteWorldMap, false);
  assert.equal(snapshot.topCaptureModeKey, 'modal:naming');
});

test('ModeResolver keeps tech-tree routing separate from generic blocking overlays', () => {
  const snapshot = ModeResolver.createModeSnapshot({
    baseModeKey: 'techTree',
    modalKeys: ['modal:blockingPanel'],
    blockingOverlayActive: true,
    techTreeBlockingOverlayActive: false,
  });

  assert.equal(snapshot.blockingOverlayActive, true);
  assert.equal(snapshot.canRouteTechTree, true);
  assert.equal(snapshot.canRouteWorldMap, false);
});

test('ModeWorld stores mode state in a single ECS entity and returns frozen snapshots', () => {
  const owner = ModeWorld.createModeWorld({
    baseModeKey: 'city',
  });

  let snapshot = ModeWorld.getModeSnapshot(owner);
  assert.equal(snapshot.baseModeKey, 'city');

  const update = ModeWorld.updateModeWorld(owner, {
    baseModeKey: 'worldMap',
    worldMapHomeActive: true,
  });

  snapshot = update.snapshot;
  assert.equal(update.modeOwner, owner);
  assert.equal(snapshot.baseModeKey, 'worldMap');
  assert.equal(snapshot.canRouteWorldMap, true);
  assert.equal(Object.isFrozen(snapshot), true);
});
