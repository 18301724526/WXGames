(function (global) {
  const CanvasPanelSurfaceManager = (() => {
    if (global.CanvasPanelSurfaceManager) return global.CanvasPanelSurfaceManager;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasPanelSurfaceManager');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const CanvasStageScheduler = (() => {
    if (global.CanvasStageScheduler) return global.CanvasStageScheduler;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasStageScheduler');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function getGameHost(host) {
    return host?.getCanvasGameHost?.() || host?.lastGame || host || null;
  }

  function getUiStateOwner(host) {
    const game = host?.getCanvasGameHost?.() || host?.lastGame || null;
    return game && game !== host ? game : host;
  }

  function getSurfaceHost(host) {
    return host?.canvasShell || host?.lastGame?.canvasShell || host;
  }

  function ensurePanelSurfaceManager(host) {
    const surfaceHost = getSurfaceHost(host);
    const game = getGameHost(host);
    const existing = host?.panelSurfaceManager
      || surfaceHost?.panelSurfaceManager
      || game?.panelSurfaceManager
      || null;
    if (existing) return existing;
    if (!CanvasPanelSurfaceManager) return null;
    const owner = surfaceHost || host || game;
    if (!owner || typeof owner !== 'object') return null;
    owner.panelSurfaceManager = new CanvasPanelSurfaceManager({ host: owner });
    return owner.panelSurfaceManager;
  }

  function ensureStageScheduler(host, context) {
    const surfaceHost = getSurfaceHost(host);
    const owner = surfaceHost || host || getGameHost(host);
    const existing = host?.stageScheduler
      || surfaceHost?.stageScheduler
      || null;
    if (existing) return existing;
    if (!CanvasStageScheduler || !owner || typeof owner !== 'object') return null;
    owner.stageScheduler = new CanvasStageScheduler({
      host: owner,
      panelSurfaceManager: context.getPanelSurfaceManager(),
      log: (error) => context.log(error),
    });
    return owner.stageScheduler;
  }

  function buildPanelActionContext(host) {
    const context = {
      host,
      isPanelActionContext: true,
      getGameHost() {
        return getGameHost(host);
      },
      getUiStateOwner() {
        return getUiStateOwner(host);
      },
      getState() {
        return host?.getCanvasActionState?.()
          || this.getGameHost()?.state
          || host?.state
          || {};
      },
      getPanelSurfaceManager() {
        return ensurePanelSurfaceManager(host);
      },
      getScheduler() {
        return ensureStageScheduler(host, context);
      },
      getRuntimeScheduler() {
        const game = this.getGameHost();
        return host?.runtime || game?.runtime || host?.scheduler || game?.scheduler || global;
      },
      getTutorialController() {
        const game = this.getGameHost();
        return game?.tutorialController || host?.tutorialController || null;
      },
      renderAction(action = {}) {
        if (typeof host?.renderCanvasAction === 'function') return host.renderCanvasAction(action);
        if (typeof host?.renderGuideFrame === 'function') return host.renderGuideFrame();
        if (typeof host?.renderActive === 'function') return host.renderActive();
        if (typeof host?.render === 'function') return host.render();
        const game = this.getGameHost();
        if (game && game !== host && typeof game.renderCanvasAction === 'function') return game.renderCanvasAction(action);
        return false;
      },
      showFloatingText(message = '') {
        const game = this.getGameHost();
        if (typeof host?.showFloatingText === 'function') return host.showFloatingText(message);
        if (game && game !== host && typeof game?.showFloatingText === 'function') return game.showFloatingText(message);
        return this.log(message);
      },
      t(key = '', params = {}) {
        const game = this.getGameHost();
        const translator = host?.t || game?.t || global.t || null;
        if (typeof translator === 'function') return translator.call(host?.t ? host : game || global, key, params);
        if (key === 'guide.completeCurrentStep') return 'Complete the current guide step first';
        return String(key || '');
      },
      log(errorOrMessage) {
        if (typeof host?.log === 'function') return host.log(errorOrMessage);
        const game = getGameHost(host);
        if (game && game !== host && typeof game?.log === 'function') return game.log(errorOrMessage);
        if (typeof global.console?.error === 'function' && errorOrMessage instanceof Error) {
          global.console.error(errorOrMessage);
          return undefined;
        }
        return global.console?.log?.(errorOrMessage);
      },
    };
    return context;
  }

  global.CanvasPanelActionContextAdapter = buildPanelActionContext;
  if (typeof module !== 'undefined' && module.exports) module.exports = buildPanelActionContext;
})(typeof window !== 'undefined' ? window : globalThis);

