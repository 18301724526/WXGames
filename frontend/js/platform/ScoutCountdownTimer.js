// ScoutCountdownTimer -- SHAPE-B (stateful plain class) owner of the 1s scout/conquest
// countdown interval, extracted from CanvasGameApp (god-file re-decomposition slice 7).
//
// The class owns the interval handle; the tick reaches the host only through explicit
// facilities: getState(), canvasShell drag guards, renderCanvasSurface(),
// renderTerritory(), and the host scheduler for arming/clearing. Composed lazily by
// CanvasGameApp.getScoutCountdownTimer(); startScoutCountdownTimer()/stopHeartbeat()
// keep their public names as 1-line delegators.
(function (global) {
  class ScoutCountdownTimer {
    constructor({ host } = {}) {
      this.host = host || null;
      this.timer = null;
    }

    isActive() {
      return Boolean(this.timer);
    }

    start() {
      if (this.timer) return;
      this.timer = this.host.scheduler?.setInterval?.(() => this.tick(), 1000);
    }

    tick() {
      const host = this.host;
      const state = host.getState() || {};
      if ((state.currentEra || 0) < 5) return;
      if (
        host.canvasShell?.isWorldMapDragging?.() ||
        host.canvasShell?.hasPendingWorldMapCompositeCommit?.()
      ) {
        return;
      }
      if (state.currentTab === 'military') host.renderCanvasSurface(state.currentTab);
      if (state.currentTab === 'territory') {
        const territories = state.territoryState?.territories || [];
        const hasConquestMission = territories.some((site) => site.mission?.status === 'active');
        if (hasConquestMission) host.renderTerritory();
      }
    }

    stop() {
      if (!this.timer) return;
      this.host.scheduler?.clearInterval?.(this.timer);
      this.timer = null;
    }
  }

  global.ScoutCountdownTimer = ScoutCountdownTimer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoutCountdownTimer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
