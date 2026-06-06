(function (global) {
  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
createRenderer(canvas) {
      if (this.renderer || !canvas) return this.renderer;
      const RendererCtor = global.H5CanvasGameRenderer;
      if (!RendererCtor) return null;
      const sharedAssetCache = new Map();
      const sharedAssetMetricsCache = new Map();
      const sharedWorldTileMaskCache = new Map();
      const sharedWorldTileMaskMetricsCache = new Map();
      const sharedWorldTileDryCompositeCache = new Map();
      const worldMapLayerPadding = this.getWorldMapLayerPadding();
      const mapCanvas = typeof this.runtime?.ensureLayerCanvas === 'function'
        ? this.runtime.ensureLayerCanvas('worldMap', { padding: worldMapLayerPadding })
        : null;
      if (mapCanvas && !this.worldMapRenderer) {
        const layerMetrics = this.runtime?.getLayerMetrics?.('worldMap') || {};
        this.worldMapRenderer = new RendererCtor({
          canvas: mapCanvas,
          presenter: this.presenter,
          pixelRatio: this.runtime?.pixelRatio,
          width: layerMetrics.width || this.runtime?.width,
          height: layerMetrics.height || this.runtime?.height,
          viewportOffsetX: Number(layerMetrics.padding) || 0,
          viewportOffsetY: Number(layerMetrics.padding) || 0,
          viewportWidth: layerMetrics.viewportWidth || this.runtime?.width,
          viewportHeight: layerMetrics.viewportHeight || this.runtime?.height,
          h5Runtime: this.runtime,
          assetCache: sharedAssetCache,
          assetMetricsCache: sharedAssetMetricsCache,
          worldTileMaskCache: sharedWorldTileMaskCache,
          worldTileMaskMetricsCache: sharedWorldTileMaskMetricsCache,
          worldTileDryCompositeCache: sharedWorldTileDryCompositeCache,
          showFpsOverlay: false,
        });
        if (typeof this.worldMapRenderer.setAssetsChangedHandler === 'function') {
          this.worldMapRenderer.setAssetsChangedHandler(() => {
            this.renderer?.invalidateWorldTileCaches?.();
            this.renderer?.invalidateWorldTileViewCache?.();
            this.requestWorldMapRenderAnimationFrame();
          });
        }
      }
      this.renderer = new RendererCtor({
        canvas,
        presenter: this.presenter,
        pixelRatio: this.runtime?.pixelRatio,
        width: this.runtime?.width,
        height: this.runtime?.height,
        h5Runtime: this.runtime,
        assetCache: sharedAssetCache,
        assetMetricsCache: sharedAssetMetricsCache,
        worldTileMaskCache: sharedWorldTileMaskCache,
        worldTileMaskMetricsCache: sharedWorldTileMaskMetricsCache,
        worldTileDryCompositeCache: sharedWorldTileDryCompositeCache,
      });
      if (typeof this.renderer.setAssetsChangedHandler === 'function') {
        this.renderer.setAssetsChangedHandler(() => {
          this.worldMapRenderer?.invalidateWorldTileCaches?.();
          this.worldMapRenderer?.invalidateWorldTileViewCache?.();
          this.requestRenderAnimationFrame();
        });
      }
      if (this.worldMapRenderer) this.worldMapRenderer.presenter = this.renderer.presenter;
      this.ensureWorldMapRuntime();
      return this.renderer;
    },

mount(game) {
      if (this.mounted) return false;
      if (!this.runtime || typeof this.runtime.ensureCanvas !== 'function') return false;
      const canvas = this.runtime.ensureCanvas();
      if (!canvas) return false;
      this.createRenderer(canvas);
      this.mounted = true;
      this.lastGame = game || null;
      const shouldHoldInitialLoading = Boolean(game?.token && !game?.hasServerState);
      if (shouldHoldInitialLoading) {
        this.loading = {
          visible: true,
          percentage: 0,
          message: '\u6b63\u5728\u6574\u7406\u5927\u5730\u56fe',
        };
      }
      if (game?.authView) this.applyAuthShell(game.authView);
      if (game?.authCredentials) this.applyCredentials(game.authCredentials);
      if (this.runtime?.onResize && !this.resizeDisposer) {
        this.resizeDisposer = this.runtime.onResize((size) => this.handleResize(size));
      }
      this.bindInput();
      this.renderActive();
      return true;
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellMounting = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
