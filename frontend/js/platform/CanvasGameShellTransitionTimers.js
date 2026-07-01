(function (global) {
  // Page/building transition animation timers, extracted verbatim from
  // CanvasGameShellRenderingRuntime. Owns the setInterval-driven transition loop
  // and the two command entry points (startPageTransition, scrollBuildings) that
  // seed a transition and start the timer. Pure instance-field state
  // (pageTransition/buildingTransition/transitionTimer); the only module-level
  // dependency is the stateless getUiStateOwner helper, sourced from the shared
  // CanvasGameShellHostAccess module (single source across the shell mixins).
  var CanvasGameShellHostAccess = global.CanvasGameShellHostAccess;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellHostAccess) {
    CanvasGameShellHostAccess = require('./CanvasGameShellHostAccess');
  }
  var getUiStateOwner = CanvasGameShellHostAccess.getUiStateOwner;

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
      startTransitionTimer() {
        if (this.transitionTimer || !this.runtime?.setInterval) return false;
        this.transitionTimer = this.runtime.setInterval(() => {
          const now = this.now();
          const duration = this.getTransitionDurationMs();
          const pageDone =
            !this.pageTransition ||
            now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
          const buildingDone =
            !this.buildingTransition ||
            now - this.buildingTransition.startedAt >=
              (this.buildingTransition.durationMs || duration);
          if (pageDone) this.pageTransition = null;
          if (buildingDone) {
            this.buildingTransition = null;
            if (this.lastGame && typeof this.lastGame === 'object')
              this.lastGame.buildingTransition = null;
          }
          if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
          this.renderAnimationFrame();
        }, this.getAnimationFrameMs());
        return true;
      },

      stopTransitionTimer() {
        if (!this.transitionTimer) return;
        this.runtime?.clearInterval?.(this.transitionTimer);
        this.transitionTimer = null;
      },

      startPageTransition(fromTab, toTab, options = {}) {
        if (!fromTab || !toTab || fromTab === toTab) {
          this.pageTransition = null;
          return false;
        }
        const tabs = this.getTabOrder();
        const fromIndex = tabs.indexOf(fromTab);
        const toIndex = tabs.indexOf(toTab);
        this.pageTransition = {
          fromTab,
          toTab,
          direction: toIndex >= 0 && fromIndex >= 0 && toIndex < fromIndex ? -1 : 1,
          startedAt: this.now(),
          durationMs: this.getTransitionDurationMs(),
          fromBuildingOffset: options.fromBuildingOffset ?? getUiStateOwner(this).buildingOffset,
        };
        this.startTransitionTimer();
        this.renderActive();
        return true;
      },

      scrollBuildings(action = {}) {
        const owner = getUiStateOwner(this);
        const fromOffset = Math.max(0, Number(owner.buildingOffset) || 0);
        const delta = Number(action.delta) || 0;
        const toOffset = Math.max(0, fromOffset + delta);
        owner.buildingOffset = toOffset;
        if (toOffset !== fromOffset) {
          this.buildingTransition = {
            fromOffset,
            toOffset,
            direction: toOffset < fromOffset ? -1 : 1,
            startedAt: this.now(),
            durationMs: this.getTransitionDurationMs(),
          };
          this.startTransitionTimer();
        }
        if (owner !== this) owner.buildingTransition = this.buildingTransition;
        return true;
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellTransitionTimers = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
