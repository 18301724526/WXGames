// CapturePresenter — view-model builder for the ②b on-canvas capture-decision panel (斩杀/招降/放生).
// Parallel to EventPresenter: a pure static builder that turns a pending captureDecision (from
// gameState.captureDecisions, surfaced via the state projection) into the shape CaptureCanvasRenderer
// draws. i18n via LocaleText; no baked strings. No IO, no state mutation — fully unit-testable.
(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CapturePresenter {
    static t(key, params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static toPercent(chance) {
      const n = Number(chance);
      return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(1, n)) * 100) : 0;
    }

    // Find the first pending capture decision in a state (the one to surface), or null.
    static firstPending(state = {}) {
      const list = Array.isArray(state.captureDecisions) ? state.captureDecisions : [];
      return list.find((d) => d && d.status === 'pending') || null;
    }

    // Build the modal view state for a specific decision (by id) out of the state, or a hidden view.
    static buildCaptureModalViewState(state = {}, decisionId = null) {
      const list = Array.isArray(state.captureDecisions) ? state.captureDecisions : [];
      const decision = decisionId
        ? list.find((d) => d && d.id === decisionId)
        : this.firstPending(state);
      if (!decision || decision.status !== 'pending') return { showModal: false };
      const captive = decision.captive && typeof decision.captive === 'object' ? decision.captive : {};
      const name = captive.name || decision.territoryName || '';
      return {
        showModal: true,
        id: decision.id,
        title: this.t('capture.title', {}),
        subtitle: this.t('capture.subtitle', { name }),
        recruitChanceText: this.t('capture.recruitChance', { percent: this.toPercent(decision.recruitChance) }),
        hint: this.t('capture.hint', {}),
        captiveName: name,
        buttons: [
          { choice: 'execute', label: this.t('capture.button.execute', {}), tone: 'danger' },
          { choice: 'recruit', label: this.t('capture.button.recruit', {}), tone: 'primary' },
          { choice: 'release', label: this.t('capture.button.release', {}), tone: 'neutral' },
        ],
      };
    }

    // Localized one-line result for a resolved outcome (floating text after the choice).
    static formatOutcome(outcomeKind, name = '') {
      const key = {
        executed: 'capture.result.executed',
        recruited: 'capture.result.recruited',
        recruitRefused: 'capture.result.recruitRefused',
        released: 'capture.result.released',
      }[outcomeKind];
      return key ? this.t(key, { name }) : '';
    }
  }

  global.CapturePresenter = CapturePresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = CapturePresenter;
})(typeof window !== 'undefined' ? window : globalThis);
