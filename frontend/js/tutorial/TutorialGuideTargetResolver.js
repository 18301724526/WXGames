(function (global) {
  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function isVisuallyDisabled(action = {}) {
    return ClientCommandSemantics?.isVisuallyDisabled?.(action)
      ?? Boolean(action?.visualDisabled ?? action?.disabled);
  }

  const MODAL_TARGET_PANEL_BY_ACTION_TYPE = Object.freeze({
    acceptFamousPerson: 'famousPersons',
    changeFamousPersonsPage: 'famousPersons',
    clearFamousSkillTooltip: 'famousPersons',
    closeFamousPersonDetail: 'famousPersons',
    closeFamousPersons: 'famousPersons',
    dismissFamousPersonCandidate: 'famousPersons',
    openFamousPersonDetail: 'famousPersons',
    seekFamousPerson: 'famousPersons',
    showFamousSkillTooltip: 'famousPersons',
  });

  class TutorialGuideTargetResolver {
    constructor(options = {}) {
      this.host = options.host || options.controller || null;
    }

    getGame() {
      return this.host?.game || null;
    }

    getShell() {
      return this.getGame()?.canvasShell || null;
    }

    getActiveRenderTab() {
      const game = this.getGame();
      return game?.state?.currentTab || game?.activeTab || 'resources';
    }

    getCanvasTarget(type, predicate = null) {
      return this.getShell()?.getCanvasTarget?.(type, predicate) || null;
    }

    getTargetPanelKey(type, allowedAction = null) {
      return MODAL_TARGET_PANEL_BY_ACTION_TYPE[type]
        || MODAL_TARGET_PANEL_BY_ACTION_TYPE[allowedAction?.type]
        || '';
    }

    refreshTargetSurface(type, allowedAction = null) {
      const panelKey = this.getTargetPanelKey(type, allowedAction);
      if (panelKey) {
        const game = this.getGame();
        const shell = this.getShell();
        const manager = shell?.getPanelSurfaceManager?.()
          || game?.getPanelSurfaceManager?.()
          || shell?.panelSurfaceManager
          || game?.panelSurfaceManager
          || null;
        return manager?.projectModalLayer?.({
          requestedPanelKey: panelKey,
          reason: 'tutorialHighlightTarget',
          source: 'tutorialTargetResolver',
        }) !== false;
      }
      this.getGame()?.renderCanvasSurface?.(this.getActiveRenderTab());
      return true;
    }

    getState() {
      return this.getGame()?.state || {};
    }

    getWorldMapRuntimeContext() {
      const shell = this.getShell() || {};
      return shell.worldMapRuntime?.getLastTileMapContext?.()
        || shell.worldMapRuntime?.lastTileMapContext
        || shell.worldMapRenderer?.lastWorldTileMapContext
        || shell.renderer?.lastWorldTileMapContext
        || null;
    }

    getWorldSiteAnchorSource() {
      const shell = this.getShell() || {};
      return [
        shell.worldMapRenderer,
        shell.renderer,
        shell.worldActorLayerRenderer,
      ].find((source) => typeof source?.getWorldSiteCanvasAnchor === 'function') || null;
    }

    resolveWorldSiteAnchorTarget(siteId = '') {
      const anchorSource = this.getWorldSiteAnchorSource();
      const runtimeContext = this.getWorldMapRuntimeContext();
      if (!siteId || !anchorSource || !runtimeContext) return null;
      const shell = this.getShell() || {};
      const anchor = anchorSource.getWorldSiteCanvasAnchor(siteId, this.getState(), {
        worldMapRuntimeContext: runtimeContext,
        territoryUiState: shell.territoryUiState || this.getGame()?.territoryUiState || {},
      });
      if (!anchor?.hitRect) return null;
      const action = {
        type: 'openWorldSite',
        siteId: anchor.site?.id || anchor.siteId || siteId,
        tileId: anchor.tile?.id || anchor.tileId || '',
        inputSurface: 'worldMap',
      };
      return {
        ...anchor.hitRect,
        action,
        getRect: () => ({
          left: anchor.hitRect.x,
          top: anchor.hitRect.y,
          width: anchor.hitRect.width,
          height: anchor.hitRect.height,
          right: anchor.hitRect.x + anchor.hitRect.width,
          bottom: anchor.hitRect.y + anchor.hitRect.height,
        }),
        getBoundingClientRect: () => ({
          left: anchor.hitRect.x,
          top: anchor.hitRect.y,
          width: anchor.hitRect.width,
          height: anchor.hitRect.height,
          right: anchor.hitRect.x + anchor.hitRect.width,
          bottom: anchor.hitRect.y + anchor.hitRect.height,
        }),
      };
    }

    showHighlight(type, predicate, message, allowedAction, options = {}) {
      const shell = this.getShell();
      const selectable = (action) => (
        !isVisuallyDisabled(action) && (typeof predicate !== 'function' || predicate(action))
      );
      let target = this.getCanvasTarget(type, selectable);
      if (!target && this.host && !this.host.retryingHighlightAfterRender) {
        this.host.retryingHighlightAfterRender = true;
        this.refreshTargetSurface(type, allowedAction);
        target = this.getCanvasTarget(type, selectable);
        this.host.retryingHighlightAfterRender = false;
      }
      if (!target) {
        shell?.hideTutorialHighlight?.();
        return false;
      }
      return shell?.showTutorialHighlight?.(
        target,
        message,
        { ...options, allowedAction, source: options.source || 'strongTutorial' },
      ) || false;
    }

    getCanvasTargetRect(target = {}) {
      const rect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const left = Number(rect?.left ?? rect?.x);
      const top = Number(rect?.top ?? rect?.y);
      const width = Number(rect?.width);
      const height = Number(rect?.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        width,
        height,
        right: Number(rect?.right) || left + width,
        bottom: Number(rect?.bottom) || top + height,
      };
    }

    isCanvasTargetVisible(target = {}, padding = 8) {
      const rect = this.getCanvasTargetRect(target);
      if (!rect) return false;
      const shell = this.getShell() || {};
      const width = Number(shell.runtime?.width || shell.renderer?.width || shell.width || 0);
      const height = Number(shell.runtime?.height || shell.renderer?.height || shell.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return true;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return centerX >= padding
        && centerX <= width - padding
        && centerY >= padding
        && centerY <= height - padding;
    }

    showOpenWorldSiteHighlight(options = {}) {
      const siteId = options.siteId || '';
      const anchorSource = this.getWorldSiteAnchorSource();
      const anchorTarget = this.resolveWorldSiteAnchorTarget(siteId);
      if (anchorSource && !anchorTarget) {
        this.getShell()?.hideTutorialHighlight?.();
        return false;
      }
      const target = anchorTarget || this.getCanvasTarget(
        'openWorldSite',
        (action) => !isVisuallyDisabled(action) && (!siteId || action.siteId === siteId || action.territoryId === siteId),
      );
      if (!target || !this.isCanvasTargetVisible(target, options.padding)) {
        this.getShell()?.hideTutorialHighlight?.();
        return false;
      }
      return this.getShell()?.showTutorialHighlight?.(
        target,
        options.message || '',
        {
          allowedAction: options.allowedAction || { type: 'openWorldSite', siteId },
          targetAction: target.action || null,
          locator: {
            type: 'worldSite',
            siteId,
          },
          source: options.source || 'strongTutorial',
        },
      ) || false;
    }
  }

  global.TutorialGuideTargetResolver = TutorialGuideTargetResolver;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideTargetResolver;
})(typeof window !== 'undefined' ? window : globalThis);
