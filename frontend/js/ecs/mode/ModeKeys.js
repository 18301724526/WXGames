'use strict';

const BASE_MODE_KEYS = Object.freeze([
  'boot',
  'city',
  'worldMap',
  'techTree',
  'formationEditor',
  'battle',
]);

const MODAL_MODE_KEYS = Object.freeze([
  'modal:naming',
  'modal:event',
  'modal:rewardReveal',
  'modal:confirmDialog',
  'modal:targetPicker',
  'modal:blockingPanel',
]);

const OVERLAY_MODE_KEYS = Object.freeze(['tutorial', 'debug']);

const MODE_KEYS = Object.freeze([...BASE_MODE_KEYS, ...MODAL_MODE_KEYS, ...OVERLAY_MODE_KEYS]);

const MODE_ID_BY_KEY = Object.freeze(
  MODE_KEYS.reduce((record, key, index) => {
    record[key] = index + 1;
    return record;
  }, {}),
);

const MODE_KEY_BY_ID = Object.freeze(
  MODE_KEYS.reduce((record, key) => {
    record[MODE_ID_BY_KEY[key]] = key;
    return record;
  }, {}),
);

const MODAL_BIT_BY_KEY = Object.freeze(
  MODAL_MODE_KEYS.reduce((record, key, index) => {
    record[key] = 1 << index;
    return record;
  }, {}),
);

const CAPTURE_PRIORITY = Object.freeze([
  'modal:confirmDialog',
  'modal:naming',
  'modal:rewardReveal',
  'modal:event',
  'modal:targetPicker',
  'modal:blockingPanel',
  'battle',
  'formationEditor',
  'techTree',
  'worldMap',
  'city',
  'boot',
]);

function normalizeModeKey(value, fallback = 'city') {
  const key = String(value || '');
  return MODE_ID_BY_KEY[key] ? key : fallback;
}

function modeIdForKey(key, fallback = 'city') {
  return MODE_ID_BY_KEY[normalizeModeKey(key, fallback)] || MODE_ID_BY_KEY[fallback] || 0;
}

function modeKeyForId(id, fallback = 'city') {
  return MODE_KEY_BY_ID[Number(id) || 0] || fallback;
}

function isModalModeKey(key) {
  return Object.prototype.hasOwnProperty.call(MODAL_BIT_BY_KEY, key);
}

const api = Object.freeze({
  BASE_MODE_KEYS,
  CAPTURE_PRIORITY,
  MODAL_BIT_BY_KEY,
  MODAL_MODE_KEYS,
  MODE_ID_BY_KEY,
  MODE_KEY_BY_ID,
  MODE_KEYS,
  OVERLAY_MODE_KEYS,
  isModalModeKey,
  modeIdForKey,
  modeKeyForId,
  normalizeModeKey,
});

if (typeof globalThis !== 'undefined') globalThis.EcsModeKeys = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
