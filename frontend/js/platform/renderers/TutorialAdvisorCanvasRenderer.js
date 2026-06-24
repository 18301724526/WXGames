(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TUTORIAL_ADVISOR_SPINE_ALPHA = 1;
  const TUTORIAL_SPINE_LAYER_NAME = 'tutorialSpine';

  const CanvasLayerRegistry = (() => {
    if (global.CanvasLayerRegistry) return global.CanvasLayerRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../CanvasLayerRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class TutorialAdvisorCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    disposeTutorialAdvisorSpine() {
      const existing = this.tutorialAdvisorSpine;
      if (!existing) return false;
      existing.player?.dispose?.();
      existing.player?.stop?.();
      this.tutorialAdvisorSpine = null;
      if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, false);
      else this.h5Runtime?.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, false);
      return true;
    }

    renderTutorialIntroAdvisorPortrait(x, y, width, height) {
      if (this.renderTutorialAdvisorSpineLayer(x, y, width, height)) return true;
      const image = this.getAsset('assets/art/spine/tutorial/advisor/tutorial_advisor.png');
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.rect?.(x, y, width, height);
      this.ctx.clip?.();
      if (image && typeof this.ctx.drawImage === 'function') {
        this.drawTutorialAdvisorImageCover(
          image,
          0,
          0,
          image.naturalWidth || image.width,
          Math.min(1120, image.naturalHeight || image.height),
          x,
          y,
          width,
          height,
        );
      } else {
        this.drawPanel(x + 8, y + 20, width - 16, height - 22, {
          fill: 'rgba(48, 37, 28, 0.92)',
          stroke: 'rgba(255, 218, 142, 0.28)',
          radius: 10,
        });
        this.drawText(this.t('tutorial.advisorName', {}), x + width / 2, y + height / 2, {
          size: 15,
          bold: true,
          color: '#ffd98a',
          align: 'center',
          baseline: 'middle',
        });
      }
      this.ctx.restore?.();
      return false;
    }

    normalizeSpineLayerRect(x, y, width, height) {
      const runtime = this.h5Runtime || null;
      const runtimeWidth = Math.max(1, Number(runtime?.width || this.width) || 1);
      const runtimeHeight = Math.max(1, Number(runtime?.height || this.height) || 1);
      const rect = {
        x: Math.max(0, Math.floor(Number(x) || 0)),
        y: Math.max(0, Math.floor(Number(y) || 0)),
        width: Math.max(1, Math.ceil(Number(width) || runtimeWidth)),
        height: Math.max(1, Math.ceil(Number(height) || runtimeHeight)),
      };
      rect.x = Math.min(rect.x, runtimeWidth - 1);
      rect.y = Math.min(rect.y, runtimeHeight - 1);
      rect.width = Math.max(1, Math.min(rect.width, runtimeWidth - rect.x));
      rect.height = Math.max(1, Math.min(rect.height, runtimeHeight - rect.y));
      return rect;
    }

    fitSpineBoundsToRect(rect = {}, bounds = null) {
      const base = this.normalizeSpineLayerRect(rect.x, rect.y, rect.width, rect.height);
      const aspectRatio = Number(bounds?.aspectRatio || bounds?.width / Math.max(1, bounds?.height));
      if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return base;
      const baseAspect = base.width / Math.max(1, base.height);
      if (Math.abs(baseAspect - aspectRatio) < 0.015) return base;
      if (baseAspect > aspectRatio) {
        const nextWidth = Math.max(1, Math.round(base.height * aspectRatio));
        return {
          x: base.x + Math.max(0, Math.round((base.width - nextWidth) / 2)),
          y: base.y,
          width: Math.min(base.width, nextWidth),
          height: base.height,
        };
      }
      const nextHeight = Math.max(1, Math.round(base.width / aspectRatio));
      return {
        x: base.x,
        y: base.y + Math.max(0, Math.round((base.height - nextHeight) / 2)),
        width: base.width,
        height: Math.min(base.height, nextHeight),
      };
    }

    ensureTutorialSpineLayerCanvas(rect = {}) {
      const runtime = this.h5Runtime || null;
      const canEnsureLayer = typeof this.ensureCanvasLayer === 'function'
        || typeof runtime?.ensureLayerCanvas === 'function';
      if (!canEnsureLayer || !global.SpineWebglPlayer?.isAvailable?.()) return false;
      const pixelRatio = Math.min(2, Math.max(1, Number(global.devicePixelRatio) || 1));
      const layerRect = this.normalizeSpineLayerRect(rect.x, rect.y, rect.width, rect.height);
      const overrides = {
        pixelRatio,
        rect: layerRect,
      };
      const canvas = typeof this.ensureCanvasLayer === 'function'
        ? this.ensureCanvasLayer(TUTORIAL_SPINE_LAYER_NAME, overrides)
        : runtime.ensureLayerCanvas(
          TUTORIAL_SPINE_LAYER_NAME,
          CanvasLayerRegistry?.getLayerOptions?.(TUTORIAL_SPINE_LAYER_NAME, overrides) || overrides,
        );
      return canvas ? { canvas, layerRect, pixelRatio } : null;
    }

    renderTutorialAdvisorSpineLayer(x, y, width, height) {
      const runtime = this.h5Runtime || null;
      const targetRect = this.normalizeSpineLayerRect(x, y, width, height);
      const currentBounds = this.tutorialAdvisorSpine?.player?.getBoundsSummary?.() || null;
      const fittedRect = this.fitSpineBoundsToRect(targetRect, currentBounds);
      const layer = this.ensureTutorialSpineLayerCanvas(fittedRect);
      if (!layer) return false;
      const { canvas, layerRect, pixelRatio } = layer;
      if (!canvas) return false;
      if (canvas.style) canvas.style.opacity = String(TUTORIAL_ADVISOR_SPINE_ALPHA);
      if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, true);
      else runtime.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, true);
      const metrics = runtime.getLayerMetrics?.(TUTORIAL_SPINE_LAYER_NAME) || {};
      const logicalWidth = metrics.width || layerRect.width;
      const logicalHeight = metrics.height || layerRect.height;
      const existing = this.tutorialAdvisorSpine;
      if (existing?.mode === 'layer' && existing?.player && existing.canvas === canvas) {
        existing.player.logicalWidth = logicalWidth;
        existing.player.logicalHeight = logicalHeight;
        existing.player.maxDevicePixelRatio = pixelRatio;
        existing.targetRect = targetRect;
        existing.layerRect = layerRect;
        existing.player.resize?.();
        return existing.player.status === 'ready' || existing.player.status === 'loading';
      }
      existing?.player?.dispose?.();
      const player = new global.SpineWebglPlayer({
        canvas,
        runtime: global,
        background: null,
        fitPadding: 1,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        maxDevicePixelRatio: pixelRatio,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        onBounds: (event = {}) => {
          const nextRect = this.fitSpineBoundsToRect(this.tutorialAdvisorSpine?.targetRect || targetRect, event.bounds);
          const nextLayer = this.ensureTutorialSpineLayerCanvas(nextRect);
          if (!nextLayer || this.tutorialAdvisorSpine?.canvas !== nextLayer.canvas) return;
          this.tutorialAdvisorSpine.layerRect = nextLayer.layerRect;
          player.logicalWidth = nextLayer.layerRect.width;
          player.logicalHeight = nextLayer.layerRect.height;
          player.resize?.();
        },
        onError: () => {
          this.tutorialAdvisorSpineFailed = true;
          if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, false);
          else runtime.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, false);
        },
        onStatus: (event = {}) => {
          if (event.status === 'ready') {
            if (typeof this.requestOverlayRenderFrame === 'function') this.requestOverlayRenderFrame();
          }
        },
      });
      this.tutorialAdvisorSpine = { canvas, player, mode: 'layer', targetRect, layerRect };
      const loaded = player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
        antialias: true,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        maxDevicePixelRatio: pixelRatio,
        preserveDrawingBuffer: false,
      });
      if (!loaded) {
        this.tutorialAdvisorSpineFailed = true;
        this.tutorialAdvisorSpine = null;
        if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, false);
        else runtime.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, false);
        return false;
      }
      return true;
    }

    drawTutorialAdvisorImageCover(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
      let sourceX = Number(sx) || 0;
      let sourceY = Number(sy) || 0;
      let sourceW = Math.max(1, Number(sw) || image.width || image.naturalWidth || 1);
      let sourceH = Math.max(1, Number(sh) || image.height || image.naturalHeight || 1);
      const targetW = Math.max(1, Number(dw) || 1);
      const targetH = Math.max(1, Number(dh) || 1);
      const sourceAspect = sourceW / sourceH;
      const targetAspect = targetW / targetH;
      if (sourceAspect > targetAspect) {
        const nextW = sourceH * targetAspect;
        sourceX += (sourceW - nextW) * 0.5;
        sourceW = nextW;
      } else if (sourceAspect < targetAspect) {
        const nextH = sourceW / targetAspect;
        sourceY += Math.max(0, (sourceH - nextH) * 0.08);
        sourceH = nextH;
      }
      this.ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, dx, dy, targetW, targetH);
      return true;
    }
  }

  global.TutorialAdvisorCanvasRenderer = TutorialAdvisorCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialAdvisorCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
