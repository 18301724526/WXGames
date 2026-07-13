'use strict';

const EcsCoreBoundary = (() => {
  if (typeof require === 'function') return require('../core/EcsCoreBoundary');
  return globalThis.EcsCoreBoundary;
})();
const { modeIdForKey } = (() => {
  if (typeof require === 'function') return require('./ModeKeys');
  return globalThis.EcsModeKeys;
})();
const { ModeState } = (() => {
  if (typeof require === 'function') return require('./ModeComponents');
  return globalThis.EcsModeComponents;
})();
const { createModeSnapshot, snapshotFromComponent } = (() => {
  if (typeof require === 'function') return require('./ModeResolver');
  return globalThis.EcsModeResolver;
})();

const { addComponent, addEntity, createWorld, hasComponent } = EcsCoreBoundary || {};

function createModeWorld(initialFacts = {}) {
  const world = createWorld();
  const entity = addEntity(world);
  addComponent(world, ModeState, entity);
  const owner = Object.freeze({
    owner: 'frontend/js/ecs/mode/ModeWorld',
    world,
    entity,
  });
  updateModeWorld(owner, initialFacts);
  return owner;
}

function ensureModeWorld(owner = null) {
  if (
    owner?.world &&
    Number.isFinite(owner.entity) &&
    hasComponent(owner.world, ModeState, owner.entity)
  ) {
    return owner;
  }
  return createModeWorld();
}

function updateModeWorld(owner, facts = {}) {
  const modeOwner = ensureModeWorld(owner);
  const snapshot = createModeSnapshot(facts);
  const entity = modeOwner.entity;

  ModeState.baseModeId[entity] = snapshot.baseModeId;
  ModeState.modalMask[entity] = snapshot.modalMask;
  ModeState.debugActive[entity] = snapshot.debugActive ? 1 : 0;
  ModeState.blockingOverlayActive[entity] = snapshot.blockingOverlayActive ? 1 : 0;
  ModeState.techTreeBlockingOverlayActive[entity] = snapshot.techTreeBlockingOverlayActive ? 1 : 0;
  ModeState.entityBattleActive[entity] = snapshot.entityBattleActive ? 1 : 0;
  ModeState.worldMapHomeActive[entity] = snapshot.worldMapHomeActive ? 1 : 0;
  ModeState.techTreeActive[entity] = snapshot.techTreeActive ? 1 : 0;
  ModeState.formationEditorActive[entity] = snapshot.formationEditorActive ? 1 : 0;
  ModeState.topCaptureModeId[entity] = modeIdForKey(snapshot.topCaptureModeKey);

  return Object.freeze({
    modeOwner,
    snapshot: snapshotFromComponent(ModeState, entity),
  });
}

function getModeSnapshot(owner) {
  const modeOwner = ensureModeWorld(owner);
  return snapshotFromComponent(ModeState, modeOwner.entity);
}

const api = Object.freeze({
  createModeWorld,
  ensureModeWorld,
  getModeSnapshot,
  updateModeWorld,
});

if (typeof globalThis !== 'undefined') globalThis.EcsModeWorld = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
