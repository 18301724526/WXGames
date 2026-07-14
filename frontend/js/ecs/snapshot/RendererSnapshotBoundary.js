'use strict';

const SCHEMA = 'renderer-snapshot-v1';

const ModeKeys = (() => {
  if (typeof require === 'function') return require('../mode/ModeKeys');
  return globalThis.EcsModeKeys;
})();

// Batch 8F: per-panel modal subtypes replace the single 'modal:blockingPanel'.
// 'modal:commandPanel' carries the activeCommandPanel string in its payload; the
// other 11 are open/closed only. PANEL_KEYS/PANEL_DEFAULTS below are unchanged --
// the panel block is DERIVED from these entries, not from a host mirror.
// The subtype list IS the canonical MODAL_MODE_KEYS (single source) so a newly
// added modal subtype appears here automatically.
const MODAL_SUBTYPES = ModeKeys.MODAL_MODE_KEYS;

const PANEL_KEYS = Object.freeze([
  'showSettings',
  'showLogs',
  'showResourceDetails',
  'showCitySwitcher',
  'showSubcityList',
  'showCityManagement',
  'showTaskCenter',
  'showFamousPersons',
  'activeCommandPanel',
  'techDetailOpen',
  'activeDockItemIds',
  'showTopBarDebugStats',
]);

const PANEL_DEFAULTS = Object.freeze({
  showSettings: false,
  showLogs: false,
  showResourceDetails: false,
  showCitySwitcher: false,
  showSubcityList: false,
  showCityManagement: false,
  showTaskCenter: false,
  showFamousPersons: false,
  activeCommandPanel: '',
  techDetailOpen: false,
  activeDockItemIds: Object.freeze([]),
  showTopBarDebugStats: false,
});

const MODE_DEFAULTS = Object.freeze({
  baseModeId: 0,
  baseModeKey: 'city',
  modalMask: 0,
  modalKeys: Object.freeze([]),
  debugActive: false,
  blockingOverlayActive: false,
  techTreeBlockingOverlayActive: false,
  entityBattleActive: false,
  worldMapHomeActive: false,
  techTreeActive: false,
  formationEditorActive: false,
  topCaptureModeId: 0,
  topCaptureModeKey: 'city',
  canRouteWorldMap: false,
  canRouteTechTree: false,
});

const BATTLE_DEFAULTS = Object.freeze({
  schema: 'battle-owner-v1',
  battleScene: null,
  entityBattle: null,
  activeOverlay: 'none',
});

function cloneSerializable(value) {
  if (typeof value === 'function' || typeof value === 'undefined') return null;
  if (value == null) return null;
  if (Array.isArray(value)) return Object.freeze(value.map((item) => cloneSerializable(item)));
  if (typeof value === 'object') {
    const copy = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        const next = value[key];
        if (typeof next === 'function' || typeof next === 'undefined') return;
        copy[key] = cloneSerializable(next);
      });
    return Object.freeze(copy);
  }
  return value;
}

function readEntry(modalWorld, subtype) {
  return (modalWorld && modalWorld.entries && modalWorld.entries[subtype]) || null;
}

// modalWorld is the read-only projection ModalStore.buildModalSnapshot() produces:
// { entries: { '<subtype>': { open, token, payload } } }. Presence is the entry's
// `open` flag (ModalStore omits closed subtypes, so a missing entry is closed).
function buildModalSnapshot(modalWorld = null) {
  const modal = {};
  MODAL_SUBTYPES.forEach((subtype) => {
    const entry = readEntry(modalWorld, subtype);
    const open = Boolean(entry?.open);
    modal[subtype] = Object.freeze({
      open,
      token: open ? String(entry.token || '') : '',
      payload: open ? cloneSerializable(entry.payload || {}) : null,
    });
  });
  return Object.freeze(modal);
}

function normalizePanelValue(panelKey, value) {
  if (panelKey === 'activeCommandPanel') return String(value || '');
  // Pre-decided id lists must survive as arrays — Boolean() would collapse them to
  // `true` and the dock active-state consumers (Array.isArray guards) would never fire.
  if (panelKey === 'activeDockItemIds') {
    return Object.freeze(Array.isArray(value) ? value.map(String) : []);
  }
  return Boolean(value);
}

function buildPanelSnapshot(panelFacts = {}) {
  const panel = {};
  PANEL_KEYS.forEach((panelKey) => {
    const value = Object.prototype.hasOwnProperty.call(panelFacts, panelKey)
      ? panelFacts[panelKey]
      : PANEL_DEFAULTS[panelKey];
    panel[panelKey] = normalizePanelValue(panelKey, value);
  });
  return Object.freeze(panel);
}

function buildModeSnapshot(modeFacts = null) {
  const source = modeFacts && typeof modeFacts === 'object' ? modeFacts : {};
  const mode = {};
  Object.keys(MODE_DEFAULTS).forEach((key) => {
    const value = Object.prototype.hasOwnProperty.call(source, key)
      ? source[key]
      : MODE_DEFAULTS[key];
    mode[key] = cloneSerializable(value);
  });
  return Object.freeze(mode);
}

function buildBattleSnapshot(battleFacts = null) {
  if (!battleFacts || typeof battleFacts !== 'object') return BATTLE_DEFAULTS;
  return Object.freeze({
    schema: String(battleFacts.schema || BATTLE_DEFAULTS.schema),
    battleScene: cloneSerializable(battleFacts.battleScene || null),
    entityBattle: cloneSerializable(battleFacts.entityBattle || null),
    activeOverlay: String(battleFacts.activeOverlay || BATTLE_DEFAULTS.activeOverlay),
  });
}

function buildRendererSnapshot(facts = {}) {
  return Object.freeze({
    schema: SCHEMA,
    modal: buildModalSnapshot(facts.modalWorld || null),
    panel: buildPanelSnapshot(facts.panel || {}),
    mode: buildModeSnapshot(facts.mode || null),
    battle: buildBattleSnapshot(facts.battle || null),
  });
}

function isRendererSnapshot(value) {
  return Boolean(value && value.schema === SCHEMA && value.modal && value.panel && value.mode);
}

const api = Object.freeze({
  BATTLE_DEFAULTS,
  MODAL_SUBTYPES,
  MODE_DEFAULTS,
  PANEL_DEFAULTS,
  PANEL_KEYS,
  SCHEMA,
  buildRendererSnapshot,
  isRendererSnapshot,
});

if (typeof globalThis !== 'undefined') globalThis.EcsRendererSnapshotBoundary = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
