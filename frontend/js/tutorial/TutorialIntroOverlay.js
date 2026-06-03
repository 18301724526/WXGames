(function (global) {
  const STORAGE_KEY = 'tutorialIntroAdvisorSeen.v2';
  const LEGACY_STORAGE_KEY = 'tutorialIntroAdvisorSeen.v1';
  const MARCH_DURATION_MS = 2400;
  const STEPS = {
    march: 'march',
    city: 'city',
    enter: 'enter',
    done: 'done',
  };

  class TutorialIntroOverlay {
    constructor(options = {}) {
      this.runtime = options.runtime || global;
      this.storage = options.storage || this.runtime?.localStorage || null;
      this.game = options.game || null;
      this.running = false;
      this.step = STEPS.done;
      this.startedAt = 0;
      this.marchEndedAt = 0;
      this.timer = null;
      this.frameTimer = null;
    }

    static get storageKey() {
      return STORAGE_KEY;
    }

    static get legacyStorageKey() {
      return LEGACY_STORAGE_KEY;
    }

    getQueryMode() {
      const search = String(this.runtime?.location?.search || '');
      if (/[?&]tutorialIntro=reset(?:&|$)/.test(search)) {
        this.storage?.removeItem?.(STORAGE_KEY);
        this.storage?.removeItem?.(LEGACY_STORAGE_KEY);
        return 'reset';
      }
      if (/[?&]tutorialIntro=1(?:&|$)/.test(search)) return 'force';
      return '';
    }

    hasSeen() {
      if (this.getQueryMode() === 'force') return false;
      return this.storage?.getItem?.(STORAGE_KEY) === 'true';
    }

    markSeen() {
      if (this.getQueryMode() === 'force') return;
      this.storage?.setItem?.(STORAGE_KEY, 'true');
      this.storage?.setItem?.(LEGACY_STORAGE_KEY, 'true');
    }

    resetSeen() {
      this.storage?.removeItem?.(STORAGE_KEY);
      this.storage?.removeItem?.(LEGACY_STORAGE_KEY);
      return true;
    }

    shouldStart(state = this.game?.state) {
      if (this.running || this.hasSeen()) return false;
      if (!state || typeof state !== 'object') return false;
      if (this.game?.authView?.loginPanelVisible || this.game?.canvasShell?.auth?.view?.loginPanelVisible) return false;
      if (!this.game?.hasServerState) return false;
      if (!this.hasCapitalSite(state)) return false;
      if (this.getQueryMode() === 'force') return true;
      const gameDay = Number(state.gameDay);
      const totalBuildings = Number(state.totalBuildings);
      return (!Number.isFinite(gameDay) || gameDay <= 1)
        && (!Number.isFinite(totalBuildings) || totalBuildings <= 0);
    }

    now() {
      return this.runtime?.performance?.now?.() || this.runtime?.now?.() || Date.now();
    }

    start(state = this.game?.state) {
      if (!this.shouldStart(state)) return false;
      this.clearTimer();
      this.running = true;
      this.step = STEPS.march;
      this.startedAt = this.now();
      this.marchEndedAt = this.startedAt + MARCH_DURATION_MS;
      this.syncGame();
      this.requestRender();
      this.startFrameTimer();
      const setDelay = this.runtime?.setTimeout || global.setTimeout;
      if (typeof setDelay === 'function') {
        this.timer = setDelay.call(this.runtime, () => this.finishMarch(), MARCH_DURATION_MS);
      }
      return true;
    }

    hasCapitalSite(state = this.game?.state) {
      const cityId = this.getCapitalCityId(state);
      const territories = Array.isArray(state?.territoryState?.territories) ? state.territoryState.territories : [];
      const tiles = Array.isArray(state?.territoryState?.worldMap?.tiles) ? state.territoryState.worldMap.tiles : [];
      return territories.some((site) => site?.id === cityId)
        || tiles.some((tile) => tile?.siteId === cityId || tile?.site?.id === cityId);
    }

    startFrameTimer() {
      this.clearFrameTimer();
      const setEvery = this.runtime?.setInterval || global.setInterval;
      if (typeof setEvery !== 'function') return false;
      this.frameTimer = setEvery.call(this.runtime, () => {
        if (!this.running) {
          this.clearFrameTimer();
          return;
        }
        this.requestRender();
      }, 16);
      return true;
    }

    clearFrameTimer() {
      if (this.frameTimer === null || this.frameTimer === undefined) return;
      const clearEvery = this.runtime?.clearInterval || global.clearInterval;
      if (typeof clearEvery === 'function') clearEvery.call(this.runtime, this.frameTimer);
      this.frameTimer = null;
    }

    clearTimer() {
      if (this.timer === null || this.timer === undefined) return;
      const clearDelay = this.runtime?.clearTimeout || global.clearTimeout;
      if (typeof clearDelay === 'function') clearDelay.call(this.runtime, this.timer);
      this.timer = null;
    }

    finishMarch() {
      if (!this.running || this.step !== STEPS.march) return false;
      this.step = STEPS.city;
      this.marchEndedAt = this.now();
      this.syncGame();
      this.requestRender();
      return true;
    }

    advanceFromAction(action = {}) {
      if (!this.running || !action?.type) return false;
      const cityId = this.getCapitalCityId();
      const actionCityId = action.cityId || action.territoryId || action.siteId || action.siteId;
      if (this.step === STEPS.city && action.type === 'openWorldSite' && (!actionCityId || actionCityId === cityId)) {
        this.step = STEPS.enter;
        this.syncGame();
        this.requestRender();
        return true;
      }
      if (this.step === STEPS.enter && action.type === 'enterCity' && (!actionCityId || actionCityId === cityId)) {
        this.finish({ markSeen: true });
        return true;
      }
      return false;
    }

    skip() {
      return this.finish({ markSeen: true });
    }

    finish(options = {}) {
      this.clearTimer();
      this.clearFrameTimer();
      if (options.markSeen !== false) this.markSeen();
      this.running = false;
      this.step = STEPS.done;
      this.syncGame();
      this.requestRender();
      return true;
    }

    getCapitalCityId(state = this.game?.state || {}) {
      return state.cityState?.capitalCityId
        || state.activeCityId
        || state.cityState?.activeCityId
        || 'capital';
    }

    getViewState() {
      if (!this.running) return null;
      return {
        active: true,
        step: this.step,
        capitalCityId: this.getCapitalCityId(),
        startedAt: this.startedAt,
        marchDurationMs: MARCH_DURATION_MS,
        marchEndedAt: this.marchEndedAt,
        advisorName: '谋士',
        messages: {
          city: '前方的雾散开了。这里背山临水，土地平整，是个建立据点的好地方。点一下首都看看。',
          enter: '让队伍入城整备。只要根基扎稳，这座首都会慢慢长成我们的核心。',
        },
      };
    }

    syncGame() {
      if (this.game && typeof this.game === 'object') {
        this.game.tutorialIntro = this.getViewState();
      }
      if (this.game?.canvasShell && typeof this.game.canvasShell === 'object') {
        this.game.canvasShell.tutorialIntro = this.getViewState();
      }
      return true;
    }

    requestRender() {
      const shell = this.game?.canvasShell;
      if (shell?.renderActive) return shell.renderActive({ invalidateWorldTileView: false });
      if (this.game?.renderCanvasSurface) return this.game.renderCanvasSurface();
      if (this.game?.render) return this.game.render();
      return false;
    }
  }

  global.TutorialIntroOverlay = TutorialIntroOverlay;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialIntroOverlay;
})(typeof window !== 'undefined' ? window : globalThis);
