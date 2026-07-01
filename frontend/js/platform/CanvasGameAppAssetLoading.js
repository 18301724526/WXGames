(function (global) {
  // Loading-indicator + asset-preload cluster (showLoading/updateLoading/hideLoading,
  // preloadAssets, loadGameAssets) extracted from CanvasGameAppRenderingRuntime.
  // Pure this-scoped orchestration over the loading field, canvasShell, renderer,
  // and the base now()/wait() scheduler methods; no module-level deps.
  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      showLoading(message = '') {
        this.loading = {
          visible: true,
          percentage: 0,
          message: message || '正在整理营地资源',
        };
        this.canvasShell?.showLoading?.(this.loading.message);
        this.renderCanvasSurface();
        return true;
      },

      updateLoading(progress = {}) {
        if (!this.loading.visible && !this.canvasShell?.loading?.visible) return false;
        this.loading = {
          ...this.loading,
          visible: true,
          percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
          message: progress.message || this.loading.message,
        };
        this.canvasShell?.updateLoading?.(this.loading);
        this.renderCanvasSurface();
        return true;
      },

      hideLoading() {
        const hadLoading = Boolean(this.loading.visible || this.canvasShell?.loading?.visible);
        this.loading = {
          visible: false,
          percentage: 100,
          message: '',
        };
        this.canvasShell?.hideLoading?.();
        if (hadLoading) this.renderCanvasSurface();
        return hadLoading;
      },

      preloadAssets(onProgress = null, assetPaths = null) {
        if (this.canvasShell && typeof this.canvasShell.preloadAssets === 'function') {
          return this.canvasShell.preloadAssets(onProgress, assetPaths);
        }
        if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
          onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
          return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        }
        return this.renderer.preloadAssets(assetPaths || undefined, onProgress);
      },

      async loadGameAssets(options = {}) {
        const message = options.message || '正在整理营地资源';
        const hideWhenDone = options.hideWhenDone !== false;
        const minimumDurationMs = Number.isFinite(options.minimumDurationMs)
          ? Math.max(0, options.minimumDurationMs)
          : 3000;
        const trace = this.loadTrace || null;
        const startedAt = this.now();
        trace?.phaseStart?.('assets:preload', {
          message,
          hideWhenDone,
          minimumDurationMs,
        });
        this.showLoading(message);
        try {
          const result = await this.preloadAssets((progress) => {
            const progressMessage = progress?.message || message;
            trace?.progress?.('assets:preload', { ...progress, message: progressMessage });
            this.updateLoading({ ...progress, message: progressMessage });
          }, options.assetPaths || null);
          const elapsed = Math.max(0, this.now() - startedAt);
          const minimumWaitMs = Math.max(0, minimumDurationMs - elapsed);
          trace?.phaseEnd?.('assets:preload', {
            ...result,
            minimumWaitMs,
          });
          if (minimumWaitMs > 0) {
            trace?.mark?.('assets:minimum-wait', {
              waitMs: Math.round(minimumWaitMs),
              reason: 'loading screen minimum duration',
            });
          }
          await this.wait(minimumWaitMs);
          return result;
        } catch (error) {
          trace?.phaseFail?.('assets:preload', error);
          throw error;
        } finally {
          this.updateLoading({ percentage: 100, message: '资源准备完成' });
          if (hideWhenDone) this.hideLoading();
        }
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppAssetLoading = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
