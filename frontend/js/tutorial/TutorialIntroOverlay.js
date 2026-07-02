(function (global) {

  const TutorialFlowShared = (() => {
    if (global.TutorialFlowShared) return global.TutorialFlowShared;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../shared/tutorialFlowConfig');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }
  const STORAGE_KEY = 'tutorialIntroAdvisorSeen.v2';
  const MARCH_DURATION_MS = 4800;
  const ENTER_DURATION_MS = 1560;
  const MARCH_FRAME_INTERVAL_MS = 33;
  const IDLE_FRAME_INTERVAL_MS = 33;
  const STEPS = {
    march: 'march',
    city: 'city',
    enter: 'enter',
    entering: 'entering',
    done: 'done',
  };
  const MAX_INTRO_TUTORIAL_STEP = TutorialFlowShared?.TUTORIAL_STEPS?.tutorialStarted || 'tutorialStarted';

  class TutorialIntroOverlay {
    constructor(options = {}) {
      this.runtime = options.runtime || global;
      this.storage = options.storage || null;
      this.game = options.game || null;
      this.running = false;
      this.step = STEPS.done;
      this.startedAt = 0;
      this.marchEndedAt = 0;
      this.enterStartedAt = 0;
      this.enterEndedAt = 0;
      this.pendingEnterCityAction = null;
      this.timer = null;
      this.frameTimer = null;
      this.completedThisSession = false;
    }

    static get storageKey() {
      return STORAGE_KEY;
    }

    getQueryMode() {
      const search = String(this.runtime?.location?.search || '');
      if (/[?&]tutorialIntro=reset(?:&|$)/.test(search)) {
        this.storage?.removeItem?.(STORAGE_KEY);
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
    }

    resetSeen() {
      this.storage?.removeItem?.(STORAGE_KEY);
      this.completedThisSession = false;
      return true;
    }

    shouldStart(state = this.game?.state) {
      if (this.running || this.hasSeen()) return false;
      if (this.completedThisSession) return false;
      if (!state || typeof state !== 'object') return false;
      if (this.game?.authView?.loginPanelVisible || this.game?.canvasShell?.auth?.view?.loginPanelVisible) return false;
      if (!this.game?.hasServerState) return false;
      if (!this.hasCapitalSite(state)) return false;
      if (this.getQueryMode() === 'force') return true;
      if (!this.isIntroTutorialStep(state)) return false;
      const gameDay = Number(state.gameDay);
      const totalBuildings = Number(state.totalBuildings);
      return (!Number.isFinite(gameDay) || gameDay <= 1)
        && (!Number.isFinite(totalBuildings) || totalBuildings <= 0);
    }

    isIntroTutorialStep(state = this.game?.state) {
      const tutorial = state?.tutorial || this.game?.tutorial || null;
      if (!tutorial || typeof tutorial !== 'object') return true;
      if (tutorial.completed || tutorial.disabled) return false;
      const step = TutorialFlowShared?.stepName(tutorial.currentStep) || '';
      return step ? TutorialFlowShared.stepAtMost(step, MAX_INTRO_TUTORIAL_STEP) : true;
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

    getFrameIntervalMs() {
      return this.step === STEPS.march || this.step === STEPS.entering ? MARCH_FRAME_INTERVAL_MS : IDLE_FRAME_INTERVAL_MS;
    }

    startFrameTimer() {
      this.clearFrameTimer();
      const setDelay = this.runtime?.setTimeout || global.setTimeout;
      if (typeof setDelay !== 'function') return false;
      const tick = () => {
        if (!this.running) {
          this.clearFrameTimer();
          return;
        }
        this.requestRender();
        this.frameTimer = setDelay.call(this.runtime, tick, this.getFrameIntervalMs());
      };
      this.frameTimer = setDelay.call(this.runtime, tick, this.getFrameIntervalMs());
      return true;
    }

    clearFrameTimer() {
      if (this.frameTimer === null || this.frameTimer === undefined) return;
      const clearDelay = this.runtime?.clearTimeout || global.clearTimeout;
      const clearEvery = this.runtime?.clearInterval || global.clearInterval;
      if (typeof clearDelay === 'function') clearDelay.call(this.runtime, this.frameTimer);
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
        this.beginEnterCityTransition(action);
        return true;
      }
      return false;
    }

    beginEnterCityTransition(action = {}, onComplete = null) {
      if (!this.running || this.step !== STEPS.enter) return false;
      const cityId = this.getCapitalCityId();
      const actionCityId = action.cityId || action.territoryId || action.siteId || '';
      if (action?.type !== 'enterCity' || (actionCityId && actionCityId !== cityId)) return false;
      this.clearTimer();
      this.step = STEPS.entering;
      this.enterStartedAt = this.now();
      this.enterEndedAt = this.enterStartedAt + ENTER_DURATION_MS;
      this.pendingEnterCityAction = typeof onComplete === 'function' ? onComplete : null;
      this.syncGame();
      this.requestRender();
      this.startFrameTimer();
      const setDelay = this.runtime?.setTimeout || global.setTimeout;
      if (typeof setDelay === 'function') {
        this.timer = setDelay.call(this.runtime, () => this.completeEnterCityTransition(), ENTER_DURATION_MS);
      }
      return true;
    }

    completeEnterCityTransition() {
      if (!this.running || this.step !== STEPS.entering) return false;
      const action = this.pendingEnterCityAction;
      this.pendingEnterCityAction = null;
      this.finish({ markSeen: true });
      if (typeof action === 'function') {
        Promise.resolve()
          .then(() => action())
          .catch((error) => this.game?.log?.(error?.message || String(error)));
      }
      return true;
    }

    skip() {
      return this.finish({ markSeen: true });
    }

    finish(options = {}) {
      this.clearTimer();
      this.clearFrameTimer();
      this.pendingEnterCityAction = null;
      if (options.markSeen !== false) this.markSeen();
      if (options.completed !== false) this.completedThisSession = true;
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
        enterStartedAt: this.enterStartedAt,
        enterDurationMs: ENTER_DURATION_MS,
        enterEndedAt: this.enterEndedAt,
        advisorName: t('tutorial.advisorName'),
        messages: {
          city: t('tutorial.intro.city'),
          enter: t('tutorial.intro.enter'),
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
