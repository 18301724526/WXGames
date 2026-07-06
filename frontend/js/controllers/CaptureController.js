// CaptureController — ②b capture-decision controller (斩杀/招降/放生), parallel to EventController.
// Holds the active decision id, and on a choice calls the server `resolveCapture` action, applies the
// returned state, and surfaces the localized outcome as floating text. No rendering here — that's
// CaptureCanvasRenderer; this is the interaction/business layer.
(function (global) {
  const CapturePresenter = (() => {
    if (global.CapturePresenter) return global.CapturePresenter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../state/presenters/CapturePresenter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CaptureController {
    constructor(options = {}) {
      this.api = options.api;
      this.getState = options.getState;
      this.onStateApplied = options.onStateApplied || (() => {});
      this.onTutorialUpdated = options.onTutorialUpdated || (() => {});
      this.onFloatingText = options.onFloatingText || (() => {});
      this.onLog = options.onLog || (() => {});
      this.activeDecisionId = null;
    }

    // Open a specific decision, or auto-open the first pending one (called after a garrison victory).
    open(decisionId = null) {
      const state = this.getState ? this.getState() : {};
      const list = Array.isArray(state.captureDecisions) ? state.captureDecisions : [];
      const decision = decisionId
        ? list.find((d) => d && d.id === decisionId && d.status === 'pending')
        : list.find((d) => d && d.status === 'pending');
      if (!decision) return null;
      this.activeDecisionId = decision.id;
      return decision;
    }

    close() {
      this.activeDecisionId = null;
    }

    isOpen() {
      return Boolean(this.activeDecisionId);
    }

    async resolve(decisionId, choice) {
      const id = decisionId || this.activeDecisionId;
      if (!id || !choice) return false;
      const state = this.getState ? this.getState() : {};
      const decision = (state.captureDecisions || []).find((d) => d && d.id === id);
      const name = decision && decision.captive ? decision.captive.name : '';
      if (!this.api || !this.api.resolveCapture) return false;
      try {
        const result = await this.api.resolveCapture(id, choice);
        this.onStateApplied(result);
        if (result && result.tutorial) this.onTutorialUpdated(result.tutorial);
        this.close();
        const outcomeKind = result && result.outcome ? result.outcome.kind : null;
        const text = CapturePresenter ? CapturePresenter.formatOutcome(outcomeKind, name) : '';
        if (text) this.onFloatingText(text);
        return result;
      } catch (error) {
        this.onLog(`❌ ${(error && error.payload && error.payload.message) || (error && error.message) || 'capture failed'}`);
        return false;
      }
    }
  }

  global.CaptureController = CaptureController;
  if (typeof module !== 'undefined' && module.exports) module.exports = CaptureController;
})(typeof window !== 'undefined' ? window : globalThis);
