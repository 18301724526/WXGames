(function (global) {
  const CanvasPanelRegistry = (() => {
    if (global.CanvasPanelRegistry) return global.CanvasPanelRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./panels/CanvasPanelRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasPanelSurfaceManager {
    constructor(options = {}) {
      this.host = options.host || null;
      this.registry = options.registry || CanvasPanelRegistry || null;
    }

    getPanelEntry(panelKey = '') {
      return this.registry?.get?.(panelKey) || null;
    }

    getPanel(panelKey = '') {
      return this.getPanelEntry(panelKey)?.module || this.getPanelEntry(panelKey) || null;
    }

    getSurfaceHost() {
      const host = this.host || null;
      return host?.canvasShell || host?.lastGame?.canvasShell || host;
    }

    getRenderer() {
      const surfaceHost = this.getSurfaceHost();
      return surfaceHost?.renderer || this.host?.renderer || null;
    }

    getState(options = {}) {
      if (options.state) return options.state;
      const contextState = options.context?.getState?.();
      if (contextState) return contextState;
      const host = this.host || {};
      if (typeof host.getCanvasActionState === 'function') return host.getCanvasActionState();
      if (host.lastGame?.state) return host.lastGame.state;
      return host.state || {};
    }

    getPanelHost(options = {}) {
      return options.context?.host || this.host;
    }

    isPanelOpen(panelKey = '', options = {}) {
      const panel = this.getPanel(panelKey);
      if (typeof panel?.isOpen !== 'function') return false;
      return panel.isOpen(this.getPanelHost(options), options) !== false;
    }

    openPanel(panelKey = '', options = {}) {
      const panel = this.getPanel(panelKey);
      if (!panel?.open) return false;
      return panel.open(this.getPanelHost(options), options) !== false;
    }

    closePanel(panelKey = '', options = {}) {
      const panel = this.getPanel(panelKey);
      if (!panel?.close) return false;
      return panel.close(this.getPanelHost(options), options) !== false;
    }

    runPanelAction(panelKey = '', actionName = '', action = {}, options = {}) {
      const panel = this.getPanel(panelKey);
      const handler = panel?.actions?.[actionName] || panel?.[actionName];
      if (typeof handler !== 'function') return false;
      return handler.call(panel, this.getPanelHost(options), action, options) !== false;
    }

    getOpenEntries(options = {}) {
      const keys = typeof this.registry?.keys === 'function' ? this.registry.keys() : [];
      return keys
        .map((key) => this.getPanelEntry(key))
        .filter((entry) => entry?.module?.isOpen?.(this.getPanelHost(options), options) === true)
        .sort((left, right) => {
          const leftBand = left.band || '';
          const rightBand = right.band || '';
          if (leftBand !== rightBand) return leftBand.localeCompare(rightBand);
          return (Number(left.renderPriority) || 0) - (Number(right.renderPriority) || 0);
        });
    }

    ensurePanelOverlayCanvas() {
      const surfaceHost = this.getSurfaceHost();
      if (typeof surfaceHost?.ensureCanvasLayer === 'function') {
        return surfaceHost.ensureCanvasLayer('panelOverlay');
      }
      const runtime = surfaceHost?.runtime || this.host?.runtime || null;
      if (typeof runtime?.ensureLayerCanvas === 'function') {
        return runtime.ensureLayerCanvas('panelOverlay', { zIndex: 1001, pointerEvents: 'none' });
      }
      return null;
    }

    clearPanelOverlayCanvas(canvas = null) {
      const surfaceHost = this.getSurfaceHost();
      const targetCanvas = canvas || surfaceHost?.getCanvasLayerCanvas?.('panelOverlay') || surfaceHost?.runtime?.getLayerCanvas?.('panelOverlay') || null;
      const ctx = targetCanvas?.getContext?.('2d') || null;
      if (ctx?.clearRect) ctx.clearRect(0, 0, targetCanvas.width || 0, targetCanvas.height || 0);
      surfaceHost?.setCanvasLayerVisible?.('panelOverlay', false);
      surfaceHost?.runtime?.setLayerVisible?.('panelOverlay', false);
      return true;
    }

    withOverlayRenderer(renderer, callback) {
      const canvas = this.ensurePanelOverlayCanvas();
      const ctx = canvas?.getContext?.('2d') || null;
      if (!renderer || !ctx) return callback(renderer);
      const previous = {
        canvas: renderer.canvas,
        ctx: renderer.ctx,
        width: renderer.width,
        height: renderer.height,
      };
      renderer.canvas = canvas;
      renderer.ctx = ctx;
      renderer.width = previous.width || canvas.width || renderer.width;
      renderer.height = previous.height || canvas.height || renderer.height;
      ctx.clearRect?.(0, 0, canvas.width || renderer.width || 0, canvas.height || renderer.height || 0);
      try {
        return callback(renderer);
      } finally {
        renderer.canvas = previous.canvas;
        renderer.ctx = previous.ctx;
        renderer.width = previous.width;
        renderer.height = previous.height;
      }
    }

    addOutsideClickTarget(renderer, entry = {}) {
      if (!renderer?.addHitTarget || !entry?.key) return false;
      const passThrough = entry.blocksBaseHitTargets === false && entry.passesOutsideClickToBase === true;
      renderer.addHitTarget(
        { x: 0, y: 0, width: renderer.width || 0, height: renderer.height || 0 },
        {
          type: 'panelOutsideClick',
          panelKey: entry.key,
          background: passThrough,
          blocksBaseHitTargets: entry.blocksBaseHitTargets !== false,
        },
      );
      return true;
    }

    projectModalLayer(options = {}) {
      const renderer = this.getRenderer();
      if (!renderer) return false;
      const entries = this.getOpenEntries(options);
      renderer.clearHitTargetPool?.('modal');
      if (!entries.length) return this.clearPanelOverlayCanvas();
      const state = this.getState(options);
      const renderWork = (targetRenderer) => {
        const renderEntries = () => {
          entries.forEach((entry) => {
            const panel = entry.module;
            this.addOutsideClickTarget(targetRenderer, entry);
            try {
              panel?.render?.(targetRenderer, state, {
                ...options,
                panelKey: entry.key,
                mode: 'panelOverlay',
                famousPersonsPage: options.context?.getUiStateOwner?.()?.famousPersonsPage
                  ?? this.host?.famousPersonsPage,
                selectedFamousPersonId: options.context?.getUiStateOwner?.()?.selectedFamousPersonId
                  ?? this.host?.selectedFamousPersonId,
              });
            } catch (error) {
              options.context?.log?.(error);
            }
          });
        };
        if (typeof targetRenderer?.withHitTargetPool === 'function') {
          return targetRenderer.withHitTargetPool('modal', renderEntries);
        }
        return renderEntries();
      };
      const result = this.withOverlayRenderer(renderer, renderWork);
      const surfaceHost = this.getSurfaceHost();
      surfaceHost?.setCanvasLayerVisible?.('panelOverlay', true);
      surfaceHost?.runtime?.setLayerVisible?.('panelOverlay', true);
      return result !== false;
    }

  }

  global.CanvasPanelSurfaceManager = CanvasPanelSurfaceManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelSurfaceManager;
})(typeof window !== 'undefined' ? window : globalThis);
