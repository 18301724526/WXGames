(function (global) {
  const sharedTileMapManifest = (() => {
    if (global.TileMapAssetManifest) return global.TileMapAssetManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/TileMapAssetManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasAssetRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) return host[prop];
            if (prop in host) {
              const hostValue = host[prop];
              return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
            }
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          const host = target.host;
          if (host) {
            if (typeof prop === 'string' && prop.startsWith('worldTile')) {
              host[prop] = value;
              return true;
            }
            if (prop in host) {
              host[prop] = value;
              return true;
            }
          }
          target[prop] = value;
          return true;
        },
      });
    }

    static getTileMapAssetManifest() {
      return sharedTileMapManifest || {};
    }

    preloadAssets(assetPaths = this.getPreloadAssetPaths(), onProgress = null, options = {}) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const total = paths.length;
      const report = typeof onProgress === 'function' ? onProgress : null;
      const preloadOptions = options && typeof options === 'object' ? options : {};
      if (!total) {
        report?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }

      let completed = 0;
      let loaded = 0;
      let failed = 0;
      const notify = (assetPath, status) => {
        const percentage = Math.round((completed / total) * 100);
        report?.({ total, completed, loaded, failed, percentage, assetPath, status });
      };

      return new Promise((resolve) => {
        const settle = (assetPath, status) => {
          completed += 1;
          if (status === 'loaded') loaded += 1;
          else failed += 1;
          notify(assetPath, status);
          if (completed >= total) {
            if (preloadOptions.deferPrewarm === false) {
              this.prewarmWorldTileCaches(paths);
            } else if (preloadOptions.deferPrewarm === true || preloadOptions.prewarm) {
              this.scheduleWorldTileCachePrewarm(paths, preloadOptions.prewarm || preloadOptions);
            }
            resolve({ total, completed, loaded, failed, percentage: 100 });
          }
        };

        notify('', 'start');
        paths.forEach((assetPath) => {
          const cached = this.assetCache.get(assetPath);
          if (cached?.status === 'loaded') {
            settle(assetPath, 'loaded');
            return;
          }
          if (cached?.status === 'error') {
            settle(assetPath, 'error');
            return;
          }

          const image = cached?.image || this.createImage(assetPath);
          if (!image) {
            this.assetCache.set(assetPath, { status: 'error', image: null });
            settle(assetPath, 'error');
            return;
          }

          const record = cached || { status: 'loading', image };
          if (!cached) this.assetCache.set(assetPath, record);
          const previousOnload = image.onload;
          const previousOnerror = image.onerror;
          let settled = false;
          const complete = (status, handler, event) => {
            if (settled) return;
            settled = true;
            record.status = status;
            if (status === 'loaded') this.handleAssetsChanged();
            if (typeof handler === 'function') handler.call(image, event);
            settle(assetPath, status);
          };
          image.onload = (event) => complete('loaded', previousOnload, event);
          image.onerror = (event) => complete('error', previousOnerror, event);
          const requestPath = this.host?.constructor?.getAssetRequestPath
            ? this.host.constructor.getAssetRequestPath(assetPath)
            : assetPath;
          if (!cached) image.src = requestPath;
          else if (!image.src) image.src = requestPath;
        });
      });
    }

    getWorldTileCachePrewarmCandidatePaths(assetPaths = this.getPreloadAssetPaths()) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      return paths.filter((assetPath) => {
        const cached = this.assetCache.get(assetPath);
        if (cached?.status !== 'loaded') return false;
        return this.isWorldTilePrewarmMetricAssetPath(assetPath)
          || this.isWorldTileTemplateAssetPath(assetPath);
      });
    }

    prewarmWorldTileCacheAsset(assetPath = '', result = { total: 0, metrics: 0, masks: 0, dryTemplates: 0 }) {
      const cached = this.assetCache.get(assetPath);
      if (cached?.status !== 'loaded') return result;
      if (this.isWorldTilePrewarmMetricAssetPath(assetPath) && !this.assetMetricsCache.has(assetPath)) {
        if (this.analyzeAssetAlphaBounds(assetPath)) result.metrics += 1;
      }
      if (!this.isWorldTileTemplateAssetPath(assetPath)) return result;
      const hadMask = this.worldTileMaskCache.has(assetPath);
      const mask = this.getWorldTileTemplateMask(assetPath);
      if (mask && !hadMask) result.masks += 1;
      if (!this.isWorldTileWaterTemplateAssetPath(assetPath)) return result;
      const hadDryTemplate = this.worldTileDryCompositeCache.has(assetPath);
      const dryTemplate = this.getWorldTileDryTemplateCanvas(assetPath);
      if (dryTemplate && !hadDryTemplate) result.dryTemplates += 1;
      return result;
    }

    isWorldTilePrewarmMetricAssetPath(assetPath = '') {
      const path = String(assetPath || '');
      return path.startsWith('assets/art/tile-map/')
        || path.startsWith('assets/art/world-site-');
    }

    isWorldTileTemplateAssetPath(assetPath = '') {
      return /^assets\/art\/tile-map\/(?:river-template|ocean-template|transition-template)\//.test(String(assetPath || ''));
    }

    isWorldTileWaterTemplateAssetPath(assetPath = '') {
      return /^assets\/art\/tile-map\/(?:river-template|ocean-template)\//.test(String(assetPath || ''));
    }

    prewarmWorldTileCaches(assetPaths = this.getPreloadAssetPaths()) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const result = { total: paths.length, metrics: 0, masks: 0, dryTemplates: 0 };
      this.getWorldTileCachePrewarmCandidatePaths(paths)
        .forEach((assetPath) => this.prewarmWorldTileCacheAsset(assetPath, result));
      return result;
    }

    getWorldTileCachePrewarmLoadingMessage(assetPath = '') {
      const path = String(assetPath || '');
      if (path.includes('/river-template/') || path.includes('/ocean-template/')) return '\u6b63\u5728\u51c6\u5907\u6c34\u9762\u6a21\u677f';
      if (path.includes('/transition-template/')) return '\u6b63\u5728\u751f\u6210\u5730\u5757\u8fc7\u6e21\u7f13\u5b58';
      if (path.startsWith('assets/art/world-site-')) return '\u6b63\u5728\u51c6\u5907\u636e\u70b9\u8d44\u6e90';
      if (path.startsWith('assets/art/tile-map/')) return '\u6b63\u5728\u51c6\u5907\u5927\u5730\u56fe\u8d44\u6e90';
      return '\u6b63\u5728\u751f\u6210\u5730\u5757\u7f13\u5b58';
    }

    getWorldTileCachePrewarmLoadingChunkDelayMs() {
      return 16;
    }

    waitForWorldTileCachePrewarmLoadingChunk(delayMs = 0) {
      const host = this.getWorldTileCachePrewarmTimerHost();
      const setDelay = typeof host?.setTimeout === 'function' ? host.setTimeout : global.setTimeout;
      if (typeof setDelay !== 'function' || delayMs <= 0) return Promise.resolve();
      return new Promise((resolve) => {
        setDelay.call(host, resolve, delayMs);
      });
    }

    async prewarmWorldTileCachesForLoading(assetPaths = this.getPreloadAssetPaths(), onProgress = null, options = {}) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const candidates = this.getWorldTileCachePrewarmCandidatePaths(paths);
      const result = {
        total: paths.length,
        candidateTotal: candidates.length,
        completed: 0,
        percentage: candidates.length ? 0 : 100,
        metrics: 0,
        masks: 0,
        dryTemplates: 0,
      };
      const report = typeof onProgress === 'function' ? onProgress : null;
      const trace = global.H5LoadTrace;
      const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? this.getWorldTileCachePrewarmChunkSize()) || 1));
      const betweenChunksMs = Math.max(0, Number(options.betweenChunksMs ?? this.getWorldTileCachePrewarmLoadingChunkDelayMs()) || 0);
      const notify = (assetPath = '', status = 'prewarm') => {
        const percentage = candidates.length
          ? Math.round((result.completed / candidates.length) * 100)
          : 100;
        result.percentage = percentage;
        const event = {
          phase: 'assets:prewarm',
          status,
          total: result.total,
          candidateTotal: result.candidateTotal,
          completed: result.completed,
          percentage,
          assetPath,
          message: this.getWorldTileCachePrewarmLoadingMessage(assetPath),
          metrics: result.metrics,
          masks: result.masks,
          dryTemplates: result.dryTemplates,
        };
        report?.(event);
        trace?.progress?.('assets:prewarm', event);
      };

      this.cancelWorldTileCachePrewarmTask();
      trace?.phaseStart?.('assets:prewarm', {
        total: result.total,
        candidateTotal: result.candidateTotal,
        chunkSize,
        betweenChunksMs,
      });
      notify(candidates[0] || '', 'start');

      try {
        for (let index = 0; index < candidates.length;) {
          let processed = 0;
          while (index < candidates.length && processed < chunkSize) {
            const assetPath = candidates[index];
            this.prewarmWorldTileCacheAsset(assetPath, result);
            index += 1;
            processed += 1;
            result.completed = index;
            notify(assetPath, 'prewarm');
          }
          if (index < candidates.length) {
            await this.waitForWorldTileCachePrewarmLoadingChunk(betweenChunksMs);
          }
        }
        trace?.phaseEnd?.('assets:prewarm', {
          total: result.total,
          candidateTotal: result.candidateTotal,
          completed: result.completed,
          metrics: result.metrics,
          masks: result.masks,
          dryTemplates: result.dryTemplates,
          forceLog: true,
        });
        notify(candidates[candidates.length - 1] || '', 'complete');
        return { ...result, percentage: 100 };
      } catch (error) {
        trace?.phaseFail?.('assets:prewarm', error);
        throw error;
      }
    }

    getWorldTileCachePrewarmTimerHost() {
      return this.h5Runtime?.runtime
        || this.h5Runtime
        || this.runtime?.runtime
        || this.runtime
        || global;
    }

    getWorldTileCachePrewarmNow() {
      const host = this.getWorldTileCachePrewarmTimerHost();
      const perfNow = host?.performance?.now?.();
      if (Number.isFinite(perfNow)) return perfNow;
      const runtimeNow = host?.now?.();
      if (Number.isFinite(runtimeNow)) return runtimeNow;
      return Date.now();
    }

    getWorldTileCachePrewarmChunkSize() {
      const nav = global.navigator || {};
      const cores = Number(nav.hardwareConcurrency) || 0;
      const memory = Number(nav.deviceMemory) || 0;
      if ((cores && cores <= 4) || (memory && memory <= 4)) return 1;
      return 2;
    }

    getWorldTileCachePrewarmInitialDelayMs() {
      const nav = global.navigator || {};
      const cores = Number(nav.hardwareConcurrency) || 0;
      const memory = Number(nav.deviceMemory) || 0;
      if ((cores && cores <= 4) || (memory && memory <= 4)) return 8000;
      if ((cores && cores <= 6) || (memory && memory <= 6)) return 5000;
      return 3000;
    }

    getWorldTileCachePrewarmBetweenChunksMs() {
      const nav = global.navigator || {};
      const cores = Number(nav.hardwareConcurrency) || 0;
      const memory = Number(nav.deviceMemory) || 0;
      if ((cores && cores <= 4) || (memory && memory <= 4)) return 850;
      if ((cores && cores <= 6) || (memory && memory <= 6)) return 450;
      return 180;
    }

    cancelWorldTileCachePrewarmTask() {
      const task = this.worldTileCachePrewarmTask;
      if (!task) return false;
      task.cancelled = true;
      const host = task.host || this.getWorldTileCachePrewarmTimerHost();
      if (task.timer && typeof host?.clearTimeout === 'function') {
        host.clearTimeout(task.timer);
      }
      this.worldTileCachePrewarmTask = null;
      return true;
    }

    scheduleWorldTileCachePrewarm(assetPaths = this.getPreloadAssetPaths(), options = {}) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const candidates = this.getWorldTileCachePrewarmCandidatePaths(paths);
      const result = {
        total: paths.length,
        candidateTotal: candidates.length,
        scheduled: false,
        metrics: 0,
        masks: 0,
        dryTemplates: 0,
      };
      if (!candidates.length) return result;

      this.cancelWorldTileCachePrewarmTask();
      const host = this.getWorldTileCachePrewarmTimerHost();
      const setDelay = typeof host?.setTimeout === 'function' ? host.setTimeout : global.setTimeout;
      if (typeof setDelay !== 'function') {
        candidates.forEach((assetPath) => this.prewarmWorldTileCacheAsset(assetPath, result));
        return result;
      }

      const initialDelayMs = Math.max(0, Number(options.initialDelayMs ?? options.delayMs ?? this.getWorldTileCachePrewarmInitialDelayMs()) || 0);
      const betweenChunksMs = Math.max(0, Number(options.betweenChunksMs ?? this.getWorldTileCachePrewarmBetweenChunksMs()) || 0);
      const chunkSize = Math.max(1, Math.floor(Number(options.chunkSize ?? this.getWorldTileCachePrewarmChunkSize()) || 1));
      const task = {
        cancelled: false,
        host,
        timer: null,
      };
      this.worldTileCachePrewarmTask = task;
      result.scheduled = true;

      const trace = global.H5LoadTrace;
      trace?.phaseStart?.('assets:prewarm:deferred', {
        total: result.total,
        candidateTotal: result.candidateTotal,
        chunkSize,
        initialDelayMs,
        betweenChunksMs,
      });

      let index = 0;
      const runChunk = () => {
        if (task.cancelled) return;
        const chunkStartedAt = this.getWorldTileCachePrewarmNow();
        let processed = 0;
        while (index < candidates.length && processed < chunkSize) {
          this.prewarmWorldTileCacheAsset(candidates[index], result);
          index += 1;
          processed += 1;
        }
        if (index < candidates.length) {
          task.timer = setDelay.call(host, runChunk, betweenChunksMs);
          return;
        }
        this.worldTileCachePrewarmTask = null;
        trace?.phaseEnd?.('assets:prewarm:deferred', {
          total: result.total,
          candidateTotal: result.candidateTotal,
          metrics: result.metrics,
          masks: result.masks,
          dryTemplates: result.dryTemplates,
          lastChunkMs: Math.max(0, Math.round(this.getWorldTileCachePrewarmNow() - chunkStartedAt)),
          forceLog: true,
        });
      };

      task.timer = setDelay.call(host, runChunk, initialDelayMs);
      return result;
    }

    getAsset(assetPath) {
      if (!assetPath) return null;
      const cached = this.assetCache.get(assetPath);
      if (cached) return cached.status === 'loaded' ? cached.image : null;

      const image = this.createImage(assetPath);
      if (!image) {
        this.assetCache.set(assetPath, { status: 'error', image: null });
        return null;
      }

      const record = { status: 'loading', image };
      this.assetCache.set(assetPath, record);
      image.onload = () => {
        record.status = 'loaded';
        this.handleAssetsChanged();
      };
      image.onerror = () => {
        record.status = 'error';
      };
      const requestPath = this.host?.constructor?.getAssetRequestPath
        ? this.host.constructor.getAssetRequestPath(assetPath)
        : assetPath;
      image.src = requestPath;
      return null;
    }

    setAssetsChangedHandler(handler) {
      this.assetsChangedHandler = typeof handler === 'function' ? handler : null;
    }

    handleAssetsChanged() {
      this.invalidateWorldTileCaches();
      if (this.assetsChangedHandler) this.assetsChangedHandler();
    }

    invalidateWorldTileCaches() {
      this.worldTileStaticCache = null;
      this.worldTileStaticCacheKey = '';
      this.worldTileStaticCacheLayoutKind = '';
      this.worldTileStaticCacheLayout = null;
      this.worldTileStaticChunkCaches?.clear?.();
      this.worldTileStaticChunkCacheTick = 0;
      this.worldTileWaterLayerCache = null;
      this.worldTileWaterLayerCacheKey = '';
      this.worldTileWaterFrameCaches?.clear?.();
      this.worldTileWaterChunkCaches?.clear?.();
      this.worldTileWaterChunkCacheTick = 0;
      this.worldTileFastDragComposite = null;
      this.worldTileFastDragCompositeCache = null;
      this.invalidateWorldTileViewCache();
    }

    hasPreparedWorldTileSnapshotCache() {
      return Boolean(
        (this.worldTileStaticCache?.canvas && this.worldTileStaticCacheLayout?.frame)
        || (this.worldTileStaticCacheLayoutKind === 'chunks' && this.worldTileStaticChunkCaches?.size),
      );
    }

    invalidateWorldTileViewCache() {
      this.worldTileViewCache = null;
      this.worldTileVisibleEntriesCache = null;
      this.worldTileLocalEntriesCache = null;
    }

    drawAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawAssetClipped(assetPath, sourceRect, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const sourceWidth = Number(image.naturalWidth || image.width || 0);
      const sourceHeight = Number(image.naturalHeight || image.height || 0);
      const sx = Math.max(0, Number(sourceRect?.x) || 0);
      const sy = Math.max(0, Number(sourceRect?.y) || 0);
      const sw = Math.max(1, Number(sourceRect?.width) || sourceWidth || 1);
      const sh = Math.max(1, Number(sourceRect?.height) || sourceHeight || 1);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    getFallbackAssetMetrics(image) {
      const width = Number(image?.naturalWidth || image?.width || 1) || 1;
      const height = Number(image?.naturalHeight || image?.height || 1) || 1;
      return { x: 0, y: 0, width, height, sourceWidth: width, sourceHeight: height };
    }

    isOpaquePixel(data, index) {
      return data[index + 3] > 8;
    }

    isWorldTileTemplateWaterPixel(data, index) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const alpha = data[index + 3];
      if (alpha <= 56 || blue <= 70) return false;
      return blue > red + 12 && blue > green - 3 && (green > red + 18 || blue > 112);
    }

    measurePixelBounds(data, width, height, predicate) {
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;
      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          const index = (py * width + px) * 4;
          if (!predicate(data, index)) continue;
          count += 1;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
      if (maxX < minX || maxY < minY) return null;
      return {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        count,
        sourceWidth: width,
        sourceHeight: height,
      };
    }

    analyzeAssetAlphaBounds(assetPath = '') {
      if (!assetPath) return null;
      const cached = this.assetMetricsCache.get(assetPath);
      if (cached) return cached;
      const image = this.getAsset(assetPath);
      const fallback = this.getFallbackAssetMetrics(image);
      if (!image) return fallback;
      const canvas = this.createTileWorkCanvas(fallback.sourceWidth, fallback.sourceHeight);
      const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
      if (!canvas || !ctx) {
        this.assetMetricsCache.set(assetPath, fallback);
        return fallback;
      }
      try {
        ctx.clearRect?.(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const metrics = this.measurePixelBounds(data, canvas.width, canvas.height, this.isOpaquePixel) || fallback;
        this.assetMetricsCache.set(assetPath, metrics);
        return metrics;
      } catch (_) {
        this.assetMetricsCache.set(assetPath, fallback);
        return fallback;
      }
    }

    getIsoTileSourceRect(assetPath = '') {
      return this.getWorldTileTemplateMetrics({ asset: assetPath });
    }

    getWorldTileTemplateMetrics(template = {}) {
      const assetPath = typeof template === 'string' ? template : template.asset;
      if (!assetPath || !String(assetPath).startsWith('assets/art/tile-map/')) return null;
      if (String(assetPath).includes('/ocean-template/') || String(assetPath).includes('/transition-template/')) {
        const manifest = this.constructor.getTileMapAssetManifest();
        const plains = manifest.getTerrainAsset?.('plains') || manifest.terrain?.plains;
        if (plains?.path) return this.analyzeAssetAlphaBounds(plains.path);
      }
      return this.analyzeAssetAlphaBounds(assetPath);
    }

    drawTileAsset(assetPath, x, y, width, height, alpha = 1) {
      const sourceRect = this.getIsoTileSourceRect(assetPath);
      if (sourceRect) return this.drawAssetClipped(assetPath, sourceRect, x, y, width, height, alpha);
      return this.drawAsset(assetPath, x, y, width, height, alpha);
    }

    getTemplateCanvasFactory() {
      const doc = this.canvas?.ownerDocument || (typeof document !== 'undefined' ? document : null);
      if (doc?.createElement) return () => doc.createElement('canvas');
      if (typeof global.OffscreenCanvas === 'function') return (width = 1, height = 1) => new global.OffscreenCanvas(width, height);
      if (typeof OffscreenCanvas === 'function') return (width = 1, height = 1) => new OffscreenCanvas(width, height);
      return null;
    }

    createTileWorkCanvas(width, height) {
      const factory = this.getTemplateCanvasFactory();
      if (!factory) return null;
      const canvas = factory(width, height);
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    drawCanvasClipped(sourceCanvas, sourceRect, x, y, width, height, alpha = 1) {
      if (!sourceCanvas || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(
        sourceCanvas,
        Number(sourceRect?.x) || 0,
        Number(sourceRect?.y) || 0,
        Number(sourceRect?.width) || Number(sourceCanvas.width) || 1,
        Number(sourceRect?.height) || Number(sourceCanvas.height) || 1,
        x,
        y,
        width,
        height,
      );
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawCoverAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const sourceWidth = Number(image.naturalWidth || image.width);
      const sourceHeight = Number(image.naturalHeight || image.height);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      if (sourceWidth > 0 && sourceHeight > 0) {
        const sourceRatio = sourceWidth / sourceHeight;
        const targetRatio = width / height;
        let sx = 0;
        let sy = 0;
        let sw = sourceWidth;
        let sh = sourceHeight;
        if (sourceRatio > targetRatio) {
          sw = sourceHeight * targetRatio;
          sx = (sourceWidth - sw) / 2;
        } else {
          sh = sourceWidth / targetRatio;
          sy = (sourceHeight - sh) / 2;
        }
        this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
      } else {
        this.ctx.drawImage(image, x, y, width, height);
      }
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }
  }

  global.CanvasAssetRenderer = CanvasAssetRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasAssetRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
