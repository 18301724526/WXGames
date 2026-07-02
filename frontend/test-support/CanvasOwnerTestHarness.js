const CanvasModeOwnershipRuntime = require('../js/platform/CanvasModeOwnershipRuntime');
const CanvasModalSnapshotAdapter = require('../js/platform/CanvasModalSnapshotAdapter');

class CanvasModalOwnerTestHost {
  getModeSnapshot() {
    return CanvasModeOwnershipRuntime.getModeSnapshot(this);
  }

  refreshModeSnapshot() {
    return CanvasModeOwnershipRuntime.refreshModeSnapshot(this);
  }

  deriveModeFacts() {
    return CanvasModeOwnershipRuntime.deriveModeFacts(this);
  }

  isModeBlockingOverlayOpen() {
    const snapshot = this.getModeSnapshot();
    return snapshot
      ? CanvasModeOwnershipRuntime.isBlockingOverlayOpen?.(snapshot)
      : this.deriveModeFacts().blockingOverlayActive;
  }

  isModeEntityBattleActive() {
    const snapshot = this.getModeSnapshot();
    return snapshot
      ? CanvasModeOwnershipRuntime.isEntityBattleActive?.(snapshot)
      : this.deriveModeFacts().entityBattleActive;
  }

  canRouteModeWorldMap() {
    const snapshot = this.getModeSnapshot();
    if (snapshot) return CanvasModeOwnershipRuntime.canRouteWorldMap?.(snapshot);
    const facts = this.deriveModeFacts();
    return facts.baseModeKey === 'worldMap' && !facts.blockingOverlayActive;
  }

  canRouteModeTechTree() {
    const snapshot = this.getModeSnapshot();
    if (snapshot) return CanvasModeOwnershipRuntime.canRouteTechTree?.(snapshot);
    const facts = this.deriveModeFacts();
    return facts.techTreeActive && !facts.techTreeBlockingOverlayActive;
  }

  resolveInputIntent(physicalIntent) {
    return CanvasModeOwnershipRuntime.resolveInputIntent(this, physicalIntent);
  }

  buildRendererSnapshot(options = {}) {
    return CanvasModeOwnershipRuntime.buildRendererSnapshot(this, options);
  }

  getRendererSnapshot() {
    return CanvasModeOwnershipRuntime.getRendererSnapshot(this);
  }

  openModal(subtype, payload, callbacks) {
    return CanvasModeOwnershipRuntime.openModal(this, subtype, payload, callbacks);
  }

  updateModalPayload(subtype, patch) {
    return CanvasModeOwnershipRuntime.updateModalPayload(this, subtype, patch);
  }

  closeModal(subtype) {
    return CanvasModeOwnershipRuntime.closeModal(this, subtype);
  }

  getModalPayload(subtype) {
    return CanvasModeOwnershipRuntime.getModalPayload(this, subtype);
  }

  isModalOpen(subtype) {
    return CanvasModeOwnershipRuntime.isModalOpen(this, subtype);
  }

  getModalOwnerHost() {
    return CanvasModeOwnershipRuntime.getModalOwnerHost(this);
  }

  resolveModalCallback(subtype, action, ...args) {
    return CanvasModeOwnershipRuntime.resolveModalCallback(this, subtype, action, ...args);
  }

  closeNamingSnapshot() {
    return CanvasModalSnapshotAdapter.closeNamingSnapshot(this);
  }

  closeConfirmDialogSnapshot() {
    return CanvasModalSnapshotAdapter.closeConfirmDialogSnapshot(this);
  }

  getConfirmDialogSnapshot(snapshot = null) {
    return CanvasModalSnapshotAdapter.getConfirmDialogSnapshot(this, snapshot);
  }

  getNamingSnapshot(snapshot = null) {
    return CanvasModalSnapshotAdapter.getNamingSnapshot(this, snapshot);
  }

  isNamingSnapshotOpen(snapshot = null) {
    return CanvasModalSnapshotAdapter.isNamingSnapshotOpen(this, snapshot);
  }

