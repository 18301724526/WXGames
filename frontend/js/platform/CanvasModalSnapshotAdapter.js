(function (global) {
  const NAMING_MODAL_KEY = 'modal:naming';
  const CONFIRM_DIALOG_MODAL_KEY = 'modal:confirmDialog';
  const REWARD_REVEAL_MODAL_KEY = 'modal:rewardReveal';
  const EVENT_MODAL_KEY = 'modal:event';
  const TARGET_PICKER_MODAL_KEY = 'modal:targetPicker';

  // Batch 8F: per-panel blocking modal subtypes replace the retired single
  // 'modal:blockingPanel' umbrella. Each blocking panel
  // owns one modal subtype; the renderer panel facts (snapshot.panel.showX) are
  // DERIVED from these entries by the bridge. 'activeCommandPanel' carries its
  // string enum in the payload value; the other 11 are open/closed only.
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
    return typeof owner?.getRendererSnapshot === 'function'
      ? owner.getRendererSnapshot()
      : (typeof host?.getRendererSnapshot === 'function' ? host.getRendererSnapshot() : null);
  }

  function readModalEntry(snapshot = null, subtype = '') {
    return snapshot?.modal?.[subtype] || null;
  }

  function refreshRendererSnapshot(host) {
    const owner = getModalOwnerHost(host);
    owner?.buildRendererSnapshot?.();
    if (owner === host) return;
    host?.buildRendererSnapshot?.();
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
    const target = getModalOwnerHost(host);
    const result =
      typeof target?.openModal === 'function'
        ? target.openModal(subtype, payload, callbacks)
        : null;
    refreshRendererSnapshot(host);
    return result;
  }

  function updateModalPayload(host, subtype = '', patch = {}) {
    const target = getModalOwnerHost(host);
    const result =
      typeof target?.updateModalPayload === 'function'
        ? target.updateModalPayload(subtype, patch)
        : null;
    refreshRendererSnapshot(host);
    return result;
  }

  function closeModalPayload(host, subtype = '') {
    const target = getModalOwnerHost(host);
    const result = typeof target?.closeModal === 'function' ? target.closeModal(subtype) : null;
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
    const target = getModalOwnerHost(host);
    return typeof target?.resolveModalCallback === 'function'
      ? target.resolveModalCallback(CONFIRM_DIALOG_MODAL_KEY, type, ...args)
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

  // Open (or, for a falsy/empty value, close) a blocking panel. Preserves the
  // retired openBlockingPanelOwner toggle contract: boolean panels open on a truthy
  // value / close on falsy; activeCommandPanel opens on a non-empty string carried in
  // the payload / closes on ''. Returns the normalized value so toggle call sites can
  // keep `const next = host.openBlockingPanelSnapshot(key, !current)`.
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
    const target = getModalOwnerHost(host);
    BLOCKING_PANEL_KEYS.forEach((panelKey) => {
      if (keep.has(panelKey)) return;
      const subtype = BLOCKING_PANEL_SUBTYPE_BY_KEY[panelKey];
      target?.closeModal?.(subtype);
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

  function install(TargetClass) {
    if (!TargetClass?.prototype) return false;
    Object.assign(TargetClass.prototype, {
      closeNamingSnapshot() {
        return closeNamingSnapshot(this);
      },

      closeConfirmDialogSnapshot() {
        return closeConfirmDialogSnapshot(this);
      },

      getConfirmDialogSnapshot(snapshot = null) {
        return getConfirmDialogSnapshot(this, snapshot);
      },

      getNamingSnapshot(snapshot = null) {
        return getNamingSnapshot(this, snapshot);
      },

      isNamingSnapshotOpen(snapshot = null) {
        return isNamingSnapshotOpen(this, snapshot);
      },

      isConfirmDialogSnapshotOpen(snapshot = null) {
        return isConfirmDialogSnapshotOpen(this, snapshot);
      },

      getNamingInputValue(snapshot = null) {
        return getNamingInputValue(this, snapshot);
      },

      openNamingSnapshot(payload = {}) {
        return openNamingSnapshot(this, payload);
      },

      updateNamingSnapshot(patch = {}) {
        return updateNamingSnapshot(this, patch);
      },

      openConfirmDialogSnapshot(payload = {}, callbacks = null) {
        return openConfirmDialogSnapshot(this, payload, callbacks);
      },

      updateConfirmDialogSnapshot(patch = {}) {
        return updateConfirmDialogSnapshot(this, patch);
      },

      resolveConfirmDialogSnapshotCallback(type, ...args) {
        return resolveConfirmDialogSnapshotCallback(this, type, ...args);
      },

      openRewardRevealSnapshot(payload = {}) {
        return openRewardRevealSnapshot(this, payload);
      },

      closeRewardRevealSnapshot() {
        return closeRewardRevealSnapshot(this);
      },

      getRewardRevealSnapshot(snapshot = null) {
        return getRewardRevealSnapshot(this, snapshot);
      },

      isRewardRevealSnapshotOpen(snapshot = null) {
        return isRewardRevealSnapshotOpen(this, snapshot);
      },

      openEventSnapshot(eventId) {
        return openEventSnapshot(this, eventId);
      },

      closeEventSnapshot() {
        return closeEventSnapshot(this);
      },

      getEventSnapshot(snapshot = null) {
        return getEventSnapshot(this, snapshot);
      },

      isEventSnapshotOpen(snapshot = null) {
        return isEventSnapshotOpen(this, snapshot);
      },

      openTargetPickerSnapshot(payload = {}) {
        return openTargetPickerSnapshot(this, payload);
      },

      closeTargetPickerSnapshot() {
        return closeTargetPickerSnapshot(this);
      },

      getTargetPickerSnapshot(snapshot = null) {
        return getTargetPickerSnapshot(this, snapshot);
      },

      isTargetPickerSnapshotOpen(snapshot = null) {
        return isTargetPickerSnapshotOpen(this, snapshot);
      },

      openBlockingPanelSnapshot(panelKey, value = true) {
        return openBlockingPanelSnapshot(this, panelKey, value);
      },

      closeBlockingPanelSnapshot(panelKey) {
        return closeBlockingPanelSnapshot(this, panelKey);
      },

      closeBlockingPanelsSnapshot(except = []) {
        return closeBlockingPanelsSnapshot(this, except);
      },

      isBlockingPanelSnapshotOpen(panelKey, snapshot = null) {
        return isBlockingPanelSnapshotOpen(this, panelKey, snapshot);
      },

      getCommandPanelValue(snapshot = null) {
        return getCommandPanelValue(this, snapshot);
      },

      buildBlockingPanelFacts(snapshot = null) {
        return buildBlockingPanelFacts(this, snapshot);
      },
    });
    return true;
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
    install,
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
