(function (global) {
  const NAMING_MODAL_KEY = 'modal:naming';

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

  function getNamingSnapshotFromRendererSnapshot(snapshot = null) {
    return getModalPayloadSnapshot(null, NAMING_MODAL_KEY, snapshot);
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

  function install(TargetClass) {
    if (!TargetClass?.prototype) return false;
    Object.assign(TargetClass.prototype, {
      closeNamingSnapshot() {
        return closeNamingSnapshot(this);
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

      getNamingInputValue(snapshot = null) {
        return getNamingInputValue(this, snapshot);
      },

      openNamingSnapshot(payload = {}) {
        return openNamingSnapshot(this, payload);
      },

      updateNamingSnapshot(patch = {}) {
        return updateNamingSnapshot(this, patch);
      },
    });
    return true;
  }

  const api = {
    NAMING_MODAL_KEY,
    collectRelatedHosts,
    closeModalPayload,
    closeNamingSnapshot,
    getOpenModalHost,
    getModalPayloadSnapshot,
    getNamingInputValue,
    getNamingPrompt,
    getNamingSnapshot,
    getNamingSnapshotFromRendererSnapshot,
    install,
    isNamingSnapshotOpen,
    openModalPayload,
    openNamingSnapshot,
    readModalEntry,
    updateModalPayload,
    updateNamingSnapshot,
  };

  global.CanvasModalSnapshotAdapter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