  isConfirmDialogSnapshotOpen(snapshot = null) {
    return CanvasModalSnapshotAdapter.isConfirmDialogSnapshotOpen(this, snapshot);
  }

  getNamingInputValue(snapshot = null) {
    return CanvasModalSnapshotAdapter.getNamingInputValue(this, snapshot);
  }

  openNamingSnapshot(payload = {}) {
    return CanvasModalSnapshotAdapter.openNamingSnapshot(this, payload);
  }

  updateNamingSnapshot(patch = {}) {
    return CanvasModalSnapshotAdapter.updateNamingSnapshot(this, patch);
  }

  openConfirmDialogSnapshot(payload = {}, callbacks = null) {
    return CanvasModalSnapshotAdapter.openConfirmDialogSnapshot(this, payload, callbacks);
  }

  updateConfirmDialogSnapshot(patch = {}) {
    return CanvasModalSnapshotAdapter.updateConfirmDialogSnapshot(this, patch);
  }

  resolveConfirmDialogSnapshotCallback(type, ...args) {
    return CanvasModalSnapshotAdapter.resolveConfirmDialogSnapshotCallback(this, type, ...args);
  }

  openRewardRevealSnapshot(payload = {}) {
    return CanvasModalSnapshotAdapter.openRewardRevealSnapshot(this, payload);
  }

  closeRewardRevealSnapshot() {
    return CanvasModalSnapshotAdapter.closeRewardRevealSnapshot(this);
  }

  getRewardRevealSnapshot(snapshot = null) {
    return CanvasModalSnapshotAdapter.getRewardRevealSnapshot(this, snapshot);
  }

  isRewardRevealSnapshotOpen(snapshot = null) {
    return CanvasModalSnapshotAdapter.isRewardRevealSnapshotOpen(this, snapshot);
  }

  openEventSnapshot(eventId) {
    return CanvasModalSnapshotAdapter.openEventSnapshot(this, eventId);
  }

  closeEventSnapshot() {
    return CanvasModalSnapshotAdapter.closeEventSnapshot(this);
  }

  getEventSnapshot(snapshot = null) {
    return CanvasModalSnapshotAdapter.getEventSnapshot(this, snapshot);
  }

  isEventSnapshotOpen(snapshot = null) {
    return CanvasModalSnapshotAdapter.isEventSnapshotOpen(this, snapshot);
  }

  openTargetPickerSnapshot(payload = {}) {
    return CanvasModalSnapshotAdapter.openTargetPickerSnapshot(this, payload);
  }

  closeTargetPickerSnapshot() {
    return CanvasModalSnapshotAdapter.closeTargetPickerSnapshot(this);
  }

  getTargetPickerSnapshot(snapshot = null) {
    return CanvasModalSnapshotAdapter.getTargetPickerSnapshot(this, snapshot);
  }

  isTargetPickerSnapshotOpen(snapshot = null) {
    return CanvasModalSnapshotAdapter.isTargetPickerSnapshotOpen(this, snapshot);
  }

  openBlockingPanelSnapshot(panelKey, value = true) {
    return CanvasModalSnapshotAdapter.openBlockingPanelSnapshot(this, panelKey, value);
  }

  closeBlockingPanelSnapshot(panelKey) {
    return CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(this, panelKey);
  }

  closeBlockingPanelsSnapshot(except = []) {
    return CanvasModalSnapshotAdapter.closeBlockingPanelsSnapshot(this, except);
  }

  isBlockingPanelSnapshotOpen(panelKey, snapshot = null) {
    return CanvasModalSnapshotAdapter.isBlockingPanelSnapshotOpen(this, panelKey, snapshot);
  }

  getCommandPanelValue(snapshot = null) {
    return CanvasModalSnapshotAdapter.getCommandPanelValue(this, snapshot);
  }

  buildBlockingPanelFacts(snapshot = null) {
    return CanvasModalSnapshotAdapter.buildBlockingPanelFacts(this, snapshot);
  }
}

function makeModalOwnerHost(fields = {}) {
  return Object.assign(new CanvasModalOwnerTestHost(), fields);
}

module.exports = {
  CanvasModalOwnerTestHost,
  makeModalOwnerHost,
};
