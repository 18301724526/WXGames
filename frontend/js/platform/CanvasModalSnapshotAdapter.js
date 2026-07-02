(function (global) {
  const CanvasModeOwnershipRuntime = (() => {
    if (global.CanvasModeOwnershipRuntime) return global.CanvasModeOwnershipRuntime;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasModeOwnershipRuntime');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const NAMING_MODAL_KEY = 'modal:naming';
  const CONFIRM_DIALOG_MODAL_KEY = 'modal:confirmDialog';
  const REWARD_REVEAL_MODAL_KEY = 'modal:rewardReveal';
  const EVENT_MODAL_KEY = 'modal:event';
  const TARGET_PICKER_MODAL_KEY = 'modal:targetPicker';

  // Each blocking panel owns one modal subtype. Renderer panel facts
  // (snapshot.panel.showX) are derived from these ModalStore entries.
  // activeCommandPanel carries its string enum in the payload value; the other
  // entries are open/closed only.
  const BLOCKING_PANEL_SUBTYPE_BY_KEY = Object.freeze({
    showSettings: 'modal:settings',
    showLogs: 'modal:logs',
    showResourceDetails: 'modal:resourceDetails',
    showCitySwitcher: 'modal:citySwitcher',
    showSubcityList: 'modal:subcityList',
    showCityManagement: 'modal:cityManagement',
    showAdvisor: 'modal:advisor',
    showTaskCenter: 'modal:taskCenter',
    showGuidebook: 'modal:guidebook',
    showFamousPersons: 'modal:famousPersons',
    activeCommandPanel: 'modal:commandPanel',
    techDetailOpen: 'modal:techDetail',
  });

  const BLOCKING_PANEL_KEYS = Object.freeze(Object.keys(BLOCKING_PANEL_SUBTYPE_BY_KEY));

  const COMMAND_PANEL_MODAL_KEY = 'modal:commandPanel';

  function getModalOwnerHost(host) {
    if (!host || typeof host !== 'object') return host;
    if (typeof host.getModalOwnerHost === 'function') return host.getModalOwnerHost();
    return host.getCanvasGameHost?.() || host.lastGame || host;
  }

  function getRendererSnapshot(host, snapshot = null) {
    if (snapshot && typeof snapshot === 'object') return snapshot;
    const owner = getModalOwnerHost(host);
    if (!CanvasModeOwnershipRuntime?.getRendererSnapshot) return null;
    return CanvasModeOwnershipRuntime.getRendererSnapshot(owner || host);
  }

  function readModalEntry(snapshot = null, subtype = '') {
    return snapshot?.modal?.[subtype] || null;
  }

  function refreshRendererSnapshot(host) {
    const owner = getModalOwnerHost(host);
    CanvasModeOwnershipRuntime?.buildRendererSnapshot?.(owner || host);
    if (owner === host) return;
    CanvasModeOwnershipRuntime?.buildRendererSnapshot?.(host);
  }

  function getModalPayloadSnapshot(host, subtype = '', snapshot = null) {
    const entry = readModalEntry(getRendererSnapshot(host, snapshot), subtype);
    if (!entry?.open || !entry.payload) return null;
    return { ...entry.payload, visible: true };
  }

  function getNamingSnapshot(host, snapshot = null) {
    return getModalPayloadSnapshot(host, NAMING_MODAL_KEY, snapshot);
  }

  function getConfirmDialogSnapshot(host, snapshot = null) {
    return getModalPayloadSnapshot(host, CONFIRM_DIALOG_MODAL_KEY, snapshot);
  }

  function getNamingSnapshotFromRendererSnapshot(snapshot = null) {
    return getModalPayloadSnapshot(null, NAMING_MODAL_KEY, snapshot);
  }

  function getConfirmDialogSnapshotFromRendererSnapshot(snapshot = null) {
    return getModalPayloadSnapshot(null, CONFIRM_DIALOG_MODAL_KEY, snapshot);
  }

  function getRewardRevealSnapshot(host, snapshot = null) {
    return getModalPayloadSnapshot(host, REWARD_REVEAL_MODAL_KEY, snapshot);
  }

  function getRewardRevealSnapshotFromRendererSnapshot(snapshot = null) {
    return getModalPayloadSnapshot(null, REWARD_REVEAL_MODAL_KEY, snapshot);
  }

  function getEventSnapshot(host, snapshot = null) {
    return getModalPayloadSnapshot(host, EVENT_MODAL_KEY, snapshot);
  }

  function getEventSnapshotFromRendererSnapshot(snapshot = null) {
    return getModalPayloadSnapshot(null, EVENT_MODAL_KEY, snapshot);
  }

  function getTargetPickerSnapshot(host, snapshot = null) {
    return getModalPayloadSnapshot(host, TARGET_PICKER_MODAL_KEY, snapshot);
  }

  function getTargetPickerSnapshotFromRendererSnapshot(snapshot = null) {
    return getModalPayloadSnapshot(null, TARGET_PICKER_MODAL_KEY, snapshot);
  }

  function getNamingPrompt(host, snapshot = null) {
    return getNamingSnapshot(host, snapshot)?.prompt || null;
  }

  function isNamingSnapshotOpen(host, snapshot = null) {
    return Boolean(getNamingSnapshot(host, snapshot)?.visible);
  }

  function getNamingInputValue(host, snapshot = null) {
    return String(getNamingSnapshot(host, snapshot)?.inputValue || '').trim();
  }

  function openModalPayload(host, subtype = '', payload = {}, callbacks = null) {
    const owner = getModalOwnerHost(host);
    const result =
      typeof CanvasModeOwnershipRuntime?.openModal === 'function'
        ? CanvasModeOwnershipRuntime.openModal(owner || host, subtype, payload, callbacks)
        : null;
    refreshRendererSnapshot(host);
    return result;
  }

  function updateModalPayload(host, subtype = '', patch = {}) {
    const owner = getModalOwnerHost(host);
    const result =
      typeof CanvasModeOwnershipRuntime?.updateModalPayload === 'function'
        ? CanvasModeOwnershipRuntime.updateModalPayload(owner || host, subtype, patch)
        : null;
    refreshRendererSnapshot(host);
    return result;
  }

  function closeModalPayload(host, subtype = '') {
    const owner = getModalOwnerHost(host);
    const result =
      typeof CanvasModeOwnershipRuntime?.closeModal === 'function'
        ? CanvasModeOwnershipRuntime.closeModal(owner || host, subtype)
        : null;
    refreshRendererSnapshot(host);
    return result;
  }

  function openNamingSnapshot(host, payload = {}) {
    return openModalPayload(host, NAMING_MODAL_KEY, payload);
  }

  function updateNamingSnapshot(host, patch = {}) {
    return updateModalPayload(host, NAMING_MODAL_KEY, patch);
  }

  function closeNamingSnapshot(host) {
    return closeModalPayload(host, NAMING_MODAL_KEY);
  }

  function openConfirmDialogSnapshot(host, payload = {}, callbacks = null) {
    return openModalPayload(host, CONFIRM_DIALOG_MODAL_KEY, payload, callbacks);
  }

  function updateConfirmDialogSnapshot(host, patch = {}) {
    return updateModalPayload(host, CONFIRM_DIALOG_MODAL_KEY, patch);
  }

  function closeConfirmDialogSnapshot(host) {
    return closeModalPayload(host, CONFIRM_DIALOG_MODAL_KEY);
  }

  function isConfirmDialogSnapshotOpen(host, snapshot = null) {
    return Boolean(getConfirmDialogSnapshot(host, snapshot)?.visible);
  }

  function resolveConfirmDialogSnapshotCallback(host, type, ...args) {
    const owner = getModalOwnerHost(host);
    return typeof CanvasModeOwnershipRuntime?.resolveModalCallback === 'function'
      ? CanvasModeOwnershipRuntime.resolveModalCallback(owner || host, CONFIRM_DIALOG_MODAL_KEY, type, ...args)
      : undefined;
  }

  function openRewardRevealSnapshot(host, payload = {}) {
    return openModalPayload(host, REWARD_REVEAL_MODAL_KEY, payload);
  }

  function closeRewardRevealSnapshot(host) {
    return closeModalPayload(host, REWARD_REVEAL_MODAL_KEY);
  }

  function isRewardRevealSnapshotOpen(host, snapshot = null) {
    return Boolean(getRewardRevealSnapshot(host, snapshot)?.visible);
  }

  // event modal: the payload carries the scalar eventId. openEventSnapshot returns
  // the eventId so call sites keep `const id = host.openEventSnapshot(x) || x`.
  function openEventSnapshot(host, eventId) {
    openModalPayload(host, EVENT_MODAL_KEY, { eventId });
    return eventId;
  }

  function closeEventSnapshot(host) {
    return closeModalPayload(host, EVENT_MODAL_KEY);
  }

  function isEventSnapshotOpen(host, snapshot = null) {
    return Boolean(getEventSnapshot(host, snapshot)?.visible);
  }

  // targetPicker modal: the payload is a STRUCTURED object discriminated by
  // pickerKind ('worldTargetPicker' carries `picker`, 'worldMarchFormation'
  // carries `target`). openTargetPickerSnapshot returns the payload so call
  // sites keep a truthy guard. The world-march target facts (coords/route/
  // mission/combat) stay in territoryUiState -- only the modal flag moves here.
  function openTargetPickerSnapshot(host, payload = {}) {
    openModalPayload(host, TARGET_PICKER_MODAL_KEY, payload);
    return payload;
  }

  function closeTargetPickerSnapshot(host) {
    return closeModalPayload(host, TARGET_PICKER_MODAL_KEY);
  }

  function isTargetPickerSnapshotOpen(host, snapshot = null) {
    return Boolean(getTargetPickerSnapshot(host, snapshot)?.visible);
  }

  // blocking-panel helpers ---------------------------------------------------
  function blockingPanelSubtype(panelKey) {
    return BLOCKING_PANEL_SUBTYPE_BY_KEY[panelKey] || '';
  }

  function normalizeBlockingPanelKeepSet(except) {
    if (except instanceof Set) return except;
    if (Array.isArray(except)) return new Set(except);
    return new Set(except ? [except] : []);
  }

  // Open a blocking panel, or close it when the requested value is empty. Boolean
  // panels open on truthy values; activeCommandPanel stores its string in the
  // payload and closes on an empty string.
  function openBlockingPanelSnapshot(host, panelKey, value = true) {
    const subtype = blockingPanelSubtype(panelKey);
    if (!subtype) return null;
    if (panelKey === 'activeCommandPanel') {
      const next = String(value || '');
      if (!next) return closeBlockingPanelSnapshot(host, panelKey);
      openModalPayload(host, subtype, { value: next });
      return next;
    }
    if (!value) return closeBlockingPanelSnapshot(host, panelKey);
    openModalPayload(host, subtype, {});
    return true;
  }

  function closeBlockingPanelSnapshot(host, panelKey) {
    const subtype = blockingPanelSubtype(panelKey);
    if (!subtype) return null;
    return closeModalPayload(host, subtype);
  }

  // Close every blocking panel except the kept panelKeys (Axis-1 mutual exclusion).
  // Does NOT touch armyFormationEditor or
  // the event modal -- those are out of scope and stay on their owning close paths.
  function closeBlockingPanelsSnapshot(host, except = []) {
    const keep = normalizeBlockingPanelKeepSet(except);
    const owner = getModalOwnerHost(host);
    BLOCKING_PANEL_KEYS.forEach((panelKey) => {
      if (keep.has(panelKey)) return;
      const subtype = BLOCKING_PANEL_SUBTYPE_BY_KEY[panelKey];
      CanvasModeOwnershipRuntime?.closeModal?.(owner || host, subtype);
    });
    refreshRendererSnapshot(host);
    return null;
  }

  // The raw activeCommandPanel string ('', 'capital', 'tech', ...). Reads must keep
  // the string so `=== 'tech'` / `!== 'tech'` carve-outs survive (a boolean-only
  // isBlockingPanelSnapshotOpen would lose the tech-tree carve-out).
  function getCommandPanelValue(host, snapshot = null) {
    const entry = readModalEntry(getRendererSnapshot(host, snapshot), COMMAND_PANEL_MODAL_KEY);
    return entry?.open ? String(entry.payload?.value || '') : '';
  }

  function isBlockingPanelSnapshotOpen(host, panelKey, snapshot = null) {
    const subtype = blockingPanelSubtype(panelKey);
    if (!subtype) return false;
    if (panelKey === 'activeCommandPanel') return Boolean(getCommandPanelValue(host, snapshot));
    const entry = readModalEntry(getRendererSnapshot(host, snapshot), subtype);
    return Boolean(entry?.open);
  }

  // The flat-12 panel facts (showX booleans + the activeCommandPanel string +
  // techDetailOpen) derived from the per-panel modal entries.
  function buildBlockingPanelFacts(host, snapshot = null) {
    const resolved = getRendererSnapshot(host, snapshot);
    const facts = {};
    BLOCKING_PANEL_KEYS.forEach((panelKey) => {
      const subtype = BLOCKING_PANEL_SUBTYPE_BY_KEY[panelKey];
      const entry = readModalEntry(resolved, subtype);
      if (panelKey === 'activeCommandPanel') {
        facts[panelKey] = entry?.open ? String(entry.payload?.value || '') : '';
      } else {
        facts[panelKey] = Boolean(entry?.open);
      }
    });
    return facts;
  }

  const api = {
    BLOCKING_PANEL_SUBTYPE_BY_KEY,
    COMMAND_PANEL_MODAL_KEY,
    CONFIRM_DIALOG_MODAL_KEY,
    EVENT_MODAL_KEY,
    NAMING_MODAL_KEY,
    REWARD_REVEAL_MODAL_KEY,
    TARGET_PICKER_MODAL_KEY,
    buildBlockingPanelFacts,
    closeBlockingPanelSnapshot,
    closeBlockingPanelsSnapshot,
    closeConfirmDialogSnapshot,
    closeEventSnapshot,
    closeModalPayload,
    closeNamingSnapshot,
    closeRewardRevealSnapshot,
    closeTargetPickerSnapshot,
    getCommandPanelValue,
    isBlockingPanelSnapshotOpen,
    openBlockingPanelSnapshot,
    getConfirmDialogSnapshot,
    getConfirmDialogSnapshotFromRendererSnapshot,
    getEventSnapshot,
    getEventSnapshotFromRendererSnapshot,
    getModalOwnerHost,
    getModalPayloadSnapshot,
    getNamingInputValue,
    getNamingPrompt,
    getNamingSnapshot,
    getNamingSnapshotFromRendererSnapshot,
    getRewardRevealSnapshot,
    getRewardRevealSnapshotFromRendererSnapshot,
    getTargetPickerSnapshot,
    getTargetPickerSnapshotFromRendererSnapshot,
    isConfirmDialogSnapshotOpen,
    isEventSnapshotOpen,
    isNamingSnapshotOpen,
    isRewardRevealSnapshotOpen,
    isTargetPickerSnapshotOpen,
    openConfirmDialogSnapshot,
    openEventSnapshot,
    openModalPayload,
    openNamingSnapshot,
    openRewardRevealSnapshot,
    openTargetPickerSnapshot,
    readModalEntry,
    resolveConfirmDialogSnapshotCallback,
    updateConfirmDialogSnapshot,
    updateModalPayload,
    updateNamingSnapshot,
  };

  global.CanvasModalSnapshotAdapter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
