(function (global) {
  const NAMING_MODAL_KEY = 'modal:naming';
  const CONFIRM_DIALOG_MODAL_KEY = 'modal:confirmDialog';
  const REWARD_REVEAL_MODAL_KEY = 'modal:rewardReveal';
  const EVENT_MODAL_KEY = 'modal:event';
  const TARGET_PICKER_MODAL_KEY = 'modal:targetPicker';

  function getRendererSnapshot(host, snapshot = null) {
    if (snapshot && typeof snapshot === 'object') return snapshot;
    return typeof host?.getRendererSnapshot === 'function' ? host.getRendererSnapshot() : null;
  }

  function readModalEntry(snapshot = null, subtype = '') {
    return snapshot?.modal?.[subtype] || null;
  }

  function collectRelatedHosts(host) {
    if (!host || typeof host !== 'object') return [];
    const game = host.getCanvasGameHost?.() || host.lastGame || host;
    const shell = game?.canvasShell || host.canvasShell || host.lastGame?.canvasShell || null;
    return [host, game, shell].filter(
      (target, index, targets) =>
        target && typeof target === 'object' && targets.indexOf(target) === index,
    );
  }

  function getOpenModalHost(host, subtype = '') {
    return (
      collectRelatedHosts(host).find(
        (target) => typeof target.isModalOpen === 'function' && target.isModalOpen(subtype),
      ) || null
    );
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
    const target = getOpenModalHost(host, subtype) || host;
    const result =
      typeof target?.openModal === 'function'
        ? target.openModal(subtype, payload, callbacks)
        : null;
    collectRelatedHosts(host).forEach((relatedHost) => relatedHost.buildRendererSnapshot?.());
    return result;
  }

  function updateModalPayload(host, subtype = '', patch = {}) {
    const target = getOpenModalHost(host, subtype) || host;
    const result =
      typeof target?.updateModalPayload === 'function'
        ? target.updateModalPayload(subtype, patch)
        : null;
    collectRelatedHosts(host).forEach((relatedHost) => relatedHost.buildRendererSnapshot?.());
    return result;
  }

  function closeModalPayload(host, subtype = '') {
    const target = getOpenModalHost(host, subtype) || host;
    const result = typeof target?.closeModal === 'function' ? target.closeModal(subtype) : null;
    collectRelatedHosts(host).forEach((relatedHost) => relatedHost.buildRendererSnapshot?.());
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
    const target = getOpenModalHost(host, CONFIRM_DIALOG_MODAL_KEY) || host;
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
  // sites keep a truthy guard. The world-march DOMAIN target (coords/route/
  // mission/combat) stays in territoryUiState -- only the modal flag moves here.
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

      getOpenModalHost(subtype = '') {
        return getOpenModalHost(this, subtype);
      },

      getRelatedModalHosts() {
        return collectRelatedHosts(this);
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
    });
    return true;
  }

  const api = {
    CONFIRM_DIALOG_MODAL_KEY,
    EVENT_MODAL_KEY,
    NAMING_MODAL_KEY,
    REWARD_REVEAL_MODAL_KEY,
    TARGET_PICKER_MODAL_KEY,
    collectRelatedHosts,
    closeConfirmDialogSnapshot,
    closeEventSnapshot,
    closeModalPayload,
    closeNamingSnapshot,
    closeRewardRevealSnapshot,
    closeTargetPickerSnapshot,
    getConfirmDialogSnapshot,
    getConfirmDialogSnapshotFromRendererSnapshot,
    getEventSnapshot,
    getEventSnapshotFromRendererSnapshot,
    getOpenModalHost,
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
