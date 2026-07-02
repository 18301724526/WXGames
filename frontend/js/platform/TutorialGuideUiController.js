// TutorialGuideUiController -- SHAPE-B (stateful plain class) owner of the tutorial
// highlight blob and its show/hide/target-refresh lifecycle, extracted from
// CanvasGameShell (god-file re-decomposition slice 10).
//
// Single-owner rule: exactly ONE controller instance holds the highlight, and it
// lives on the state host (StateWriter.getStateHost). CanvasGameApp exposes a
// prototype accessor named after the legacy `tutorialHighlight` field (inherited by
// CanvasGameShell), so every legacy read/write site -- the shell's input gating and
// render paths, the app's advisor flows, CanvasModeOwnershipRuntime's
// tutorialActive fact -- observes the same store. This retires the app<->shell
// highlight mirror (the app used to copy the shell's blob back after hiding, and
// mode facts derived on the app host could miss a shell-set highlight entirely).
//
// The RENDER surface (the shell whose renderers/anchors the highlight lives on) is
// passed per call by the delegators -- the shell passes itself, exactly like the old
// `this`-bound bodies -- with host.canvasShell/host as the fallback. show/hide/refresh
// reach it only through explicit facilities (now, startFloatTimer, renderActive,
// renderGuideHighlightFrame, world-map anchor lookups). The per-frame
// renderGuideHighlightFrame orchestration itself stays on CanvasGameShell -- it
// re-points tab/military view state, which is mode-owned territory.
(function (global) {
  function resolveTutorialRect(target) {
    if (!target) return null;
    const rect =
      typeof target.getRect === 'function'
        ? target.getRect()
        : typeof target.getBoundingClientRect === 'function'
          ? target.getBoundingClientRect()
          : target;
    const x = Number(rect.x ?? rect.left);
    const y = Number(rect.y ?? rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    return {
      left: x,
      top: y,
      width,
      height,
      right: Number(rect.right) || x + width,
      bottom: Number(rect.bottom) || y + height,
    };
  }

  class TutorialGuideUiController {
    constructor({ host } = {}) {
      this.host = host || null;
      this.highlight = null;
    }

    getSurface() {
      const host = this.host;
      return host && host.canvasShell && typeof host.canvasShell === 'object'
        ? host.canvasShell
        : host;
    }

    refreshTarget(surface = this.getSurface(), highlight = this.highlight) {
      const host = this.host;
      const locator = highlight?.locator || null;
      if (!locator || locator.type !== 'worldSite' || !locator.siteId) return highlight || null;
      const anchorSource =
        [surface.worldMapRenderer, surface.renderer, surface.worldActorLayerRenderer].find(
          (source) => typeof source?.getWorldSiteCanvasAnchor === 'function',
        ) || null;
      if (!anchorSource) return highlight || null;
      const anchor = anchorSource.getWorldSiteCanvasAnchor(locator.siteId, host.state || {}, {
        worldMapRuntimeContext:
          surface.worldMapRuntime?.getLastTileMapContext?.() ||
          surface.worldMapRuntime?.lastTileMapContext ||
          surface.getWorldMapRenderState?.()?.lastWorldTileMapContext ||
          surface.worldMapRenderer?.lastWorldTileMapContext ||
          surface.renderer?.lastWorldTileMapContext ||
          null,
        territoryUiState: surface.territoryUiState || host.territoryUiState || {},
      });
      if (!anchor?.hitRect) return null;
      const rect = resolveTutorialRect({
        ...anchor.hitRect,
        action: {
          type: 'openWorldSite',
          siteId: anchor.site?.id || anchor.siteId || locator.siteId,
          tileId: anchor.tile?.id || anchor.tileId || '',
          inputSurface: 'worldMap',
        },
      });
      if (!rect) return null;
      const sameRect =
        highlight?.rect &&
        rect.left === highlight.rect.left &&
        rect.top === highlight.rect.top &&
        rect.width === highlight.rect.width &&
        rect.height === highlight.rect.height;
      return {
        ...highlight,
        rect,
        targetAction: {
          ...(highlight?.targetAction || {}),
          type: 'openWorldSite',
          siteId: anchor.site?.id || anchor.siteId || locator.siteId,
          tileId: anchor.tile?.id || anchor.tileId || '',
          inputSurface: 'worldMap',
        },
        transition: sameRect ? highlight.transition : null,
      };
    }

    show(surface = this.getSurface(), target, message, options = {}) {
      const rect = resolveTutorialRect(target);
      if (!rect) {
        if (this.highlight) return true;
        return false;
      }
      const now = surface.now();
      const previousRect = this.highlight?.rect || rect;
      this.highlight = {
        rect,
        message: String(message ?? ''),
        allowedAction: options.allowedAction || null,
        targetAction: options.targetAction || target?.action || null,
        locator: options.locator || null,
        renderActiveTab: options.renderActiveTab || null,
        renderOptions: options.renderOptions || null,
        transition: {
          fromRect: previousRect,
          toRect: rect,
          startedAt: now,
          durationMs: 260,
        },
        pulseStartedAt: this.highlight?.pulseStartedAt || now,
        source: options.source || 'guide',
      };
      surface.startFloatTimer();
      surface.renderGuideHighlightFrame(this.highlight);
      return true;
    }

    hide(surface = this.getSurface()) {
      const hadHighlight = Boolean(this.highlight);
      this.highlight = null;
      if (hadHighlight) surface.renderActive();
      return hadHighlight;
    }
  }

  TutorialGuideUiController.resolveTutorialRect = resolveTutorialRect;

  global.TutorialGuideUiController = TutorialGuideUiController;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TutorialGuideUiController;
  }
})(typeof window !== 'undefined' ? window : globalThis);
