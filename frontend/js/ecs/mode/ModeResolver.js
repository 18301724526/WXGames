'use strict';

const ModeKeys = (() => {
  if (typeof require === 'function') return require('./ModeKeys');
  return globalThis.EcsModeKeys;
})();

const { CAPTURE_PRIORITY, MODAL_BIT_BY_KEY, modeIdForKey, modeKeyForId, normalizeModeKey } =
  ModeKeys || {};

const BLOCKING_MODAL_KEYS = Object.freeze([
  'modal:naming',
  'modal:event',
  'modal:rewardReveal',
  'modal:confirmDialog',
  'modal:targetPicker',
  'modal:blockingPanel',
]);

function readBool(value) {
  return value === true || value === 1;
}

function modalMaskFromKeys(keys = []) {
  return keys.reduce((mask, key) => mask | (MODAL_BIT_BY_KEY[key] || 0), 0);
}

function modalKeysFromMask(mask = 0) {
  return Object.entries(MODAL_BIT_BY_KEY)
    .filter(([, bit]) => (Number(mask) & bit) !== 0)
    .map(([key]) => key);
}

function deriveTopCaptureModeKey(facts = {}) {
  const modalMask = Number(facts.modalMask) || 0;
  if (readBool(facts.tutorialActive)) return 'tutorial';
  return (
    CAPTURE_PRIORITY.find((key) => {
      if (key.startsWith('modal:')) return (modalMask & (MODAL_BIT_BY_KEY[key] || 0)) !== 0;
      return normalizeModeKey(facts.baseModeKey) === key;
    }) || normalizeModeKey(facts.baseModeKey)
  );
}

function createModeSnapshot(facts = {}) {
  const baseModeKey = normalizeModeKey(facts.baseModeKey);
  const modalMask = Number(facts.modalMask) || modalMaskFromKeys(facts.modalKeys || []);
  const modalKeys = modalKeysFromMask(modalMask);
  const blockingOverlayActive =
    readBool(facts.blockingOverlayActive) ||
    modalKeys.some((key) => BLOCKING_MODAL_KEYS.includes(key)) ||
    readBool(facts.entityBattleActive);
  const techTreeBlockingOverlayActive = Object.prototype.hasOwnProperty.call(
    facts,
    'techTreeBlockingOverlayActive',
  )
    ? readBool(facts.techTreeBlockingOverlayActive)
    : blockingOverlayActive;
  const topCaptureModeKey =
    facts.topCaptureModeKey || deriveTopCaptureModeKey({ ...facts, baseModeKey, modalMask });

  return Object.freeze({
    baseModeId: modeIdForKey(baseModeKey),
    baseModeKey,
    modalMask,
    modalKeys: Object.freeze(modalKeys),
    tutorialActive: readBool(facts.tutorialActive),
    debugActive: readBool(facts.debugActive),
    blockingOverlayActive,
    techTreeBlockingOverlayActive,
    entityBattleActive: readBool(facts.entityBattleActive),
    worldMapHomeActive: readBool(facts.worldMapHomeActive),
    techTreeActive: readBool(facts.techTreeActive) || baseModeKey === 'techTree',
    formationEditorActive:
      readBool(facts.formationEditorActive) || baseModeKey === 'formationEditor',
    topCaptureModeId: modeIdForKey(topCaptureModeKey),
    topCaptureModeKey,
    canRouteWorldMap: baseModeKey === 'worldMap' && !blockingOverlayActive,
    canRouteTechTree:
      (baseModeKey === 'techTree' || readBool(facts.techTreeActive)) &&
      !techTreeBlockingOverlayActive,
  });
}

function snapshotFromComponent(ModeState, entity) {
  const modalMask = ModeState.modalMask[entity] || 0;
  const baseModeKey = modeKeyForId(ModeState.baseModeId[entity], 'city');
  return createModeSnapshot({
    baseModeKey,
    modalMask,
    tutorialActive: ModeState.tutorialActive[entity] === 1,
    debugActive: ModeState.debugActive[entity] === 1,
    blockingOverlayActive: ModeState.blockingOverlayActive[entity] === 1,
    techTreeBlockingOverlayActive: ModeState.techTreeBlockingOverlayActive[entity] === 1,
    entityBattleActive: ModeState.entityBattleActive[entity] === 1,
    worldMapHomeActive: ModeState.worldMapHomeActive[entity] === 1,
    techTreeActive: ModeState.techTreeActive[entity] === 1,
    formationEditorActive: ModeState.formationEditorActive[entity] === 1,
    topCaptureModeKey: modeKeyForId(ModeState.topCaptureModeId[entity], baseModeKey),
  });
}

function isBlockingOverlayOpen(snapshot = {}) {
  return Boolean(snapshot.blockingOverlayActive);
}

function isEntityBattleActive(snapshot = {}) {
  return Boolean(snapshot.entityBattleActive);
}

function canRouteWorldMap(snapshot = {}) {
  return Boolean(snapshot.canRouteWorldMap);
}

function canRouteTechTree(snapshot = {}) {
  return Boolean(snapshot.canRouteTechTree);
}

const api = Object.freeze({
  BLOCKING_MODAL_KEYS,
  canRouteTechTree,
  canRouteWorldMap,
  createModeSnapshot,
  deriveTopCaptureModeKey,
  isBlockingOverlayOpen,
  isEntityBattleActive,
  modalKeysFromMask,
  modalMaskFromKeys,
  snapshotFromComponent,
});

if (typeof globalThis !== 'undefined') globalThis.EcsModeResolver = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
