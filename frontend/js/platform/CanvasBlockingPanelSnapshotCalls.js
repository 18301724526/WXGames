(function (global) {
  // Single source for the blocking-panel snapshot DELEGATING WRAPPERS that were
  // copy-pasted byte-identically into 13 platform/tutorial files. The real owner
  // is CanvasModalSnapshotAdapter (it holds the modal-payload logic + installs the
  // host methods); these wrappers only route a call to host.<method> when the host
  // implements it, else to the module adapter. Resolve the adapter LAZILY at call
  // time: this module loads before the adapter in index.html, so a load-time
  // resolution would capture null. The blocking guard
  // scripts/check-frontend-blocking-panel-snapshot-calls.js forbids re-defining
  // these wrappers anywhere else under frontend/.
  function adapter() {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasModalSnapshotAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  function openBlockingPanelSnapshot(host, panelKey, value = true) {
    if (typeof host?.openBlockingPanelSnapshot === 'function') {
      return host.openBlockingPanelSnapshot(panelKey, value);
    }
    return adapter()?.openBlockingPanelSnapshot?.(host, panelKey, value) ?? null;
  }

  function closeBlockingPanelSnapshot(host, panelKey) {
    if (typeof host?.closeBlockingPanelSnapshot === 'function') {
      return host.closeBlockingPanelSnapshot(panelKey);
    }
    return adapter()?.closeBlockingPanelSnapshot?.(host, panelKey) ?? null;
  }

  function isBlockingPanelSnapshotOpen(host, panelKey) {
    if (typeof host?.isBlockingPanelSnapshotOpen === 'function') {
      return host.isBlockingPanelSnapshotOpen(panelKey);
    }
    return Boolean(adapter()?.isBlockingPanelSnapshotOpen?.(host, panelKey));
  }

  const api = {
    openBlockingPanelSnapshot,
    closeBlockingPanelSnapshot,
    isBlockingPanelSnapshotOpen,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.CanvasBlockingPanelSnapshotCalls = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
